import { z } from "zod";
import { QuestionKind, baseSettings, symmetricPoints } from "./types";

const option = z
  .object({
    id: z.string().min(1).max(64),
    text: z.string().min(1).max(1000).optional(),
    mediaId: z.uuid().optional(),
    isCorrect: z.boolean(),
  })
  .refine((o) => o.text || o.mediaId, { message: "У варианта должен быть text или mediaId" });

/** variant=choice — выбор ответа; variant=odd_one_out — «найти лишнее» (те же данные, другой заголовок на экране) */
export const optionsSettings = z
  .object({
    ...baseSettings,
    variant: z.enum(["choice", "odd_one_out"]).default("choice"),
    multiple: z.boolean().default(false),
    options: z.array(option).min(2).max(8),
  })
  .superRefine((s, ctx) => {
    if (new Set(s.options.map((o) => o.id)).size !== s.options.length) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "id вариантов должны быть уникальны" });
    }
    if (!s.options.some((o) => o.isCorrect)) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Нужен минимум один верный вариант" });
    }
  });

export const optionsKind: QuestionKind = {
  kind: "options",
  settingsSchema: optionsSettings,
  initState: () => ({ phase: "play" }),
  commands: {},
  commandRules: {},
  project(q, _state, { role, status }) {
    const s = optionsSettings.parse(q.settings);
    const showCorrect = role === "host" || status === "answer_revealed";
    return {
      variant: s.variant,
      multiple: s.multiple,
      options: s.options.map((o) => ({
        id: o.id,
        text: o.text,
        mediaId: o.mediaId,
        ...(showCorrect ? { isCorrect: o.isCorrect } : {}),
      })),
    };
  },
  points: (q) => symmetricPoints(q, q.price),
};
