import { z } from "zod";
import { QuestionKind, baseSettings, symmetricPoints } from "./types";

export const trueFalseSettings = z.object({
  ...baseSettings,
  correct: z.boolean(),
  explanation: z.string().max(2000).optional(),
});

/** «Верю / не верю». Верный ответ и пояснение видны экрану только после reveal_answer. */
export const trueFalseKind: QuestionKind = {
  kind: "true_false",
  settingsSchema: trueFalseSettings,
  initState: () => ({ phase: "play" }),
  commands: {},
  commandRules: {},
  project(q, _state, { role, status }) {
    const s = trueFalseSettings.parse(q.settings);
    return role === "host" || status === "answer_revealed" ? { correct: s.correct, explanation: s.explanation } : {};
  },
  points: (q) => symmetricPoints(q, q.price),
};
