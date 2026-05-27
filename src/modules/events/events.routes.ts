import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { Event, Hall, Language } from "../../db/entities/event.entity";
import { Between, FindOptionsWhere } from "typeorm";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";
import { notifyEventCreated } from "../../utils/telegram";

const bearerAuth = { security: [{ bearerAuth: [] }] };

const eventSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    title: { type: "string" },
    photo: { type: "string" },
    hall: { type: "string", enum: ["big", "small"] },
    language: { type: "string", enum: ["ru", "kz", "en"] },
    link: { type: "string" },
    date: { type: "string", description: "YYYY-MM-DD" },
    time: { type: "string", description: "HH:MM" },
    isDonation: { type: "boolean" },
    isSoldOut: { type: "boolean" },
    isOnMainPage: { type: "boolean" },
    publishToTelegram: { type: "boolean" },
    notion: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
    comedians: { type: ["string", "null"] },
    subtext: { type: ["string", "null"] },
    categoryId: { type: ["number", "null"] },
    category: {
      nullable: true,
      type: "object",
      properties: {
        id: { type: "number" },
        name: { type: "string" },
      },
    },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const eventProperties = {
  title: { type: "string" },
  photo: { type: "string", description: "URL из /admin/upload/events" },
  hall: { type: "string", enum: Object.values(Hall), description: "big | small" },
  language: { type: "string", enum: Object.values(Language), description: "Язык события: ru | kz | en" },
  link: { type: "string", description: "Ссылка на билеты" },
  date: { type: "string", description: "YYYY-MM-DD" },
  time: { type: "string", description: "HH:MM" },
  isDonation: { type: "boolean", description: "Мероприятие по донейшену" },
  isSoldOut: { type: "boolean", description: "Билеты проданы" },
  isOnMainPage: { type: "boolean", description: "Показывать на главной" },
  publishToTelegram: { type: "boolean", description: "Опубликовать анонс в Telegram канал" },
  notion: { type: "string", description: "Краткое описание (опционально)" },
  description: { type: "string", description: "Полное описание (опционально)" },
  comedians: { type: "string", description: "Участники (опционально)" },
  subtext: { type: "string", description: "Подпись (опционально)" },
  categoryId: { type: "number", description: "ID категории (опционально)" },
};

const bodySchema = {
  type: "object",
  required: ["title", "photo", "hall", "link", "date", "time"],
  properties: eventProperties,
};

const updateBodySchema = {
  type: "object",
  properties: eventProperties,
};

// Events are stored in Almaty time (UTC+5); offset server UTC to match
const ALMATY_OFFSET_MS = 5 * 60 * 60 * 1000;

function almatyNow(): Date {
  return new Date(Date.now() + ALMATY_OFFSET_MS);
}

function getTodayRange(): { start: string; end: string } {
  const now = almatyNow();
  const start = now.toISOString().split("T")[0];
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  const end = next.toISOString().split("T")[0];
  return { start, end };
}

function getWeekRange(): { start: string; end: string } {
  const now = almatyNow();
  const start = now.toISOString().split("T")[0];
  const next = new Date(now);
  next.setDate(next.getDate() + 7);
  const end = next.toISOString().split("T")[0];
  return { start, end };
}

