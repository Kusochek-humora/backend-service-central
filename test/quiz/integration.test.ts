// Интеграционный тест на реальном Postgres. Запуск:
//   DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASSWORD=... DB_NAME=quiz_test JWT_SECRET=x QUIZ_TEST_DB=1 npm run test:quiz
// База должна быть пустой/тестовой: таблицы quiz_* пересоздаются. Без QUIZ_TEST_DB тест пропускается.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import WebSocket from "ws";

const ENABLED = process.env.QUIZ_TEST_DB === "1";
const t = ENABLED ? test : test.skip;

let app: any;
let base = "";
let wsBase = "";
let db: any;
let siteJwtSign: (p: object) => string;
let adminToken = "";
let hostToken = "";
const uploadsRoot = path.join(process.cwd(), "uploads");
const uploadsExisted = fs.existsSync(uploadsRoot);

type Res = { status: number; body: any };
async function api(method: string, url: string, body?: unknown, token: string | null = adminToken): Promise<Res> {
  // соединение закрывается после каждого запроса: после оборванной большой загрузки (413) keep-alive пул клиента зависает
  const headers: Record<string, string> = { Connection: "close" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload: any;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  const r = await fetch(`${base}${url}`, { method, headers, body: payload });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null };
}
const ok = (r: Res, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.body)); return r.body; };
const err = (r: Res, status: number, code?: string) => {
  assert.equal(r.status, status, JSON.stringify(r.body));
  if (code) assert.equal(r.body.error.code, code, JSON.stringify(r.body));
  return r.body.error;
};

const text1 = (s: string) => [{ type: "text", text: s }];
const upload = async (buf: Buffer, name: string, mime: string, token = adminToken) => {
  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array(buf)], { type: mime }), name);
  return api("POST", "/api/media", fd, token);
};
const png = () => sharp({ create: { width: 64, height: 48, channels: 3, background: "#336699" } }).png().toBuffer();
const fakeMp4 = (size = 4096) => { const b = Buffer.alloc(size); b.write("ftypmp42", 4, "latin1"); return b; };

before(async () => {
  if (!ENABLED) return;
  const fastify = (await import("fastify")).default;
  const { default: multipart } = await import("@fastify/multipart");
  const { default: fastifyJwt } = await import("@fastify/jwt");
  const { default: rateLimit } = await import("@fastify/rate-limit");
  const { default: swagger } = await import("@fastify/swagger");
  const { default: fastifyStatic } = await import("@fastify/static");
  const { AppDataSource } = await import("../../src/db/data-source");
  const { env } = await import("../../src/config/env");
  const { quizPlugin } = await import("../../src/modules/quiz");
  const { swaggerRefResolver } = await import("../../src/modules/quiz/apiDocs");
  const { quizSwaggerTags } = await import("../../src/modules/quiz/swaggerGuide");
  const { CreateQuizTables1785400000000 } = await import("../../src/db/migrations/1785400000000-CreateQuizTables");
  const { QuizUser } = await import("../../src/db/entities/quiz/quiz.entity");

  await AppDataSource.initialize();
  db = AppDataSource;
  const qr = AppDataSource.createQueryRunner();
  await new CreateQuizTables1785400000000().down(qr);
  await new CreateQuizTables1785400000000().up(qr);
  await qr.release();

  app = fastify({ logger: false, bodyLimit: 10 * 1024 * 1024, connectionTimeout: 30000, requestTimeout: 300000 });
  await app.register(rateLimit, { global: false });
  await app.register(swagger, { refResolver: swaggerRefResolver, openapi: { openapi: "3.0.0", tags: quizSwaggerTags, info: { title: "t", version: "1" }, components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } } } } });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  await app.register(fastifyJwt, { secret: env.jwtSecret }); // JWT сайта, как в server.ts
  app.get("/site-protected", { onRequest: async (req: any, reply: any) => { try { await req.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); } } }, async () => ({ ok: true }));
  app.register(quizPlugin);
  await app.register(fastifyStatic, { root: uploadsRoot, prefix: "/uploads/" });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const port = app.server.address().port;
  base = `http://127.0.0.1:${port}`;
  wsBase = `ws://127.0.0.1:${port}`;
  siteJwtSign = (p) => app.jwt.sign(p);

  await AppDataSource.manager.save(QuizUser, AppDataSource.manager.create(QuizUser, { login: "admin", role: "admin", passwordHash: await bcrypt.hash("adminpass1", 4) }));
  adminToken = ok(await api("POST", "/api/auth/login", { login: "admin", password: "adminpass1" }, null)).token;
  ok(await api("POST", "/api/users", { login: "host1", password: "hostpass1", role: "host" }), 201);
  hostToken = ok(await api("POST", "/api/auth/login", { login: "host1", password: "hostpass1" }, null)).token;
});

after(async () => {
  if (!ENABLED) return;
  await app?.close();
  await db?.destroy();
  // убираем файлы, созданные тестом
  fs.rmSync(path.join(uploadsRoot, "quiz"), { recursive: true, force: true });
  if (!uploadsExisted) fs.rmSync(uploadsRoot, { recursive: true, force: true });
});

// ───────────────────────── Авторизация ─────────────────────────

