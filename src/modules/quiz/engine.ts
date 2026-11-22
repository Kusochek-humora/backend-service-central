// Игровой движок. Чистые функции: (state, command, context) => новое состояние | ошибка.
// Никакой БД и сети. О конкретных механиках вопросов движок ничего не знает: они приходят из реестра kinds/.

import { z } from "zod";
import { getKind } from "./kinds";
import {
  CommandRule,
  KindCtx,
  KindError,
  PlayerScore,
  QuestionKind,
  QuestionModel,
  Role,
  SessionStatus,
} from "./kinds/types";
import {
  FinalSettings,
  RoundType,
  computeFinalists,
  finalCanBeginPlay,
  finalCommandRules,
  finalDecorateInit,
  finalPoints,
  finalProject,
  finalRoundSettings,
  finalSetStake,
} from "./rounds";

export type { SessionStatus, Role };

// ───────────────────────────── Модель игры и состояние ─────────────────────────────

export interface ThemeModel {
  id: string;
  order: number;
  title: string;
  /** по цене по возрастанию, затем по order */
  questions: QuestionModel[];
}

export interface RoundModel {
  id: string;
  order: number;
  title: string;
  description: string;
  type: RoundType;
  settings: Record<string, any>;
  themes: ThemeModel[];
}

export interface GameModel {
  id: string;
  title: string;
  rounds: RoundModel[];
}

export interface RoundState {
  finalists: string[] | null;
  eliminatedThemeIds: string[];
}

export interface EngineState {
  status: SessionStatus;
  currentRoundId: string | null;
  currentQuestionId: string | null;
  activeParticipantId: string | null;
  /** ISO */
  timerEndsAt: string | null;
  roundState: RoundState;
  /** рабочее состояние вопросов сессии (session_question_state.state) по id вопроса */
  questionStates: Record<string, Record<string, any>>;
  /** сыгранные вопросы (session_played_questions) */
  played: string[];
}

export interface EngineContext {
  now: Date;
  game: GameModel;
  /** игроки сессии в порядке слотов, со счётом */
  players: PlayerScore[];
  /** случайное число для перемешивания (в state фиксируется как shuffleSeed) */
  seed: number;
}

export interface EngineCommand {
  type: string;
  payload?: unknown;
}

export type EngineErrorCode =
  | "INVALID_TRANSITION"
  | "VALIDATION_ERROR"
  | "NO_MORE_ROUNDS"
  | "NO_ROUNDS"
  | "ALREADY_PLAYED"
  | "QUESTION_NOT_FOUND"
  | "PARTICIPANT_NOT_FOUND"
  | "NO_TIMER"
  | "NOT_READY"
  | "NO_FINALISTS";

export type EngineResult =
  | { ok: true; state: EngineState }
  | { ok: false; code: EngineErrorCode; message: string; details?: Record<string, unknown> };

export const initialState = (): EngineState => ({
  status: "idle",
  currentRoundId: null,
  currentQuestionId: null,
  activeParticipantId: null,
  timerEndsAt: null,
  roundState: { finalists: null, eliminatedThemeIds: [] },
  questionStates: {},
  played: [],
});

const fail = (code: EngineErrorCode, message: string, details?: Record<string, unknown>): EngineResult => ({
  ok: false, code, message, ...(details ? { details } : {}),
});
const ok = (state: EngineState): EngineResult => ({ ok: true, state });

// ───────────────────────────── Поиск по модели ─────────────────────────────

export const currentRound = (s: EngineState, g: GameModel) => g.rounds.find((r) => r.id === s.currentRoundId) ?? null;

export function findQuestion(g: GameModel, id: string | null) {
  if (!id) return null;
  for (const round of g.rounds) {
    for (const theme of round.themes) {
      const question = theme.questions.find((q) => q.id === id);
      if (question) return { round, theme, question };
    }
  }
  return null;
}

export function nextRoundOf(s: EngineState, g: GameModel): RoundModel | null {
  const sorted = g.rounds;
  if (!s.currentRoundId) return sorted[0] ?? null;
  const idx = sorted.findIndex((r) => r.id === s.currentRoundId);
  return sorted[idx + 1] ?? null;
}

const finalCfg = (round: RoundModel): FinalSettings => finalRoundSettings.parse(round.settings);
const remainingThemes = (round: RoundModel, s: EngineState) =>
  round.themes.filter((t) => !s.roundState.eliminatedThemeIds.includes(t.id));

