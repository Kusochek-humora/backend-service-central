import { FastifyInstance } from "fastify";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import { Transform } from "stream";
import { pipeline } from "stream/promises";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { AppDataSource } from "../../db/data-source";
import { QuizMedia, QuizMediaType } from "../../db/entities/quiz/quiz.entity";
import { QuizAuth } from "./auth";
import { ApiError, QUIZ_UPLOAD_DIR, bearerAuth, idParams, notFound, pageParams, paginationQuery, validationError } from "./common";
import { isMediaUsed, mediaDto } from "./media.service";

const MB = 1024 * 1024;
/** Лимиты по типу файла */
export const MEDIA_LIMITS: Record<QuizMediaType, number> = { image: 15 * MB, audio: 50 * MB, video: 200 * MB };

const MIME_KIND: Record<string, QuizMediaType> = {
  "image/jpeg": "image", "image/png": "image", "image/webp": "image", "image/gif": "image",
  "audio/mpeg": "audio", "video/mp4": "video", "video/webm": "video",
};

const TMP_DIR = path.join(QUIZ_UPLOAD_DIR, ".tmp");

/** Реальный тип по содержимому файла (а не по Content-Type от клиента) */
export function sniffMedia(b: Buffer): { kind: QuizMediaType; ext: string; mime: string; isGif?: boolean } | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: "image", ext: "jpg", mime: "image/jpeg" };
  if (b[0] === 0x89 && b.toString("latin1", 1, 4) === "PNG") return { kind: "image", ext: "png", mime: "image/png" };
  if (b.toString("latin1", 0, 4) === "GIF8") return { kind: "image", ext: "gif", mime: "image/gif", isGif: true };
  if (b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return { kind: "image", ext: "webp", mime: "image/webp" };
  if (b.toString("latin1", 0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return { kind: "audio", ext: "mp3", mime: "audio/mpeg" };
  if (b.toString("latin1", 4, 8) === "ftyp") return { kind: "video", ext: "mp4", mime: "video/mp4" };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { kind: "video", ext: "webm", mime: "video/webm" };
  return null;
}

export async function quizMediaRoutes(app: FastifyInstance, auth: QuizAuth) {
  await fs.mkdir(TMP_DIR, { recursive: true });
  const Media = () => AppDataSource.getRepository(QuizMedia);
  const adminOnly = auth.guard(["admin"]);

  app.post("/media", {
    schema: {
      tags: ["Quiz Media"],
      summary: "Загрузить картинку, аудио или видео (admin)",
      description:
        "multipart/form-data, поле `file`. Картинки jpeg/png/webp/gif (до 15 МБ) конвертируются в WebP, анимация gif сохраняется; " +
        "аудио mp3 (до 50 МБ); видео mp4/webm (до 200 МБ). Тип проверяется по содержимому файла. " +
        "Ответ содержит `id` (его указывают в blocks.mediaId, settings и photoMediaId участника), `path` и `url`.",
      ...bearerAuth,
      consumes: ["multipart/form-data"],
    },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const file = await request.file({ limits: { fileSize: MEDIA_LIMITS.video, files: 1 } });
    if (!file) throw validationError("Нужен файл в поле file (multipart/form-data)");

    const declared = MIME_KIND[file.mimetype];
    if (!declared) throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Разрешены jpeg, png, webp, gif, mp3, mp4, webm");
    const limit = MEDIA_LIMITS[declared];

    const tmp = path.join(TMP_DIR, randomUUID());
    let size = 0;
    const limiter = new Transform({
      transform(chunk, _enc, cb) {
        size += chunk.length;
        if (size > limit) cb(new ApiError(413, "PAYLOAD_TOO_LARGE", `Файл больше ${Math.round(limit / MB)} МБ`));
        else cb(null, chunk);
      },
    });

    let finalPath: string | null = null;
    try {
      await pipeline(file.file, limiter, createWriteStream(tmp));
      if (file.file.truncated) throw new ApiError(413, "PAYLOAD_TOO_LARGE", `Файл больше ${Math.round(limit / MB)} МБ`);

      const handle = await fs.open(tmp, "r");
      const head = Buffer.alloc(16);
      try { await handle.read(head, 0, 16, 0); } finally { await handle.close(); }
      const sniffed = sniffMedia(head);
      if (!sniffed || sniffed.kind !== declared) {
        throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Содержимое файла не соответствует заявленному типу");
      }

      let filename: string;
      let mime = sniffed.mime;
      if (sniffed.kind === "image") {
        filename = `${randomUUID()}.webp`;
        finalPath = path.join(QUIZ_UPLOAD_DIR, filename);
        try {
          let img = sharp(tmp, { animated: true, limitInputPixels: 100_000_000 });
          if (!sniffed.isGif) img = img.rotate(); // учесть EXIF-ориентацию фото
          await img.resize({ width: 3840, height: 3840, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toFile(finalPath);
        } catch {
          throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Не удалось прочитать изображение");
        }
        mime = "image/webp";
      } else {
        filename = `${randomUUID()}.${sniffed.ext}`;
        finalPath = path.join(QUIZ_UPLOAD_DIR, filename);
        await fs.rename(tmp, finalPath);
      }

      const stat = await fs.stat(finalPath);
      const row = await Media().save(Media().create({
        type: sniffed.kind, path: `quiz/${filename}`, originalName: file.filename || filename, mime, size: stat.size,
      }));
      finalPath = null; // записано в БД, откатывать файл не нужно
      return reply.status(201).send(mediaDto(row));
    } finally {
      await fs.rm(tmp, { force: true });
      if (finalPath) await fs.rm(finalPath, { force: true });
    }
  });

  app.get("/media", {
    schema: {
      tags: ["Quiz Media"],
      summary: "Список медиа с фильтром ?type= (admin)",
      ...bearerAuth,
      querystring: { type: "object", properties: { type: { type: "string", enum: ["image", "audio", "video"] }, ...paginationQuery } },
    },
    preHandler: adminOnly,
  }, async (request) => {
    const { type } = request.query as { type?: QuizMediaType };
    const { limit, offset } = pageParams(request.query);
    const where = type ? { type } : {};
    const [items, total] = await Media().findAndCount({ where, order: { createdAt: "DESC" }, take: limit, skip: offset });
    return { items: items.map(mediaDto), total };
  });

  app.delete("/media/:id", {
    schema: { tags: ["Quiz Media"], summary: "Удалить файл (admin). 409 MEDIA_IN_USE, если файл используется", ...bearerAuth, params: idParams },
    preHandler: adminOnly,
  }, async (request) => {
    const { id } = request.params as { id: string };
    const media = await Media().findOneBy({ id });
    if (!media) throw notFound("Файл");
    if (await isMediaUsed(id)) throw new ApiError(409, "MEDIA_IN_USE", "Файл используется в вопросах или как фото игрока");
    await Media().delete({ id });
    await fs.rm(path.join(QUIZ_UPLOAD_DIR, path.basename(media.path)), { force: true });
    return { ok: true };
  });
}