t("авторизация: 401 без токена, 403 для host, токены сайта и квиза не взаимозаменяемы", async () => {
  err(await api("GET", "/api/games", undefined, null), 401, "UNAUTHORIZED");
  err(await api("POST", "/api/auth/login", { login: "admin", password: "wrong" }, null), 401, "INVALID_CREDENTIALS");
  const me = ok(await api("GET", "/api/auth/me"));
  assert.equal(me.login, "admin"); // пользователь в корне ответа
  ok(await api("GET", "/api/games", undefined, hostToken));
  err(await api("POST", "/api/games", { title: "x" }, hostToken), 403, "FORBIDDEN");
  err(await api("POST", "/api/participants", { name: "x" }, hostToken), 403);
  // токен сайта не проходит в квиз (даже с подходящими полями)
  err(await api("GET", "/api/games", undefined, siteJwtSign({ id: 1, role: "chief_editor" })), 401);
  err(await api("GET", "/api/games", undefined, siteJwtSign({ uid: "x", role: "admin" })), 401);
  // токен квиза не проходит на роутах сайта
  const r = await fetch(`${base}/site-protected`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(r.status, 401);
  const okSite = await fetch(`${base}/site-protected`, { headers: { Authorization: `Bearer ${siteJwtSign({ id: 1, role: "chief_editor" })}` } });
  assert.equal(okSite.status, 200);
});

t("rate limit логина: 5 попыток в минуту", async () => {
  // в окне уже есть логины из before() и предыдущего теста; всего разрешено 5 в минуту
  const results: Res[] = [];
  for (let i = 0; i < 7; i++) results.push(await api("POST", "/api/auth/login", { login: "nobody", password: "x" }, null));
  assert.equal(results[0].status, 401);
  const firstLimited = results.findIndex((r) => r.status === 429);
  assert.ok(firstLimited > 0 && firstLimited <= 5, );
  assert.equal(results[6].body.error.code, "RATE_LIMITED");
  assert.ok(results.slice(firstLimited).every((r) => r.status === 429));
});

// ───────────────────────── Медиа и участники ─────────────────────────

let imgId = "", videoId = "", audioId = "", imgPath = "";

t("медиа: загрузка (картинка → webp, видео, аудио), проверка по содержимому, список, статика", async () => {
  const img = ok(await upload(await png(), "photo.png", "image/png"), 201);
  assert.equal(img.type, "image");
  assert.equal(img.mime, "image/webp");
  assert.match(img.path, /^quiz\/.+\.webp$/);
  assert.equal(img.originalName, "photo.png");
  imgId = img.id; imgPath = img.path;
  const video = ok(await upload(fakeMp4(), "clip.mp4", "video/mp4"), 201);
  assert.equal(video.type, "video");
  videoId = video.id;
  const mp3 = Buffer.alloc(2048); mp3.write("ID3", 0, "latin1");
  audioId = ok(await upload(mp3, "a.mp3", "audio/mpeg"), 201).id;

  err(await upload(Buffer.from("это не картинка, просто текст"), "fake.png", "image/png"), 415);
  err(await upload(await png(), "fake.mp4", "video/mp4"), 415); // содержимое не видео
  err(await upload(Buffer.from("text text text text"), "x.txt", "text/plain"), 415);
  err(await upload(await png(), "x.png", "image/png", hostToken), 403);

  assert.equal((await fetch(`${base}/uploads/${img.path}`)).status, 200);
  const range = await fetch(`${base}/uploads/${video.path}`, { headers: { Range: "bytes=0-99" } });
  assert.equal(range.status, 206);

  const list = ok(await api("GET", "/api/media?limit=500"));
  assert.equal(list.total, 3);
  assert.equal(ok(await api("GET", "/api/media?type=video")).items.length, 1);
});

t("медиа: файл больше 10 МБ проходит (лимиты сайта на него не действуют), больше лимита типа — 413", async () => {
  const big = fakeMp4(12 * 1024 * 1024);
  const r = ok(await upload(big, "big.mp4", "video/mp4"), 201);
  assert.ok(r.size >= 12 * 1024 * 1024);
  ok(await api("DELETE", `/api/media/${r.id}`));
  assert.ok(!fs.existsSync(path.join(uploadsRoot, r.path)));
  const hugeImage = Buffer.alloc(16 * 1024 * 1024, 1);
  hugeImage[0] = 0xff; hugeImage[1] = 0xd8; hugeImage[2] = 0xff;
  err(await upload(hugeImage, "huge.jpg", "image/jpeg"), 413, "PAYLOAD_TOO_LARGE");
});

let players: any[] = [];

t("участники: фото из медиа (только картинка), стартовый балл по умолчанию, удаление фото блокируется", async () => {
  err(await api("POST", "/api/participants", { name: "А", photoMediaId: videoId }), 422);
  err(await api("POST", "/api/participants", { name: "А", photoMediaId: "00000000-0000-4000-8000-000000000000" }), 422, "MEDIA_NOT_FOUND");
  err(await api("POST", "/api/participants", { name: "", color: "red" }), 422);
  const a = ok(await api("POST", "/api/participants", { name: "Аня", color: "#ff0000", photoMediaId: imgId, defaultStartScore: 100 }), 201);
  assert.equal(a.photoMediaId, imgId);
  assert.match(a.photoUrl, /\/uploads\/quiz\//);
  assert.equal(a.defaultStartScore, 100);
  players = [a];
  for (const n of ["Боря", "Вика", "Гена", "Даша", "Егор"]) players.push(ok(await api("POST", "/api/participants", { name: n, color: "#00ff00" }), 201));
  err(await api("DELETE", `/api/media/${imgId}`), 409, "MEDIA_IN_USE");
  // фото можно сменить и убрать
  const patched = ok(await api("PATCH", `/api/participants/${players[1].id}`, { photoMediaId: imgId, name: "Борис" }));
  assert.equal(patched.name, "Борис");
  ok(await api("PATCH", `/api/participants/${players[1].id}`, { photoMediaId: null }));
  const list = ok(await api("GET", "/api/participants?limit=200"));
  assert.equal(list.total, 6);
});

// ───────────────────────── Контент игры ─────────────────────────

let game: any;
const Q: Record<string, any> = {};

t("контент: игра → раунд → тема → вопросы всех механик, валидация 422 с путями", async () => {
  game = ok(await api("POST", "/api/games", { title: "Тест" }), 201);
  err(await api("POST", "/api/games", {}), 422, "VALIDATION_ERROR");
  const r1 = ok(await api("POST", `/api/games/${game.id}/rounds`, { title: "Раунд 1" }), 201);
  assert.equal(r1.type, "standard");
  err(await api("POST", `/api/games/${game.id}/rounds`, { title: "x", type: "team" }), 422); // командного типа нет
  const th = ok(await api("POST", `/api/rounds/${r1.id}/themes`, { title: "Тема" }), 201);
  Q.theme = th;

  const mk = async (name: string, price: number, kind: string, settings: object, over: object = {}) => {
    Q[name] = ok(await api("POST", `/api/themes/${th.id}/questions`, { price, kind, settings, content: text1(`в ${name}`), answerContent: text1(`о ${name}`), timeLimitSec: 30, ...over }), 201);
  };
  await mk("standard", 500, "standard", {});
  await mk("options", 200, "options", { options: [{ id: "a", text: "A", isCorrect: true }, { id: "b", text: "B", isCorrect: false }] });
  await mk("tf", 300, "true_false", { correct: true });
  await mk("hints", 400, "hints", { penaltyPerHint: 50, hints: [{ text: "h1" }, { text: "h2" }] });
  await mk("cat", 100, "cat_in_bag", { teaser: "кот" });
  await mk("auction", 100, "auction", { startBid: 100, step: 50 });
  await mk("stake", 200, "stake", { maxStake: "score" });
  await mk("blitz", 300, "blitz", { pointsPerItem: 10, totalSec: 60, items: [{ content: text1("1"), answerContent: text1("a") }, { content: text1("2"), answerContent: text1("b") }] }, { timeLimitSec: null });
  await mk("image", 400, "reveal_image", { mediaId: imgId, mode: "tiles", steps: 3, penaltyPerStep: 10 });
  await mk("ordering", 500, "ordering", { items: [{ id: "1", text: "a" }, { id: "2", text: "b" }, { id: "3", text: "c" }] });
  await mk("matching", 100, "matching", { pairs: [{ left: { text: "l1" }, right: { text: "r1" } }, { left: { text: "l2" }, right: { text: "r2" } }] });
  await mk("fill", 200, "fill_blank", { template: "A ___ B ___", blanks: ["x", "y"] });
  await mk("word", 300, "word_guess", { word: "слово" });
  await mk("video", 600, "standard", { noPenalty: true }, {
    content: [{ type: "text", text: "смотрим" }, { type: "video", mediaId: videoId }],
    answerContent: [{ type: "audio", mediaId: audioId }],
  });
  assert.equal(Q.matching.settings.noPenalty, undefined);
  assert.equal(Q.options.settings.variant, "choice"); // значения по умолчанию подставлены схемой механики
});

t("контент: ошибки валидации по полям (422)", async () => {
  const body = (kind: string, settings: object, over: object = {}) => ({ price: 100, kind, settings, content: text1("q"), answerContent: text1("a"), ...over });
  const post = (b: object) => api("POST", `/api/themes/${Q.theme.id}/questions`, b);
  const paths = (e: any) => e.details.map((d: any) => d.path);

  assert.ok(paths(err(await post(body("options", { options: [{ id: "a", text: "A", isCorrect: true }] })), 422)).includes("settings.options"));
  assert.ok(paths(err(await post(body("options", { options: [{ id: "a", text: "A", isCorrect: false }, { id: "b", text: "B", isCorrect: false }] })), 422)).length > 0);
  err(await post(body("standard", {}, { price: 0 })), 422);
  err(await post(body("standard", {}, { content: [] })), 422);
  err(await post(body("standard", {}, { answerContent: [] })), 422);
  err(await post(body("standard", {}, { content: [{ type: "image" }] })), 422); // нет mediaId
  err(await post(body("standard", {}, { content: [{ type: "text" }] })), 422); // нет text
  err(await post(body("standard", {}, { content: [{ type: "video", mediaId: "00000000-0000-4000-8000-000000000000" }] })), 422, "MEDIA_NOT_FOUND");
  err(await post(body("nope", {})), 422);
  assert.ok(paths(err(await post(body("fill_blank", { template: "один ___", blanks: ["a", "b"] })), 422)).includes("settings.blanks"));
  err(await post(body("reveal_image", { mediaId: imgId, mode: "blur", steps: 1 })), 422); // steps 2..10
  err(await post(body("hints", { penaltyPerHint: 10, hints: [] })), 422);
  err(await post(body("hints", { penaltyPerHint: 10, hints: Array.from({ length: 6 }, () => ({ text: "h" })) })), 422);
  err(await post(body("blitz", { pointsPerItem: 5, items: [{ content: text1("1"), answerContent: text1("a") }] })), 422); // минимум 2
  err(await post(body("auction", { startBid: 0, step: 10 })), 422);
  err(await post(body("stake", { maxStake: "banana" })), 422);
  err(await api("POST", `/api/rounds/${Q.theme.roundId}/themes`, {}), 422);
  err(await api("POST", `/api/games/${game.id}/rounds`, { title: "F", type: "final", settings: { mode: "weird" } }), 422);
});

t("контент: question_media обновляется при сохранении, файл блокируется до удаления вопроса", async () => {
  const [{ n }] = await db.query(`SELECT COUNT(*)::int AS n FROM quiz_question_media WHERE "questionId" = $1`, [Q.video.id]);
  assert.equal(n, 2); // video в content, audio в answerContent
  err(await api("DELETE", `/api/media/${videoId}`), 409, "MEDIA_IN_USE");
  err(await api("DELETE", `/api/media/${audioId}`), 409, "MEDIA_IN_USE");
  // mediaId внутри settings тоже учитывается
  err(await api("DELETE", `/api/media/${imgId}`), 409);
  // убрали видео из вопроса: файл освободился
  ok(await api("PATCH", `/api/questions/${Q.video.id}`, { content: text1("без видео") }));
  ok(await api("DELETE", `/api/media/${videoId}`));
  // удалили вопрос: освободилось аудио
  ok(await api("DELETE", `/api/questions/${Q.video.id}`));
  ok(await api("DELETE", `/api/media/${audioId}`));
  delete Q.video;
  // PATCH сливает поля и проверяет заново: смена механики без settings невозможна
  err(await api("PATCH", `/api/questions/${Q.standard.id}`, { kind: "options" }), 422);
  const p = ok(await api("PATCH", `/api/questions/${Q.standard.id}`, { price: 550, kind: "options", settings: { options: [{ id: "x", text: "X", isCorrect: true }, { id: "y", text: "Y", isCorrect: false }] } }));
  assert.equal(p.price, 550);
  ok(await api("PATCH", `/api/questions/${Q.standard.id}`, { kind: "standard", settings: {}, price: 500 }));
});

t("контент: игра целиком (ячейки по цене), порядок, дублирование, /kinds", async () => {
  const full = ok(await api("GET", `/api/games/${game.id}`));
  const prices = full.rounds[0].themes[0].questions.map((q: any) => q.price);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));

  const r2 = ok(await api("POST", `/api/games/${game.id}/rounds`, { title: "Командный раунд" }), 201);
  const r3 = ok(await api("POST", `/api/games/${game.id}/rounds`, { title: "Супер-игра", type: "final", settings: { finalists: 2 } }), 201);
  assert.deepEqual(r3.settings, { finalists: 2, mode: "single_question" });
  ok(await api("PUT", `/api/games/${game.id}/rounds/order`, { ids: [r3.id, full.rounds[0].id, r2.id] }));
  err(await api("PUT", `/api/games/${game.id}/rounds/order`, { ids: [r3.id] }), 422);
  assert.deepEqual(ok(await api("GET", `/api/games/${game.id}`)).rounds.map((r: any) => r.title), ["Супер-игра", "Раунд 1", "Командный раунд"]);
  ok(await api("PUT", `/api/games/${game.id}/rounds/order`, { ids: [full.rounds[0].id, r2.id, r3.id] }));
  const t2 = ok(await api("POST", `/api/rounds/${r2.id}/themes`, { title: "Т2" }), 201);
  const t3 = ok(await api("POST", `/api/rounds/${r2.id}/themes`, { title: "Т3" }), 201);
  ok(await api("PUT", `/api/rounds/${r2.id}/themes/order`, { ids: [t3.id, t2.id] }));

  const copy = ok(await api("POST", `/api/games/${game.id}/duplicate`), 201);
  assert.equal(copy.rounds.length, 3);
  assert.equal(copy.rounds[0].themes[0].questions.length, full.rounds[0].themes[0].questions.length);
  const [{ n }] = await db.query(`SELECT COUNT(*)::int AS n FROM quiz_question_media qm JOIN quiz_questions q ON q.id = qm."questionId" JOIN quiz_themes t ON t.id = q."themeId" JOIN quiz_rounds r ON r.id = t."roundId" WHERE r."gameId" = $1`, [copy.id]);
  assert.equal(n, 1); // reveal_image с картинкой
  ok(await api("DELETE", `/api/games/${copy.id}`));

  const list = ok(await api("GET", "/api/games?limit=200", undefined, hostToken));
  assert.equal(list.items[0].roundsCount, 3);
  assert.ok(list.items[0].questionsCount >= 12);

  const kinds = ok(await api("GET", "/api/kinds", undefined, hostToken));
  assert.equal(kinds.kinds.length, 13);
  assert.ok(kinds.kinds.find((k: any) => k.kind === "hints").commands.includes("reveal_hint"));
});