const kindCtx = (s: EngineState, c: EngineContext): KindCtx => ({
  now: c.now, seed: c.seed, activeParticipantId: s.activeParticipantId, players: c.players, status: s.status,
});

function zodFail(err: z.ZodError): EngineResult {
  return fail("VALIDATION_ERROR", "Некорректные параметры команды", {
    issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  });
}

// ───────────────────────────── Таблица переходов ─────────────────────────────
// Для каждой основной команды: из каких статусов допустима и что делает.
// Недопустимый статус → 409 INVALID_TRANSITION (проверяется единообразно в applyCommand).

type Apply = (s: EngineState, payload: unknown, c: EngineContext) => EngineResult;
interface Transition {
  from: SessionStatus[];
  to: SessionStatus | "same";
  apply: Apply;
}

const ALL_BUT_IDLE: SessionStatus[] = ["intro", "round_intro", "board", "question_shown", "timer_running", "answer_revealed", "finished"];

const startApply: Apply = (s, _p, c) =>
  c.game.rounds.length === 0 ? fail("NO_ROUNDS", "В игре нет раундов") : ok({ ...s });

const nextRoundApply: Apply = (s, _p, c) => {
  const next = nextRoundOf(s, c.game);
  if (!next) return fail("NO_MORE_ROUNDS", "Раундов больше нет");
  return ok({
    ...s,
    currentRoundId: next.id,
    currentQuestionId: null,
    timerEndsAt: null,
    roundState: { finalists: null, eliminatedThemeIds: [] },
  });
};

/** Перейти к любому раунду игры, в том числе к предыдущему. Сыгранные вопросы остаются сыгранными. */
const gotoRoundApply: Apply = (s, payload, c) => {
  const parsed = z.object({ roundId: z.uuid() }).safeParse(payload);
  if (!parsed.success) return zodFail(parsed.error);
  const round = c.game.rounds.find((r) => r.id === parsed.data.roundId);
  if (!round) return fail("VALIDATION_ERROR", "Раунд не найден в этой игре");
  return ok({
    ...s,
    currentRoundId: round.id,
    currentQuestionId: null,
    timerEndsAt: null,
    roundState: { finalists: null, eliminatedThemeIds: [] },
  });
};

const showBoardApply: Apply = (s) => ok({ ...s, currentQuestionId: null, activeParticipantId: null, timerEndsAt: null });

const openQuestionApply: Apply = (s, payload, c) => {
  const parsed = z.object({ questionId: z.uuid() }).safeParse(payload);
  if (!parsed.success) return zodFail(parsed.error);
  const round = currentRound(s, c.game);
  if (!round) return fail("INVALID_TRANSITION", "Раунд не выбран");
  const found = findQuestion(c.game, parsed.data.questionId);
  if (!found || found.round.id !== round.id) return fail("QUESTION_NOT_FOUND", "Вопрос не найден в текущем раунде");
  if (s.played.includes(found.question.id)) return fail("ALREADY_PLAYED", "Этот вопрос уже сыгран");

  let roundState = s.roundState;
  if (round.type === "final") {
    const cfg = finalCfg(round);
    if (cfg.mode === "elimination") {
      const left = remainingThemes(round, s);
      if (left.length !== 1) {
        return fail("INVALID_TRANSITION", "В режиме elimination сначала вычеркните темы: должна остаться одна", { themesLeft: left.length });
      }
      if (left[0].id !== found.theme.id) return fail("INVALID_TRANSITION", "Можно открыть вопрос только оставшейся темы");
    }
    if (!roundState.finalists) {
      const finalists = computeFinalists(cfg.finalists, c.players);
      if (finalists.length === 0) return fail("NO_FINALISTS", "Нет игроков для финала");
      roundState = { ...roundState, finalists };
    }
  }

  const kind = getKind(found.question.kind);
  let qs = kind.initState(found.question, kindCtx(s, c));
  if (round.type === "final") qs = finalDecorateInit(qs);

  return ok({
    ...s,
    status: "question_shown",
    roundState,
    currentQuestionId: found.question.id,
    timerEndsAt: null,
    played: [...s.played, found.question.id],
    questionStates: { ...s.questionStates, [found.question.id]: qs },
  });
};

