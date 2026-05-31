import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { EventSeat, EventSeatStatus } from "../../db/entities/ticket/event-seat.entity";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";

const bearerAuth = { security: [{ bearerAuth: [] }] };

const eventSeatSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    eventId: { type: "number" },
    seatId: { type: "number" },
    status: { type: "string", enum: Object.values(EventSeatStatus) },
    reservedUntil: { type: ["string", "null"] },
    priceOverride: { type: ["number", "null"] },
    orderId: { type: ["number", "null"] },
    seat: {
      type: "object",
      properties: {
        id: { type: "number" },
        groupId: { type: "number" },
        venueId: { type: "number" },
        seatNumber: { type: "number" },
        offsetX: { type: "number" },
        offsetY: { type: "number" },
        priceZoneId: { type: ["number", "null"] },
        priceZone: {
          type: ["object", "null"],
          properties: {
            id: { type: "number" },
            name: { type: "string" },
            color: { type: "string" },
            price: { type: "number" },
          },
        },
        group: {
          type: "object",
          properties: {
            id: { type: "number" },
            type: { type: "string" },
            label: { type: "string" },
            cx: { type: "number" },
            cy: { type: "number" },
            rotation: { type: "number" },
            priceZoneId: { type: ["number", "null"] },
            priceZone: {
              type: ["object", "null"],
              properties: {
                id: { type: "number" },
                name: { type: "string" },
                color: { type: "string" },
                price: { type: "number" },
              },
            },
          },
        },
      },
    },
  },
};

export async function eventSeatsRoutes(app: FastifyInstance) {
  const repo = AppDataSource.getRepository(EventSeat);

  const jwtGuard = async (request: any, reply: any) => {
    try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
  };

  // PUBLIC — все места ивента с их статусом и координатами
  app.get("/ticket-events/:eventId/seats", {
    schema: {
      tags: ["Tickets Public"],
      summary: "Места ивента со статусом и координатами для рендера схемы",
      params: { type: "object", properties: { eventId: { type: "number" } } },
      response: { 200: { type: "array", items: eventSeatSchema } },
    },
  }, async (request) => {
    const { eventId } = request.params as { eventId: string };
    return repo.find({
      where: { eventId: Number(eventId) },
      relations: { seat: { priceZone: true, group: { priceZone: true } } },
      order: { id: "ASC" },
    });
  });

  // ADMIN — все места ивента с координатами (для рендера схемы зала)
  app.get("/admin/ticket-events/:eventId/seats", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Места ивента со статусом и координатами для рендера схемы зала",
      description: "Возвращает все места ивента с вложенными координатами, группой и priceZoneId — для рендера интерактивной схемы зала",
      ...bearerAuth,
      params: { type: "object", properties: { eventId: { type: "number" } } },
      response: { 200: { type: "array", items: eventSeatSchema } },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request) => {
    const { eventId } = request.params as { eventId: string };
    return repo.find({
      where: { eventId: Number(eventId) },
      relations: { seat: { priceZone: true, group: { priceZone: true } } },
      order: { id: "ASC" },
    });
  });

  // ADMIN — сменить статус одного места (заблокировать/разблокировать)
  app.patch("/admin/event-seats/:id/status", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Сменить статус места (blocked/free)",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: {
        type: "object",
        required: ["status"],
        properties: { status: { type: "string", enum: Object.values(EventSeatStatus) } },
      },
      response: {
        200: eventSeatSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: EventSeatStatus };
    const seat = await repo.findOne({ where: { id: Number(id) }, relations: { seat: { priceZone: true, group: { priceZone: true } } } });
    if (!seat) return reply.status(404).send({ message: "Not found" });
    seat.status = status;
    if (status === EventSeatStatus.FREE) seat.reservedUntil = undefined;
    await repo.save(seat);
    return seat;
  });

  // ADMIN — массовая смена статуса (список id мест)
  app.patch("/admin/ticket-events/:eventId/seats/bulk-status", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Массово сменить статус мест (заблокировать зону)",
      ...bearerAuth,
      params: { type: "object", properties: { eventId: { type: "number" } } },
      body: {
        type: "object",
        required: ["seatIds", "status"],
        properties: {
          seatIds: { type: "array", items: { type: "number" } },
          status: { type: "string", enum: Object.values(EventSeatStatus) },
        },
      },
      response: {
        200: { type: "object", properties: { updated: { type: "number" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request) => {
    const { eventId } = request.params as { eventId: string };
    const { seatIds, status } = request.body as { seatIds: number[]; status: EventSeatStatus };

    const seats = await repo.find({
      where: seatIds.map((seatId) => ({ eventId: Number(eventId), seatId })),
    });

    for (const seat of seats) {
      seat.status = status;
      if (status === EventSeatStatus.FREE) seat.reservedUntil = undefined;
    }
    await repo.save(seats);

    return { updated: seats.length };
  });

  // ADMIN — установить цену override для места
  app.patch("/admin/event-seats/:id/price", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Установить индивидуальную цену для места на ивенте",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: {
        type: "object",
        properties: { priceOverride: { type: ["number", "null"] } },
      },
      response: {
        200: { type: "object", properties: { id: { type: "number" }, priceOverride: { type: ["number", "null"] } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { priceOverride } = request.body as { priceOverride?: number | null };
    const seat = await repo.findOneBy({ id: Number(id) });
    if (!seat) return reply.status(404).send({ message: "Not found" });
    seat.priceOverride = priceOverride ?? undefined;
    await repo.save(seat);
    return { id: seat.id, priceOverride: seat.priceOverride ?? null };
  });
}
