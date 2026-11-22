import { z } from "zod";
import { CommandRule, KindCtx, KindError, PlayerScore, QuestionModel, Role, SessionStatus, parsePayload } from "./kinds/types";

// Типы раундов: standard — обычная сетка тем и цен; final — супер-игра.

export const standardRoundSettings = z.object({});

export const finalRoundSettings = z.object({
  /** 'leader' — игрок с максимальным счётом (при равенстве все лидеры); число N — топ-N */
  finalists: z.union([z.literal("leader"), z.number().int().positive()]).default("leader"),
  /** single_question — одна тема и один вопрос; elimination — темы вычёркиваются, последняя играется как single_question */
  mode: z.enum(["single_question", "elimination"]).default("single_question"),
});
export type FinalSettings = z.infer<typeof finalRoundSettings>;

export const ROUND_SETTINGS = { standard: standardRoundSettings, final: finalRoundSettings } as const;
export const ROUND_TYPES = ["standard", "final"] as const;
export type RoundType = (typeof ROUND_TYPES)[number];

/**
 * Финалисты по правилу. players — в порядке слотов.
 * leader: все с максимальным счётом. N: топ-N по счёту (при равенстве на границе берутся все равные).
 */
export function computeFinalists(rule: FinalSettings["finalists"], players: PlayerScore[]): string[] {
  if (players.length === 0) return [];
  const sorted = [...players].sort((a, b) => b.score - a.score);
  if (rule === "leader") return sorted.filter((p) => p.score === sorted[0].score).map((p) => p.id);
  const cutoff = sorted[Math.min(rule, sorted.length) - 1].score;
  return sorted.filter((p) => p.score >= cutoff).map((p) => p.id);
}

// ───────────────────── Надстройка вопроса в раунде final ─────────────────────
// Вопрос финала всегда начинается с фазы prepare: каждый финалист делает ставку (set_stake),
// затем begin_play. Экран до reveal_answer видит только факт ставки.

export interface FinalExtra {
  finalists: string[];
}

export function finalDecorateInit(base: Record<string, any>): Record<string, any> {
  return { ...base, phase: "prepare", stakes: {} };
}

export const finalCommandRules: Record<string, CommandRule> = { set_stake: { phase: "prepare" } };

export function finalSetStake(state: Record<string, any>, payload: unknown, ctx: KindCtx, extra: FinalExtra) {
  const { participantId, amount } = parsePayload(z.object({ participantId: z.uuid(), amount: z.number().int().positive() }), payload);
  if (!extra.finalists.includes(participantId)) throw new KindError("VALIDATION_ERROR", "Ставку делают только финалисты");
  const score = ctx.players.find((p) => p.id === participantId)?.score ?? 0;
  if (amount > score) throw new KindError("VALIDATION_ERROR", `Ставка не может быть больше счёта игрока (${score})`, { maxStake: Math.max(0, score) });
  return { ...state, stakes: { ...state.stakes, [participantId]: amount } };
}

export function finalCanBeginPlay(state: Record<string, any>, extra: FinalExtra): string | null {
  const missing = extra.finalists.filter((id) => !state.stakes?.[id]);
  return missing.length ? "Не все финалисты сделали ставку" : null;
}

export function finalProject(state: Record<string, any>, ctx: { role: Role; status: SessionStatus }, extra: FinalExtra) {
  const stakes: Record<string, number | true> = {};
  for (const [id, amount] of Object.entries<number>(state.stakes ?? {})) {
    stakes[id] = ctx.role === "host" || ctx.status === "answer_revealed" ? amount : true;
  }
  return { finalists: extra.finalists, stakes };
}

export function finalPoints(q: QuestionModel, state: Record<string, any>, active: string | null, base: { ifCorrect: number; ifWrong: number }) {
  const stake = active ? state.stakes?.[active] : undefined;
  return stake ? { ifCorrect: stake, ifWrong: q.settings?.noPenalty ? 0 : -stake } : base;
}
