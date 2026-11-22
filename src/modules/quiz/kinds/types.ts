import { z, ZodType } from "zod";
import type { QuizSessionStatus } from "../../../db/entities/quiz/quiz.entity";

export type SessionStatus = QuizSessionStatus;
export type Role = "screen" | "host";

/** Блок содержимого вопроса или ответа */
export const blockSchema = z
  .object({
    type: z.enum(["text", "image", "audio", "video"]),
    text: z.string().min(1).max(5000).optional(),
    mediaId: z.uuid().optional(),
  })
  .superRefine((b, ctx) => {
    if (b.type === "text" && !b.text) ctx.addIssue({ code: "custom", path: ["text"], message: "Для блока text обязателен text" });
    if (b.type !== "text" && !b.mediaId) {
      ctx.addIssue({ code: "custom", path: ["mediaId"], message: `Для блока ${b.type} обязателен mediaId` });
    }
  });
export type Block = z.infer<typeof blockSchema>;
export const blocksSchema = z.array(blockSchema).min(1);

/** «Текст и/или медиа» — для вариантов, подсказок, элементов */
export const textOrMedia = z
  .object({ text: z.string().min(1).max(1000).optional(), mediaId: z.uuid().optional() })
  .refine((v) => v.text || v.mediaId, { message: "Нужен text или mediaId" });

export const baseSettings = { noPenalty: z.boolean().optional() };

/** Вопрос в том виде, в каком его видит движок */
export interface QuestionModel {
  id: string;
  themeId: string;
  order: number;
  price: number;
  kind: string;
  settings: any;
  content: Block[];
  answerContent: Block[];
  comment: string;
  timeLimitSec: number | null;
}

export interface PlayerScore {
  id: string;
  score: number;
}

/** Контекст, который движок передаёт механике. Чистые данные, без БД. */
export interface KindCtx {
  now: Date;
  /** случайное число сессии для перемешивания (фиксируется в state как shuffleSeed) */
  seed: number;
  activeParticipantId: string | null;
  players: PlayerScore[];
  status: SessionStatus;
}

/** Ошибка, которую механика бросает из команды; движок превращает её в результат */
export class KindError extends Error {
  constructor(
    public code: "INVALID_TRANSITION" | "VALIDATION_ERROR" | "NOT_READY",
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** Рабочее состояние вопроса. Обязательное поле phase: "prepare" | "play"; остальное зависит от механики. */
export type BaseState = Record<string, any>;

export interface CommandRule {
  /** в какой фазе вопроса команда допустима */
  phase: "prepare" | "play";
  /** статусы сессии; по умолчанию: prepare → question_shown, play → question_shown и timer_running */
  statuses?: SessionStatus[];
}

export interface QuestionKind<S = any, St extends BaseState = BaseState> {
  kind: string;
  settingsSchema: ZodType<S>;
  initState(q: QuestionModel, ctx: KindCtx): St;
  commands: Record<string, (state: St, payload: unknown, ctx: KindCtx, q: QuestionModel) => St>;
  commandRules: Record<string, CommandRule>;
  /** что показывать клиенту: зависит от роли и статуса (экран не видит верных ответов до answer_revealed) */
  project(q: QuestionModel, state: St, ctx: { role: Role; status: SessionStatus }): unknown;
  /** сколько очков «засчитать» / «не засчитать» предложить на кнопках пульта */
  points(q: QuestionModel, state: St, ctx: { activeParticipantId: string | null }): { ifCorrect: number; ifWrong: number };
  /** кто должен стать активным игроком после команды (получатель, победитель аукциона) */
  activeParticipant?(q: QuestionModel, state: St): string | null | undefined;
  /** null — можно переходить в фазу play; строка — причина отказа */
  canBeginPlay?(q: QuestionModel, state: St): string | null;
  /** лимит времени по умолчанию, если у вопроса не задан timeLimitSec (например totalSec блица) */
  defaultTimeLimitSec?(q: QuestionModel): number | null;
}

// ───────────────────────────── Помощники ─────────────────────────────

/** Разбор payload команды механики; ошибки превращаются в KindError VALIDATION_ERROR */
export function parsePayload<T>(schema: ZodType<T>, payload: unknown): T {
  const r = schema.safeParse(payload ?? {});
  if (!r.success) {
    throw new KindError("VALIDATION_ERROR", "Некорректные параметры команды", {
      issues: r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  return r.data;
}

/** Детерминированный генератор (mulberry32) — перемешивание фиксируется seed'ом из state */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Перемешивание Фишера-Йетса; для n>1 гарантированно не возвращает исходный порядок */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const rnd = seededRandom(seed);
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  if (arr.length > 1 && arr.every((x, i) => x === items[i])) arr.push(arr.shift() as T);
  return arr;
}

export const isRevealed = (status: SessionStatus) => status === "answer_revealed" || status === "finished";

/** Пара очков по умолчанию: «не засчитать» = −цена, если вопрос без риска — 0 */
export function symmetricPoints(q: QuestionModel, price: number) {
  return { ifCorrect: price, ifWrong: q.settings?.noPenalty ? 0 : -price };
}
