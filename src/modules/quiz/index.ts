import { FastifyInstance } from "fastify";
import fs from "fs/promises";
import { setupQuizAuth, quizAuthRoutes } from "./auth";
import { commandSchema, snapshotSchema } from "./apiDocs";
import { QUIZ_UPLOAD_DIR, quizErrorHandler } from "./common";
import { quizContentRoutes } from "./content.routes";
import { quizMediaRoutes } from "./media.routes";
import { quizParticipantsRoutes } from "./participants.routes";
import { quizSessionRoutes } from "./sessions.routes";
import { quizWsRoutes } from "./ws.routes";

/**
 * Квиз «Своя игра». Подключается одной строкой в server.ts: app.register(quizPlugin).
 *   REST       → /api/...
 *   WebSocket  → /ws/sessions/:id
 * Изолирован от сайта: свои таблицы quiz_*, свои пользователи и токены (отдельный секрет),
 * свой обработчик ошибок (плагин инкапсулирован и не затрагивает остальные роуты).
 */
export async function quizPlugin(app: FastifyInstance) {
  await fs.mkdir(QUIZ_UPLOAD_DIR, { recursive: true });
  app.setErrorHandler(quizErrorHandler);
  app.addSchema(snapshotSchema);
  app.addSchema(commandSchema);

  // JWT квиза регистрируется один раз: namespace "quiz" общий для REST и WebSocket
  const auth = await setupQuizAuth(app);

  await app.register(async (api) => {
    await quizAuthRoutes(api, auth);
    await quizContentRoutes(api, auth);
    await quizMediaRoutes(api, auth);
    await quizParticipantsRoutes(api, auth);
    await quizSessionRoutes(api, auth);
  }, { prefix: "/api" });

  await app.register(async (ws) => {
    await quizWsRoutes(ws, auth);
  }, { prefix: "/ws" });
}