const startTimerApply: Apply = (s, _p, c) => {
  const found = findQuestion(c.game, s.currentQuestionId);
  if (!found) return fail("INVALID_TRANSITION", "Нет открытого вопроса");
  if (s.questionStates[found.question.id]?.phase !== "play") {
    return fail("INVALID_TRANSITION", "Таймер нельзя запустить в фазе prepare: сначала begin_play");
  }
  const limit = found.question.timeLimitSec ?? getKind(found.question.kind).defaultTimeLimitSec?.(found.question) ?? null;
  if (!limit) return fail("NO_TIMER", "У вопроса не задан лимит времени");
  return ok({ ...s, status: "timer_running", timerEndsAt: new Date(c.now.getTime() + limit * 1000).toISOString() });
};

const revealAnswerApply: Apply = (s) => ok({ ...s, status: "answer_revealed", timerEndsAt: null });

const setActiveApply: Apply = (s, payload, c) => {
  const parsed = z.object({ participantId: z.uuid().nullable() }).safeParse(payload);
  if (!parsed.success) return zodFail(parsed.error);
  const id = parsed.data.participantId;
  if (id && !c.players.some((p) => p.id === id)) return fail("PARTICIPANT_NOT_FOUND", "Этого игрока нет в сессии");
  return ok({ ...s, activeParticipantId: id });
};

const finishApply: Apply = (s) => ok({ ...s, timerEndsAt: null });

const beginPlayApply: Apply = (s, _p, c) => {
  const found = findQuestion(c.game, s.currentQuestionId);
  if (!found) return fail("INVALID_TRANSITION", "Нет открытого вопроса");
  const qs = s.questionStates[found.question.id];
  if (qs?.phase !== "prepare") return fail("INVALID_TRANSITION", "Вопрос не в фазе prepare");
  const reason =
    found.round.type === "final"
      ? finalCanBeginPlay(qs, { finalists: s.roundState.finalists ?? [] })
      : getKind(found.question.kind).canBeginPlay?.(found.question, qs) ?? null;
  if (reason) return fail("NOT_READY", reason);
  return ok({ ...s, questionStates: { ...s.questionStates, [found.question.id]: { ...qs, phase: "play" } } });
};

const selectFinalistsApply: Apply = (s, payload, c) => {
  const round = currentRound(s, c.game);
  if (!round || round.type !== "final") return fail("INVALID_TRANSITION", "select_finalists доступна только в раунде final");
  const parsed = z.object({ participantIds: z.array(z.uuid()).min(1) }).safeParse(payload);
  if (!parsed.success) return zodFail(parsed.error);
  const ids = [...new Set(parsed.data.participantIds)];
  if (ids.some((id) => !c.players.some((p) => p.id === id))) return fail("PARTICIPANT_NOT_FOUND", "Среди финалистов есть игрок, которого нет в сессии");
  return ok({ ...s, roundState: { ...s.roundState, finalists: ids } });
};

const eliminateThemeApply: Apply = (s, payload, c) => {
  const round = currentRound(s, c.game);
  if (!round || round.type !== "final" || finalCfg(round).mode !== "elimination") {
    return fail("INVALID_TRANSITION", "eliminate_theme доступна только в раунде final с mode=elimination");
  }
  const parsed = z.object({ themeId: z.uuid() }).safeParse(payload);
  if (!parsed.success) return zodFail(parsed.error);
  const themeId = parsed.data.themeId;
  if (!round.themes.some((t) => t.id === themeId)) return fail("VALIDATION_ERROR", "Тема не найдена в текущем раунде");
  if (s.roundState.eliminatedThemeIds.includes(themeId)) return fail("INVALID_TRANSITION", "Тема уже вычеркнута");
  if (remainingThemes(round, s).length <= 1) return fail("INVALID_TRANSITION", "Нельзя вычеркнуть последнюю тему");
  return ok({ ...s, roundState: { ...s.roundState, eliminatedThemeIds: [...s.roundState.eliminatedThemeIds, themeId] } });
};

