import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { TicketEvent, TicketEventStatus } from "../../db/entities/ticket/ticket-event.entity";
import { EventSeat, EventSeatStatus } from "../../db/entities/ticket/event-seat.entity";
import { VenueSeat } from "../../db/entities/ticket/venue-seat.entity";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";

const bearerAuth = { security: [{ bearerAuth: [] }] };

const ticketEventSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    venueId: { type: "number" },
    title: { type: "string" },
    description: { type: ["string", "null"] },
    date: { type: "string" },
    time: { type: "string" },
    status: { type: "string", enum: Object.values(TicketEventStatus) },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const eventBody = {
  venueId: { type: "number" },
  title: { type: "string" },
  description: { type: "string" },
  date: { type: "string", description: "Формат: YYYY-MM-DD, например 2026-06-15" },
  time: { type: "string", description: "Формат: HH:MM, например 19:00" },
};

export async function ticketEventsRoutes(app: FastifyInstance) {
  const eventRepo = AppDataSource.getRepository(TicketEvent);
  const eventSeatRepo = AppDataSource.getRepository(EventSeat);
  const venueSeatRepo = AppDataSource.getRepository(VenueSeat);

  const jwtGuard = async (request: any, reply: any) => {
    try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
  };

  // PUBLIC — опубликованные ивенты
  app.get("/ticket-events", {
    schema: {
      tags: ["Tickets Public"],
      summary: "Список опубликованных ивентов",
      querystring: {
        type: "object",
        properties: {
          venueId: { type: "number" },
          date: { type: "string" },
        },
      },
      response: { 200: { type: "array", items: ticketEventSchema } },
    },
  }, async (request) => {
    const { venueId, date } = request.query as { venueId?: number; date?: string };
    const qb = eventRepo.createQueryBuilder("e")
      .where("e.status = :status", { status: TicketEventStatus.PUBLISHED });
    if (venueId) qb.andWhere("e.venueId = :venueId", { venueId });
    if (date) qb.andWhere("e.date = :date", { date });
    return qb.orderBy("e.date", "ASC").addOrderBy("e.time", "ASC").getMany();
  });

  // PUBLIC — один ивент
  app.get("/ticket-events/:id", {
    schema: {
      tags: ["Tickets Public"],
      summary: "Один ивент",
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: ticketEventSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const event = await eventRepo.findOneBy({ id: Number(id), status: TicketEventStatus.PUBLISHED });
    if (!event) return reply.status(404).send({ message: "Not found" });
    return event;
  });

  // ADMIN — все ивенты
  app.get("/admin/ticket-events", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Все ивенты включая черновики",
      ...bearerAuth,
      querystring: {
        type: "object",
        properties: {
          venueId: { type: "number" },
          status: { type: "string" },
        },
      },
      response: { 200: { type: "array", items: ticketEventSchema } },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request) => {
    const { venueId, status } = request.query as { venueId?: number; status?: string };
    const qb = eventRepo.createQueryBuilder("e");
    if (venueId) qb.andWhere("e.venueId = :venueId", { venueId });
    if (status) qb.andWhere("e.status = :status", { status });
    return qb.orderBy("e.date", "DESC").addOrderBy("e.time", "DESC").getMany();
  });

  // ADMIN — один ивент
  app.get("/admin/ticket-events/:id", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Один ивент (админ)",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: ticketEventSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const event = await eventRepo.findOneBy({ id: Number(id) });
    if (!event) return reply.status(404).send({ message: "Not found" });
    return event;
  });

  // ADMIN — создать ивент (автоматически генерирует event_seats)
  app.post("/admin/ticket-events", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Создать ивент — автоматически создаёт места из зала",
      ...bearerAuth,
      body: { type: "object", required: ["venueId", "title", "date", "time"], properties: eventBody },
      response: { 201: ticketEventSchema },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request, reply) => {
    const body = request.body as Partial<TicketEvent>;
    const event = eventRepo.create(body);
    await eventRepo.save(event);

    const venueSeats = await venueSeatRepo.findBy({ venueId: event.venueId });
    if (venueSeats.length) {
      const eventSeats = venueSeats.map((seat) =>
        eventSeatRepo.create({
          eventId: event.id,
          seatId: seat.id,
          status: EventSeatStatus.FREE,
        })
      );
      await eventSeatRepo.save(eventSeats);
    }

    return reply.status(201).send(event);
  });

  // ADMIN — обновить ивент
  app.put("/admin/ticket-events/:id", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Обновить ивент",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: { type: "object", properties: eventBody },
      response: {
        200: ticketEventSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const event = await eventRepo.findOneBy({ id: Number(id) });
    if (!event) return reply.status(404).send({ message: "Not found" });
    eventRepo.merge(event, request.body as Partial<TicketEvent>);
    await eventRepo.save(event);
    return event;
  });

  // ADMIN — сменить статус (draft/published/cancelled)
  app.patch("/admin/ticket-events/:id/status", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Сменить статус ивента",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: {
        type: "object",
        required: ["status"],
        properties: { status: { type: "string", enum: Object.values(TicketEventStatus) } },
      },
      response: {
        200: ticketEventSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: TicketEventStatus };
    const event = await eventRepo.findOneBy({ id: Number(id) });
    if (!event) return reply.status(404).send({ message: "Not found" });
    event.status = status;
    await eventRepo.save(event);
    return event;
  });

  // ADMIN — удалить ивент
  app.delete("/admin/ticket-events/:id", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Удалить ивент",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const event = await eventRepo.findOneBy({ id: Number(id) });
    if (!event) return reply.status(404).send({ message: "Not found" });
    await eventRepo.remove(event);
    return { message: "Deleted" };
  });
}
