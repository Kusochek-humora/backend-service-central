import { randomBytes } from "crypto";
import { EntityManager, In } from "typeorm";
import { AppDataSource } from "../../db/data-source";
import {
  QuizGame,
  QuizParticipant,
  QuizScoreEvent,
  QuizScoreKind,
  QuizSession,
  QuizSessionHistory,
  QuizSessionParticipant,
  QuizSessionPlayedQuestion,
  QuizSessionQuestionState,
} from "../../db/entities/quiz/quiz.entity";
import { ApiError, mediaUrl, notFound, validationError } from "./common";
import { EngineCommand, EngineErrorCode, EngineState, applyCommand } from "./engine";
import { loadGame } from "./repo";
import { SnapshotPair, realtime } from "./realtime";
import { PlayerRow, buildSnapshot } from "./snapshot";

// ───────────────────────────── Состояние ↔ БД ─────────────────────────────

async function loadEngineState(em: EntityManager, s: QuizSession): Promise<EngineState> {
  const states = await em.find(QuizSessionQuestionState, { where: { sessionId: s.id } });
  const played = await em.find(QuizSessionPlayedQuestion, { where: { sessionId: s.id } });
  return {
    status: s.status,
    currentRoundId: s.currentRoundId,
    currentQuestionId: s.currentQuestionId,
    activeParticipantId: s.activeParticipantId,
    timerEndsAt: s.timerEndsAt ? s.timerEndsAt.toISOString() : null,
    roundState: s.roundState,
    questionStates: Object.fromEntries(states.map((r) => [r.questionId, r.state])),
    played: played.map((p) => p.questionId),
  };
}

async function persistEngineState(em: EntityManager, s: QuizSession, st: EngineState) {
  s.status = st.status;
  s.currentRoundId = st.currentRoundId;
  s.currentQuestionId = st.currentQuestionId;
  s.activeParticipantId = st.activeParticipantId;
  s.timerEndsAt = st.timerEndsAt ? new Date(st.timerEndsAt) : null;
  s.roundState = st.roundState;
  await replaceQuestionStates(em, s.id, st.questionStates, st.played);
}

async function replaceQuestionStates(em: EntityManager, sessionId: string, states: Record<string, any>, played: string[]) {
  await em.delete(QuizSessionQuestionState, { sessionId });
  const entries = Object.entries(states);
  if (entries.length) {
    await em.insert(QuizSessionQuestionState, entries.map(([questionId, state]) => ({ sessionId, questionId, state })));
  }
  await em.delete(QuizSessionPlayedQuestion, { sessionId });
  if (played.length) await em.insert(QuizSessionPlayedQuestion, played.map((questionId) => ({ sessionId, questionId })));
}

// ───────────────────────────── Игроки и счёт ─────────────────────────────

/** Игроки сессии по слотам; счёт = startScore + сумма неотменённых событий */
export async function loadPlayers(em: EntityManager, sessionId: string): Promise<PlayerRow[]> {
  const rows: { id: string; name: string; color: string; path: string | null; order: number; score: string }[] = await em.query(
    `SELECT sp."participantId" AS id, p.name, p.color, m.path, sp."order",
            sp."startScore" + COALESCE(SUM(e.delta) FILTER (WHERE e.voided = FALSE), 0) AS score
     FROM quiz_session_participants sp
     JOIN quiz_participants p ON p.id = sp."participantId"
     LEFT JOIN quiz_media m ON m.id = p."photoMediaId"
     LEFT JOIN quiz_score_events e ON e."sessionId" = sp."sessionId" AND e."participantId" = sp."participantId"
     WHERE sp."sessionId" = $1
     GROUP BY sp."participantId", sp."order", sp."startScore", p.name, p.color, m.path
     ORDER BY sp."order" ASC, p.name ASC`,
    [sessionId],
  );
  return rows.map((r) => ({
    id: r.id, name: r.name, color: r.color, photo: r.path ? mediaUrl(r.path) : null, order: r.order, score: Number(r.score),
  }));
}

async function loadMediaMap(em: EntityManager, gameId: string, sessionId: string) {
  const rows: { id: string; type: string; path: string }[] = await em.query(
    `SELECT m.id, m.type, m.path FROM quiz_media m
     WHERE m.id IN (
       SELECT qm."mediaId" FROM quiz_question_media qm
       JOIN quiz_questions q ON q.id = qm."questionId" JOIN quiz_themes t ON t.id = q."themeId" JOIN quiz_rounds r ON r.id = t."roundId"
       WHERE r."gameId" = $1)`,
    [gameId],
  );
  void sessionId;
  return new Map(rows.map((r) => [r.id, { type: r.type, url: mediaUrl(r.path) }]));
}

// ───────────────────────────── Снимки ─────────────────────────────

