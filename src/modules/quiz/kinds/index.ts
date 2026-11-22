import { QuestionKind } from "./types";
import { standardKind } from "./standard";
import { optionsKind } from "./options";
import { trueFalseKind } from "./true_false";
import { hintsKind } from "./hints";
import { catInBagKind } from "./cat_in_bag";
import { auctionKind } from "./auction";
import { stakeKind } from "./stake";
import { blitzKind } from "./blitz";
import { revealImageKind } from "./reveal_image";
import { orderingKind } from "./ordering";
import { matchingKind } from "./matching";
import { fillBlankKind } from "./fill_blank";
import { wordGuessKind } from "./word_guess";

/**
 * Реестр механик. Новая механика = один файл в этой папке + одна строка здесь.
 * Движок (engine.ts) о конкретных механиках ничего не знает.
 */
const ALL: QuestionKind[] = [
  standardKind, optionsKind, trueFalseKind, hintsKind, catInBagKind, auctionKind, stakeKind,
  blitzKind, revealImageKind, orderingKind, matchingKind, fillBlankKind, wordGuessKind,
];

export const KINDS: Record<string, QuestionKind> = Object.fromEntries(ALL.map((k) => [k.kind, k]));
export const KIND_NAMES = ALL.map((k) => k.kind);

export function getKind(kind: string): QuestionKind {
  const k = KINDS[kind];
  if (!k) throw new Error(`Неизвестная механика: ${kind}`);
  return k;
}
