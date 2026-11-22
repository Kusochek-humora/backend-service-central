import { EntityManager, In } from "typeorm";
import { AppDataSource } from "../../db/data-source";
import { QuizMedia, QuizQuestionMedia } from "../../db/entities/quiz/quiz.entity";
import { ApiError, mediaUrl, validationError } from "./common";

export { collectMediaIds } from "./mediaIds";

export const mediaDto = (m: QuizMedia) => ({
  id: m.id,
  type: m.type,
  path: m.path,
  url: mediaUrl(m.path),
  originalName: m.originalName,
  mime: m.mime,
  size: m.size,
  createdAt: m.createdAt,
});

/** Проверяет, что все медиа существуют (иначе 422 MEDIA_NOT_FOUND), и возвращает их по id */
export async function requireMedia(ids: string[], em: EntityManager = AppDataSource.manager): Promise<Map<string, QuizMedia>> {
  if (ids.length === 0) return new Map();
  const rows = await em.find(QuizMedia, { where: { id: In(ids) } });
  const map = new Map(rows.map((r) => [r.id, r]));
  const missing = ids.filter((id) => !map.has(id));
  if (missing.length) throw new ApiError(422, "MEDIA_NOT_FOUND", "Медиафайл не найден", { mediaIds: missing });
  return map;
}

/** Пересобирает question_media под текущее содержимое вопроса (content, answerContent, settings) */
export async function syncQuestionMedia(em: EntityManager, questionId: string, ids: string[]) {
  await requireMedia(ids, em);
  await em.delete(QuizQuestionMedia, { questionId });
  if (ids.length) await em.insert(QuizQuestionMedia, ids.map((mediaId) => ({ questionId, mediaId })));
}

/** Фото участника должно быть картинкой */
export async function requireImage(id: string | null | undefined, em: EntityManager = AppDataSource.manager) {
  if (!id) return null;
  const media = (await requireMedia([id], em)).get(id)!;
  if (media.type !== "image") throw validationError("Фото игрока должно быть изображением");
  return media;
}

/** Используется ли файл в вопросах или как фото участника */
export async function isMediaUsed(mediaId: string, em: EntityManager = AppDataSource.manager): Promise<boolean> {
  const [{ n }] = await em.query(
    `SELECT (SELECT COUNT(*) FROM quiz_question_media WHERE "mediaId" = $1)
          + (SELECT COUNT(*) FROM quiz_participants WHERE "photoMediaId" = $1) AS n`,
    [mediaId],
  );
  return Number(n) > 0;
}
