import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { QuizSession } from "../../db/entities/quiz/quiz.entity";
import { QuizAuth } from "./auth";
import { COMMAND_TYPES } from "./apiDocs";
import { bearerAuth, buildScreenUrl, idParams, notFound, pageParams, paginationQuery, uuidSchema } from "./common";
import { realtime } from "./realtime";
import { addPlayer, addScore, buildSnapshots, createSession, executeCommand, newScreenToken, patchPlayer, removePlayer, setScore, voidScore } from "./sessions.service";
import { docSchema, parseWith, skipAjv } from "./validation";

const snapshotRef = { $ref: "QuizSnapshot#" };
/** Ответ-снимок не сериализуется по схеме (она нужна только для OpenAPI) */
const rawSerializer = { serializerCompiler: () => (data: unknown) => JSON.stringify(data) } as const;

const expectedVersion = z.number().int().min(0).optional();
const createInput = z.object({ gameId: z.uuid(), participantIds: z.array(z.uuid()).default([]), hostName: z.string().max(100).nullish() });
const commandInput = z.object({
  type: z.enum(COMMAND_TYPES as [string, ...string[]]),
  payload: z.unknown().optional(),
  expectedVersion,
});
const scoreInput = z.object({
  participantId: z.uuid(),
  kind: z.enum(["correct", "wrong", "bonus", "penalty", "manual"]),
  delta: z.number().int().refine((n) => n !== 0, "delta не может быть 0"),
  reason: z.string().max(500).nullish(),
  questionId: z.uuid().nullish(),
  expectedVersion,
});
const scoreSetInput = z.object({ participantId: z.uuid(), total: z.number().int(), reason: z.string().max(500).nullish(), expectedVersion });
const addPlayerInput = z.object({ participantId: z.uuid(), startScore: z.number().int().optional(), expectedVersion });
const patchPlayerInput = z.object({ startScore: z.number().int().optional(), order: z.number().int().min(0).optional(), expectedVersion });
const voidInput = z.object({ expectedVersion }).nullish();

