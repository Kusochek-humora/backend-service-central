import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { AlemEvent } from "../../db/entities/alem-event.entity";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";
import { cacheGet, cacheSet, cacheDelPattern, cacheKey } from "../../utils/cache";
import { sendAlemEvent, notifyAlemEventCreated } from "../../utils/telegram";

const TTL_ALEM = 120;
const bearerAuth = { security: [{ bearerAuth: [] }] };

const locationSchema = {
  type: "object",
  nullable: true,
  properties: {
    id: { type: "number" },
    label: { type: "string" },
    address_ru: { type: ["string", "null"] },
    address_kz: { type: ["string", "null"] },
    address_en: { type: ["string", "null"] },
    latitude: { type: ["number", "null"] },
    longitude: { type: ["number", "null"] },
    zoom: { type: ["string", "null"] },
    twogis: { type: ["string", "null"] },
  },
};

const categorySchema = {
  type: "object",
  nullable: true,
  properties: {
    id: { type: "number" },
    name_ru: { type: "string" },
    name_kz: { type: ["string", "null"] },
    name_en: { type: ["string", "null"] },
  },
};

const eventSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    title: { type: "string" },
    photo: { type: "string" },
    photoStories: { type: ["string", "null"] },
    banner: { type: ["string", "null"] },
    date: { type: "string" },
    time: { type: "string" },
    language: { type: "string", enum: ["ru", "kz", "en"] },
    notion: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
    comedians: { type: ["string", "null"] },
    link: { type: ["string", "null"] },
    moreinfolink: { type: ["string", "null"] },
    order: { type: ["number", "null"] },
    yandexSessionId: { type: ["string", "null"] },
    isSoldOut: { type: "boolean" },
    publishToOrganizerTelegram: { type: "boolean" },
    publishToMainBlock: { type: "boolean" },
    publishToMainTelegram: { type: "boolean" },
    isOnMainPage: { type: "boolean" },
    telegramMsgId: { type: ["string", "null"] },
    location: locationSchema,
    category: categorySchema,
    locationId: { type: ["number", "null"] },
    categoryId: { type: ["number", "null"] },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const eventBodyProperties = {
  title: { type: "string" },
  photo: { type: "string" },
  photoStories: { type: "string" },
  banner: { type: "string" },
  date: { type: "string" },
  time: { type: "string" },
  language: { type: "string", enum: ["ru", "kz", "en"] },
  notion: { type: "string" },
  description: { type: "string" },
  comedians: { type: "string" },
  link: { type: "string" },
  moreinfolink: { type: "string" },
  order: { type: "number" },
  yandexSessionId: { type: "string" },
  isSoldOut: { type: "boolean" },
  publishToOrganizerTelegram: { type: "boolean" },
  publishToMainBlock: { type: "boolean" },
  publishToMainTelegram: { type: "boolean" },
  isOnMainPage: { type: "boolean" },
  locationId: { type: ["number", "null"] },
  categoryId: { type: ["number", "null"] },
};

const ALMATY_OFFSET_MS = 5 * 60 * 60 * 1000;
function almatyNow() { return new Date(Date.now() + ALMATY_OFFSET_MS); }

