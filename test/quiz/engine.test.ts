import test from "node:test";
import assert from "node:assert/strict";
import { EngineCommand, EngineState, TRANSITIONS, applyCommand, initialState, questionPoints, questionView } from "../../src/modules/quiz/engine";
import { PLAYERS, ctx, makeGame, stateWith, uid } from "./fixtures";
import { computeFinalists } from "../../src/modules/quiz/rounds";

const { game, k, rounds } = makeGame();
const C = ctx(game);

function run(state: EngineState, type: string, payload?: unknown, c = C): EngineState {
  const r = applyCommand(state, { type, payload }, c);
  assert.ok(r.ok, `${type}: ${!r.ok ? `${r.code} ${r.message}` : ""}`);
  return r.state;
}
function err(state: EngineState, type: string, payload?: unknown, c = C) {
  const r = applyCommand(state, { type, payload }, c);
  assert.ok(!r.ok, `${type} должна завершиться ошибкой`);
  return r.ok ? null : r;
}

const toBoard = (roundIdx = 0): EngineState => {
  let s = run(initialState(), "start");
  for (let i = 0; i <= roundIdx; i++) s = run(i === 0 ? s : run(s, "show_board"), "next_round");
  return run(s, "show_board");
};
const open = (s: EngineState, id: string) => run(s, "open_question", { questionId: id });
const view = (s: EngineState, role: "screen" | "host", q = k.standard, roundIdx = 0) =>
  questionView(game.rounds[roundIdx], q, s.questionStates[q.id], s, role) as any;

// ───────────────────── Основные переходы ─────────────────────

test("полный сценарий: start → next_round → show_board → open → timer → reveal → show_board → next_round → finish", () => {
  let s = run(initialState(), "start");
  assert.equal(s.status, "intro");
  s = run(s, "next_round");
  assert.equal(s.status, "round_intro");
  assert.equal(s.currentRoundId, rounds.r1.id);
  s = run(s, "show_board");
  assert.equal(s.status, "board");
  s = open(s, k.standard.id);
  assert.equal(s.status, "question_shown");
  s = run(s, "start_timer");
  assert.equal(s.status, "timer_running");
  assert.equal(s.timerEndsAt, new Date(C.now.getTime() + 30_000).toISOString());
  s = run(s, "reveal_answer");
  assert.equal(s.status, "answer_revealed");
  assert.equal(s.timerEndsAt, null);
  s = run(s, "show_board");
  assert.equal(s.status, "board");
  assert.equal(s.currentQuestionId, null);
  s = run(s, "next_round");
  assert.equal(s.currentRoundId, rounds.r2.id);
  s = run(s, "finish");
  assert.equal(s.status, "finished");
});

test("таблица переходов: каждая команда допустима только из своих статусов", () => {
  const statuses = ["idle", "intro", "round_intro", "board", "question_shown", "timer_running", "answer_revealed", "finished"] as const;
  const board = toBoard();
  const shown = open(board, k.standard.id);
  const make = (status: (typeof statuses)[number]): EngineState => {
    switch (status) {
      case "idle": return initialState();
      case "intro": return run(initialState(), "start");
      case "round_intro": return run(run(initialState(), "start"), "next_round");
      case "board": return board;
      case "question_shown": return shown;
      case "timer_running": return run(shown, "start_timer");
      case "answer_revealed": return run(shown, "reveal_answer");
      case "finished": return run(shown, "finish");
    }
  };
  const payloads: Record<string, unknown> = { open_question: { questionId: k.options.id }, set_active: { participantId: null } };
  for (const cmd of ["start", "next_round", "show_board", "open_question", "start_timer", "reveal_answer", "set_active", "finish"]) {
    for (const status of statuses) {
      const allowed = TRANSITIONS[cmd].from.includes(status);
      const r = applyCommand(make(status), { type: cmd, payload: payloads[cmd] }, C);
      if (!allowed) {
        assert.ok(!r.ok && r.code === "INVALID_TRANSITION", `${cmd} в ${status} должна давать INVALID_TRANSITION`);
      } else if (!r.ok) {
        assert.notEqual(r.code, "INVALID_TRANSITION", `${cmd} в ${status} не должна быть INVALID_TRANSITION: ${r.message}`);
      }
    }
  }
});