// ───────────────────────── Сессия: команды, версии, back ─────────────────────────

let sess: any;
let sid = "";
let rounds: any[] = [];
const cmd = (type: string, payload?: unknown, expectedVersion?: number, token = hostToken) =>
  api("POST", `/api/sessions/${sid}/commands`, { type, payload, expectedVersion }, token);
const snap = async () => ok(await api("GET", `/api/sessions/${sid}`, undefined, hostToken));
const strip = (s: any) => { const { serverTime, version, ...rest } = s; return rest; };

t("сессия: создание, 6 игроков (больше четырёх), стартовые баллы, screenUrl", async () => {
  process.env.SCREEN_URL_BASE = "https://user.github.io/quiz-web/screen/#";
  rounds = ok(await api("GET", `/api/games/${game.id}`)).rounds;
  const res = ok(await api("POST", "/api/sessions", { gameId: game.id, participantIds: players.map((p) => p.id), hostName: "Тико" }, hostToken), 201);
  sid = res.session.id;
  assert.ok(res.screenToken.length >= 40);
  assert.equal(res.screenUrl, `https://user.github.io/quiz-web/screen/#/${sid}?token=${encodeURIComponent(res.screenToken)}`);
  sess = res;
  const s = res.snapshot;
  assert.equal(s.players.length, 6);
  assert.equal(s.players[0].score, 100); // defaultStartScore из участника
  assert.equal(s.players[1].score, 0);
  assert.equal(s.hostName, "Тико");
  assert.ok(s.players[0].photo);
  assert.equal(s.status, "idle");
  err(await api("POST", "/api/sessions", { gameId: game.id, participantIds: [players[0].id, players[0].id] }, hostToken), 422);
  err(await api("POST", "/api/sessions", { gameId: "00000000-0000-4000-8000-000000000000", participantIds: [] }, hostToken), 404);
});

