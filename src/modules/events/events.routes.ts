import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { Event, Hall } from "../../db/entities/event.entity";
import { Between, FindOptionsWhere } from "typeorm";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";

const bearerAuth = { security: [{ bearerAuth: [] }] };

const eventSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    title: { type: "string" },
    photo: { type: "string" },
    hall: { type: "string" },
    link: { type: "string" },
    date: { type: "string" },
    time: { type: "string" },
    isDonation: { type: "boolean" },
    isOnMainPage: { type: "boolean" },
    notion: { type: "string" },
    description: { type: "string" },
    comedians: { type: "string" },
    subtext: { type: "string" },
    categoryId: { type: "number" },
    category: {
      type: "object",
      nullable: true,
      properties: {
        id: { type: "number" },
        name: { type: "string" },
      },
    },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const bodySchema = {
  type: "object",
  required: ["title", "photo", "hall", "link", "date", "time"],
  properties: {
    title: { type: "string" },
    photo: { type: "string" },
    hall: { type: "string", enum: Object.values(Hall) },
    link: { type: "string" },
    date: { type: "string", description: "YYYY-MM-DD" },
    time: { type: "string", description: "HH:MM" },
    isDonation: { type: "boolean" },
    isOnMainPage: { type: "boolean" },
    notion: { type: "string" },
    description: { type: "string" },
    comedians: { type: "string" },
    subtext: { type: "string" },
    categoryId: { type: "number" },
  },
};

function getTodayRange(): { start: string; end: string } {
  const now = new Date();
  const start = now.toISOString().split("T")[0];
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  const end = next.toISOString().split("T")[0];
  return { start, end };
}

function getWeekRange(): { start: string; end: string } {
  const now = new Date();
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
        },
      },
      response: {
        200: { type: "array", items: eventSchema },
      },
    },
  }, async (request) => {
    const { date, period, hall } = request.query as {
      date?: string;
      period?: "today" | "week";
      hall?: Hall;
    };

    const where: FindOptionsWhere<Event> = {};

    if (hall) where.hall = hall;

    if (date) {
      where.date = date;
    } else if (period === "today") {
      const { start } = getTodayRange();
      where.date = start;
    } else if (period === "week") {
      const { start, end } = getWeekRange();
      where.date = Between(start, end);
    }

    return eventRepo.find({ where, order: { date: "ASC", time: "ASC" } });
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
        },
      },
      response: {
        200: { type: "array", items: eventSchema },
        401: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [
      async (request, reply) => {
        try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
      },
      requirePermission(Section.EVENTS),
    ],
  }, async (request) => {
    const { date, period, hall } = request.query as {
      date?: string;
      period?: "today" | "week";
      hall?: Hall;
    };

    const where: FindOptionsWhere<Event> = {};
    if (hall) where.hall = hall;
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
        201: eventSchema,
        401: { type: "object", properties: { message: { type: "string" } } },
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
    return reply.status(201).send(event);
  });

  app.put("/admin/events/:id", {
    schema: {
      tags: ["Events Admin"],
      summary: "Обновить событие",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: bodySchema,
      response: {
        200: eventSchema,
        401: { type: "object", properties: { message: { type: "string" } } },
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
    eventRepo.merge(event, body);
    await eventRepo.save(event);
    return event;
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
