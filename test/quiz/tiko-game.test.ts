import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { EngineState, GameModel, applyCommand, initialState } from "../../src/modules/quiz/engine";
import { getKind } from "../../src/modules/quiz/kinds";
import { blocksSchema } from "../../src/modules/quiz/kinds/types";
import { ROUND_SETTINGS } from "../../src/modules/quiz/rounds";
import { buildSnapshot } from "../../src/modules/quiz/snapshot";
import { TIKO_GAME } from "../../src/db/seeds/data/tiko-game.data";
import { NOW } from "./fixtures";

/** Игра из данных миграции в виде модели движка (как её отдаёт loadGame: вопросы по цене по возрастанию) */
function toModel(): GameModel {
  return {
    id: randomUUID(), title: TIKO_GAME.title,
    rounds: TIKO_GAME.rounds.map((r, ri) => ({
      id: randomUUID(), order: ri, title: r.title, description: r.description, type: r.type, settings: r.settings,
      themes: r.themes.map((t, ti) => {
        const themeId = randomUUID();
        return {
          id: randomUUID(), order: ti, title: t.title,
          questions: t.questions.map((x, i) => ({ ...x, id: randomUUID(), themeId, order: i, content: x.content as any, answerContent: x.answerContent as any }))
            .sort((a, b) => a.price - b.price || a.order - b.order),
        };
      }),
    })),
  };
}

test("данные игры валидны: схемы механик, блоки, цены, раунды", () => {
  assert.equal(TIKO_GAME.rounds.map((r) => r.type).join(), "standard,standard,standard,final");
  let n = 0;
  for (const r of TIKO_GAME.rounds) {
    assert.ok(ROUND_SETTINGS[r.type].safeParse(r.settings).success, r.title);
    for (const t of r.themes) for (const x of t.questions) {
      n++;
      assert.ok(x.price > 0);
      assert.ok(getKind(x.kind).settingsSchema.safeParse(x.settings).success, `${t.title} ${x.price}: ${x.kind}`);
      assert.ok(blocksSchema.safeParse(x.content).success && blocksSchema.safeParse(x.answerContent).success, `${t.title} ${x.price}`);
    }
  }
  assert.equal(n, 61);
  // два тура по таблице: 5 тем × 5 цен
  for (const r of TIKO_GAME.rounds.slice(0, 2)) {
    assert.equal(r.themes.length, 5);
    assert.ok(r.themes.every((t) => t.questions.map((q) => q.price).join() === "100,200,300,400,500"));
  }
});

test("игру можно пройти целиком: все 61 вопрос, каждая механика, суперфинал, экран не видит ответов", () => {
  const game = toModel();
  const players = [900, 600, 300, 0].map((score) => ({ id: randomUUID(), score })); // игроков 4, но их может быть сколько угодно
  const ctx = { now: NOW, game, players, seed: 42 };
  let s: EngineState = initialState();
  const cmd = (type: string, payload?: unknown) => {
    const r = applyCommand(s, { type, payload }, ctx);
    assert.ok(r.ok, `${type} ${JSON.stringify(payload)}: ${!r.ok ? `${r.code} ${r.message}` : ""}`);
    s = r.state;
  };
  const snap = () => buildSnapshot({
    sessionId: randomUUID(), version: 1, hostName: null, state: s, game, canBack: false, now: NOW, mediaById: new Map(),
    players: players.map((p, i) => ({ id: p.id, name: `И${i}`, color: "#000000", photo: null, score: p.score, order: i })),
  }, "screen");

  cmd("start");
  const seenKinds = new Set<string>();
  for (let ri = 0; ri < game.rounds.length; ri++) {
    const round = game.rounds[ri];
    cmd("next_round");
    cmd("show_board");
    for (const theme of round.themes) {
      for (const q of theme.questions) {
        seenKinds.add(q.kind);
        cmd("set_active", { participantId: players[0].id });
        cmd("open_question", { questionId: q.id });

        // фаза prepare: кот в мешке, аукцион, ставка и любой вопрос финала
        if (round.type === "final") {
          for (const id of s.roundState.finalists!) cmd("set_stake", { participantId: id, amount: 100 });
          cmd("begin_play");
        } else if (q.kind === "cat_in_bag") {
          cmd("choose_recipient", { participantId: players[1].id }); cmd("begin_play");
        } else if (q.kind === "auction") {
          cmd("place_bid", { participantId: players[2].id, amount: 100 }); cmd("close_bidding"); cmd("begin_play");
        } else if (q.kind === "stake") {
          cmd("set_stake", { amount: 100 }); cmd("begin_play");
        }

        // экран до reveal не видит ответов
        const view = snap();
        assert.ok(!("answerContent" in view.question!), `${q.kind}: ответ виден до reveal`);
        assert.ok(!JSON.stringify(view.question!.view).includes('"isCorrect"'), `${q.kind}: isCorrect виден до reveal`);
        assert.ok(!JSON.stringify(view).includes("заметка ведущему"));

        // команды механик
        if (q.kind === "hints") cmd("reveal_hint");
        if (q.kind === "word_guess") cmd("reveal_letter", { letter: (q.settings.word as string)[0] });
        if (q.kind === "blitz") cmd("blitz_next");
        // таймер: у вопроса либо timeLimitSec, либо (блиц) totalSec
        if (q.timeLimitSec || q.kind === "blitz") cmd("start_timer");

        cmd("reveal_answer");
        assert.ok("answerContent" in snap().question!, `${q.kind}: ответа нет после reveal`);
        if (!(ri === game.rounds.length - 1)) cmd("show_board");
      }
    }
  }
  cmd("finish");
  assert.equal(s.status, "finished");
  assert.equal(s.played.length, 61);
  assert.equal(seenKinds.size, 12);
});

test("механики и подсказки в игре: нужные вопросы получили нужные kind", () => {
  const byTitle = (title: string) => TIKO_GAME.rounds.flatMap((r) => r.themes).find((t) => t.title.startsWith(title))!;
  assert.deepEqual(byTitle("Цитатаны").questions.map((q) => q.kind), Array(5).fill("fill_blank"));
  assert.deepEqual(byTitle("Комментарий").questions.map((q) => q.kind), Array(5).fill("options"));
  assert.deepEqual(byTitle("Сөздерді").questions.map((q) => q.kind), Array(5).fill("word_guess"));
  assert.deepEqual(byTitle("Осыныда").questions.slice(0, 2).map((q) => q.kind), ["hints", "hints"]);
  const final = TIKO_GAME.rounds[3];
  assert.equal(final.type, "final");
  const sf = final.themes[0].questions[0];
  assert.equal(sf.kind, "options");
  const correct = (sf.settings.options as any[]).filter((o) => o.isCorrect).map((o) => o.text);
  assert.deepEqual(correct, ["Дүйсенбі"]);
  // у вопросов без ответа в таблице есть пометка для ведущего
  const noAnswer = TIKO_GAME.rounds.flatMap((r) => r.themes.flatMap((t) => t.questions)).filter((q) => (q.answerContent[0] as any).text?.startsWith("Ответа в таблице нет"));
  assert.equal(noAnswer.length, 8);
  assert.ok(noAnswer.every((q) => q.comment.length > 0));
});