test("finish доступна из любого статуса, кроме idle", () => {
  assert.equal(err(initialState(), "finish")!.code, "INVALID_TRANSITION");
  assert.equal(run(toBoard(), "finish").status, "finished");
});

test("повторное открытие сыгранного вопроса — ALREADY_PLAYED", () => {
  let s = open(toBoard(), k.standard.id);
  assert.ok(s.played.includes(k.standard.id));
  s = run(run(s, "reveal_answer"), "show_board");
  assert.equal(err(s, "open_question", { questionId: k.standard.id })!.code, "ALREADY_PLAYED");
});

test("open_question: вопрос из другого раунда и несуществующий", () => {
  assert.equal(err(toBoard(), "open_question", { questionId: k.team.id })!.code, "QUESTION_NOT_FOUND");
  assert.equal(err(toBoard(), "open_question", { questionId: uid() })!.code, "QUESTION_NOT_FOUND");
  assert.equal(err(toBoard(), "open_question", {})!.code, "VALIDATION_ERROR");
});

test("смена раунда и NO_MORE_ROUNDS", () => {
  let s = toBoard(3);
  assert.equal(s.currentRoundId, rounds.r4.id);
  assert.equal(err(s, "next_round")!.code, "NO_MORE_ROUNDS");
  s = toBoard(0);
  s = run(s, "next_round");
  assert.equal(s.roundState.finalists, null);
});

test("start без раундов — NO_ROUNDS", () => {
  assert.equal(err(initialState(), "start", undefined, ctx({ ...game, rounds: [] }))!.code, "NO_ROUNDS");
});

test("start_timer без time_limit — NO_TIMER; set_active проверяет участника", () => {
  const noTimer = { ...game, rounds: [{ ...rounds.r1, themes: [{ ...rounds.r1.themes[0], questions: [{ ...k.standard, timeLimitSec: null }] }] }] };
  const c = ctx(noTimer);
  let s = run(run(run(run(initialState(), "start", undefined, c), "next_round", undefined, c), "show_board", undefined, c), "open_question", { questionId: k.standard.id }, c);
  assert.equal(err(s, "start_timer", undefined, c)!.code, "NO_TIMER");
  s = run(toBoard(), "set_active", { participantId: PLAYERS[2].id });
  assert.equal(s.activeParticipantId, PLAYERS[2].id);
  assert.equal(err(s, "set_active", { participantId: uid() })!.code, "PARTICIPANT_NOT_FOUND");
  assert.equal(run(s, "set_active", { participantId: null }).activeParticipantId, null);
});

test("команда механики не к своему вопросу и вне вопроса — INVALID_TRANSITION", () => {
  assert.equal(err(toBoard(), "reveal_hint")!.code, "INVALID_TRANSITION");
  assert.equal(err(open(toBoard(), k.standard.id), "reveal_hint")!.code, "INVALID_TRANSITION");
  assert.equal(err(open(toBoard(), k.standard.id), "blitz_next")!.code, "INVALID_TRANSITION");
});

// ───────────────────── Фаза prepare ─────────────────────

