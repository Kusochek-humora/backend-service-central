import test from "node:test";
import assert from "node:assert/strict";
import { EngineState, applyCommand, initialState } from "../../src/modules/quiz/engine";
import { buildSnapshot, PlayerRow, SnapshotInput } from "../../src/modules/quiz/snapshot";
import { MEDIA_IMG, NOW, PLAYERS, ctx, makeGame, uid } from "./fixtures";

const { game, k, rounds } = makeGame();
const C = ctx(game);

const players: PlayerRow[] = PLAYERS.map((p, i) => ({ id: p.id, name: `Игрок ${i + 1}`, color: "#112233", photo: i === 0 ? "/uploads/quiz/a.webp" : null, score: p.score, order: i }));
const mediaById = new Map([[MEDIA_IMG, { type: "image", url: "/uploads/quiz/img.webp" }]]);

function run(s: EngineState, type: string, payload?: unknown): EngineState {
  const r = applyCommand(s, { type, payload }, C);
  assert.ok(r.ok, `${type}: ${!r.ok ? r.message : ""}`);
  return r.state;
}
const input = (state: EngineState, over: Partial<SnapshotInput> = {}): SnapshotInput => ({
  sessionId: uid(), version: 7, hostName: "Ведущий", state, game, players, mediaById, canBack: true, now: NOW, ...over,
});

const board = () => run(run(run(initialState(), "start"), "next_round"), "show_board");
const open = (id: string, s = board()) => run(s, "open_question", { questionId: id });

test("screen: нет answerContent и comment до answer_revealed; host видит всё сразу", () => {
  const s = open(k.standard.id);
  const screen = buildSnapshot(input(s), "screen");
  assert.ok(!("answerContent" in screen.question!));
  assert.ok(!("comment" in screen.question!));
  assert.ok(!("pointsIfCorrect" in screen.question!));
  assert.ok(!JSON.stringify(screen).includes("заметка"));
  assert.ok(!JSON.stringify(screen).includes("Ответ standard"));

  const host = buildSnapshot(input(s), "host");
  assert.equal(host.question!.comment, "заметка standard");
  assert.ok(host.question!.answerContent);
  assert.deepEqual([host.question!.pointsIfCorrect, host.question!.pointsIfWrong], [100, -100]);

  const revealed = buildSnapshot(input(run(s, "reveal_answer")), "screen");
  assert.ok(revealed.question!.answerContent);
  assert.ok(!("comment" in revealed.question!)); // comment никогда
});

test("screen: в ячейках сетки только цена и played, host видит содержимое вопросов", () => {
  const s = board();
  const screen = buildSnapshot(input(s), "screen");
  const cell = screen.board!.themes[0].cells[0];
  assert.deepEqual(Object.keys(cell).sort(), ["played", "price", "questionId"]);
  assert.ok(!JSON.stringify(screen.board).includes("Вопрос standard"));
  const host = buildSnapshot(input(s), "host");
  assert.equal(host.board!.themes[0].cells[0].question!.comment, "заметка standard");
  assert.ok(host.board!.themes[0].cells[0].question!.content.length > 0);
});

test("ячейки по цене по возрастанию и отметка played", () => {
  const s = run(run(open(k.standard.id), "reveal_answer"), "show_board");
  const cells = buildSnapshot(input(s), "screen").board!.themes[0].cells;
  assert.deepEqual(cells.map((c) => c.price), [100, 200, 300, 400, 500]);
  assert.equal(cells[0].played, true);
  assert.equal(cells[1].played, false);
});

test("статусы: сетки и вопроса нет там, где их быть не должно", () => {
  assert.equal(buildSnapshot(input(initialState()), "screen").board, null);
  const intro = run(initialState(), "start");
  assert.equal(buildSnapshot(input(intro), "screen").board, null);
  const roundIntro = run(intro, "next_round");
  const ri = buildSnapshot(input(roundIntro), "screen");
  assert.equal(ri.board!.themes.length, 3);
  assert.equal(ri.question, null);
  assert.equal(ri.round!.total, 4);
  assert.equal(buildSnapshot(input(run(open(k.standard.id), "finish")), "screen").question, null);
  assert.equal(buildSnapshot(input(board()), "screen").question, null);
});

