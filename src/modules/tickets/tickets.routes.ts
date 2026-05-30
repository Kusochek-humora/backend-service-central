import { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { AppDataSource } from "../../db/data-source";
import { Ticket } from "../../db/entities/ticket/ticket.entity";
import { Order, OrderStatus } from "../../db/entities/ticket/order.entity";
import { EventSeat, EventSeatStatus } from "../../db/entities/ticket/event-seat.entity";
import { VenueSeat } from "../../db/entities/ticket/venue-seat.entity";
import { PriceZone } from "../../db/entities/ticket/price-zone.entity";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";

const bearerAuth = { security: [{ bearerAuth: [] }] };

const ticketSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    orderId: { type: "number" },
    seatId: { type: "number" },
    eventId: { type: "number" },
    qrToken: { type: "string" },
    price: { type: "number" },
    scannedAt: { type: ["string", "null"] },
    createdAt: { type: "string" },
  },
};

export async function ticketsRoutes(app: FastifyInstance) {
  const ticketRepo = AppDataSource.getRepository(Ticket);
  const orderRepo = AppDataSource.getRepository(Order);
  const eventSeatRepo = AppDataSource.getRepository(EventSeat);
  const venueSeatRepo = AppDataSource.getRepository(VenueSeat);
  const priceZoneRepo = AppDataSource.getRepository(PriceZone);

  const jwtGuard = async (request: any, reply: any) => {
    try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
  };

  // PUBLIC — сканирование QR (валидация билета)
  app.get("/tickets/scan/:qrToken", {
    schema: {
      tags: ["Tickets Public"],
      summary: "Сканирование QR-кода билета",
      params: { type: "object", properties: { qrToken: { type: "string" } } },
      response: {
        200: {
          type: "object",
          properties: {
            valid: { type: "boolean" },
            alreadyScanned: { type: "boolean" },
            scannedAt: { type: ["string", "null"] },
            eventId: { type: ["number", "null"] },
            seatId: { type: ["number", "null"] },
            price: { type: ["number", "null"] },
          },
        },
      },
    },
  }, async (request) => {
    const { qrToken } = request.params as { qrToken: string };
    const ticket = await ticketRepo.findOneBy({ qrToken });

    if (!ticket) {
      return { valid: false, alreadyScanned: false, scannedAt: null, eventId: null, seatId: null, price: null };
    }

    if (ticket.scannedAt) {
      return {
        valid: false,
        alreadyScanned: true,
        scannedAt: ticket.scannedAt.toISOString(),
        eventId: ticket.eventId,
        seatId: ticket.seatId,
        price: ticket.price,
      };
    }

    ticket.scannedAt = new Date();
    await ticketRepo.save(ticket);

    return {
      valid: true,
      alreadyScanned: false,
      scannedAt: ticket.scannedAt.toISOString(),
      eventId: ticket.eventId,
      seatId: ticket.seatId,
      price: ticket.price,
    };
  });

  // ADMIN — получить билеты заказа
  app.get("/admin/orders/:orderId/tickets", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Билеты заказа",
      ...bearerAuth,
      params: { type: "object", properties: { orderId: { type: "number" } } },
      response: { 200: { type: "array", items: ticketSchema } },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request) => {
    const { orderId } = request.params as { orderId: string };
    return ticketRepo.findBy({ orderId: Number(orderId) });
  });

  // ADMIN — сгенерировать билеты для оплаченного заказа
  app.post("/admin/orders/:orderId/tickets/generate", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Сгенерировать билеты (вызывается после подтверждения оплаты)",
      ...bearerAuth,
      params: { type: "object", properties: { orderId: { type: "number" } } },
      response: {
        201: { type: "array", items: ticketSchema },
        400: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const order = await orderRepo.findOneBy({ id: Number(orderId) });
    if (!order) return reply.status(404).send({ message: "Order not found" });
    if (order.status !== OrderStatus.PAID) return reply.status(400).send({ message: "Order is not paid" });

    const existing = await ticketRepo.findBy({ orderId: order.id });
    if (existing.length) return reply.status(400).send({ message: "Tickets already generated" });

    const eventSeats = await eventSeatRepo.findBy({ orderId: order.id });

    const tickets: Ticket[] = [];
    for (const es of eventSeats) {
      const venueSeat = await venueSeatRepo.findOneBy({ id: es.seatId });
      let price = es.priceOverride ?? 0;

      if (!price && venueSeat?.priceZoneId) {
        const zone = await priceZoneRepo.findOneBy({ id: venueSeat.priceZoneId });
        price = zone?.price ?? 0;
      }

      const ticket = ticketRepo.create({
        orderId: order.id,
        seatId: es.seatId,
        eventId: order.eventId,
        qrToken: randomUUID(),
        price,
      });
      tickets.push(ticket);

      es.status = EventSeatStatus.SOLD;
      await eventSeatRepo.save(es);
    }

    await ticketRepo.save(tickets);
    return reply.status(201).send(tickets);
  });

  // ADMIN — список всех билетов ивента
  app.get("/admin/ticket-events/:eventId/tickets", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Все билеты ивента",
      ...bearerAuth,
      params: { type: "object", properties: { eventId: { type: "number" } } },
      response: { 200: { type: "array", items: ticketSchema } },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request) => {
    const { eventId } = request.params as { eventId: string };
    return ticketRepo.findBy({ eventId: Number(eventId) });
  });

  // ADMIN — аннулировать билет
  app.patch("/admin/tickets/:id/invalidate", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Аннулировать билет (пометить как использованный)",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: ticketSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ticket = await ticketRepo.findOneBy({ id: Number(id) });
    if (!ticket) return reply.status(404).send({ message: "Not found" });
    ticket.scannedAt = new Date();
    await ticketRepo.save(ticket);
    return ticket;
  });
}