test("cat_in_bag: prepare, start_timer запрещён, получатель становится активным", () => {
  const board = run(toBoard(), "set_active", { participantId: PLAYERS[0].id });
  let s = open(board, k.cat.id);
  assert.equal(s.questionStates[k.cat.id].phase, "prepare");
  assert.equal(err(s, "start_timer")!.code, "INVALID_TRANSITION");
  assert.equal(err(s, "begin_play")!.code, "NOT_READY");
  assert.equal(err(s, "choose_recipient", { participantId: PLAYERS[0].id })!.code, "VALIDATION_ERROR"); // себе нельзя
  assert.equal(err(s, "choose_recipient", { participantId: uid() })!.code, "VALIDATION_ERROR");
  s = run(s, "choose_recipient", { participantId: PLAYERS[3].id });
  assert.equal(s.activeParticipantId, PLAYERS[3].id);
  s = run(s, "begin_play");
  assert.equal(s.questionStates[k.cat.id].phase, "play");
  assert.equal(s.status, "question_shown");
  assert.equal(run(s, "start_timer").status, "timer_running");
  assert.equal(err(s, "choose_recipient", { participantId: PLAYERS[1].id })!.code, "INVALID_TRANSITION"); // уже play
  // экран в prepare видит заставку, пульт — то же без содержимого вопроса (содержимое режется в снимке)
  assert.equal(view(open(board, k.cat.id), "screen", k.cat).teaser, "Кот в мешке");
});

test("cat_in_bag с allowSelf=true разрешает передать вопрос себе", () => {
  const self = { ...k.cat, settings: { ...k.cat.settings, allowSelf: true } };
  const game2 = { ...game, rounds: [{ ...rounds.r1, themes: [{ ...rounds.r1.themes[0], questions: [self] }] }, ...game.rounds.slice(1)] };
  const c2 = ctx(game2);
  let st = run(run(run(run(initialState(), "start", undefined, c2), "next_round", undefined, c2), "show_board", undefined, c2), "set_active", { participantId: PLAYERS[0].id }, c2);
  st = run(st, "open_question", { questionId: self.id }, c2);
  assert.equal(run(st, "choose_recipient", { participantId: PLAYERS[0].id }, c2).questionStates[self.id].recipientId, PLAYERS[0].id);
});

test("auction: минимальные ставки, закрытие, победитель активен, цена = ставка", () => {
  let s = open(toBoard(), k.auction.id);
  assert.equal(err(s, "close_bidding")!.code, "VALIDATION_ERROR"); // нет ставок
  assert.equal(err(s, "place_bid", { participantId: PLAYERS[0].id, amount: 50 })!.code, "VALIDATION_ERROR"); // меньше startBid
  s = run(s, "place_bid", { participantId: PLAYERS[0].id, amount: 100 });
  assert.equal(err(s, "place_bid", { participantId: PLAYERS[1].id, amount: 120 })!.code, "VALIDATION_ERROR"); // меньше шага
  s = run(s, "place_bid", { participantId: PLAYERS[1].id, amount: 150 });
  assert.equal(err(s, "begin_play")!.code, "NOT_READY");
  s = run(s, "close_bidding");
  assert.equal(s.activeParticipantId, PLAYERS[1].id);
  assert.equal(err(s, "place_bid", { participantId: PLAYERS[2].id, amount: 300 })!.code, "INVALID_TRANSITION"); // торги закрыты
  s = run(s, "begin_play");
  assert.deepEqual(questionPoints(rounds.r1, k.auction, s.questionStates[k.auction.id], s), { ifCorrect: 150, ifWrong: -150 });
});

test("stake: потолок по счёту игрока, begin_play только после ставки, ±ставка", () => {
  let s = open(run(toBoard(), "set_active", { participantId: PLAYERS[2].id }), k.stake.id); // у p3 счёт 200
  assert.equal(err(s, "begin_play")!.code, "NOT_READY");
  assert.equal(err(s, "set_stake", { amount: 500 })!.code, "VALIDATION_ERROR");
  assert.equal(err(s, "set_stake", { amount: 0 })!.code, "VALIDATION_ERROR");
  s = run(s, "set_stake", { amount: 150 });
  s = run(s, "begin_play");
  assert.deepEqual(questionPoints(rounds.r1, k.stake, s.questionStates[k.stake.id], s), { ifCorrect: 150, ifWrong: -150 });
  // явный participantId
  const s2 = run(open(toBoard(), k.stake.id), "set_stake", { participantId: PLAYERS[1].id, amount: 500 });
  assert.equal(s2.activeParticipantId, PLAYERS[1].id);
  assert.equal(err(open(toBoard(), k.stake.id), "set_stake", { amount: 10 })!.code, "VALIDATION_ERROR"); // нет игрока для потолка 'score'
});