t("команды: недопустимые → 409 INVALID_TRANSITION, валидация payload → 422, expectedVersion", async () => {
  err(await cmd("open_question", { questionId: Q.options.id }), 409, "INVALID_TRANSITION");
  err(await cmd("finish"), 409, "INVALID_TRANSITION");
  err(await cmd("back"), 409, "INVALID_TRANSITION");
  err(await cmd("nonsense"), 422, "VALIDATION_ERROR");
  ok(await cmd("start"));
  let s = await snap();
  assert.equal(s.version, 1);
  err(await cmd("next_round", undefined, 0), 409, "VERSION_MISMATCH");
  assert.equal((await snap()).status, "intro");
  err(await cmd("next_round", undefined, 99), 409, "VERSION_MISMATCH");
  s = ok(await cmd("next_round", undefined, 1));
  assert.equal(s.version, 2);
  assert.equal(s.round.id, rounds[0].id);
  assert.equal(s.status, "round_intro");
  err(await cmd("start_timer"), 409, "INVALID_TRANSITION");
});

t("параллельные команды и очки дают корректную последовательность версий", async () => {
  ok(await cmd("show_board"));
  const before = (await snap()).version;
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) =>
    api("POST", `/api/sessions/${sid}/scores`, { participantId: players[i % 6].id, kind: "bonus", delta: 10, reason: `б${i}` }, hostToken)));
  results.forEach((r) => assert.equal(r.status, 201, JSON.stringify(r.body)));
  const versions = results.map((r) => r.body.snapshot.version).sort((a, b) => a - b);
  assert.deepEqual(versions, Array.from({ length: 8 }, (_, i) => before + 1 + i));
  // одинаковая команда параллельно: выигрывает одна, остальные получают VERSION_MISMATCH
  const v = (await snap()).version;
  const racing = await Promise.all(Array.from({ length: 5 }, () => cmd("set_active", { participantId: players[2].id }, v)));
  assert.equal(racing.filter((r) => r.status === 200).length, 1);
  assert.equal(racing.filter((r) => r.status === 409).length, 4);
  // откат этих изменений, чтобы дальше работать с чистой доской
  for (let i = 0; i < 9; i++) ok(await cmd("back"));
  const s = await snap();
  assert.equal(s.activeParticipantId, null);
  assert.deepEqual(s.players.map((p: any) => p.score), [100, 0, 0, 0, 0, 0]);
});

