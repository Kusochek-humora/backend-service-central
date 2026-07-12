import { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";
import { env } from "../../config/env";

const bearerAuth = { security: [{ bearerAuth: [] }] };

async function metrikaFetch(path: string, params: Record<string, string>) {
  const url = new URL(`https://api-metrika.yandex.net${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `OAuth ${env.metrika.token}` },
  });
  if (!res.ok) throw new Error(`Metrika API error: ${res.status}`);
  return res.json();
}

export async function analyticsRoutes(app: FastifyInstance) {
  const jwtGuard = async (request: any, reply: any) => {
    try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
  };

  app.get("/admin/analytics", {
    schema: {
      tags: ["Analytics"],
      summary: "Статистика сайта из Яндекс Метрики",
      ...bearerAuth,
      querystring: {
        type: "object",
        properties: {
          days: { type: "number", description: "За сколько дней (по умолчанию 30)" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            totals: {
              type: "object",
              properties: {
                visits: { type: "number" },
                users: { type: "number" },
                pageviews: { type: "number" },
              },
            },
            byDate: { type: "array", items: { type: "object", additionalProperties: true } },
            topPages: { type: "array", items: { type: "object", additionalProperties: true } },
          },
        },
        503: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.EVENTS)],
  }, async (request, reply) => {
    if (!env.metrika.token || !env.metrika.counterId) {
      return reply.status(503).send({ message: "Metrika not configured" });
    }

    const { days = 30 } = request.query as { days?: number };
    const date2 = new Date().toISOString().split("T")[0];
    const date1 = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const id = env.metrika.counterId;

    try {
      const [totalsData, byDateData, topPagesData] = await Promise.all([
        metrikaFetch("/stat/v1/data", {
          id, date1, date2,
          metrics: "ym:s:visits,ym:s:users,ym:s:pageviews",
        }),
        metrikaFetch("/stat/v1/data", {
          id, date1, date2,
          dimensions: "ym:s:date",
          metrics: "ym:s:visits,ym:s:users",
          sort: "ym:s:date",
          limit: "60",
        }),
        metrikaFetch("/stat/v1/data", {
          id, date1, date2,
          dimensions: "ym:s:URLPath",
          metrics: "ym:s:pageviews",
          sort: "-ym:s:pageviews",
          limit: "10",
        }),
      ]);

      const t = totalsData.totals ?? [];
      const totals = { visits: t[0] ?? 0, users: t[1] ?? 0, pageviews: t[2] ?? 0 };

      const byDate = (byDateData.data ?? []).map((row: any) => ({
        date: row.dimensions?.[0]?.name,
        visits: row.metrics?.[0] ?? 0,
        users: row.metrics?.[1] ?? 0,
      }));

      const topPages = (topPagesData.data ?? []).map((row: any) => ({
        path: row.dimensions?.[0]?.name,
        pageviews: row.metrics?.[0] ?? 0,
      }));

      return { totals, byDate, topPages };
    } catch {
      return reply.status(503).send({ message: "Metrika unavailable" });
    }
  });
}