// ───────────────────── Механики ─────────────────────

test("options: экран не видит isCorrect до reveal_answer, пульт видит", () => {
  const s = open(toBoard(), k.options.id);
  assert.ok(view(s, "screen", k.options).options.every((o: any) => !("isCorrect" in o)));
  assert.equal(view(s, "host", k.options).options[0].isCorrect, true);
  const r = run(s, "reveal_answer");
  assert.equal(view(r, "screen", k.options).options[0].isCorrect, true);
});

test("true_false: ответ только после reveal_answer", () => {
  const s = open(toBoard(), k.trueFalse.id);
  assert.deepEqual(view(s, "screen", k.trueFalse), {});
  assert.equal(view(s, "host", k.trueFalse).correct, true);
  assert.equal(view(run(s, "reveal_answer"), "screen", k.trueFalse).explanation, "потому что");
});

test("hints: подсказки по одной, экран видит только открытые, цена падает", () => {
  let s = open(toBoard(), k.hints.id);
  assert.deepEqual(view(s, "screen", k.hints).hints, []);
  assert.equal(view(s, "host", k.hints).hints.length, 2);
  assert.equal(questionPoints(rounds.r1, k.hints, s.questionStates[k.hints.id], s).ifCorrect, 400);
  s = run(s, "reveal_hint");
  assert.deepEqual(view(s, "screen", k.hints).hints, [{ text: "подсказка 1" }]);
  s = run(run(s, "start_timer"), "reveal_hint");
  assert.equal(questionPoints(rounds.r1, k.hints, s.questionStates[k.hints.id], s).ifCorrect, 300);
  assert.equal(err(s, "reveal_hint")!.code, "INVALID_TRANSITION");
  assert.equal(err(run(s, "reveal_answer"), "reveal_hint")!.code, "INVALID_TRANSITION");
});

test("blitz: листание пунктов с границами, defaultTimeLimit из totalSec, экран без ответов до reveal", () => {
  let s = open(toBoard(), k.blitz.id);
  assert.equal(err(s, "blitz_back")!.code, "INVALID_TRANSITION");
  s = run(s, "start_timer"); // timeLimitSec=null → totalSec 60
  assert.equal(s.timerEndsAt, new Date(C.now.getTime() + 60_000).toISOString());
  s = run(run(s, "blitz_next"), "blitz_next");
  assert.equal(err(s, "blitz_next")!.code, "INVALID_TRANSITION");
  assert.equal(view(s, "screen", k.blitz).index, 2);
  assert.ok(!("answers" in view(s, "screen", k.blitz)));
  assert.ok("answerContent" in view(s, "host", k.blitz).item);
  assert.ok("answers" in view(run(s, "reveal_answer"), "screen", k.blitz));
  assert.equal(run(s, "blitz_back").questionStates[k.blitz.id].index, 1);
  assert.deepEqual(questionPoints(rounds.r1, k.blitz, s.questionStates[k.blitz.id], s), { ifCorrect: 10, ifWrong: -10 });
});

test("reveal_image: шаги, штраф за шаг, предел", () => {
  let s = open(toBoard(), k.revealImage.id);
  s = run(run(s, "reveal_step"), "reveal_step");
  assert.equal(view(s, "screen", k.revealImage).step, 2);
  assert.equal(questionPoints(rounds.r1, k.revealImage, s.questionStates[k.revealImage.id], s).ifCorrect, 340);
  s = run(s, "reveal_step");
  assert.equal(err(s, "reveal_step")!.code, "INVALID_TRANSITION");
});