t("открытие вопроса, повторное открытие, play-цикл и back на всю глубину", async () => {
  const initial = strip(await snap());
  const initialVersion = (await snap()).version;
  err(await cmd("open_question", { questionId: "00000000-0000-4000-8000-000000000000" }), 422, "QUESTION_NOT_FOUND");
  err(await cmd("open_question", {}), 422);

  const steps: [string, any?][] = [
    ["open_question", { questionId: Q.hints.id }],
    ["reveal_hint"],
    ["start_timer"],
    ["reveal_hint"],
    ["set_active", { participantId: players[3].id }],
    ["reveal_answer"],
  ];
  const seen: any[] = [];
  for (const [t, p] of steps) { seen.push(strip(await snap())); ok(await cmd(t, p)); }
  const s = await snap();
  assert.equal(s.status, "answer_revealed");
  assert.equal(s.question.view.hintsShown, 2);
  assert.deepEqual([s.question.pointsIfCorrect, s.question.pointsIfWrong], [300, -300]);
  assert.equal(s.board.themes[0].cells.find((c: any) => c.questionId === Q.hints.id).played, true);
  assert.equal(s.question.comment, "");

  ok(await cmd("show_board"));
  err(await cmd("open_question", { questionId: Q.hints.id }), 409, "ALREADY_PLAYED");

  // back на всю глубину: каждый шаг возвращает ровно то состояние, что было до него
  ok(await cmd("back")); // отменяет show_board
  for (let i = steps.length - 1; i >= 0; i--) {
    assert.equal((await snap()).canBack, true);
    ok(await cmd("back"));
    assert.deepEqual(strip(await snap()), seen[i], `после отката шага ${steps[i][0]}`);
  }
  assert.deepEqual(strip(await snap()), initial);
  // вопрос снова не сыгран
  const again = ok(await cmd("open_question", { questionId: Q.hints.id }));
  assert.equal(again.status, "question_shown");
  ok(await cmd("back"));
  assert.ok((await snap()).version > initialVersion);
});

