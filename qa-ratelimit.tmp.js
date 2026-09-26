const fastify = require("fastify");

async function main() {
  const app = fastify();
  await app.register(require("@fastify/rate-limit"), { global: false });

  app.post("/test", {
    config: { rateLimit: { max: 3, timeWindow: "1 minute" } },
  }, async () => ({ ok: true }));

  await app.ready();

  const results = [];
  for (let i = 1; i <= 5; i++) {
    const res = await app.inject({ method: "POST", url: "/test" });
    results.push({ attempt: i, status: res.statusCode });
  }

  console.log("Результаты 5 запросов подряд (лимит 3/мин):");
  results.forEach((r) => console.log(`  Запрос ${r.attempt}: ${r.status}`));

  const first3ok = results.slice(0, 3).every((r) => r.status === 200);
  const rest429 = results.slice(3).every((r) => r.status === 429);

  console.log(`\n${first3ok ? "✅" : "❌"} Первые 3 запроса прошли (200)`);
  console.log(`${rest429 ? "✅" : "❌"} 4-й и 5-й запросы заблокированы (429)`);

  await app.close();
}

main();