test("ordering: порядок фиксируется shuffleSeed, верный порядок только после reveal_answer", () => {
  const s = open(toBoard(), k.ordering.id);
  const a = view(s, "screen", k.ordering);
  const b = view(s, "screen", k.ordering);
  assert.deepEqual(a.items, b.items);
  assert.notDeepEqual(a.items.map((i: any) => i.id), ["1", "2", "3", "4"]);
  assert.ok(!("correctOrder" in a));
  assert.deepEqual(view(s, "host", k.ordering).correctOrder, ["1", "2", "3", "4"]);
  assert.deepEqual(view(run(s, "reveal_answer"), "screen", k.ordering).correctOrder, ["1", "2", "3", "4"]);
});

test("matching: колонки перемешаны, пары только после reveal_answer", () => {
  const s = open(toBoard(), k.matching.id);
  const a = view(s, "screen", k.matching);
  assert.equal(a.left.length, 3);
  assert.ok(!("pairs" in a));
  assert.deepEqual(view(run(s, "reveal_answer"), "screen", k.matching).pairs, [
    { leftId: "l0", rightId: "r0" }, { leftId: "l1", rightId: "r1" }, { leftId: "l2", rightId: "r2" },
  ]);
  assert.ok("pairs" in view(s, "host", k.matching));
});

test("fill_blank: пропуски заполнены только после reveal_answer", () => {
  const s = open(toBoard(), k.fillBlank.id);
  assert.ok(!("blanks" in view(s, "screen", k.fillBlank)));
  assert.deepEqual(view(run(s, "reveal_answer"), "screen", k.fillBlank).blanks, ["Франции", "Париж"]);
});

test("word_guess: маска, открытие букв без учёта регистра, знаки видны сразу", () => {
  let s = open(toBoard(), k.wordGuess.id);
  const chars = (st: EngineState, role: "screen" | "host" = "screen") => view(st, role, k.wordGuess).mask.map((m: any) => m.char);
  assert.deepEqual(chars(s), [null, null, null, "-", null, null, null, null, null, null]);
  s = run(s, "reveal_letter", { letter: "К" });
  s = run(s, "reveal_letter", { letter: "о" });
  assert.deepEqual(chars(s).slice(0, 3), ["К", "о", null]);
  assert.equal(run(s, "reveal_letter", { letter: "к" }).questionStates[k.wordGuess.id].letters.length, 2); // повтор не дублирует
  assert.equal(err(s, "reveal_letter", { letter: "кк" })!.code, "VALIDATION_ERROR");
  assert.equal(err(s, "reveal_letter", { letter: "-" })!.code, "VALIDATION_ERROR");
  assert.ok(!("word" in view(s, "screen", k.wordGuess)));
  assert.equal(view(s, "host", k.wordGuess).word, "Кот-учёный");
  assert.ok(chars(run(s, "reveal_answer")).every((c: any) => c !== null));
});

test("noPenalty: неверный ответ даёт 0, standard возвращает ±цена", () => {
  const s = open(toBoard(), k.noPenalty.id);
  assert.deepEqual(questionPoints(rounds.r1, k.noPenalty, s.questionStates[k.noPenalty.id], s), { ifCorrect: 400, ifWrong: 0 });
  const t = open(toBoard(), k.standard.id);
  assert.deepEqual(questionPoints(rounds.r1, k.standard, t.questionStates[k.standard.id], t), { ifCorrect: 100, ifWrong: -100 });
});

// ───────────────────── Раунд final ─────────────────────

test("computeFinalists: leader, ничья, топ-N, много игроков", () => {
  assert.deepEqual(computeFinalists("leader", PLAYERS), [PLAYERS[1].id, PLAYERS[3].id]); // оба по 500
  assert.deepEqual(computeFinalists("leader", [{ id: "a", score: 5 }, { id: "b", score: 9 }]), ["b"]);
  assert.deepEqual(computeFinalists(3, PLAYERS), [PLAYERS[1].id, PLAYERS[3].id, PLAYERS[0].id]);
  assert.deepEqual(computeFinalists(1, PLAYERS), [PLAYERS[1].id, PLAYERS[3].id]); // граница: берутся все равные
  assert.deepEqual(computeFinalists("leader", []), []);
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `x${i}`, score: i }));
  assert.equal(computeFinalists(10, many).length, 10);
});

