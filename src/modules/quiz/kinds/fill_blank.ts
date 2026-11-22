import { z } from "zod";
import { QuestionKind, baseSettings, symmetricPoints } from "./types";

const MARKER = "___";
const countBlanks = (t: string) => t.split(MARKER).length - 1;

export const fillBlankSettings = z
  .object({
    ...baseSettings,
    template: z.string().min(1).max(3000),
    blanks: z.array(z.string().min(1).max(200)).min(1).max(20),
  })
  .refine((s) => countBlanks(s.template) === s.blanks.length, {
    message: `Число маркеров ${MARKER} в template должно совпадать с длиной blanks`,
    path: ["blanks"],
  });

/** Текст с пропусками. После reveal_answer пропуски заполнены. */
export const fillBlankKind: QuestionKind = {
  kind: "fill_blank",
  settingsSchema: fillBlankSettings,
  initState: () => ({ phase: "play" }),
  commands: {},
  commandRules: {},
  project(q, _state, { role, status }) {
    const s = fillBlankSettings.parse(q.settings);
    const showAnswer = role === "host" || status === "answer_revealed";
    return { template: s.template, blanksCount: s.blanks.length, ...(showAnswer ? { blanks: s.blanks } : {}) };
  },
  points: (q) => symmetricPoints(q, q.price),
};