export async function alemEventsRoutes(app: FastifyInstance) {
  const repo = AppDataSource.getRepository(AlemEvent);

  const jwtGuard = async (request: any, reply: any) => {
    try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
  };

  // PUBLIC — список активных
  app.get("/alem/events", {
    schema: {
      tags: ["Alem Public"],
      summary: "Список активных мероприятий Alem",
      querystring: {
        type: "object",
        properties: {
          categoryId: { type: "number" },
          locationId: { type: "number" },
          isOnMainPage: { type: "boolean" },
          date: { type: "string", description: "YYYY-MM-DD" },
          language: { type: "string", enum: ["ru", "kz", "en"] },
        },
      },
      response: { 200: { type: "array", items: eventSchema } },
    },
  }, async (request) => {
    const { categoryId, locationId, isOnMainPage, date, language } = request.query as {
      categoryId?: number; locationId?: number; isOnMainPage?: boolean; date?: string; language?: string;
    };
    const key = cacheKey("alem:list", request.query as object);
    const cached = await cacheGet(key);
    if (cached) return cached;

    const now = almatyNow();
    const today = now.toISOString().split("T")[0];
    const currentTime = now.toISOString().split("T")[1].slice(0, 8);

    const qb = repo.createQueryBuilder("e")
      .leftJoinAndSelect("e.location", "location")
      .leftJoinAndSelect("e.category", "category");

    if (date) {
      qb.where("e.date = :date", { date });
    } else {
      qb.where("(e.date > :today OR (e.date = :today AND e.time >= :currentTime))", { today, currentTime });
    }

    if (categoryId) qb.andWhere("e.categoryId = :categoryId", { categoryId });
    if (locationId) qb.andWhere("e.locationId = :locationId", { locationId });
    if (isOnMainPage !== undefined) qb.andWhere("e.isOnMainPage = :isOnMainPage", { isOnMainPage });
    if (language) qb.andWhere("e.language = :language", { language });

    const result = await qb.orderBy("e.date", "ASC").addOrderBy("e.time", "ASC").getMany();
    await cacheSet(key, result, TTL_ALEM);
    return result;
  });

  // PUBLIC — один ивент
  app.get("/alem/events/:id", {
    schema: {
      tags: ["Alem Public"],
      summary: "Мероприятие Alem по id",
      params: { type: "object", properties: { id: { type: "number" } } },
      response: { 200: eventSchema, 404: { type: "object", properties: { message: { type: "string" } } } },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const key = `alem:id:${id}`;
    const cached = await cacheGet(key);
    if (cached) return cached;
    const event = await repo.findOne({ where: { id: Number(id) }, relations: { location: true, category: true } });
    if (!event) return reply.status(404).send({ message: "Not found" });
    await cacheSet(key, event, TTL_ALEM);
    return event;
  });

  // ADMIN — список всех
  app.get("/admin/alem/events", {
    schema: {
      tags: ["Alem Admin"], summary: "Все мероприятия Alem", ...bearerAuth,
      querystring: {
        type: "object",
        properties: {
          categoryId: { type: "number" },
          locationId: { type: "number" },
          isOnMainPage: { type: "boolean" },
          date: { type: "string", description: "YYYY-MM-DD" },
          language: { type: "string", enum: ["ru", "kz", "en"] },
        },
      },
      response: { 200: { type: "array", items: eventSchema } },
    },
    onRequest: [jwtGuard, requirePermission(Section.ALEM)],
  }, async (request) => {
    const { categoryId, locationId, isOnMainPage, date, language } = request.query as {
      categoryId?: number; locationId?: number; isOnMainPage?: boolean; date?: string; language?: string;
    };

    const qb = repo.createQueryBuilder("e")
      .leftJoinAndSelect("e.location", "location")
      .leftJoinAndSelect("e.category", "category");

    if (date) qb.andWhere("e.date = :date", { date });
    if (categoryId) qb.andWhere("e.categoryId = :categoryId", { categoryId });
    if (locationId) qb.andWhere("e.locationId = :locationId", { locationId });
    if (isOnMainPage !== undefined) qb.andWhere("e.isOnMainPage = :isOnMainPage", { isOnMainPage });
    if (language) qb.andWhere("e.language = :language", { language });

    return qb.orderBy("e.date", "ASC").addOrderBy("e.time", "ASC").getMany();
  });

  // ADMIN — один ивент
  app.get("/admin/alem/events/:id", {
    schema: {
      tags: ["Alem Admin"], summary: "Мероприятие Alem по id", ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: { 200: eventSchema, 404: { type: "object", properties: { message: { type: "string" } } } },
    },
    onRequest: [jwtGuard, requirePermission(Section.ALEM)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const event = await repo.findOne({ where: { id: Number(id) }, relations: { location: true, category: true } });
    if (!event) return reply.status(404).send({ message: "Not found" });
    return event;
  });

  // ADMIN — создать
  app.post("/admin/alem/events", {
    schema: {
      tags: ["Alem Admin"], summary: "Создать мероприятие Alem", ...bearerAuth,
      body: { type: "object", required: ["title", "photo", "date", "time"], properties: eventBodyProperties },
      response: { 201: eventSchema },
    },
    onRequest: [jwtGuard, requirePermission(Section.ALEM)],
  }, async (request, reply) => {
    const event = repo.create(request.body as Partial<AlemEvent>);
    await repo.save(event);
    await cacheDelPattern("alem:*");
    const saved = await repo.findOne({ where: { id: event.id }, relations: { location: true, category: true } });

    console.log(`[alem/events POST] id=${saved?.id} publishToOrganizerTelegram=${saved?.publishToOrganizerTelegram} publishToMainTelegram=${saved?.publishToMainTelegram}`);

    if (saved && saved.publishToOrganizerTelegram) {
      sendAlemEvent({
        id: saved.id, title: saved.title, date: saved.date, time: saved.time,
        photo: saved.photo, photoStories: saved.photoStories,
        link: saved.link, yandexSessionId: saved.yandexSessionId, moreinfolink: saved.moreinfolink,
      }).then(async (r) => {
        console.log("[alem/events POST] sendAlemEvent result:", JSON.stringify(r));
        if (r.msgId) await repo.update(saved.id, { telegramMsgId: r.msgId });
      }).catch((e) => console.error("[alem/events POST] sendAlemEvent error:", e));
    }

    if (saved && saved.publishToMainTelegram) {
      notifyAlemEventCreated({
        id: saved.id, title: saved.title, date: saved.date, time: saved.time,
        photo: saved.photo, link: saved.link, yandexSessionId: saved.yandexSessionId,
      }).then((r) => console.log("[alem/events POST] notifyAlemEventCreated result:", JSON.stringify(r)))
        .catch((e) => console.error("[alem/events POST] notifyAlemEventCreated error:", e));
    }

    return reply.status(201).send(saved);
  });

  // ADMIN — обновить
  app.put("/admin/alem/events/:id", {
    schema: {
      tags: ["Alem Admin"], summary: "Обновить мероприятие Alem", ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: { type: "object", properties: eventBodyProperties },
      response: { 200: eventSchema, 404: { type: "object", properties: { message: { type: "string" } } } },
    },
    onRequest: [jwtGuard, requirePermission(Section.ALEM)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const exists = await repo.findOneBy({ id: Number(id) });
    if (!exists) return reply.status(404).send({ message: "Not found" });
    await repo.update(Number(id), request.body as Partial<AlemEvent>);
    await cacheDelPattern("alem:*");
    return repo.findOne({ where: { id: Number(id) }, relations: { location: true, category: true } });
  });

  // ADMIN — удалить
  app.delete("/admin/alem/events/:id", {
    schema: {
      tags: ["Alem Admin"], summary: "Удалить мероприятие Alem", ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: { 200: { type: "object", properties: { message: { type: "string" } } }, 404: { type: "object", properties: { message: { type: "string" } } } },
    },
    onRequest: [jwtGuard, requirePermission(Section.ALEM)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const event = await repo.findOneBy({ id: Number(id) });
    if (!event) return reply.status(404).send({ message: "Not found" });
    await repo.remove(event);
    await cacheDelPattern("alem:*");
    return { message: "Deleted" };
  });
}