export async function quizSessionRoutes(app: FastifyInstance, auth: QuizAuth) {
  const host = auth.guard(["admin", "host"]);
  const adminOnly = auth.guard(["admin"]);
  const Sessions = () => AppDataSource.getRepository(QuizSession);
  const sid = { type: "object", required: ["id", "participantId"], properties: { id: uuidSchema, participantId: uuidSchema } };

  app.post("/sessions", {
    ...skipAjv,
    schema: {
      tags: ["Quiz Sessions"],
      summary: "Создать сессию (host, admin). screenToken и screenUrl показываются только здесь и при перевыпуске",
      ...bearerAuth, body: docSchema(createInput),
    },
    preHandler: host,
  }, async (request, reply) => {
    const session = await createSession(parseWith(createInput, request.body));
    return reply.status(201).send({
      session: { id: session.id, gameId: session.gameId, status: session.status, version: session.version, hostName: session.hostName, createdAt: session.createdAt },
      screenToken: session.screenToken,
      screenUrl: buildScreenUrl(session.id, session.screenToken),
      snapshot: (await buildSnapshots(session.id)).host,
    });
  });

  app.get("/sessions", {
    schema: {
      tags: ["Quiz Sessions"], summary: "Список сессий (история)", ...bearerAuth,
      querystring: { type: "object", properties: { status: { type: "string" }, ...paginationQuery } },
    },
    preHandler: host,
  }, async (request) => {
    const { status } = request.query as { status?: string };
    const { limit, offset } = pageParams(request.query);
    const params: unknown[] = [limit, offset, ...(status ? [status] : [])];
    const items = await AppDataSource.query(
      `SELECT s.id, s."gameId", g.title AS "gameTitle", s.status, s."hostName", s.version, s."startedAt", s."finishedAt", s."createdAt",
              (SELECT COUNT(*) FROM quiz_session_participants sp WHERE sp."sessionId" = s.id)::int AS "playersCount"
       FROM quiz_sessions s JOIN quiz_games g ON g.id = s."gameId" ${status ? "WHERE s.status = $3" : ""}
       ORDER BY s."createdAt" DESC LIMIT $1 OFFSET $2`,
      params,
    );
    const [{ n }] = await AppDataSource.query(`SELECT COUNT(*)::int AS n FROM quiz_sessions s ${status ? "WHERE s.status = $1" : ""}`, status ? [status] : []);
    return { items, total: n };
  });

  app.get("/sessions/:id", {
    ...rawSerializer,
    schema: { tags: ["Quiz Sessions"], summary: "Снимок состояния для пульта (host)", ...bearerAuth, params: idParams, response: { 200: snapshotRef } },
    preHandler: host,
  }, async (request) => (await buildSnapshots((request.params as { id: string }).id)).host);

  // ── Команды ──

  app.post("/sessions/:id/commands", {
    ...skipAjv, ...rawSerializer,
    schema: {
      tags: ["Quiz Sessions"],
      summary: "Команда ведущего или механики. Возвращает новый снимок для host",
      description: "Все команды и их допустимые статусы описаны в схеме QuizCommand. expectedVersion защищает от двойного клика и двух пультов (409 VERSION_MISMATCH).",
      ...bearerAuth, params: idParams, body: { $ref: "QuizCommand#" }, response: { 200: snapshotRef },
    },
    preHandler: host,
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = parseWith(commandInput, request.body);
    return executeCommand(id, { type: body.type, payload: body.payload }, body.expectedVersion);
  });

  // ── Очки (оценка всегда ручная) ──

  app.post("/sessions/:id/scores", {
    ...skipAjv, ...rawSerializer,
    schema: {
      tags: ["Quiz Scores"],
      summary: "Начислить очки игроку в любой момент и на любую сумму (в том числе отрицательную)",
      description: "«Засчитать» = kind=correct, delta=+pointsIfCorrect; «не засчитать» = kind=wrong, delta=pointsIfWrong. Бонус или штраф: kind=bonus|penalty. delta не равна 0.",
      ...bearerAuth, params: idParams, body: docSchema(scoreInput),
    },
    preHandler: host,
  }, async (request, reply) => reply.status(201).send(await addScore((request.params as { id: string }).id, parseWith(scoreInput, request.body), request.quizAuth!.id)));

  app.post("/sessions/:id/scores/set", {
    ...skipAjv, ...rawSerializer,
    schema: { tags: ["Quiz Scores"], summary: "Выставить итоговый счёт вручную: создаётся событие manual с delta = total − текущий счёт", ...bearerAuth, params: idParams, body: docSchema(scoreSetInput) },
    preHandler: host,
  }, async (request, reply) => reply.status(201).send(await setScore((request.params as { id: string }).id, parseWith(scoreSetInput, request.body), request.quizAuth!.id)));

  app.post("/sessions/:id/scores/:eventId/void", {
    ...skipAjv, ...rawSerializer,
    schema: {
      tags: ["Quiz Scores"], summary: "Отменить начисление (строка остаётся в журнале с voided=true)", ...bearerAuth,
      params: { type: "object", required: ["id", "eventId"], properties: { id: uuidSchema, eventId: uuidSchema } }, body: docSchema(voidInput as any),
    },
    preHandler: host,
  }, async (request) => {
    const { id, eventId } = request.params as { id: string; eventId: string };
    const body = parseWith(voidInput as any, request.body) as { expectedVersion?: number } | null;
    return voidScore(id, eventId, body?.expectedVersion);
  });

  app.get("/sessions/:id/scores", {
    schema: { tags: ["Quiz Scores"], summary: "Журнал начислений (новые сверху)", ...bearerAuth, params: idParams },
    preHandler: host,
  }, async (request) => {
    const { id } = request.params as { id: string };
    if (!(await Sessions().findOneBy({ id }))) throw notFound("Сессия");
    const items = await AppDataSource.query(
      `SELECT e.id, e."participantId", p.name AS "participantName", e.kind, e.delta, e.reason, e."questionId", e.voided, e."createdBy", e."createdAt"
       FROM quiz_score_events e LEFT JOIN quiz_participants p ON p.id = e."participantId"
       WHERE e."sessionId" = $1 ORDER BY e."createdAt" DESC`,
      [id],
    );
    return { items, total: items.length };
  });

  // ── Игроки сессии: сколько угодно, добавлять и править можно на ходу ──

  app.post("/sessions/:id/participants", {
    ...skipAjv, ...rawSerializer,
    schema: { tags: ["Quiz Sessions"], summary: "Добавить игрока в сессию на ходу (слот в конец; startScore по умолчанию = defaultStartScore)", ...bearerAuth, params: idParams, body: docSchema(addPlayerInput), response: { 200: snapshotRef } },
    preHandler: host,
  }, async (request) => {
    const body = parseWith(addPlayerInput, request.body);
    return addPlayer((request.params as { id: string }).id, body, body.expectedVersion);
  });

  app.patch("/sessions/:id/participants/:participantId", {
    ...skipAjv, ...rawSerializer,
    schema: { tags: ["Quiz Sessions"], summary: "Изменить стартовый балл или слот игрока в любой момент и статусе", ...bearerAuth, params: sid, body: docSchema(patchPlayerInput), response: { 200: snapshotRef } },
    preHandler: host,
  }, async (request) => {
    const { id, participantId } = request.params as { id: string; participantId: string };
    const body = parseWith(patchPlayerInput, request.body);
    return patchPlayer(id, participantId, body, body.expectedVersion);
  });

  app.delete("/sessions/:id/participants/:participantId", {
    ...rawSerializer,
    schema: { tags: ["Quiz Sessions"], summary: "Убрать игрока из сессии (его события остаются в журнале)", ...bearerAuth, params: sid, response: { 200: snapshotRef } },
    preHandler: host,
  }, async (request) => {
    const { id, participantId } = request.params as { id: string; participantId: string };
    return removePlayer(id, participantId);
  });

  // ── Токен экрана и удаление ──

  app.post("/sessions/:id/screen-token/rotate", {
    schema: { tags: ["Quiz Sessions"], summary: "Перевыпустить токен экрана; подключённые экраны получают session_closed и отключаются", ...bearerAuth, params: idParams },
    preHandler: host,
  }, async (request) => {
    const { id } = request.params as { id: string };
    const token = newScreenToken();
    const res = await Sessions().update({ id }, { screenToken: token });
    if (!res.affected) throw notFound("Сессия");
    realtime.closeRoom(id, "token_rotated", "screen");
    return { screenToken: token, screenUrl: buildScreenUrl(id, token) };
  });

  app.delete("/sessions/:id", {
    schema: { tags: ["Quiz Sessions"], summary: "Удалить сессию (admin)", ...bearerAuth, params: idParams },
    preHandler: adminOnly,
  }, async (request) => {
    const { id } = request.params as { id: string };
    const res = await Sessions().delete({ id });
    if (!res.affected) throw notFound("Сессия");
    realtime.closeRoom(id, "session_deleted");
    return { ok: true };
  });
}
