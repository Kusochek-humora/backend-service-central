import { FastifyInstance } from "fastify";
import { EntityManager } from "typeorm";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { QuizGame, QuizQuestion, QuizQuestionMedia, QuizRound, QuizTheme } from "../../db/entities/quiz/quiz.entity";
import { QuizAuth } from "./auth";
import { bearerAuth, idParams, notFound, pageParams, paginationQuery, validationError } from "./common";
import { KIND_NAMES, KINDS, getKind } from "./kinds";
import { blocksSchema } from "./kinds/types";
import { collectMediaIds, syncQuestionMedia } from "./media.service";
import { assertGameEditable, loadGame, touchGame } from "./repo";
import { ROUND_SETTINGS, ROUND_TYPES } from "./rounds";
import { docSchema, parseWith, skipAjv } from "./validation";
import { kindSettingsDocs, roundSettingsDocs } from "./apiDocs";

// ───────────────────────────── Схемы (zod) ─────────────────────────────

const gameInput = z.object({ title: z.string().min(1).max(200), description: z.string().max(2000).default("") });

const roundInput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  type: z.enum(ROUND_TYPES).default("standard"),
  settings: z.record(z.string(), z.unknown()).default({}),
});

const themeInput = z.object({ title: z.string().min(1).max(200) });

const questionInput = z.object({
  price: z.number().int().positive(),
  kind: z.enum(KIND_NAMES as [string, ...string[]]).default("standard"),
  /** зависит от kind; схемы всех механик: GET /kinds */
  settings: z.record(z.string(), z.unknown()).default({}),
  /** блоки вопроса, минимум один: { type: text|image|audio|video, text?, mediaId? } */
  content: blocksSchema,
  /** блоки ответа, минимум один */
  answerContent: blocksSchema,
  /** заметка ведущему, на экран не идёт */
  comment: z.string().max(5000).default(""),
  timeLimitSec: z.number().int().positive().max(3600).nullable().default(null),
});

const orderInput = z.object({ ids: z.array(z.uuid()).min(1) });

/** Документация тела вопроса: settings = схема выбранной механики (все схемы перечислены) */
function questionDoc(partial = false) {
  const d = docSchema(partial ? questionInput.partial() : questionInput);
  d.properties.settings = { description: "Зависит от kind. Схемы всех механик перечислены в anyOf; для каждой общий флаг noPenalty.", anyOf: kindSettingsDocs() };
  return d;
}
function roundDoc(partial = false) {
  const d = docSchema(partial ? roundInput.partial() : roundInput);
  d.properties.settings = { description: "standard: пусто. final: finalists ('leader' или N), mode (single_question | elimination).", anyOf: roundSettingsDocs() };
  return d;
}

type QuestionBody = z.infer<typeof questionInput>;

/** Проверяет настройки механики её zod-схемой и возвращает нормализованные (с подставленными значениями по умолчанию) */
function validateQuestion(body: QuestionBody) {
  const settings = parseWith(getKind(body.kind).settingsSchema as z.ZodType<Record<string, unknown>>, body.settings, "settings");
  return { ...body, settings };
}

function validateRound(body: z.infer<typeof roundInput>) {
  const settings = parseWith(ROUND_SETTINGS[body.type] as z.ZodType<Record<string, unknown>>, body.settings, "settings");
  return { ...body, settings };
}

async function nextOrder(em: EntityManager, table: string, col: string, id: string) {
  const [row] = await em.query(`SELECT COALESCE(MAX("order"), -1) + 1 AS n FROM ${table} WHERE "${col}" = $1`, [id]);
  return Number(row.n);
}

async function applyOrder(em: EntityManager, table: string, existingIds: string[], ids: string[]) {
  const same = ids.length === existingIds.length && new Set(ids).size === ids.length && ids.every((i) => existingIds.includes(i));
  if (!same) throw validationError("ids должны содержать ровно все существующие элементы без повторов");
  for (let i = 0; i < ids.length; i++) await em.query(`UPDATE ${table} SET "order" = $1, "updatedAt" = NOW() WHERE id = $2`, [i, ids[i]]);
}

const questionDto = (q: QuizQuestion) => ({
  id: q.id, themeId: q.themeId, order: q.order, price: q.price, kind: q.kind, settings: q.settings, content: q.content,
  answerContent: q.answerContent, comment: q.comment, timeLimitSec: q.timeLimitSec,
});

// ───────────────────────────── Роуты ─────────────────────────────

