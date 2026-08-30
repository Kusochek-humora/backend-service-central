import { FastifyInstance } from "fastify";
import webpush from "web-push";
import { AppDataSource } from "../../db/data-source";
import { PushSubscriptionEntity } from "../../db/entities/push-subscription.entity";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";

function setupVapid() {
  const subject = process.env.VAPID_SUBJECT;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (subject && pub && priv) {
    webpush.setVapidDetails(subject, pub, priv);
    return true;
  }
  return false;
}

const bearerAuth = { security: [{ bearerAuth: [] }] };

export async function alemPushRoutes(app: FastifyInstance) {
  const repo = AppDataSource.getRepository(PushSubscriptionEntity);
  setupVapid();

  const jwtGuard = async (request: any, reply: any) => {
    try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
  };

  // PUBLIC: вернуть VAPID публичный ключ
  app.get("/alem/push/vapid-public-key", {
    schema: {
      tags: ["Alem Public"],
      summary: "VAPID public key для подписки на push",
      response: { 200: { type: "object", properties: { publicKey: { type: "string" } } } },
    },
  }, async () => {
    return { publicKey: process.env.VAPID_PUBLIC_KEY ?? "" };
  });

  // PUBLIC: подписаться
  app.post("/alem/push/subscribe", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    schema: {
      tags: ["Alem Public"],
      summary: "Подписаться на push-уведомления",
      body: {
        type: "object",
        required: ["endpoint", "keys"],
        properties: {
          endpoint: { type: "string" },
          keys: {
            type: "object",
            required: ["p256dh", "auth"],
            properties: {
              p256dh: { type: "string" },
              auth: { type: "string" },
            },
          },
          lang: { type: "string" },
        },
      },
      response: { 200: { type: "object", properties: { ok: { type: "boolean" } } } },
    },
  }, async (request) => {
    const { endpoint, keys, lang } = request.body as any;
    const existing = await repo.findOneBy({ endpoint });
    if (!existing) {
      await repo.save(repo.create({ endpoint, keys, lang }));
    }
    return { ok: true };
  });

  // PUBLIC: отписаться
  app.post("/alem/push/unsubscribe", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    schema: {
      tags: ["Alem Public"],
      summary: "Отписаться от push-уведомлений",
      body: {
        type: "object",
        required: ["endpoint"],
        properties: { endpoint: { type: "string" } },
      },
      response: { 200: { type: "object", properties: { ok: { type: "boolean" } } } },
    },
  }, async (request) => {
    const { endpoint } = request.body as { endpoint: string };
    await repo.delete({ endpoint });
    return { ok: true };
  });

  // ADMIN: отправить всем
  app.post("/admin/alem/push/send", {
    schema: {
      tags: ["Alem Admin"],
      summary: "Отправить push-уведомление всем подписчикам",
      ...bearerAuth,
      body: {
        type: "object",
        required: ["title", "body"],
        properties: {
          title: { type: "string" },
          body: { type: "string" },
          url: { type: "string" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: { sent: { type: "number" }, failed: { type: "number" } },
        },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.ALEM)],
  }, async (request) => {
    const { title, body, url } = request.body as { title: string; body: string; url?: string };
    const subs = await repo.find();

    let sent = 0;
    let failed = 0;
    const payload = JSON.stringify({ title, body, url: url ?? "https://alemfest.kz" });

    for (const sub of subs) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
        sent++;
      } catch (err: any) {
        // 404/410 — подписка истекла, удаляем
        if (err.statusCode === 404 || err.statusCode === 410) {
          await repo.delete({ id: sub.id });
        }
        failed++;
      }
    }

    return { sent, failed };
  });
}