export async function buildSnapshots(sessionId: string, em: EntityManager = AppDataSource.manager): Promise<SnapshotPair> {
  const session = await em.findOneBy(QuizSession, { id: sessionId });
  if (!session) throw notFound("Сессия");
  const game = await loadGame(session.gameId, em);
  if (!game) throw notFound("Игра сессии");
  const input = {
    sessionId: session.id,
    version: session.version,
    hostName: session.hostName,
    state: await loadEngineState(em, session),
    game,
    players: await loadPlayers(em, sessionId),
    mediaById: await loadMediaMap(em, session.gameId, sessionId),
    canBack: (await em.count(QuizSessionHistory, { where: { sessionId } })) > 0,
    now: new Date(),
  };
  return { host: buildSnapshot(input, "host"), screen: buildSnapshot(input, "screen") };
}

// ───────────────────────────── История и откат ─────────────────────────────

interface Captured {
  session: Pick<QuizSession, "status" | "currentRoundId" | "currentQuestionId" | "activeParticipantId" | "roundState"> & { timerEndsAt: string | null };
  questionStates: Record<string, any>;
  played: string[];
  participants: { participantId: string; order: number; startScore: number }[];
  scores: { ids: string[]; voided: string[] };
}

/** Всё изменяемое состояние сессии (кроме самого журнала очков: его возвращает void) */
async function capture(em: EntityManager, s: QuizSession): Promise<Captured> {
  const st = await loadEngineState(em, s);
  const participants = await em.find(QuizSessionParticipant, { where: { sessionId: s.id } });
  const events = await em.find(QuizScoreEvent, { where: { sessionId: s.id }, select: { id: true, voided: true } });
  return {
    session: {
      status: s.status, currentRoundId: s.currentRoundId, currentQuestionId: s.currentQuestionId,
      activeParticipantId: s.activeParticipantId, roundState: s.roundState, timerEndsAt: st.timerEndsAt,
    },
    questionStates: st.questionStates,
    played: st.played,
    participants: participants.map((p) => ({ participantId: p.participantId, order: p.order, startScore: p.startScore })),
    scores: { ids: events.map((e) => e.id), voided: events.filter((e) => e.voided).map((e) => e.id) },
  };
}

/** Откат: возвращает состояние на момент снимка. События, созданные позже, не удаляются, а помечаются voided. */
async function restore(em: EntityManager, s: QuizSession, c: Captured) {
  s.status = c.session.status;
  s.currentRoundId = c.session.currentRoundId;
  s.currentQuestionId = c.session.currentQuestionId;
  s.activeParticipantId = c.session.activeParticipantId;
  s.roundState = c.session.roundState;
  s.timerEndsAt = c.session.timerEndsAt ? new Date(c.session.timerEndsAt) : null;
  if (s.status !== "finished") s.finishedAt = null;
  if (s.status === "idle") s.startedAt = null;
  await replaceQuestionStates(em, s.id, c.questionStates, c.played);

  const keep = new Set(c.participants.map((p) => p.participantId));
  const current = await em.find(QuizSessionParticipant, { where: { sessionId: s.id } });
  for (const row of current) if (!keep.has(row.participantId)) await em.delete(QuizSessionParticipant, { id: row.id });
  for (const p of c.participants) {
    const row = current.find((r) => r.participantId === p.participantId);
    if (row) await em.update(QuizSessionParticipant, { id: row.id }, { order: p.order, startScore: p.startScore });
    else await em.insert(QuizSessionParticipant, { sessionId: s.id, ...p });
  }

  const events = await em.find(QuizScoreEvent, { where: { sessionId: s.id } });
  for (const e of events) {
    const shouldVoid = !c.scores.ids.includes(e.id) || c.scores.voided.includes(e.id);
    if (e.voided !== shouldVoid) await em.update(QuizScoreEvent, { id: e.id }, { voided: shouldVoid });
  }
}

// ───────────────────────────── Транзакция под блокировкой ─────────────────────────────

/**
 * Любое изменение сессии (команда, очки, правка игроков): строго последовательно, транзакция с SELECT ... FOR UPDATE.
 * Версия +1, строка в session_history для back. Рассылка по WebSocket только после коммита.
 */