export async function quizContentRoutes(app: FastifyInstance, auth: QuizAuth) {
  const adminOnly = auth.guard(["admin"]);
  const adminOrHost = auth.guard(["admin", "host"]);
  const db = () => AppDataSource.manager;

  /** gameId по сущности + проверка, что игра не идёт */
  const gameOfRound = async (id: string) => {
    const r = await db().findOneBy(QuizRound, { id });
    if (!r) throw notFound("Раунд");
    await assertGameEditable(r.gameId);
    return r;
  };
  const gameOfTheme = async (id: string) => {
    const t = await db().findOneBy(QuizTheme, { id });
    if (!t) throw notFound("Тема");
    const r = await gameOfRound(t.roundId);
    return { theme: t, round: r };
  };

  // ── Справочник механик ──

  app.get("/kinds", {
    schema: { tags: ["Quiz Games"], summary: "Механики вопросов: JSON-схема settings и команды каждой (admin, host)", ...bearerAuth },
    preHandler: adminOrHost,
  }, async () => ({
    kinds: Object.values(KINDS).map((k) => ({
      kind: k.kind, settingsSchema: docSchema(k.settingsSchema), commands: Object.keys(k.commands),
      commandPhases: Object.fromEntries(Object.entries(k.commandRules).map(([c, r]) => [c, r.phase])),
    })),
    roundTypes: Object.entries(ROUND_SETTINGS).map(([type, schema]) => ({ type, settingsSchema: docSchema(schema) })),
  }));

  // ── Игры ──

  app.get("/games", {
    schema: { tags: ["Quiz Games"], summary: "Список игр (admin, host)", ...bearerAuth, querystring: { type: "object", properties: paginationQuery } },
    preHandler: adminOrHost,
  }, async (request) => {
    const { limit, offset } = pageParams(request.query);
    const items = await db().query(
      `SELECT g.id, g.title, g.description, g."createdAt", g."updatedAt",
         (SELECT COUNT(*) FROM quiz_rounds r WHERE r."gameId" = g.id)::int AS "roundsCount",
         (SELECT COUNT(*) FROM quiz_questions q JOIN quiz_themes t ON t.id = q."themeId" JOIN quiz_rounds r ON r.id = t."roundId" WHERE r."gameId" = g.id)::int AS "questionsCount"
       FROM quiz_games g ORDER BY g."updatedAt" DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return { items, total: await db().count(QuizGame) };
  });

  app.post("/games", {
    ...skipAjv,
    schema: { tags: ["Quiz Games"], summary: "Создать игру (admin)", ...bearerAuth, body: docSchema(gameInput) },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const body = parseWith(gameInput, request.body);
    const game = await db().save(QuizGame, db().create(QuizGame, body));
    return reply.status(201).send({ ...game, rounds: [] });
  });

  app.get("/games/:id", {
    schema: { tags: ["Quiz Games"], summary: "Игра целиком: раунды → темы → вопросы (admin, host)", ...bearerAuth, params: idParams },
    preHandler: adminOrHost,
  }, async (request) => {
    const game = await loadGame((request.params as { id: string }).id);
    if (!game) throw notFound("Игра");
    return game;
  });

  app.patch("/games/:id", {
    ...skipAjv,
    schema: { tags: ["Quiz Games"], summary: "Изменить название/описание (admin)", ...bearerAuth, params: idParams, body: docSchema(gameInput.partial()) },
    preHandler: adminOnly,
  }, async (request) => {
    const { id } = request.params as { id: string };
    const game = await db().findOneBy(QuizGame, { id });
    if (!game) throw notFound("Игра");
    await assertGameEditable(id);
    Object.assign(game, parseWith(gameInput.partial(), request.body));
    return db().save(QuizGame, game);
  });

  app.delete("/games/:id", {
    schema: { tags: ["Quiz Games"], summary: "Удалить игру со всем содержимым и её сессиями (admin)", ...bearerAuth, params: idParams },
    preHandler: adminOnly,
  }, async (request) => {
    const { id } = request.params as { id: string };
    if (!(await db().findOneBy(QuizGame, { id }))) throw notFound("Игра");
    await assertGameEditable(id);
    await db().delete(QuizGame, { id });
    return { ok: true };
  });

  app.post("/games/:id/duplicate", {
    schema: { tags: ["Quiz Games"], summary: "Дублировать игру (admin)", ...bearerAuth, params: idParams },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const src = await loadGame((request.params as { id: string }).id);
    if (!src) throw notFound("Игра");
    const newId = await AppDataSource.transaction(async (em) => {
      const game = await em.save(QuizGame, em.create(QuizGame, { title: `${src.title} (копия)`, description: src.description }));
      for (const r of src.rounds) {
        const round = await em.save(QuizRound, em.create(QuizRound, { gameId: game.id, order: r.order, title: r.title, description: r.description, type: r.type, settings: r.settings }));
        for (const t of r.themes) {
          const theme = await em.save(QuizTheme, em.create(QuizTheme, { roundId: round.id, order: t.order, title: t.title }));
          for (const q of t.questions) {
            const nq = await em.save(QuizQuestion, em.create(QuizQuestion, {
              themeId: theme.id, order: q.order, price: q.price, kind: q.kind, settings: q.settings, content: q.content,
              answerContent: q.answerContent, comment: q.comment, timeLimitSec: q.timeLimitSec,
            }));
            await syncQuestionMedia(em, nq.id, collectMediaIds(q.content, q.answerContent, q.settings));
          }
        }
      }
      return game.id;
    });
    return reply.status(201).send(await loadGame(newId));
  });

  // ── Раунды ──

  app.post("/games/:id/rounds", {
    ...skipAjv,
    schema: { tags: ["Quiz Rounds"], summary: "Добавить раунд (standard или final) в конец игры (admin)", ...bearerAuth, params: idParams, body: roundDoc() },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await db().findOneBy(QuizGame, { id }))) throw notFound("Игра");
    await assertGameEditable(id);
    const body = validateRound(parseWith(roundInput, request.body));
    const round = await AppDataSource.transaction(async (em) => {
      const r = await em.save(QuizRound, em.create(QuizRound, { ...body, gameId: id, order: await nextOrder(em, "quiz_rounds", "gameId", id) }));
      await touchGame(em, id);
      return r;
    });
    return reply.status(201).send({ ...round, themes: [] });
  });

  app.patch("/rounds/:id", {
    ...skipAjv,
    schema: { tags: ["Quiz Rounds"], summary: "Изменить раунд (admin)", ...bearerAuth, params: idParams, body: roundDoc(true) },
    preHandler: adminOnly,
  }, async (request) => {
    const round = await gameOfRound((request.params as { id: string }).id);
    const patch = parseWith(roundInput.partial(), request.body);
    const merged = validateRound(roundInput.parse({ ...round, ...patch, settings: patch.settings ?? (patch.type && patch.type !== round.type ? {} : round.settings) }));
    Object.assign(round, merged);
    return AppDataSource.transaction(async (em) => {
      const saved = await em.save(QuizRound, round);
      await touchGame(em, round.gameId);
      return saved;
    });
  });

  app.delete("/rounds/:id", {
    schema: { tags: ["Quiz Rounds"], summary: "Удалить раунд с темами и вопросами (admin)", ...bearerAuth, params: idParams },
    preHandler: adminOnly,
  }, async (request) => {
    const round = await gameOfRound((request.params as { id: string }).id);
    await db().delete(QuizRound, { id: round.id });
    await touchGame(db(), round.gameId);
    return { ok: true };
  });

  app.put("/games/:id/rounds/order", {
    ...skipAjv,
    schema: { tags: ["Quiz Rounds"], summary: "Порядок раундов: { ids } со всеми раундами игры (admin)", ...bearerAuth, params: idParams, body: docSchema(orderInput) },
    preHandler: adminOnly,
  }, async (request) => {
    const { id } = request.params as { id: string };
    if (!(await db().findOneBy(QuizGame, { id }))) throw notFound("Игра");
    await assertGameEditable(id);
    const { ids } = parseWith(orderInput, request.body);
    await AppDataSource.transaction(async (em) => {
      await applyOrder(em, "quiz_rounds", (await em.find(QuizRound, { where: { gameId: id } })).map((r) => r.id), ids);
      await touchGame(em, id);
    });
    return { ok: true };
  });

  // ── Темы ──

  app.post("/rounds/:id/themes", {
    ...skipAjv,
    schema: { tags: ["Quiz Themes"], summary: "Добавить тему (строку сетки) в раунд (admin)", ...bearerAuth, params: idParams, body: docSchema(themeInput) },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const round = await gameOfRound((request.params as { id: string }).id);
    const body = parseWith(themeInput, request.body);
    const theme = await AppDataSource.transaction(async (em) => {
      const t = await em.save(QuizTheme, em.create(QuizTheme, { roundId: round.id, title: body.title, order: await nextOrder(em, "quiz_themes", "roundId", round.id) }));
      await touchGame(em, round.gameId);
      return t;
    });
    return reply.status(201).send({ ...theme, questions: [] });
  });

  app.patch("/themes/:id", {
    ...skipAjv,
    schema: { tags: ["Quiz Themes"], summary: "Переименовать тему (admin)", ...bearerAuth, params: idParams, body: docSchema(themeInput) },
    preHandler: adminOnly,
  }, async (request) => {
    const { theme, round } = await gameOfTheme((request.params as { id: string }).id);
    theme.title = parseWith(themeInput, request.body).title;
    const saved = await db().save(QuizTheme, theme);
    await touchGame(db(), round.gameId);
    return saved;
  });

  app.delete("/themes/:id", {
    schema: { tags: ["Quiz Themes"], summary: "Удалить тему с вопросами (admin)", ...bearerAuth, params: idParams },
    preHandler: adminOnly,
  }, async (request) => {
    const { theme, round } = await gameOfTheme((request.params as { id: string }).id);
    await db().delete(QuizTheme, { id: theme.id });
    await touchGame(db(), round.gameId);
    return { ok: true };
  });

  app.put("/rounds/:id/themes/order", {
    ...skipAjv,
    schema: { tags: ["Quiz Themes"], summary: "Порядок тем: { ids } со всеми темами раунда (admin)", ...bearerAuth, params: idParams, body: docSchema(orderInput) },
    preHandler: adminOnly,
  }, async (request) => {
    const round = await gameOfRound((request.params as { id: string }).id);
    const { ids } = parseWith(orderInput, request.body);
    await AppDataSource.transaction(async (em) => {
      await applyOrder(em, "quiz_themes", (await em.find(QuizTheme, { where: { roundId: round.id } })).map((t) => t.id), ids);
      await touchGame(em, round.gameId);
    });
    return { ok: true };
  });

  // ── Вопросы ──

  app.post("/themes/:id/questions", {
    ...skipAjv,
    schema: {
      tags: ["Quiz Questions"],
      summary: "Добавить вопрос в тему (admin)",
      description: "kind и settings: см. GET /kinds. content и answerContent: массивы блоков, минимум по одному. Файлы указываются через mediaId (POST /media).",
      ...bearerAuth, params: idParams, body: questionDoc(),
    },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { theme, round } = await gameOfTheme((request.params as { id: string }).id);
    const body = validateQuestion(parseWith(questionInput, request.body));
    const created = await AppDataSource.transaction(async (em) => {
      const q = await em.save(QuizQuestion, em.create(QuizQuestion, { ...body, themeId: theme.id, order: await nextOrder(em, "quiz_questions", "themeId", theme.id) }));
      await syncQuestionMedia(em, q.id, collectMediaIds(body.content, body.answerContent, body.settings));
      await touchGame(em, round.gameId);
      return q;
    });
    return reply.status(201).send(questionDto(created));
  });

  app.get("/questions/:id", {
    schema: { tags: ["Quiz Questions"], summary: "Вопрос (admin)", ...bearerAuth, params: idParams },
    preHandler: adminOnly,
  }, async (request) => {
    const q = await db().findOneBy(QuizQuestion, { id: (request.params as { id: string }).id });
    if (!q) throw notFound("Вопрос");
    return questionDto(q);
  });

  app.patch("/questions/:id", {
    ...skipAjv,
    schema: { tags: ["Quiz Questions"], summary: "Изменить вопрос (admin). Поля сливаются с текущими и проверяются заново", ...bearerAuth, params: idParams, body: questionDoc(true) },
    preHandler: adminOnly,
  }, async (request) => {
    const q = await db().findOneBy(QuizQuestion, { id: (request.params as { id: string }).id });
    if (!q) throw notFound("Вопрос");
    const { round } = await gameOfTheme(q.themeId);
    const patch = parseWith(questionInput.partial(), request.body);
    // при смене механики старые settings не переносятся
    const settings = patch.settings ?? (patch.kind && patch.kind !== q.kind ? {} : q.settings);
    const body = validateQuestion(questionInput.parse({ ...questionDto(q), ...patch, settings }));
    Object.assign(q, body);
    return AppDataSource.transaction(async (em) => {
      const saved = await em.save(QuizQuestion, q);
      await syncQuestionMedia(em, q.id, collectMediaIds(body.content, body.answerContent, body.settings));
      await touchGame(em, round.gameId);
      return questionDto(saved);
    });
  });

  app.delete("/questions/:id", {
    schema: { tags: ["Quiz Questions"], summary: "Удалить вопрос (admin)", ...bearerAuth, params: idParams },
    preHandler: adminOnly,
  }, async (request) => {
    const q = await db().findOneBy(QuizQuestion, { id: (request.params as { id: string }).id });
    if (!q) throw notFound("Вопрос");
    const { round } = await gameOfTheme(q.themeId);
    await db().delete(QuizQuestionMedia, { questionId: q.id });
    await db().delete(QuizQuestion, { id: q.id });
    await touchGame(db(), round.gameId);
    return { ok: true };
  });
}
