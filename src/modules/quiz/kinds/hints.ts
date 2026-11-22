import { z } from "zod";
import { KindError, QuestionKind, baseSettings, symmetricPoints, textOrMedia } from "./types";

export const hintsSettings = z.object({
  ...baseSettings,
  penaltyPerHint: z.number().int().min(0),
  hints: z.array(textOrMedia).min(1).max(5),
});

const priceNow = (price: number, penalty: number, shown: number) => Math.max(0, price - shown * penalty);

/** Подсказки открываются по одной (reveal_hint). Цена: max(0, price − n·penaltyPerHint). */
export const hintsKind: QuestionKind = {
  kind: "hints",
  settingsSchema: hintsSettings,
  initState: () => ({ phase: "play", hintsShown: 0 }),
  commands: {
    reveal_hint(state, _payload, _ctx, q) {
      const s = hintsSettings.parse(q.settings);
      if (state.hintsShown >= s.hints.length) throw new KindError("INVALID_TRANSITION", "Подсказок больше нет", { code: "NO_MORE_HINTS" });
      return { ...state, hintsShown: state.hintsShown + 1 };
    },
  },
  commandRules: { reveal_hint: { phase: "play" } },
  project(q, state, { role }) {
    const s = hintsSettings.parse(q.settings);
    const shown = state.hintsShown as number;
    return role === "host"
      ? { hintsShown: shown, hintsTotal: s.hints.length, penaltyPerHint: s.penaltyPerHint, hints: s.hints.map((h, i) => ({ ...h, shown: i < shown })) }
      : { hintsShown: shown, hintsTotal: s.hints.length, penaltyPerHint: s.penaltyPerHint, hints: s.hints.slice(0, shown) };
  },
  points(q, state) {
    const s = hintsSettings.parse(q.settings);
    return symmetricPoints(q, priceNow(q.price, s.penaltyPerHint, state.hintsShown));
  },
};