async function mutate<T>(
  sessionId: string,
  expectedVersion: number | undefined,
  label: string,
  fn: (session: QuizSession, em: EntityManager, before: Captured) => Promise<{ result: T; skipHistory?: boolean }>,
): Promise<{ result: T; snapshots: SnapshotPair }> {
  const out = await AppDataSource.transaction(async (em) => {
    const session = await em.createQueryBuilder(QuizSession, "s").setLock("pessimistic_write").where("s.id = :id", { id: sessionId }).getOne();
    if (!session) throw notFound("Сессия");
    if (expectedVersion !== undefined && expectedVersion !== session.version) {
      throw new ApiError(409, "VERSION_MISMATCH", "Состояние сессии уже изменилось, обновите пульт", {
        currentVersion: session.version, expectedVersion,
      });
    }
    const before = await capture(em, session);
    const { result, skipHistory } = await fn(session, em, before);
    session.version += 1;
    await em.save(QuizSession, session);
    if (!skipHistory) {
      await em.insert(QuizSessionHistory, { sessionId, version: session.version, command: label, stateBefore: before as any });
    }
    return { result, snapshots: await buildSnapshots(sessionId, em) };
  });
  realtime.broadcast(sessionId, out.snapshots);
  return out;
}

// ───────────────────────────── Команды ─────────────────────────────

const ERROR_STATUS: Record<EngineErrorCode, number> = {
  INVALID_TRANSITION: 409, VALIDATION_ERROR: 422, NO_MORE_ROUNDS: 409, NO_ROUNDS: 409, ALREADY_PLAYED: 409,
  QUESTION_NOT_FOUND: 422, PARTICIPANT_NOT_FOUND: 422, NO_TIMER: 409, NOT_READY: 409, NO_FINALISTS: 409,
};

export async function executeCommand(sessionId: string, command: EngineCommand, expectedVersion?: number) {
  const { snapshots } = await mutate(sessionId, expectedVersion, command.type, async (session, em, before) => {
    if (command.type === "back") {
      if (session.status === "idle") {
        throw new ApiError(409, "INVALID_TRANSITION", "Команда back недоступна в статусе idle", { status: session.status });
      }
      const last = await em.findOne(QuizSessionHistory, { where: { sessionId }, order: { version: "DESC" } });
      if (!last) throw new ApiError(409, "NOTHING_TO_UNDO", "Откатываться некуда", { status: session.status });
      await restore(em, session, last.stateBefore as Captured);
      await em.delete(QuizSessionHistory, { id: last.id });
      return { result: null, skipHistory: true };
    }

    const game = await loadGame(session.gameId, em);
    if (!game) throw notFound("Игра сессии");
    const players = await loadPlayers(em, sessionId);
    const res = applyCommand(
      await loadEngineState(em, session),
      command,
      { now: new Date(), game, players: players.map((p) => ({ id: p.id, score: p.score })), seed: Math.floor(Math.random() * 2 ** 31) },
    );
    if (!res.ok) throw new ApiError(ERROR_STATUS[res.code], res.code, res.message, { status: session.status, ...res.details });

    await persistEngineState(em, session, res.state);
    if (command.type === "start") session.startedAt = new Date();
    if (res.state.status === "finished") session.finishedAt = new Date();
    void before;
    return { result: null };
  });
  return snapshots.host;
}

// ───────────────────────────── Очки ─────────────────────────────

export interface ScoreInput {
  participantId: string;
  kind: QuizScoreKind;
  delta: number;
  reason?: string | null;
  questionId?: string | null;
  expectedVersion?: number;
}

async function requireMember(em: EntityManager, sessionId: string, participantId: string) {
  const member = await em.findOneBy(QuizSessionParticipant, { sessionId, participantId });
  if (!member) throw validationError("Этого игрока нет в сессии");
  return member;
}

export async function addScore(sessionId: string, input: ScoreInput, userId: string) {
  if (!Number.isInteger(input.delta) || input.delta === 0) throw validationError("delta должна быть целым числом, не равным 0");
  const { result, snapshots } = await mutate(sessionId, input.expectedVersion, "score", async (_s, em) => {
    await requireMember(em, sessionId, input.participantId);
    const event = await em.save(QuizScoreEvent, em.create(QuizScoreEvent, {
      sessionId, participantId: input.participantId, kind: input.kind, delta: input.delta,
      reason: input.reason ?? null, questionId: input.questionId ?? null, createdBy: userId,
    }));
    return { result: event };
  });
  return { event: result, snapshot: snapshots.host };
}

/** Выставить итоговый счёт вручную: создаётся событие manual с delta = total − текущий счёт */
export async function setScore(sessionId: string, input: { participantId: string; total: number; reason?: string | null; expectedVersion?: number }, userId: string) {
  const { result, snapshots } = await mutate(sessionId, input.expectedVersion, "score_set", async (_s, em) => {
    await requireMember(em, sessionId, input.participantId);
    const player = (await loadPlayers(em, sessionId)).find((p) => p.id === input.participantId)!;
    const delta = input.total - player.score;
    if (delta === 0) throw new ApiError(409, "NO_CHANGE", "У игрока уже такой счёт", { score: player.score });
    const event = await em.save(QuizScoreEvent, em.create(QuizScoreEvent, {
      sessionId, participantId: input.participantId, kind: "manual", delta, reason: input.reason ?? null, createdBy: userId,
    }));
    return { result: event };
  });
  return { event: result, snapshot: snapshots.host };
}

