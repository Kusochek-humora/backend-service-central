import { z } from "zod";
import { KindError, QuestionKind, baseSettings, symmetricPoints } from "./types";

export const revealImageSettings = z.object({
  ...baseSettings,
  mediaId: z.uuid(),
  mode: z.enum(["blur", "tiles"]),
  steps: z.number().int().min(2).max(10),
  penaltyPerStep: z.number().int().min(0).default(0),
});

/** Картинка открывается по шагам (reveal_step). Чем больше шагов открыто, тем дешевле ответ. */
export const revealImageKind: QuestionKind = {
  kind: "reveal_image",
  settingsSchema: revealImageSettings,
  initState: () => ({ phase: "play", step: 0 }),
  commands: {
    reveal_step(state, _p, _ctx, q) {
      const s = revealImageSettings.parse(q.settings);
      if (state.step >= s.steps) throw new KindError("INVALID_TRANSITION", "Картинка уже открыта полностью", { code: "NO_MORE_STEPS" });
      return { ...state, step: state.step + 1 };
    },
  },
  commandRules: { reveal_step: { phase: "play" } },
  project(q, state) {
    const s = revealImageSettings.parse(q.settings);
    return { mediaId: s.mediaId, mode: s.mode, steps: s.steps, step: state.step };
  },
  points(q, state) {
    const s = revealImageSettings.parse(q.settings);
    return symmetricPoints(q, Math.max(0, q.price - state.step * s.penaltyPerStep));
  },
};