t("все механики через API: prepare-фаза, команды, project() для screen и host", async () => {
  // кот в мешке
  ok(await cmd("set_active", { participantId: players[0].id }));
  let s = ok(await cmd("open_question", { questionId: Q.cat.id }));
  assert.equal(s.question.phase, "prepare");
  err(await cmd("start_timer"), 409, "INVALID_TRANSITION");
  err(await cmd("begin_play"), 409, "NOT_READY");
  err(await cmd("choose_recipient", { participantId: players[0].id }), 422);
  ok(await cmd("choose_recipient", { participantId: players[4].id }));
  s = ok(await cmd("begin_play"));
  assert.equal(s.question.phase, "play");
  assert.equal(s.activeParticipantId, players[4].id);
  ok(await cmd("start_timer"));
  ok(await cmd("reveal_answer"));
  ok(await cmd("show_board"));

  // аукцион
  s = ok(await cmd("open_question", { questionId: Q.auction.id }));
  err(await cmd("place_bid", { participantId: players[1].id, amount: 50 }), 422);
  ok(await cmd("place_bid", { participantId: players[1].id, amount: 100 }));
  ok(await cmd("place_bid", { participantId: players[2].id, amount: 200 }));
  ok(await cmd("close_bidding"));
  s = ok(await cmd("begin_play"));
  assert.equal(s.activeParticipantId, players[2].id);
  assert.equal(s.question.pointsIfCorrect, 200);
  ok(await cmd("reveal_answer"));
  ok(await cmd("show_board"));

  // ставка
  ok(await cmd("set_active", { participantId: players[0].id }));
  ok(await cmd("open_question", { questionId: Q.stake.id }));
  err(await cmd("set_stake", { amount: 5000 }), 422); // у игрока счёт 100
  ok(await cmd("set_stake", { amount: 80 }));
  s = ok(await cmd("begin_play"));
  assert.deepEqual([s.question.pointsIfCorrect, s.question.pointsIfWrong], [80, -80]);
  ok(await cmd("reveal_answer"));
  ok(await cmd("show_board"));

  // блиц, картинка, слово
  ok(await cmd("open_question", { questionId: Q.blitz.id }));
  ok(await cmd("blitz_next"));
  err(await cmd("blitz_next"), 409);
  ok(await cmd("start_timer")); // totalSec
  ok(await cmd("reveal_answer"));
  ok(await cmd("show_board"));
  ok(await cmd("open_question", { questionId: Q.image.id }));
  ok(await cmd("reveal_step"));
  s = await snap();
  assert.equal(s.question.view.step, 1);
  assert.ok(s.media[imgId]);
  ok(await cmd("reveal_answer"));
  ok(await cmd("show_board"));
  ok(await cmd("open_question", { questionId: Q.word.id }));
  ok(await cmd("reveal_letter", { letter: "С" }));
  err(await cmd("reveal_hint"), 409); // не механика этого вопроса
  ok(await cmd("reveal_answer"));
  ok(await cmd("show_board"));
});

// ───────────────────────── Очки и игроки ─────────────────────────

t("очки: ручная оценка, отрицательные, void, set, нулевая delta, чужой игрок", async () => {
  const score = (b: object) => api("POST", `/api/sessions/${sid}/scores`, b, hostToken);
  const base = (await snap()).players.map((p: any) => p.score);
  err(await score({ participantId: players[1].id, kind: "correct", delta: 0 }), 422);
  err(await score({ participantId: players[1].id, kind: "weird", delta: 5 }), 422);
  err(await score({ delta: 5, kind: "bonus" }), 422); // participantId обязателен
  err(await score({ participantId: null, kind: "bonus", delta: 5 }), 422); // общего счёта нет
  const ev = ok(await score({ participantId: players[1].id, kind: "wrong", delta: -300, reason: "ошибся", questionId: Q.hints.id }), 201).event;
  assert.equal(ev.voided, false);
  assert.equal((await snap()).players[1].score, base[1] - 300); // уходит в минус
  ok(await score({ participantId: players[1].id, kind: "bonus", delta: 1000, reason: "рассмешил зал" }), 201);
  ok(await api("POST", `/api/sessions/${sid}/scores/${ev.id}/void`, undefined, hostToken));
  assert.equal((await snap()).players[1].score, base[1] + 1000);
  err(await api("POST", `/api/sessions/${sid}/scores/${ev.id}/void`, undefined, hostToken), 409, "ALREADY_VOIDED");

  const set = ok(await api("POST", `/api/sessions/${sid}/scores/set`, { participantId: players[1].id, total: 500, reason: "поправка" }, hostToken), 201);
  assert.equal(set.event.kind, "manual");
  assert.equal(set.event.delta, 500 - (base[1] + 1000));
  assert.equal((await snap()).players[1].score, 500);
  err(await api("POST", `/api/sessions/${sid}/scores/set`, { participantId: players[1].id, total: 500 }, hostToken), 409, "NO_CHANGE");

  const log = ok(await api("GET", `/api/sessions/${sid}/scores`, undefined, hostToken));
  assert.ok(log.items.some((e: any) => e.id === ev.id && e.voided));
  const other = ok(await api("POST", "/api/participants", { name: "Чужой" }), 201);
  err(await score({ participantId: other.id, kind: "bonus", delta: 5 }), 422);
});

