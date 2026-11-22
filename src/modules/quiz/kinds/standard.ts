import { z } from "zod";
import { QuestionKind, baseSettings, symmetricPoints } from "./types";

export const standardSettings = z.object({ ...baseSettings });

/** Обычный вопрос: содержимое и ответ после reveal_answer. Своих команд нет. */
export const standardKind: QuestionKind = {
  kind: "standard",
  settingsSchema: standardSettings,
  initState: () => ({ phase: "play" }),
  commands: {},
  commandRules: {},
  project: () => ({}),
  points: (q) => symmetricPoints(q, q.price),
};
