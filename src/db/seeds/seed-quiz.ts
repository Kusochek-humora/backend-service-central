import "reflect-metadata";
import bcrypt from "bcryptjs";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { AppDataSource } from "../data-source";
import {
  QuizGame, QuizMedia, QuizParticipant, QuizQuestion, QuizRound, QuizTheme, QuizUser,
} from "../entities/quiz/quiz.entity";
import { getKind } from "../../modules/quiz/kinds";
import { syncQuestionMedia } from "../../modules/quiz/media.service";
import { collectMediaIds } from "../../modules/quiz/mediaIds";
import { QUIZ_UPLOAD_DIR } from "../../modules/quiz/common";

// Использование:
//   QUIZ_ADMIN_LOGIN=admin QUIZ_ADMIN_PASSWORD=секрет12 npm run seed:quiz
// Создаёт первого админа квиза (если логина ещё нет), 4 игроков и демо-игру (если игр ещё нет).
// Открытой регистрации нет: остальных пользователей создаёт админ через POST /api/users.

const text = (t: string) => [{ type: "text" as const, text: t }];

async function main() {
  const login = process.env.QUIZ_ADMIN_LOGIN || process.env.ADMIN_LOGIN;
  const password = process.env.QUIZ_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!login || !password || password.length < 8) {
    throw new Error("Задайте QUIZ_ADMIN_LOGIN и QUIZ_ADMIN_PASSWORD (минимум 8 символов)");
  }

  await AppDataSource.initialize();
  const em = AppDataSource.manager;

  if (await em.findOneBy(QuizUser, { login })) {
    console.log(`Админ "${login}" уже существует, пропускаю`);
  } else {
    await em.save(QuizUser, em.create(QuizUser, { login, role: "admin", passwordHash: await bcrypt.hash(password, 10) }));
    console.log(`Админ "${login}" создан`);
  }

  if ((await em.count(QuizGame)) > 0) {
    console.log("Игры уже есть, демо-игру не создаю");
    return;
  }

  // 4 игрока для примера (число игроков в сессии не ограничено)
  if ((await em.count(QuizParticipant)) === 0) {
    const colors = ["#4f8bff", "#f5b400", "#2fbf8a", "#f25c5c"];
    for (let i = 0; i < 4; i++) await em.save(QuizParticipant, em.create(QuizParticipant, { name: `Игрок ${i + 1}`, color: colors[i] }));
  }

  // картинка для механики reveal_image
  await fs.mkdir(QUIZ_UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}.webp`;
  await sharp({ create: { width: 960, height: 540, channels: 3, background: { r: 60, g: 90, b: 200 } } })
    .composite([{ input: { create: { width: 480, height: 270, channels: 3, background: { r: 245, g: 180, b: 0 } } }, top: 135, left: 240 }])
    .webp().toFile(path.join(QUIZ_UPLOAD_DIR, filename));
  const stat = await fs.stat(path.join(QUIZ_UPLOAD_DIR, filename));
  const media = await em.save(QuizMedia, em.create(QuizMedia, { type: "image", path: `quiz/${filename}`, originalName: "demo.webp", mime: "image/webp", size: stat.size }));

  const game = await em.save(QuizGame, em.create(QuizGame, { title: "Демо-игра", description: "Три раунда: обычный, «Командный раунд» и супер-игра. По вопросу на каждую механику." }));

  const addRound = (title: string, order: number, type: "standard" | "final", settings: Record<string, unknown>, description = "") =>
    em.save(QuizRound, em.create(QuizRound, { gameId: game.id, title, order, type, settings, description }));
  const addTheme = (roundId: string, title: string, order: number) => em.save(QuizTheme, em.create(QuizTheme, { roundId, title, order }));
  let n = 0;
  const addQ = async (themeId: string, price: number, kind: string, settings: Record<string, unknown>, q: string, a: string, extra: Partial<QuizQuestion> = {}) => {
    const parsed = getKind(kind).settingsSchema.parse(settings) as Record<string, unknown>;
    const content = extra.content ?? text(q);
    const answerContent = extra.answerContent ?? text(a);
    const row = await em.save(QuizQuestion, em.create(QuizQuestion, {
      themeId, order: n++, price, kind, settings: parsed, content, answerContent, comment: `Заметка ведущему: ${kind}`, timeLimitSec: 30, ...extra,
    }));
    await syncQuestionMedia(em, row.id, collectMediaIds(content, answerContent, parsed));
    return row;
  };

  const r1 = await addRound("Основной раунд", 0, "standard", {}, "Сетка тем и цен");
  const t1 = await addTheme(r1.id, "Общие знания", 0);
  await addQ(t1.id, 100, "standard", {}, "Как называется самая большая планета Солнечной системы?", "Юпитер");
  await addQ(t1.id, 200, "options", { variant: "choice", options: [{ id: "a", text: "Астана", isCorrect: true }, { id: "b", text: "Алматы", isCorrect: false }, { id: "c", text: "Шымкент", isCorrect: false }] }, "Столица Казахстана?", "Астана");
  await addQ(t1.id, 300, "true_false", { correct: false, explanation: "Великая Китайская стена не видна из космоса невооружённым глазом" }, "Великую Китайскую стену видно из космоса невооружённым глазом", "Нет, это миф");
  await addQ(t1.id, 400, "hints", { penaltyPerHint: 100, hints: [{ text: "Это животное" }, { text: "Живёт в Африке" }, { text: "У него длинная шея" }] }, "Что за животное?", "Жираф");
  await addQ(t1.id, 500, "ordering", { items: [{ id: "1", text: "Меркурий" }, { id: "2", text: "Венера" }, { id: "3", text: "Земля" }, { id: "4", text: "Марс" }] }, "Расставьте планеты по удалённости от Солнца", "Меркурий, Венера, Земля, Марс");

  const t2 = await addTheme(r1.id, "Механики", 1);
  await addQ(t2.id, 100, "cat_in_bag", { teaser: "Кот в мешке! Кому передадим вопрос?", allowSelf: false }, "Сколько океанов на Земле?", "Пять");
  await addQ(t2.id, 200, "auction", { startBid: 100, step: 50 }, "Какой химический элемент обозначается Au?", "Золото");
  await addQ(t2.id, 300, "stake", { maxStake: "score" }, "Сколько хромосом у человека?", "46");
  await addQ(t2.id, 400, "blitz", {
    pointsPerItem: 50, totalSec: 60, perItemSec: 10,
    items: [
      { content: text("Столица Франции"), answerContent: text("Париж") },
      { content: text("Столица Италии"), answerContent: text("Рим") },
      { content: text("Столица Японии"), answerContent: text("Токио") },
    ],
  }, "Блиц: назовите столицы", "Париж, Рим, Токио", { timeLimitSec: null });
  await addQ(t2.id, 500, "reveal_image", { mediaId: media.id, mode: "blur", steps: 4, penaltyPerStep: 100 }, "Что на картинке?", "Демо-картинка");

  const t3 = await addTheme(r1.id, "Слова", 2);
  await addQ(t3.id, 100, "matching", { pairs: [{ left: { text: "Франция" }, right: { text: "Париж" } }, { left: { text: "Италия" }, right: { text: "Рим" } }, { left: { text: "Испания" }, right: { text: "Мадрид" } }] }, "Соедините страны и столицы", "Франция — Париж, Италия — Рим, Испания — Мадрид");
  await addQ(t3.id, 200, "fill_blank", { template: "___ — столица России, а ___ — столица Казахстана", blanks: ["Москва", "Астана"] }, "Вставьте пропущенные слова", "Москва, Астана");
  await addQ(t3.id, 300, "word_guess", { word: "Кот-учёный", hint: "Герой пушкинской поэмы" }, "Угадайте слово", "Кот-учёный");
  await addQ(t3.id, 400, "options", { variant: "odd_one_out", options: [{ id: "a", text: "Яблоко", isCorrect: false }, { id: "b", text: "Груша", isCorrect: false }, { id: "c", text: "Морковь", isCorrect: true }, { id: "d", text: "Слива", isCorrect: false }] }, "Найдите лишнее", "Морковь");

  const r2 = await addRound("Командный раунд", 1, "standard", {}, "Обычный раунд: играют все вместе, очки начисляет оператор");
  const tt = await addTheme(r2.id, "Все вместе", 0);
  await addQ(tt.id, 100, "standard", {}, "Назовите три цвета радуги", "Красный, оранжевый, жёлтый…");
  await addQ(tt.id, 200, "standard", {}, "Назовите четыре времени года", "Зима, весна, лето, осень");
  await addQ(tt.id, 300, "standard", {}, "Назовите пять континентов", "Евразия, Африка, Северная Америка…", { timeLimitSec: 45 });

  const r3 = await addRound("Супер-игра", 2, "final", { finalists: "leader", mode: "single_question" }, "Вопрос для лидера табло");
  const tf = await addTheme(r3.id, "Финал", 0);
  await addQ(tf.id, 1000, "standard", {}, "Сколько костей в теле взрослого человека?", "206", { timeLimitSec: 45 });

  console.log(`Демо-игра создана: ${game.id}`);
}

main()
  .then(() => AppDataSource.destroy())
  .catch(async (err) => {
    console.error(err);
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
    process.exit(1);
  });