t("игроки сессии: добавить на ходу, стартовый балл, порядок, убрать, back", async () => {
  const extra = ok(await api("POST", "/api/participants", { name: "Опоздавший", defaultStartScore: 250 }), 201);
  const v0 = (await snap()).version;
  let s = ok(await api("POST", `/api/sessions/${sid}/participants`, { participantId: extra.id }, hostToken));
  assert.equal(s.version, v0 + 1);
  assert.equal(s.players.length, 7);
  assert.equal(s.players[6].score, 250);
  assert.equal(s.players[6].order, 6);
  err(await api("POST", `/api/sessions/${sid}/participants`, { participantId: extra.id }, hostToken), 409, "ALREADY_IN_SESSION");

  s = ok(await api("PATCH", `/api/sessions/${sid}/participants/${extra.id}`, { startScore: 400, order: 0 }, hostToken));
  assert.equal(s.version, v0 + 2);
  assert.equal(s.players[0].id, extra.id);
  assert.equal(s.players[0].score, 400);
  ok(await api("POST", `/api/sessions/${sid}/scores`, { participantId: extra.id, kind: "bonus", delta: 5 }, hostToken), 201);
  ok(await api("PATCH", `/api/sessions/${sid}/participants/${extra.id}`, { startScore: -50 }, hostToken)); // можно и отрицательный
  assert.equal((await snap()).players[0].score, -45);

  ok(await cmd("set_active", { participantId: extra.id }));
  s = ok(await api("DELETE", `/api/sessions/${sid}/participants/${extra.id}`, undefined, hostToken));
  assert.equal(s.players.length, 6);
  assert.equal(s.activeParticipantId, null);
  const log = ok(await api("GET", `/api/sessions/${sid}/scores`, undefined, hostToken));
  assert.ok(log.items.some((e: any) => e.participantId === extra.id)); // события остаются в журнале
  err(await api("DELETE", `/api/participants/${extra.id}`), 409, "PARTICIPANT_IN_USE");

  // back возвращает игрока, его балл и активного
  ok(await cmd("back"));
  s = await snap();
  assert.equal(s.players.length, 7);
  assert.equal(s.activeParticipantId, extra.id);
  assert.equal(s.players[0].score, -45);
  // back по очкам: созданное событие помечается voided, а не удаляется
  ok(await cmd("back")); // set_active
  ok(await cmd("back")); // patch startScore=-50
  ok(await cmd("back")); // score +5
  const log2 = ok(await api("GET", `/api/sessions/${sid}/scores`, undefined, hostToken));
  const bonus5 = log2.items.find((e: any) => e.participantId === extra.id && e.delta === 5);
  assert.equal(bonus5.voided, true);
  assert.equal((await snap()).players[0].score, 400);
});

// ───────────────────────── Финал ─────────────────────────

t("раунд final через API: финалисты по правилу, ставки, вычёркивание не нужно в single_question", async () => {
  // «Командный раунд» (обычный) → final
  ok(await cmd("next_round"));
  ok(await cmd("show_board"));
  assert.equal((await snap()).round.title, "Командный раунд");
  ok(await cmd("next_round"));
  let s = await snap();
  assert.equal(s.round.type, "final");
  assert.equal(s.finalists, null);
  assert.deepEqual(s.suggestedFinalists.length, 2); // finalists: 2
  err(await cmd("select_finalists", { participantIds: [] }), 422);
  s = ok(await cmd("select_finalists", { participantIds: [players[1].id, players[0].id] }));
  assert.deepEqual(s.finalists, [players[1].id, players[0].id]);
  ok(await cmd("show_board"));
  err(await cmd("eliminate_theme", { themeId: rounds[2].themes[0]?.id ?? "00000000-0000-4000-8000-000000000000" }), 409);
});

// ───────────────────────── WebSocket ─────────────────────────

function connect(url: string) {
  return new Promise<{ ws: WebSocket; messages: any[]; closed: Promise<{ code: number }> }>((resolve) => {
    const ws = new WebSocket(url);
    const messages: any[] = [];
    const closed = new Promise<{ code: number }>((r) => ws.on("close", (code: number) => r({ code })));
    ws.on("message", (d: Buffer) => messages.push(JSON.parse(d.toString())));
    resolve({ ws, messages, closed });
  });
}
const waitFor = async (cond: () => boolean, ms = 3000) => {
  const start = Date.now();
  while (!cond()) { if (Date.now() - start > ms) throw new Error("timeout"); await new Promise((r) => setTimeout(r, 20)); }
};

