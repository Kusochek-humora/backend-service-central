import { z } from "zod";
import { KindError, QuestionKind, baseSettings, blocksSchema, isRevealed } from "./types";

export const blitzSettings = z.object({
  ...baseSettings,
  items: z.array(z.object({ content: blocksSchema, answerContent: blocksSchema })).min(2),
  perItemSec: z.number().int().positive().optional(),
  totalSec: z.number().int().positive().optional(),
  pointsPerItem: z.number().int().positive(),
});

/** Блиц: серия коротких вопросов. Оператор листает пункты (blitz_next / blitz_back), очки за пункты начисляет через /scores. */
export const blitzKind: QuestionKind = {
  kind: "blitz",
  settingsSchema: blitzSettings,
  initState: () => ({ phase: "play", index: 0 }),
  commands: {
    blitz_next(state, _p, _ctx, q) {
      const s = blitzSettings.parse(q.settings);
      if (state.index >= s.items.length - 1) throw new KindError("INVALID_TRANSITION", "Это последний пункт блица", { code: "NO_MORE_ITEMS" });
      return { ...state, index: state.index + 1 };
    },
    blitz_back(state) {
      if (state.index <= 0) throw new KindError("INVALID_TRANSITION", "Это первый пункт блица", { code: "NO_MORE_ITEMS" });
      return { ...state, index: state.index - 1 };
    },
  },
  commandRules: { blitz_next: { phase: "play" }, blitz_back: { phase: "play" } },
  defaultTimeLimitSec: (q) => blitzSettings.parse(q.settings).totalSec ?? null,
  project(q, state, { role, status }) {
    const s = blitzSettings.parse(q.settings);
    const item = s.items[state.index];
    const base = { index: state.index, total: s.items.length, perItemSec: s.perItemSec, totalSec: s.totalSec, pointsPerItem: s.pointsPerItem };
    if (role === "host") return { ...base, item, answers: s.items.map((i) => i.answerContent) };
    return {
      ...base,
      item: { content: item.content },
      // ответы всех пунктов экран получает только после reveal_answer
      ...(isRevealed(status) ? { answers: s.items.map((i) => i.answerContent) } : {}),
    };
  },
  points: (q) => {
    const per = blitzSettings.parse(q.settings).pointsPerItem;
    return { ifCorrect: per, ifWrong: q.settings?.noPenalty ? 0 : -per };
  },
};