export async function voidScore(sessionId: string, eventId: string, expectedVersion?: number) {
  const { result, snapshots } = await mutate(sessionId, expectedVersion, "score_void", async (_s, em) => {
    const event = await em.findOneBy(QuizScoreEvent, { id: eventId, sessionId });
    if (!event) throw notFound("Начисление");
    if (event.voided) throw new ApiError(409, "ALREADY_VOIDED", "Начисление уже отменено");
    event.voided = true;
    return { result: await em.save(QuizScoreEvent, event) };
  });
  return { event: result, snapshot: snapshots.host };
}

// ───────────────────────────── Игроки сессии ─────────────────────────────

export async function addPlayer(sessionId: string, input: { participantId: string; startScore?: number }, expectedVersion?: number) {
  const { snapshots } = await mutate(sessionId, expectedVersion, "player_add", async (_s, em) => {
    const participant = await em.findOneBy(QuizParticipant, { id: input.participantId });
    if (!participant) throw validationError("Участник не найден");
    if (await em.findOneBy(QuizSessionParticipant, { sessionId, participantId: participant.id })) {
      throw new ApiError(409, "ALREADY_IN_SESSION", "Игрок уже в сессии");
    }
    const [{ n }] = await em.query(`SELECT COALESCE(MAX("order"), -1) + 1 AS n FROM quiz_session_participants WHERE "sessionId" = $1`, [sessionId]);
    await em.insert(QuizSessionParticipant, {
      sessionId, participantId: participant.id, order: Number(n), startScore: input.startScore ?? participant.defaultStartScore,
    });
    return { result: null };
  });
  return snapshots.host;
}

export async function patchPlayer(sessionId: string, participantId: string, input: { startScore?: number; order?: number }, expectedVersion?: number) {
  const { snapshots } = await mutate(sessionId, expectedVersion, "player_patch", async (_s, em) => {
    const member = await requireMember(em, sessionId, participantId);
    if (input.startScore !== undefined) await em.update(QuizSessionParticipant, { id: member.id }, { startScore: input.startScore });
    if (input.order !== undefined) {
      // игрок встаёт в слот order, остальные сдвигаются; слоты перенумеровываются 0..n-1 без дублей
      const all = await em.find(QuizSessionParticipant, { where: { sessionId }, order: { order: "ASC" } });
      const rest = all.filter((p) => p.id !== member.id);
      rest.splice(Math.min(input.order, rest.length), 0, member);
      for (let i = 0; i < rest.length; i++) {
        if (rest[i].order !== i) await em.update(QuizSessionParticipant, { id: rest[i].id }, { order: i });
      }
    }
    return { result: null };
  });
  return snapshots.host;
}

/** События убранного игрока остаются в журнале */
export async function removePlayer(sessionId: string, participantId: string, expectedVersion?: number) {
  const { snapshots } = await mutate(sessionId, expectedVersion, "player_remove", async (session, em) => {
    const member = await requireMember(em, sessionId, participantId);
    await em.delete(QuizSessionParticipant, { id: member.id });
    if (session.activeParticipantId === participantId) session.activeParticipantId = null;
    if (session.roundState.finalists?.includes(participantId)) {
      session.roundState = { ...session.roundState, finalists: session.roundState.finalists.filter((id) => id !== participantId) };
    }
    return { result: null };
  });
  return snapshots.host;
}

// ───────────────────────────── Создание сессии и токен ─────────────────────────────

export const newScreenToken = () => randomBytes(32).toString("base64url");

export async function createSession(input: { gameId: string; participantIds: string[]; hostName?: string | null }) {
  const unique = [...new Set(input.participantIds)];
  if (unique.length !== input.participantIds.length) throw validationError("participantIds содержит повторы");
  return AppDataSource.transaction(async (em) => {
    if (!(await em.findOneBy(QuizGame, { id: input.gameId }))) throw notFound("Игра");
    const found = unique.length ? await em.find(QuizParticipant, { where: { id: In(unique) } }) : [];
    if (found.length !== unique.length) throw validationError("Некоторые участники не найдены");
    const s = await em.save(QuizSession, em.create(QuizSession, {
      gameId: input.gameId, status: "idle", hostName: input.hostName ?? null, screenToken: newScreenToken(), version: 0,
    }));
    if (unique.length) {
      await em.insert(QuizSessionParticipant, unique.map((id, i) => ({
        sessionId: s.id, participantId: id, order: i, startScore: found.find((p) => p.id === id)!.defaultStartScore,
      })));
    }
    return s;
  });
}
