// Снимок состояния сессии. Чистая функция: данные ей приносит сервис.
// Один формат для всех клиентов, но экран не получает ничего лишнего: ответов, заметок, содержимого сетки.

import {
  EngineState,
  GameModel,
  RoundModel,
  currentRound,
  findQuestion,
  nextRoundOf,
  questionPoints,
  questionView,
} from "./engine";
import { Block, Role, SessionStatus } from "./kinds/types";
import { computeFinalists, finalRoundSettings } from "./rounds";
import { collectMediaIds } from "./mediaIds";

export type SnapshotRole = Role;

export interface PlayerRow {
  id: string;
  name: string;
  color: string;
  photo: string | null;
  score: number;
  order: number;
}

export interface SnapshotInput {
  sessionId: string;
  version: number;
  hostName: string | null;
  state: EngineState;
  game: GameModel;
  players: PlayerRow[];
  /** id → { type, url } для всех файлов игры и фото игроков */
  mediaById: Map<string, { type: string; url: string }>;
  canBack: boolean;
  now: Date;
}

export interface SessionSnapshot {
  sessionId: string;
  version: number;
  status: SessionStatus;
  /** ISO — чтобы экран мог вычислить сдвиг своих часов */
  serverTime: string;
  timerEndsAt: string | null;
  hostName: string | null;
  round: {
    id: string; title: string; description: string; order: number; total: number;
    type: "standard" | "final"; settings: Record<string, unknown>;
  } | null;
  board: {
    themes: {
      id: string; title: string;
      /** только раунд final, режим elimination */
      eliminated?: boolean;
      cells: { questionId: string; price: number; played: boolean;
        /** только host: что откроется */
        question?: { kind: string; content: Block[]; answerContent: Block[]; comment: string } }[];
    }[];
  } | null;
  question: {
    id: string; kind: string; price: number; timeLimitSec: number | null; themeId: string; themeTitle: string;
    phase: "prepare" | "play";
    /** блоки вопроса; в фазе prepare для screen пусто */
    content: Block[];
    /** ответ реестра механик: project() */
    view: unknown;
    /** для screen только при answer_revealed */
    answerContent?: Block[];
    /** только host */
    pointsIfCorrect?: number;
    pointsIfWrong?: number;
    comment?: string;
  } | null;
  /** раунд final: выбранные финалисты (null — ещё не выбраны) */
  finalists: string[] | null;
  /** только host, раунд final, пока финалисты не выбраны: кого предлагает правило */
  suggestedFinalists?: string[];
  activeParticipantId: string | null;
  /** по слотам (order), не по рейтингу; игроков может быть сколько угодно */
  players: PlayerRow[];
  /** mediaId → файл для всех mediaId, встречающихся в снимке */
  media: Record<string, { type: string; url: string }>;
  // только host:
  canBack?: boolean;
  nextRoundAvailable?: boolean;
}

const BOARD_STATUSES: SessionStatus[] = ["round_intro", "board", "question_shown", "timer_running", "answer_revealed"];
const QUESTION_STATUSES: SessionStatus[] = ["question_shown", "timer_running", "answer_revealed"];

function buildBoard(round: RoundModel, s: EngineState, role: Role): NonNullable<SessionSnapshot["board"]> {
  const elimination = round.type === "final" && finalRoundSettings.parse(round.settings).mode === "elimination";
  return {
    themes: round.themes.map((t) => ({
      id: t.id,
      title: t.title,
      ...(elimination ? { eliminated: s.roundState.eliminatedThemeIds.includes(t.id) } : {}),
      cells: t.questions.map((q) => ({
        questionId: q.id,
        price: q.price,
        played: s.played.includes(q.id),
        ...(role === "host" ? { question: { kind: q.kind, content: q.content, answerContent: q.answerContent, comment: q.comment } } : {}),
      })),
    })),
  };
}

export function buildSnapshot(input: SnapshotInput, role: Role): SessionSnapshot {
  const { state, game } = input;
  const round = currentRound(state, game);
  const found = QUESTION_STATUSES.includes(state.status) ? findQuestion(game, state.currentQuestionId) : null;
  const qs = found ? state.questionStates[found.question.id] : undefined;

  let question: SessionSnapshot["question"] = null;
  if (found && qs) {
    const { question: q, theme, round: qRound } = found;
    const host = role === "host";
    const phase = qs.phase as "prepare" | "play";
    const points = host ? questionPoints(qRound, q, qs, state) : null;
    question = {
      id: q.id, kind: q.kind, price: q.price, timeLimitSec: q.timeLimitSec,
      themeId: theme.id, themeTitle: theme.title, phase,
      content: !host && phase === "prepare" ? [] : q.content,
      view: questionView(qRound, q, qs, state, role),
      ...(host || state.status === "answer_revealed" ? { answerContent: q.answerContent } : {}),
      ...(host ? { pointsIfCorrect: points!.ifCorrect, pointsIfWrong: points!.ifWrong, comment: q.comment } : {}),
    };
  }

  const isFinal = round?.type === "final";
  const snapshot: SessionSnapshot = {
    sessionId: input.sessionId,
    version: input.version,
    status: state.status,
    serverTime: input.now.toISOString(),
    timerEndsAt: state.timerEndsAt,
    hostName: input.hostName,
    round: round
      ? { id: round.id, title: round.title, description: round.description, order: round.order, total: game.rounds.length, type: round.type, settings: round.settings }
      : null,
    board: round && BOARD_STATUSES.includes(state.status) ? buildBoard(round, state, role) : null,
    question,
    finalists: isFinal ? state.roundState.finalists : null,
    activeParticipantId: state.activeParticipantId,
    players: input.players,
    media: {},
  };

  if (role === "host") {
    snapshot.canBack = input.canBack;
    snapshot.nextRoundAvailable = state.status !== "finished" && nextRoundOf(state, game) !== null;
    if (isFinal && !state.roundState.finalists) {
      snapshot.suggestedFinalists = computeFinalists(
        finalRoundSettings.parse(round!.settings).finalists,
        input.players.map((p) => ({ id: p.id, score: p.score })),
      );
    }
  }

  // словарь файлов: только те mediaId, что реально попали в снимок
  for (const id of collectMediaIds(snapshot.question, snapshot.board)) {
    const m = input.mediaById.get(id);
    if (m) snapshot.media[id] = m;
  }
  return snapshot;
}