export const TRANSITIONS: Record<string, Transition> = {
  start:            { from: ["idle"], to: "intro", apply: startApply },
  next_round:       { from: ["intro", "board"], to: "round_intro", apply: nextRoundApply },
  goto_round:       { from: ["intro", "round_intro", "board"], to: "round_intro", apply: gotoRoundApply },
  show_board:       { from: ["round_intro", "answer_revealed"], to: "board", apply: showBoardApply },
  open_question:    { from: ["board"], to: "question_shown", apply: openQuestionApply },
  start_timer:      { from: ["question_shown"], to: "timer_running", apply: startTimerApply },
  reveal_answer:    { from: ["question_shown", "timer_running"], to: "answer_revealed", apply: revealAnswerApply },
  set_active:       { from: ["board", "question_shown", "timer_running", "answer_revealed"], to: "same", apply: setActiveApply },
  finish:           { from: ALL_BUT_IDLE, to: "finished", apply: finishApply },
  begin_play:       { from: ["question_shown"], to: "same", apply: beginPlayApply },
  select_finalists: { from: ["round_intro", "board"], to: "same", apply: selectFinalistsApply },
  eliminate_theme:  { from: ["board"], to: "same", apply: eliminateThemeApply },
};

export const CORE_COMMANDS = Object.keys(TRANSITIONS);

// ───────────────────────────── Команды механик ─────────────────────────────

function mechanicCommand(s: EngineState, cmd: EngineCommand, c: EngineContext): EngineResult {
  const found = findQuestion(c.game, s.currentQuestionId);
  const invalid = (msg: string) => fail("INVALID_TRANSITION", msg, { status: s.status });
  if (!found || !["question_shown", "timer_running"].includes(s.status)) {
    return invalid(`Команда ${cmd.type} недоступна в статусе ${s.status}`);
  }
  const { round, question } = found;
  const kind: QuestionKind = getKind(question.kind);
  const finalExtra = { finalists: s.roundState.finalists ?? [] };

  // сначала надстройка раунда (final: set_stake), затем сама механика
  const viaRound = round.type === "final" && cmd.type in finalCommandRules;
  const rule: CommandRule | undefined = viaRound ? finalCommandRules[cmd.type] : kind.commandRules[cmd.type];
  if (!rule) return invalid(`Команда ${cmd.type} не относится к механике ${question.kind}`);

  const allowed = rule.statuses ?? (rule.phase === "prepare" ? ["question_shown"] : ["question_shown", "timer_running"]);
  if (!allowed.includes(s.status)) return invalid(`Команда ${cmd.type} недоступна в статусе ${s.status}`);
  const qs = s.questionStates[question.id];
  if (!qs || qs.phase !== rule.phase) return invalid(`Команда ${cmd.type} допустима только в фазе ${rule.phase}`);

  try {
    const ctx = kindCtx(s, c);
    const next = viaRound ? finalSetStake(qs, cmd.payload, ctx, finalExtra) : kind.commands[cmd.type](qs, cmd.payload, ctx, question);
    let activeParticipantId = s.activeParticipantId;
    if (!viaRound) {
      const forced = kind.activeParticipant?.(question, next);
      if (forced) activeParticipantId = forced;
    }
    return ok({ ...s, activeParticipantId, questionStates: { ...s.questionStates, [question.id]: next } });
  } catch (e) {
    if (e instanceof KindError) {
      return fail(e.code === "NOT_READY" ? "NOT_READY" : e.code, e.message, { status: s.status, ...e.details });
    }
    throw e;
  }
}

// ───────────────────────────── Точка входа ─────────────────────────────

export function applyCommand(state: EngineState, cmd: EngineCommand, ctx: EngineContext): EngineResult {
  const t = TRANSITIONS[cmd.type];
  if (!t) return mechanicCommand(state, cmd, ctx);
  if (!t.from.includes(state.status)) {
    return fail("INVALID_TRANSITION", `Команда ${cmd.type} недоступна в статусе ${state.status}`, { status: state.status });
  }
  const res = t.apply(state, cmd.payload, ctx);
  if (!res.ok) return res;
  return ok(t.to === "same" ? res.state : { ...res.state, status: t.to });
}

// ───────────────────────────── Проекция и очки вопроса ─────────────────────────────

export function questionView(round: RoundModel, q: QuestionModel, qs: Record<string, any>, s: EngineState, role: Role) {
  const view = getKind(q.kind).project(q, qs, { role, status: s.status }) as Record<string, unknown>;
  if (round.type !== "final") return view;
  return { ...view, final: finalProject(qs, { role, status: s.status }, { finalists: s.roundState.finalists ?? [] }) };
}

export function questionPoints(round: RoundModel, q: QuestionModel, qs: Record<string, any>, s: EngineState) {
  const base = getKind(q.kind).points(q, qs, { activeParticipantId: s.activeParticipantId });
  return round.type === "final" ? finalPoints(q, qs, s.activeParticipantId, base) : base;
}
