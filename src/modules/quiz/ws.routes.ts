import { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import { timingSafeEqual } from "crypto";
import { AppDataSource } from "../../db/data-source";
import { QuizSession } from "../../db/entities/quiz/quiz.entity";
import { QuizAuth } from "./auth";
import { WS_CLOSE, realtime } from "./realtime";
import { buildSnapshots } from "./sessions.service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

/**
 * GET /ws/sessions/:id?role=screen&token=<screen_token>  — экран
 * GET /ws/sessions/:id?role=host&token=<jwt>             — пульт
 * Сервер → клиент: snapshot | update | session_closed | pong. Клиент → сервер: только { "type": "ping" }.
 * Неверный токен: закрытие с кодом 4401; сессия не найдена: 4404.
 */
export async function quizWsRoutes(app: FastifyInstance, auth: QuizAuth) {
  await app.register(websocket);
  realtime.startHeartbeat();
  app.addHook("onClose", async () => realtime.stop());

  app.get("/sessions/:id", { websocket: true, schema: { hide: true } }, (socket, request) => {
    const { id } = request.params as { id: string };
    const q = request.query as { role?: string; token?: string };
    const role = q.role === "host" ? "host" : q.role === "screen" ? "screen" : null;
    let client: ReturnType<typeof realtime.createClient> | null = null;

    // Обработчики вешаем синхронно, до любых await
    socket.on("message", (raw: Buffer) => {
      if (client) client.alive = true;
      try {
        if (JSON.parse(raw.toString())?.type === "ping") realtime.send(socket, { type: "pong" });
      } catch {
        /* клиент может слать только ping, остальное игнорируем */
      }
    });
    socket.on("pong", () => { if (client) client.alive = true; });
    socket.on("close", () => { if (client) realtime.leave(id, client); });
    socket.on("error", () => {});

    (async () => {
      if (!role || !q.token) return socket.close(WS_CLOSE.UNAUTHORIZED, "unauthorized");
      if (!UUID_RE.test(id)) return socket.close(WS_CLOSE.SESSION_NOT_FOUND, "session not found");

      if (role === "host" && !(await auth.authenticate(q.token))) return socket.close(WS_CLOSE.UNAUTHORIZED, "unauthorized");
      const session = await AppDataSource.getRepository(QuizSession).findOneBy({ id });
      if (!session) return socket.close(WS_CLOSE.SESSION_NOT_FOUND, "session not found");
      if (role === "screen" && !safeEqual(session.screenToken, q.token)) return socket.close(WS_CLOSE.UNAUTHORIZED, "unauthorized");

      client = realtime.createClient(socket, role);
      realtime.join(id, client);
      // Сначала join, потом снимок: обновление, пришедшее между ними, не потеряется.
      // Клиент отбрасывает сообщения с version меньше уже показанной.
      realtime.send(socket, { type: "snapshot", payload: (await buildSnapshots(id))[role] });
    })().catch((err) => {
      request.log.error(err);
      socket.close(1011, "internal error");
    });
  });
}
