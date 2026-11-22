import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { QuizMedia, QuizParticipant } from "../../db/entities/quiz/quiz.entity";
import { QuizAuth } from "./auth";
import { ApiError, bearerAuth, idParams, mediaUrl, notFound, pageParams, paginationQuery } from "./common";
import { requireImage } from "./media.service";
import { docSchema, parseWith, skipAjv } from "./validation";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Цвет в формате #RRGGBB");
const createInput = z.object({
  name: z.string().min(1).max(100),
  color: color.default("#888888"),
  /** фото игрока: id изображения, загруженного через POST /media */
  photoMediaId: z.uuid().nullable().optional(),
  /** стартовый балл по умолчанию, подставляется в сессию при создании */
  defaultStartScore: z.number().int().default(0),
});
const patchInput = createInput.partial();

async function dto(p: QuizParticipant) {
  const photo = p.photoMediaId ? await AppDataSource.manager.findOneBy(QuizMedia, { id: p.photoMediaId }) : null;
  return {
    id: p.id, name: p.name, color: p.color, photoMediaId: p.photoMediaId,
    photoUrl: photo ? mediaUrl(photo.path) : null, defaultStartScore: p.defaultStartScore,
  };
}

export async function quizParticipantsRoutes(app: FastifyInstance, auth: QuizAuth) {
  const Participants = () => AppDataSource.getRepository(QuizParticipant);
  const adminOnly = auth.guard(["admin"]);

  app.get("/participants", {
    schema: { tags: ["Quiz Participants"], summary: "Список участников (admin, host)", ...bearerAuth, querystring: { type: "object", properties: paginationQuery } },
    preHandler: auth.guard(["admin", "host"]),
  }, async (request) => {
    const { limit, offset } = pageParams(request.query);
    const [items, total] = await Participants().findAndCount({ order: { createdAt: "ASC" }, take: limit, skip: offset });
    return { items: await Promise.all(items.map(dto)), total };
  });

  app.post("/participants", {
    ...skipAjv,
    schema: { tags: ["Quiz Participants"], summary: "Создать участника; photoMediaId — фото из /media (admin)", ...bearerAuth, body: docSchema(createInput) },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const body = parseWith(createInput, request.body);
    await requireImage(body.photoMediaId);
    const p = await Participants().save(Participants().create({
      name: body.name, color: body.color, photoMediaId: body.photoMediaId ?? null, defaultStartScore: body.defaultStartScore,
    }));
    return reply.status(201).send(await dto(p));
  });

  app.patch("/participants/:id", {
    ...skipAjv,
    schema: { tags: ["Quiz Participants"], summary: "Изменить участника, в том числе фото (photoMediaId, null — убрать) (admin)", ...bearerAuth, params: idParams, body: docSchema(patchInput) },
    preHandler: adminOnly,
  }, async (request) => {
    const { id } = request.params as { id: string };
    const p = await Participants().findOneBy({ id });
    if (!p) throw notFound("Участник");
    const body = parseWith(patchInput, request.body);
    if (body.photoMediaId !== undefined) {
      await requireImage(body.photoMediaId);
      p.photoMediaId = body.photoMediaId;
    }
    if (body.name !== undefined) p.name = body.name;
    if (body.color !== undefined) p.color = body.color;
    if (body.defaultStartScore !== undefined) p.defaultStartScore = body.defaultStartScore;
    return dto(await Participants().save(p));
  });

  app.delete("/participants/:id", {
    schema: { tags: ["Quiz Participants"], summary: "Удалить участника (admin). 409, если он есть в сессиях", ...bearerAuth, params: idParams },
    preHandler: adminOnly,
  }, async (request) => {
    const { id } = request.params as { id: string };
    if (!(await Participants().findOneBy({ id }))) throw notFound("Участник");
    const [{ n }] = await AppDataSource.query(
      `SELECT (SELECT COUNT(*) FROM quiz_session_participants WHERE "participantId" = $1)
            + (SELECT COUNT(*) FROM quiz_score_events WHERE "participantId" = $1) AS n`,
      [id],
    );
    if (Number(n) > 0) throw new ApiError(409, "PARTICIPANT_IN_USE", "Игрок есть в сессиях игр, удалить нельзя");
    await Participants().delete({ id });
    return { ok: true };
  });
}
