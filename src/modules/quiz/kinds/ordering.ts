import { z } from "zod";
import { QuestionKind, baseSettings, seededShuffle, symmetricPoints, textOrMedia } from "./types";

export const orderingSettings = z
  .object({
    ...baseSettings,
    /** элементы в ПРАВИЛЬНОМ порядке */
    items: z.array(z.object({ id: z.string().min(1).max(64) }).and(textOrMedia)).min(2).max(12),
  })
  .refine((s) => new Set(s.items.map((i) => i.id)).size === s.items.length, { message: "id элементов должны быть уникальны", path: ["items"] });

/** Упорядочивание: экран видит перемешанные элементы (порядок зафиксирован shuffleSeed), после reveal_answer — правильный порядок. */
export const orderingKind: QuestionKind = {
  kind: "ordering",
  settingsSchema: orderingSettings,
  initState: (_q, ctx) => ({ phase: "play", shuffleSeed: ctx.seed }),
  commands: {},
  commandRules: {},
  project(q, state, { role, status }) {
    const s = orderingSettings.parse(q.settings);
    const shuffled = seededShuffle(s.items, state.shuffleSeed);
    const showAnswer = role === "host" || status === "answer_revealed";
    return { items: shuffled, ...(showAnswer ? { correctOrder: s.items.map((i) => i.id) } : {}) };
  },
  points: (q) => symmetricPoints(q, q.price),
};
