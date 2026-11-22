import { z } from "zod";
import { QuestionKind, baseSettings, seededShuffle, symmetricPoints, textOrMedia } from "./types";

export const matchingSettings = z.object({
  ...baseSettings,
  pairs: z.array(z.object({ left: textOrMedia, right: textOrMedia })).min(2).max(10),
});

/** Соответствия: две перемешанные колонки; после reveal_answer показываются пары (leftId → rightId). */
export const matchingKind: QuestionKind = {
  kind: "matching",
  settingsSchema: matchingSettings,
  initState: (_q, ctx) => ({ phase: "play", shuffleSeed: ctx.seed }),
  commands: {},
  commandRules: {},
  project(q, state, { role, status }) {
    const s = matchingSettings.parse(q.settings);
    const left = s.pairs.map((p, i) => ({ id: `l${i}`, ...p.left }));
    const right = s.pairs.map((p, i) => ({ id: `r${i}`, ...p.right }));
    const showAnswer = role === "host" || status === "answer_revealed";
    return {
      left: seededShuffle(left, state.shuffleSeed),
      right: seededShuffle(right, state.shuffleSeed + 1),
      ...(showAnswer ? { pairs: s.pairs.map((_, i) => ({ leftId: `l${i}`, rightId: `r${i}` })) } : {}),
    };
  },
  points: (q) => symmetricPoints(q, q.price),
};