export async function eventsRoutes(app: FastifyInstance) {
  const eventRepo = AppDataSource.getRepository(Event);

  // PUBLIC
  app.get("/events", {
    schema: {
      tags: ["Events Public"],
      summary: "Получить все события (публичный)",
      querystring: {
        type: "object",
        properties: {
          date: { type: "string", description: "Фильтр по дате YYYY-MM-DD" },
          period: { type: "string", enum: ["today", "week"], description: "Сегодня или вся неделя" },
          hall: { type: "string", enum: Object.values(Hall), description: "Фильтр по залу" },
          language: { type: "string", enum: Object.values(Language), description: "Фильтр по языку: ru | kz | en" },
          isOnMainPage: { type: "boolean", description: "Только ивенты на главной" },
          categoryId: { type: "number", description: "Фильтр по категории" },
        },
      },
      response: {
        200: { type: "array", items: eventSchema },
      },
    },
  }, async (request) => {
    const { date, period, hall, language, isOnMainPage, categoryId } = request.query as {
      date?: string;
      period?: "today" | "week";
      hall?: Hall;
      language?: Language;
      isOnMainPage?: boolean;
      categoryId?: number;
    };

    const now = almatyNow();
    const today = now.toISOString().split("T")[0];
    const currentTime = now.toISOString().split("T")[1].slice(0, 8);

    const qb = eventRepo.createQueryBuilder("e").leftJoinAndSelect("e.category", "category");

    if (hall) qb.andWhere("e.hall = :hall", { hall });
    if (language) qb.andWhere("e.language = :language", { language });
    if (isOnMainPage !== undefined) qb.andWhere("e.isOnMainPage = :isOnMainPage", { isOnMainPage });
    if (categoryId) qb.andWhere("e.categoryId = :categoryId", { categoryId });

    if (date) {
      qb.andWhere("e.date = :date", { date });
    } else if (period === "today") {
      qb.andWhere("e.date = :today", { today });
    } else if (period === "week") {
      const { end } = getWeekRange();
      qb.andWhere("(e.date > :today OR (e.date = :today AND e.time >= :currentTime))", { today, currentTime });
      qb.andWhere("e.date <= :end", { end });
    } else {
      qb.andWhere("(e.date > :today OR (e.date = :today AND e.time >= :currentTime))", { today, currentTime });
    }

    return qb.orderBy("e.date", "ASC").addOrderBy("e.time", "ASC").getMany();
  });

  app.get("/events/:id", {
    schema: {
      tags: ["Events Public"],
      summary: "Получить событие по id (публичный)",
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: eventSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const event = await eventRepo.findOneBy({ id: Number(id) });
    if (!event) return reply.status(404).send({ message: "Not found" });
    return event;
  });

  const pastEventSchema = {
    type: "object",
    properties: {
      id: { type: "number" },
      title: { type: "string" },
      hall: { type: "string", enum: ["big", "small"] },
      language: { type: "string", enum: ["ru", "kz", "en"] },
      date: { type: "string", description: "YYYY-MM-DD" },
      time: { type: "string", description: "HH:MM" },
      notion: { type: ["string", "null"] },
      description: { type: ["string", "null"] },
      comedians: { type: ["string", "null"] },
      subtext: { type: ["string", "null"] },
      category: {
        nullable: true,
        type: "object",
        properties: {
          id: { type: "number" },
          name: { type: "string" },
        },
      },
    },
  };

  app.get("/events/past", {
    schema: {
      tags: ["Events Public"],
      summary: "Прошедшие события без фото, с пагинацией",
      querystring: {
        type: "object",
        properties: {
          page: { type: "number", description: "Страница (по умолчанию 1)" },
          limit: { type: "number", description: "Кол-во на странице (по умолчанию 20)" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            data: { type: "array", items: pastEventSchema },
            total: { type: "number" },
            page: { type: "number" },
            limit: { type: "number" },
            pages: { type: "number" },
          },
        },
      },
    },
  }, async (request) => {
    const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };
    const now = almatyNow();
    const today = now.toISOString().split("T")[0];
    const currentTime = now.toISOString().split("T")[1].slice(0, 8);

    const [events, total] = await eventRepo.createQueryBuilder("e")
      .leftJoinAndSelect("e.category", "category")
      .where("(e.date < :today OR (e.date = :today AND e.time < :currentTime))", { today, currentTime })
      .orderBy("e.date", "DESC")
      .addOrderBy("e.time", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data = events.map(({ photo: _p, link: _l, isDonation: _d, isOnMainPage: _m, categoryId: _cid, createdAt: _ca, updatedAt: _ua, ...rest }) => rest);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  });

  // ADMIN
  app.get("/admin/events", {
    schema: {
      tags: ["Events Admin"],
      summary: "Получить все события (админ)",
      ...bearerAuth,
      querystring: {
        type: "object",
        properties: {
          date: { type: "string" },
          period: { type: "string", enum: ["today", "week"] },
          hall: { type: "string", enum: Object.values(Hall) },
          language: { type: "string", enum: Object.values(Language) },
        },
      },
      response: {
        200: { type: "array", items: eventSchema },
        401: { type: "object", properties: { message: { type: "string" } } },
        403: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [
      async (request, reply) => {
        try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
      },
      requirePermission(Section.EVENTS),
    ],
  }, async (request) => {
    const { date, period, hall, language } = request.query as {
      date?: string;
      period?: "today" | "week";
      hall?: Hall;
      language?: Language;
    };

    const where: FindOptionsWhere<Event> = {};
    if (hall) where.hall = hall;
    if (language) where.language = language;
    if (date) {
      where.date = date;
    } else if (period === "today") {
      where.date = getTodayRange().start;
    } else if (period === "week") {
      const { start, end } = getWeekRange();
      where.date = Between(start, end);
    }

    return eventRepo.find({ where, order: { date: "ASC", time: "ASC" } });
  });

  app.get("/admin/events/:id", {
    schema: {
      tags: ["Events Admin"],
      summary: "Получить событие по id (админ)",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: eventSchema,
        401: { type: "object", properties: { message: { type: "string" } } },
        403: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [
      async (request, reply) => {
        try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
      },
      requirePermission(Section.EVENTS),
    ],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const event = await eventRepo.findOneBy({ id: Number(id) });
    if (!event) return reply.status(404).send({ message: "Not found" });
    return event;
  });

  app.post("/admin/events", {
    schema: {
      tags: ["Events Admin"],
      summary: "Создать событие",
      ...bearerAuth,
      body: bodySchema,
      response: {
        201: {
          type: "object",
          properties: {
            ...eventSchema.properties,
            telegram: { type: "object", nullable: true, additionalProperties: true },
          },
        },
        401: { type: "object", properties: { message: { type: "string" } } },
        403: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [
      async (request, reply) => {
        try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
      },
      requirePermission(Section.EVENTS),
    ],
  }, async (request, reply) => {
    const body = request.body as Partial<Event>;
    const event = eventRepo.create(body);
    await eventRepo.save(event);
    const telegram = event.publishToTelegram ? await notifyEventCreated(event) : null;
    return reply.status(201).send({ ...event, telegram });
  });

  app.put("/admin/events/:id", {
    schema: {
      tags: ["Events Admin"],
      summary: "Обновить событие",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: updateBodySchema,
      response: {
        200: {
          type: "object",
          properties: {
            ...eventSchema.properties,
            telegram: { type: "object", nullable: true, additionalProperties: true },
          },
        },
        401: { type: "object", properties: { message: { type: "string" } } },
        403: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [
      async (request, reply) => {
        try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
      },
      requirePermission(Section.EVENTS),
    ],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const event = await eventRepo.findOneBy({ id: Number(id) });
    if (!event) return reply.status(404).send({ message: "Not found" });
    const body = request.body as Partial<Event>;
    const wasPublished = event.publishToTelegram;
    eventRepo.merge(event, body);
    await eventRepo.save(event);
    const telegram = !wasPublished && event.publishToTelegram ? await notifyEventCreated(event) : null;
    return { ...event, telegram };
  });

  app.delete("/admin/events/:id", {
    schema: {
      tags: ["Events Admin"],
      summary: "Удалить событие",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: { type: "object", properties: { message: { type: "string" } } },
        401: { type: "object", properties: { message: { type: "string" } } },
        403: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [
      async (request, reply) => {
        try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
      },
      requirePermission(Section.EVENTS),
    ],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const event = await eventRepo.findOneBy({ id: Number(id) });
    if (!event) return reply.status(404).send({ message: "Not found" });
    await eventRepo.remove(event);
    return { message: "Deleted" };
  });
}
