import type { WebSocket } from "@fastify/websocket";
import type { SessionSnapshot, SnapshotRole } from "./snapshot";

// Комнаты WebSocket хранятся в памяти процесса: подключений единицы, Redis не нужен.
// Сервер → клиент: snapshot | update | session_closed | pong. Клиент → сервер: только { type: "ping" }.

export const WS_CLOSE = {
  UNAUTHORIZED: 4401,
  SESSION_NOT_FOUND: 4404,
  SESSION_CLOSED: 4410,
} as const;

const HEARTBEAT_MS = 25_000;

interface Client {
  socket: WebSocket;
  role: SnapshotRole;
  alive: boolean;
}

export type SnapshotPair = { host: SessionSnapshot; screen: SessionSnapshot };

class Realtime {
  private rooms = new Map<string, Set<Client>>();
  private timer: NodeJS.Timeout | null = null;

  join(sessionId: string, client: Client) {
    let room = this.rooms.get(sessionId);
    if (!room) this.rooms.set(sessionId, (room = new Set()));
    room.add(client);
  }

  leave(sessionId: string, client: Client) {
    const room = this.rooms.get(sessionId);
    if (!room) return;
    room.delete(client);
    if (room.size === 0) this.rooms.delete(sessionId);
  }

  createClient(socket: WebSocket, role: SnapshotRole): Client {
    return { socket, role, alive: true };
  }

  send(socket: WebSocket, message: unknown) {
    if (socket.readyState === 1 /* OPEN */) socket.send(JSON.stringify(message));
  }

  /** Рассылка нового снимка всем в комнате: экрану — экранный вариант, пульту — вариант ведущего */
  broadcast(sessionId: string, snapshots: SnapshotPair) {
    const room = this.rooms.get(sessionId);
    if (!room) return;
    const payloads = {
      screen: JSON.stringify({ type: "update", payload: snapshots.screen }),
      host: JSON.stringify({ type: "update", payload: snapshots.host }),
    };
    for (const c of room) {
      if (c.socket.readyState === 1) c.socket.send(payloads[c.role]);
    }
  }

  /** Закрыть комнату (или только экраны): сессия удалена или токен экрана перевыпущен */
  closeRoom(sessionId: string, reason: "session_deleted" | "token_rotated", onlyRole?: SnapshotRole) {
    const room = this.rooms.get(sessionId);
    if (!room) return;
    for (const c of [...room]) {
      if (onlyRole && c.role !== onlyRole) continue;
      this.send(c.socket, { type: "session_closed", payload: { reason } });
      c.socket.close(WS_CLOSE.SESSION_CLOSED, reason);
      room.delete(c);
    }
    if (room.size === 0) this.rooms.delete(sessionId);
  }

  /** Серверный ping каждые 25 с; мёртвые соединения закрываем */
  startHeartbeat() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      for (const room of this.rooms.values()) {
        for (const c of room) {
          if (!c.alive) {
            c.socket.terminate();
            continue;
          }
          c.alive = false;
          try {
            c.socket.ping();
          } catch {
            c.socket.terminate();
          }
        }
      }
    }, HEARTBEAT_MS);
    this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const room of this.rooms.values()) for (const c of room) c.socket.terminate();
    this.rooms.clear();
  }

  /** для тестов */
  clientsCount(sessionId: string) {
    return this.rooms.get(sessionId)?.size ?? 0;
  }
}

export const realtime = new Realtime();
