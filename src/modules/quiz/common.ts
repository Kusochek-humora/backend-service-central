import path from "path";
import { createHmac } from "crypto";
import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { env } from "../../config/env";
import { QuizRole } from "../../db/entities/quiz/quiz.entity";

// ───────────────────────────── Ошибки ─────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new ApiError(404, "NOT_FOUND", `${what} не найден`);
export const validationError = (message: string, details?: unknown) =>
  new ApiError(422, "VALIDATION_ERROR", message, details);

/** Формат ошибок квиза: { error: { code, message, details? } } */
export function quizErrorHandler(error: FastifyError | ApiError, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof ApiError) {
    return reply.status(error.status).send({
      error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
    });
  }

  const fe = error as FastifyError;

  if (fe.validation) {
    return reply.status(422).send({
      error: {
        code: "VALIDATION_ERROR",
        message: fe.message,
        details: fe.validation.map((v) => ({
          path: (v.instancePath || "").replace(/^\//, "").replace(/\//g, ".") || (v.params as any)?.missingProperty || "",
          message: v.message,
        })),
      },
    });
  }

  if (fe.statusCode === 429) {
    return reply.status(429).send({ error: { code: "RATE_LIMITED", message: "Слишком много запросов, попробуйте позже" } });
  }
  if (fe.statusCode === 413 || fe.code === "FST_REQ_FILE_TOO_LARGE") {
    return reply.status(413).send({ error: { code: "PAYLOAD_TOO_LARGE", message: "Файл слишком большой" } });
  }
  if (fe.statusCode && fe.statusCode >= 400 && fe.statusCode < 500) {
    return reply.status(fe.statusCode).send({ error: { code: fe.code ?? "BAD_REQUEST", message: fe.message } });
  }

  request.log.error(error);
  return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера" } });
}

// ───────────────────────────── Схемы запросов ─────────────────────────────

export const uuidSchema = { type: "string", format: "uuid" } as const;
export const idParams = { type: "object", required: ["id"], properties: { id: uuidSchema } } as const;

export const paginationQuery = {
  limit: { type: "integer", minimum: 1, maximum: 1000, default: 50 },
  offset: { type: "integer", minimum: 0, default: 0 },
} as const;

export function pageParams(query: unknown): { limit: number; offset: number } {
  const q = query as { limit?: number; offset?: number };
  return { limit: q.limit ?? 50, offset: q.offset ?? 0 };
}

export const bearerAuth = { security: [{ bearerAuth: [] }] };

// ───────────────────────────── Конфиг ─────────────────────────────

/**
 * Секрет токенов квиза. Выводится из JWT_SECRET сайта, но отличается от него:
 * токен квиза не проходит проверку на сайте и наоборот. Переопределяется через QUIZ_JWT_SECRET.
 */
export const quizJwtSecret: string =
  process.env.QUIZ_JWT_SECRET || createHmac("sha256", env.jwtSecret).update("quiz-game:jwt:v1").digest("hex");

export const QUIZ_TOKEN_TTL = "12h";

/**
 * SCREEN_URL_BASE — адрес экрана эфира. screenUrl = <база>/<sessionId>?token=<screenToken>.
 * По умолчанию экран на GitHub Pages: https://kusochek-humora.github.io/Tiko-quiz-show/#/screen
 * (переопределяется переменной; пустая строка отключает: screenUrl = null).
 */
const DEFAULT_SCREEN_URL_BASE = "https://kusochek-humora.github.io/Tiko-quiz-show/#/screen";
export function buildScreenUrl(sessionId: string, token: string): string | null {
  const base = (process.env.SCREEN_URL_BASE ?? DEFAULT_SCREEN_URL_BASE).replace(/\/+$/, "");
  return base ? `${base}/${sessionId}?token=${encodeURIComponent(token)}` : null;
}

// ───────────────────────────── Файлы ─────────────────────────────

export const UPLOADS_ROOT = path.join(process.cwd(), "uploads");
export const QUIZ_UPLOAD_DIR = path.join(UPLOADS_ROOT, "quiz");

/** Публичный URL файла. PUBLIC_UPLOADS_URL (например https://api.example.com/uploads) делает его абсолютным. */
export function mediaUrl(filePath: string): string {
  const base = (process.env.PUBLIC_UPLOADS_URL || "").replace(/\/+$/, "");
  return `${base || "/uploads"}/${filePath}`;
}

export type AuthedQuizUser = { id: string; login: string; role: QuizRole };

declare module "fastify" {
  interface FastifyRequest {
    quizAuth: AuthedQuizUser | null;
  }
}
