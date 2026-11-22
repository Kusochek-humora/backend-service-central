import { randomUUID } from "crypto";
import { EngineContext, EngineState, GameModel, QuestionModel, RoundModel, ThemeModel, initialState } from "../../src/modules/quiz/engine";
import { getKind } from "../../src/modules/quiz/kinds";

export const uid = () => randomUUID();
export const NOW = new Date("2026-01-01T12:00:00.000Z");

const text = (t: string) => [{ type: "text" as const, text: t }];
export const MEDIA_IMG = uid();
export const MEDIA_VIDEO = uid();
export const MEDIA_AUDIO = uid();

export function q(kind: string, settings: Record<string, unknown>, price: number, over: Partial<QuestionModel> = {}): QuestionModel {
  // настройки проходят через схему механики, как при сохранении вопроса (подставляются значения по умолчанию)
  const parsed = getKind(kind).settingsSchema.parse(settings);
  return {
    id: uid(), themeId: "", order: 0, price, kind, settings: parsed,
    content: text(`Вопрос ${kind}`), answerContent: text(`Ответ ${kind}`), comment: `заметка ${kind}`, timeLimitSec: 30, ...over,
  };
}

const theme = (title: string, order: number, questions: QuestionModel[]): ThemeModel => {
  const id = uid();
  questions.forEach((x, i) => { x.themeId = id; x.order = i; });
  return { id, order, title, questions };
};
const round = (order: number, title: string, type: "standard" | "final", settings: Record<string, unknown>, themes: ThemeModel[]): RoundModel =>
  ({ id: uid(), order, title, description: "", type, settings, themes });

export function makeGame() {
  const k = {
    standard: q("standard", {}, 100),
    options: q("options", { options: [{ id: "a", text: "Верный", isCorrect: true }, { id: "b", text: "Неверный", isCorrect: false }] }, 200),
    trueFalse: q("true_false", { correct: true, explanation: "потому что" }, 300),
    hints: q("hints", { penaltyPerHint: 50, hints: [{ text: "подсказка 1" }, { text: "подсказка 2" }] }, 400),
    cat: q("cat_in_bag", { teaser: "Кот в мешке" }, 500),
    auction: q("auction", { startBid: 100, step: 50 }, 100),
    stake: q("stake", { maxStake: "score" }, 200),
    blitz: q("blitz", { pointsPerItem: 10, totalSec: 60, items: [
      { content: text("п1"), answerContent: text("о1") }, { content: text("п2"), answerContent: text("о2") }, { content: text("п3"), answerContent: text("о3") },
    ] }, 300, { timeLimitSec: null }),
    revealImage: q("reveal_image", { mediaId: MEDIA_IMG, mode: "blur", steps: 3, penaltyPerStep: 30 }, 400),
    ordering: q("ordering", { items: [{ id: "1", text: "первый" }, { id: "2", text: "второй" }, { id: "3", text: "третий" }, { id: "4", text: "четвёртый" }] }, 500),
    matching: q("matching", { pairs: [{ left: { text: "А" }, right: { text: "1" } }, { left: { text: "Б" }, right: { text: "2" } }, { left: { text: "В" }, right: { text: "3" } }] }, 100),
    fillBlank: q("fill_blank", { template: "Столица ___ — ___", blanks: ["Франции", "Париж"] }, 200),
    wordGuess: q("word_guess", { word: "Кот-учёный", hint: "сказка" }, 300),
    noPenalty: q("standard", { noPenalty: true }, 400),
    team: q("standard", {}, 100),
    finalSingle: q("standard", {}, 1000, { timeLimitSec: 60 }),
    elim1: q("standard", {}, 100), elim2: q("standard", {}, 100), elim3: q("standard", {}, 100),
  };

  const r1 = round(0, "Основной раунд", "standard", {}, [
    theme("Тема 1", 0, [k.standard, k.options, k.trueFalse, k.hints, k.cat]),
    theme("Тема 2", 1, [k.auction, k.stake, k.blitz, k.revealImage, k.ordering]),
    theme("Тема 3", 2, [k.matching, k.fillBlank, k.wordGuess, k.noPenalty]),
  ]);
  const r2 = round(1, "Командный раунд", "standard", {}, [theme("Командная тема", 0, [k.team])]);
  const r3 = round(2, "Супер-игра", "final", { finalists: "leader", mode: "single_question" }, [theme("Финал", 0, [k.finalSingle])]);
  const r4 = round(3, "Финал с вычёркиванием", "final", { finalists: 2, mode: "elimination" }, [
    theme("Т-А", 0, [k.elim1]), theme("Т-Б", 1, [k.elim2]), theme("Т-В", 2, [k.elim3]),
  ]);
  const game: GameModel = { id: uid(), title: "Тестовая игра", rounds: [r1, r2, r3, r4] };
  return { game, k, rounds: { r1, r2, r3, r4 } };
}

/** 6 игроков (игроков не 4), у каждого свой счёт */
export const PLAYERS = ["p1", "p2", "p3", "p4", "p5", "p6"].map((_, i) => ({ id: uid(), score: [300, 500, 200, 500, 100, 0][i] }));

export function ctx(game: GameModel, over: Partial<EngineContext> = {}): EngineContext {
  return { now: NOW, game, players: PLAYERS, seed: 12345, ...over };
}

export const stateWith = (over: Partial<EngineState>): EngineState => ({ ...initialState(), ...over });