test("фаза prepare: у screen содержимое вопроса пусто, у host есть; view — заставка", () => {
  const s = open(k.cat.id);
  const screen = buildSnapshot(input(s), "screen");
  assert.equal(screen.question!.phase, "prepare");
  assert.deepEqual(screen.question!.content, []);
  assert.equal((screen.question!.view as any).teaser, "Кот в мешке");
  const host = buildSnapshot(input(s), "host");
  assert.ok(host.question!.content.length > 0);
  const play = buildSnapshot(input(run(run(s, "choose_recipient", { participantId: PLAYERS[1].id }), "begin_play")), "screen");
  assert.equal(play.question!.phase, "play");
  assert.ok(play.question!.content.length > 0);
  assert.equal(play.activeParticipantId, PLAYERS[1].id);
});

test("view приходит из реестра: options без isCorrect у screen до reveal", () => {
  const s = open(k.options.id);
  assert.ok((buildSnapshot(input(s), "screen").question!.view as any).options.every((o: any) => !("isCorrect" in o)));
  assert.equal((buildSnapshot(input(s), "host").question!.view as any).options[0].isCorrect, true);
});

test("players по слотам (не по рейтингу), игроков больше четырёх; нет teamScore", () => {
  const snap = buildSnapshot(input(board()), "screen");
  assert.equal(snap.players.length, 6);
  assert.deepEqual(snap.players.map((p) => p.order), [0, 1, 2, 3, 4, 5]);
  assert.equal(snap.players[0].photo, "/uploads/quiz/a.webp");
  assert.ok(!("teamScore" in snap));
  assert.equal(snap.hostName, "Ведущий");
  const many = Array.from({ length: 25 }, (_, i) => ({ id: uid(), name: `И${i}`, color: "#000000", photo: null, score: i, order: i }));
  assert.equal(buildSnapshot(input(board(), { players: many }), "screen").players.length, 25);
});

test("host: canBack и nextRoundAvailable; у screen их нет", () => {
  const s = board();
  const host = buildSnapshot(input(s), "host");
  assert.equal(host.canBack, true);
  assert.equal(host.nextRoundAvailable, true);
  const screen = buildSnapshot(input(s), "screen");
  assert.ok(!("canBack" in screen) && !("nextRoundAvailable" in screen));
  const last = { ...s, currentRoundId: rounds.r4.id };
  assert.equal(buildSnapshot(input(last), "host").nextRoundAvailable, false);
  assert.equal(buildSnapshot(input({ ...s, status: "finished" }), "host").nextRoundAvailable, false);
});

test("словарь media содержит только mediaId из снимка", () => {
  const withImg = buildSnapshot(input(open(k.revealImage.id)), "screen");
  assert.deepEqual(withImg.media, { [MEDIA_IMG]: { type: "image", url: "/uploads/quiz/img.webp" } });
  assert.deepEqual(buildSnapshot(input(open(k.standard.id)), "screen").media, {});
});

test("final: finalists, suggestedFinalists у host, ставки скрыты у screen", () => {
  let s = run(run(run(run(run(initialState(), "start"), "next_round"), "show_board"), "next_round"), "show_board");
  s = run(run(s, "next_round"), "show_board");
  assert.equal(s.currentRoundId, rounds.r3.id);
  const before = buildSnapshot(input(s), "host");
  assert.equal(before.finalists, null);
  assert.deepEqual(before.suggestedFinalists, [PLAYERS[1].id, PLAYERS[3].id]);
  assert.ok(!("suggestedFinalists" in buildSnapshot(input(s), "screen")));

  s = run(s, "open_question", { questionId: k.finalSingle.id });
  s = run(s, "set_stake", { participantId: PLAYERS[1].id, amount: 300 });
  const screen = buildSnapshot(input(s), "screen");
  assert.deepEqual(screen.finalists, [PLAYERS[1].id, PLAYERS[3].id]);
  assert.deepEqual((screen.question!.view as any).final.stakes, { [PLAYERS[1].id]: true });
  assert.equal((buildSnapshot(input(s), "host").question!.view as any).final.stakes[PLAYERS[1].id], 300);
  assert.equal(buildSnapshot(input(board()), "screen").finalists, null); // не final
});

test("elimination: темы помечаются eliminated", () => {
  let s = board();
  for (let i = 0; i < 3; i++) s = run(run(s, "next_round"), "show_board");
  s = run(s, "eliminate_theme", { themeId: rounds.r4.themes[0].id });
  const themes = buildSnapshot(input(s), "screen").board!.themes;
  assert.deepEqual(themes.map((t) => t.eliminated), [true, false, false]);
});