const toFinal = (roundIdx: number) => toBoard(roundIdx);

test("final single_question: финалисты по правилу, ставки ≤ счёта, экран видит факт ставки", () => {
  let s = toFinal(2);
  assert.equal(s.currentRoundId, rounds.r3.id);
  s = open(s, k.finalSingle.id);
  assert.deepEqual(s.roundState.finalists, [PLAYERS[1].id, PLAYERS[3].id]);
  assert.equal(s.questionStates[k.finalSingle.id].phase, "prepare");
  assert.equal(err(s, "start_timer")!.code, "INVALID_TRANSITION");
  assert.equal(err(s, "set_stake", { participantId: PLAYERS[0].id, amount: 10 })!.code, "VALIDATION_ERROR"); // не финалист
  assert.equal(err(s, "set_stake", { participantId: PLAYERS[1].id, amount: 501 })!.code, "VALIDATION_ERROR"); // больше счёта
  s = run(s, "set_stake", { participantId: PLAYERS[1].id, amount: 400 });
  assert.equal(err(s, "begin_play")!.code, "NOT_READY"); // не все поставили
  s = run(s, "set_stake", { participantId: PLAYERS[3].id, amount: 100 });
  s = run(s, "begin_play");
  const screen = view(s, "screen", k.finalSingle, 2);
  assert.deepEqual(screen.final.stakes, { [PLAYERS[1].id]: true, [PLAYERS[3].id]: true });
  assert.equal(view(s, "host", k.finalSingle, 2).final.stakes[PLAYERS[1].id], 400);
  assert.equal(view(run(s, "reveal_answer"), "screen", k.finalSingle, 2).final.stakes[PLAYERS[1].id], 400);
  // очки ± ставка активного финалиста
  const withActive = run(s, "set_active", { participantId: PLAYERS[1].id });
  assert.deepEqual(questionPoints(rounds.r3, k.finalSingle, withActive.questionStates[k.finalSingle.id], withActive), { ifCorrect: 400, ifWrong: -400 });
  assert.equal(run(s, "start_timer").status, "timer_running");
});

test("select_finalists: только в final, игроки должны быть в сессии", () => {
  assert.equal(err(toBoard(), "select_finalists", { participantIds: [PLAYERS[0].id] })!.code, "INVALID_TRANSITION"); // не final
  let s = toFinal(2);
  assert.equal(err(s, "select_finalists", { participantIds: [uid()] })!.code, "PARTICIPANT_NOT_FOUND");
  assert.equal(err(s, "select_finalists", { participantIds: [] })!.code, "VALIDATION_ERROR");
  s = run(s, "select_finalists", { participantIds: [PLAYERS[0].id, PLAYERS[2].id, PLAYERS[4].id] });
  assert.equal(open(s, k.finalSingle.id).roundState.finalists!.length, 3);
  // из round_intro тоже можно
  let intro = run(initialState(), "start");
  for (let i = 0; i < 3; i++) intro = run(i === 0 ? intro : run(intro, "show_board"), "next_round");
  assert.equal(intro.status, "round_intro");
  assert.equal(intro.currentRoundId, rounds.r3.id);
  assert.deepEqual(run(intro, "select_finalists", { participantIds: [PLAYERS[5].id] }).roundState.finalists, [PLAYERS[5].id]);
});