t("WebSocket: snapshot при подключении, update после команды, роли, ping/pong, 4401, перевыпуск токена", async () => {
  const hostWs = await connect(`${wsBase}/ws/sessions/${sid}?role=host&token=${hostToken}`);
  const screenWs = await connect(`${wsBase}/ws/sessions/${sid}?role=screen&token=${sess.screenToken}`);
  await waitFor(() => hostWs.messages.length > 0 && screenWs.messages.length > 0);
  assert.equal(hostWs.messages[0].type, "snapshot");
  assert.equal(screenWs.messages[0].type, "snapshot");
  assert.ok("canBack" in hostWs.messages[0].payload);
  assert.ok(!("canBack" in screenWs.messages[0].payload));

  // откатываемся к доске основного раунда и открываем вопрос с секретами
  while ((await snap()).round?.title !== "Раунд 1") ok(await cmd("back"));
  let s = await snap();
  if (s.status !== "board") ok(await cmd("show_board"));
  const before = screenWs.messages.length;
  ok(await cmd("open_question", { questionId: Q.options.id }));
  await waitFor(() => screenWs.messages.length > before && hostWs.messages.length > 1);
  const upd = screenWs.messages[screenWs.messages.length - 1];
  assert.equal(upd.type, "update");
  assert.ok(upd.payload.version > screenWs.messages[0].payload.version);
  assert.ok(!JSON.stringify(upd.payload).includes("о options")); // answerContent скрыт
  assert.ok(!JSON.stringify(upd.payload).includes('"isCorrect"'));
  assert.ok(!("comment" in upd.payload.question));
  const hupd = hostWs.messages[hostWs.messages.length - 1];
  assert.ok(hupd.payload.question.answerContent);
  assert.equal(hupd.payload.question.view.options[0].isCorrect, true);

  // очки тоже рассылаются
  const n = screenWs.messages.length;
  ok(await api("POST", `/api/sessions/${sid}/scores`, { participantId: players[2].id, kind: "bonus", delta: 7 }, hostToken), 201);
  await waitFor(() => screenWs.messages.length > n);
  assert.equal(screenWs.messages[screenWs.messages.length - 1].payload.players.find((p: any) => p.id === players[2].id).score, 7);

  // ping → pong
  hostWs.ws.send(JSON.stringify({ type: "ping" }));
  await waitFor(() => hostWs.messages.some((m) => m.type === "pong"));

  // неверный токен — закрытие 4401
  for (const url of [`${wsBase}/ws/sessions/${sid}?role=screen&token=bad`, `${wsBase}/ws/sessions/${sid}?role=host&token=bad`, `${wsBase}/ws/sessions/${sid}?role=screen`, `${wsBase}/ws/sessions/${sid}?role=host&token=${siteJwtSign({ id: 1, role: "chief_editor" })}`]) {
    const bad = await connect(url);
    assert.equal((await bad.closed).code, 4401, url);
  }
  assert.equal((await (await connect(`${wsBase}/ws/sessions/00000000-0000-4000-8000-000000000000?role=host&token=${hostToken}`)).closed).code, 4404);

  // перевыпуск токена: экран отключается с session_closed, пульт остаётся
  const rot = ok(await api("POST", `/api/sessions/${sid}/screen-token/rotate`, undefined, hostToken));
  assert.notEqual(rot.screenToken, sess.screenToken);
  assert.equal((await screenWs.closed).code, 4410);
  assert.ok(screenWs.messages.some((m) => m.type === "session_closed"));
  assert.equal(hostWs.ws.readyState, WebSocket.OPEN);
  assert.equal((await (await connect(`${wsBase}/ws/sessions/${sid}?role=screen&token=${sess.screenToken}`)).closed).code, 4401);
  const fresh = await connect(`${wsBase}/ws/sessions/${sid}?role=screen&token=${rot.screenToken}`);
  await waitFor(() => fresh.messages.length > 0);
  assert.equal(fresh.messages[0].type, "snapshot");

  // удаление сессии закрывает всех
  const closedHost = hostWs.closed;
  ok(await api("DELETE", `/api/sessions/${sid}`));
  assert.equal((await closedHost).code, 4410);
  fresh.ws.close();
});

// ───────────────────────── OpenAPI ─────────────────────────

t("OpenAPI /docs/json содержит снимок, команды и settings всех механик", async () => {
  await app.ready();
  const spec = app.swagger();
  const paths = Object.keys(spec.paths);
  for (const p of ["/api/sessions/{id}/commands", "/api/sessions/{id}/scores", "/api/sessions/{id}/scores/set", "/api/sessions/{id}/participants", "/api/media", "/api/kinds", "/api/themes/{id}/questions"]) {
    assert.ok(paths.includes(p), `нет пути ${p}`);
  }
  const text = JSON.stringify(spec);
  for (const needle of ["QuizSnapshot", "QuizCommand", "reveal_hint", "eliminate_theme", "select_finalists", "penaltyPerHint", "perItemSec", "word_guess"]) {
    assert.ok(text.includes(needle), `в OpenAPI нет ${needle}`);
  }
  const guide = spec.tags.find((t: any) => t.name === 'Quiz: механики');
  assert.ok(guide && guide.description.includes('cat_in_bag'), 'в Swagger нет руководства по механикам');
  assert.ok(spec.tags.some((t: any) => t.name === 'Quiz: ход игры и WebSocket' && t.description.includes('4401')));
  assert.ok(spec.components?.schemas?.QuizSnapshot, 'components: ' + Object.keys(spec.components?.schemas ?? {}).join(','));
});
