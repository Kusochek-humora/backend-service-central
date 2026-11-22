import { z } from "zod";
import { QuestionKind, baseSettings, parsePayload, symmetricPoints, KindError } from "./types";

export const wordGuessSettings = z.object({
  ...baseSettings,
  word: z.string().min(1).max(60),
  hint: z.string().max(500).optional(),
});

const isLetter = (ch: string) => ch.toLowerCase() !== ch.toUpperCase() || /\d/.test(ch);

/** Угадай слово: маска с открытыми буквами (reveal_letter). Пробелы и знаки препинания видны сразу. */
export const wordGuessKind: QuestionKind = {
  kind: "word_guess",
  settingsSchema: wordGuessSettings,
  initState: () => ({ phase: "play", letters: [] as string[] }),
  commands: {
    reveal_letter(state, payload) {
      const { letter } = parsePayload(z.object({ letter: z.string().length(1) }), payload);
      if (!isLetter(letter)) throw new KindError("VALIDATION_ERROR", "Нужна буква или цифра");
      const l = letter.toLowerCase();
      return state.letters.includes(l) ? state : { ...state, letters: [...state.letters, l] };
    },
  },
  commandRules: { reveal_letter: { phase: "play" } },
  project(q, state, { role, status }) {
    const s = wordGuessSettings.parse(q.settings);
    const full = role === "host" || status === "answer_revealed";
    const mask = [...s.word].map((ch) => ({
      char: !isLetter(ch) || full || state.letters.includes(ch.toLowerCase()) ? ch : null,
    }));
    return { hint: s.hint, letters: state.letters, mask, ...(full ? { word: s.word } : {}) };
  },
  points: (q) => symmetricPoints(q, q.price),
};