test("final elimination: вычёркивание тем, последняя открывается как single_question", () => {
  let s = toFinal(3);
  const [a, b, c3] = rounds.r4.themes;
  assert.equal(err(s, "open_question", { questionId: k.elim1.id })!.code, "INVALID_TRANSITION"); // темы ещё не вычеркнуты
  s = run(s, "eliminate_theme", { themeId: a.id });
  assert.equal(err(s, "eliminate_theme", { themeId: a.id })!.code, "INVALID_TRANSITION"); // уже вычеркнута
  assert.equal(err(s, "eliminate_theme", { themeId: uid() })!.code, "VALIDATION_ERROR");
  s = run(s, "eliminate_theme", { themeId: b.id });
  assert.equal(err(s, "eliminate_theme", { themeId: c3.id })!.code, "INVALID_TRANSITION"); // последнюю нельзя
  assert.equal(err(s, "open_question", { questionId: k.elim1.id })!.code, "INVALID_TRANSITION"); // вычеркнутая тема
  s = open(s, k.elim3.id);
  assert.equal(s.questionStates[k.elim3.id].phase, "prepare");
  assert.equal(s.roundState.finalists!.length, 2); // топ-2: p2, p4 (по 500), граница не размывается
  // вне final / не elimination
  assert.equal(err(toBoard(), "eliminate_theme", { themeId: a.id })!.code, "INVALID_TRANSITION");
  assert.equal(err(toFinal(2), "eliminate_theme", { themeId: rounds.r3.themes[0].id })!.code, "INVALID_TRANSITION");
});

test("игроков может быть сколько угодно: 40 игроков", () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ id: uid(), score: i * 10 }));
  const c = ctx(game, { players: many });
  let s = run(run(run(initialState(), "start", undefined, c), "next_round", undefined, c), "show_board", undefined, c);
  s = run(s, "set_active", { participantId: many[39].id }, c);
  assert.equal(s.activeParticipantId, many[39].id);
  assert.deepEqual(computeFinalists("leader", many), [many[39].id]);
  assert.equal(computeFinalists(10, many).length, 10);
});

test("goto_round: к предыдущему раунду, сыгранные вопросы остаются сыгранными, next_round идёт дальше от выбранного", () => {
  let s = open(toBoard(), k.standard.id);
  s = run(run(s, "reveal_answer"), "show_board");
  s = run(run(s, "next_round"), "show_board"); // второй раунд
  assert.equal(s.currentRoundId, rounds.r2.id);
  s = run(s, "goto_round", { roundId: rounds.r1.id });
  assert.equal(s.status, "round_intro");
  assert.equal(s.currentRoundId, rounds.r1.id);
  assert.equal(s.currentQuestionId, null);
  assert.ok(s.played.includes(k.standard.id)); // ранее сыгранный вопрос остаётся сыгранным
  s = run(s, "show_board");
  assert.equal(err(s, "open_question", { questionId: k.standard.id })!.code, "ALREADY_PLAYED");
  assert.equal(run(run(s, "next_round"), "show_board").currentRoundId, rounds.r2.id);
});

test("goto_round: допустима из intro, round_intro и board; из остальных статусов и с чужим раундом — ошибка", () => {
  const intro = run(initialState(), "start");
  assert.equal(run(intro, "goto_round", { roundId: rounds.r3.id }).currentRoundId, rounds.r3.id);
  const board = toBoard();
  assert.equal(run(run(board, "next_round"), "goto_round", { roundId: rounds.r1.id }).status, "round_intro");
  assert.equal(err(open(board, k.standard.id), "goto_round", { roundId: rounds.r1.id })!.code, "INVALID_TRANSITION");
  assert.equal(err(initialState(), "goto_round", { roundId: rounds.r1.id })!.code, "INVALID_TRANSITION");
  assert.equal(err(board, "goto_round", { roundId: uid() })!.code, "VALIDATION_ERROR");
  assert.equal(err(board, "goto_round", {})!.code, "VALIDATION_ERROR");
  // сброс состояния финала при переходе
  let f = run(toBoard(2), "select_finalists", { participantIds: [PLAYERS[0].id] });
  assert.deepEqual(f.roundState.finalists, [PLAYERS[0].id]);
  f = run(f, "goto_round", { roundId: rounds.r3.id });
  assert.equal(f.roundState.finalists, null);
});
