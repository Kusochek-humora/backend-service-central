import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { Order, OrderStatus } from "../../db/entities/ticket/order.entity";
import { EventSeat, EventSeatStatus } from "../../db/entities/ticket/event-seat.entity";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";

const bearerAuth = { security: [{ bearerAuth: [] }] };
const RESERVATION_MINUTES = 15;

const orderSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    eventId: { type: "number" },
    customerName: { type: "string" },
    customerEmail: { type: "string" },
    customerPhone: { type: "string" },
    totalAmount: { type: "number" },
    status: { type: "string", enum: Object.values(OrderStatus) },
    paymentId: { type: ["string", "null"] },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const orderWithTicketsSchema = {
  ...orderSchema,
  properties: {
    ...orderSchema.properties,
    tickets: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "number" },
          seatId: { type: "number" },
          eventId: { type: "number" },
          qrToken: { type: "string" },
          price: { type: "number" },
          scannedAt: { type: ["string", "null"] },
          createdAt: { type: "string" },
        },
      },
    },
  },
};

export async function ordersRoutes(app: FastifyInstance) {
  const orderRepo = AppDataSource.getRepository(Order);
  const eventSeatRepo = AppDataSource.getRepository(EventSeat);

  const jwtGuard = async (request: any, reply: any) => {
    try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
  };

  // PUBLIC — создать заказ (резерв мест на 15 минут)
  app.post("/orders", {
    schema: {
      tags: ["Tickets Public"],
      summary: "Создать заказ и зарезервировать места на 15 минут",
      body: {
        type: "object",
        required: ["eventId", "seatIds", "customerName", "customerEmail", "customerPhone"],
        properties: {
          eventId: { type: "number" },
          seatIds: { type: "array", items: { type: "number" }, minItems: 1 },
          customerName: { type: "string" },
          customerEmail: { type: "string" },
          customerPhone: { type: "string" },
        },
      },
      response: {
        201: {
          type: "object",
          properties: {
            orderId: { type: "number" },
            totalAmount: { type: "number" },
            reservedUntil: { type: "string" },
            status: { type: "string" },
          },
        },
        409: { type: "object", properties: { message: { type: "string" }, unavailableSeats: { type: "array", items: { type: "number" } } } },
      },
    },
  }, async (request, reply) => {
    const { eventId, seatIds, customerName, customerEmail, customerPhone } =
      request.body as { eventId: number; seatIds: number[]; customerName: string; customerEmail: string; customerPhone: string };

    return AppDataSource.transaction(async (manager) => {
      // Блокируем строки от конкурентного доступа
      const eventSeats = await manager
        .createQueryBuilder(EventSeat, "es")
        .setLock("pessimistic_write")
        .leftJoinAndSelect("es.seat", "seat")
        .leftJoinAndSelect("seat.group", "group")
        .where("es.eventId = :eventId AND es.seatId IN (:...seatIds)", { eventId, seatIds })
        .getMany();

      // Сбрасываем протухшие резервы
      const now = new Date();
      for (const es of eventSeats) {
        if (es.status === EventSeatStatus.RESERVED && es.reservedUntil && es.reservedUntil < now) {
          es.status = EventSeatStatus.FREE;
          es.reservedUntil = undefined;
        }
      }

      const unavailable = eventSeats.filter((es) => es.status !== EventSeatStatus.FREE).map((es) => es.seatId);
      if (unavailable.length) {
        return reply.status(409).send({ message: "Некоторые места уже заняты", unavailableSeats: unavailable });
      }

      const reservedUntil = new Date(now.getTime() + RESERVATION_MINUTES * 60 * 1000);

      // Считаем сумму
      let totalAmount = 0;
      for (const es of eventSeats) {
        const price = es.priceOverride ?? es.seat?.group?.priceZoneId ?? 0;
        totalAmount += typeof price === "number" ? price : 0;
      }

      const order = manager.create(Order, {
        eventId,
        customerName,
        customerEmail,
        customerPhone,
        totalAmount,
        status: OrderStatus.PENDING,
      });
      await manager.save(order);

      for (const es of eventSeats) {
        es.status = EventSeatStatus.RESERVED;
        es.reservedUntil = reservedUntil;
        es.orderId = order.id;
      }
      await manager.save(eventSeats);

      return reply.status(201).send({
        orderId: order.id,
        totalAmount: order.totalAmount,
        reservedUntil: reservedUntil.toISOString(),
        status: order.status,
      });
    });
  });

  // ADMIN — список заказов
  app.get("/admin/orders", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Список заказов",
      ...bearerAuth,
      querystring: {
        type: "object",
        properties: {
          eventId: { type: "number" },
          status: { type: "string" },
        },
      },
      response: { 200: { type: "array", items: orderSchema } },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request) => {
    const { eventId, status } = request.query as { eventId?: number; status?: string };
    const qb = orderRepo.createQueryBuilder("o").orderBy("o.createdAt", "DESC");
    if (eventId) qb.andWhere("o.eventId = :eventId", { eventId });
    if (status) qb.andWhere("o.status = :status", { status });
    return qb.getMany();
  });

  // ADMIN — один заказ с билетами
  app.get("/admin/orders/:id", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Один заказ с билетами",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: orderWithTicketsSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = await orderRepo.findOne({ where: { id: Number(id) }, relations: { tickets: true } });
    if (!order) return reply.status(404).send({ message: "Not found" });
    return order;
  });

  // ADMIN — сменить статус заказа
  app.patch("/admin/orders/:id/status", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Сменить статус заказа",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: {
        type: "object",
        required: ["status"],
        properties: { status: { type: "string", enum: Object.values(OrderStatus) } },
      },
      response: {
        200: orderSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: OrderStatus };
    const order = await orderRepo.findOneBy({ id: Number(id) });
    if (!order) return reply.status(404).send({ message: "Not found" });

    const prevStatus = order.status;
    order.status = status;
    await orderRepo.save(order);

    // При отмене или возврате — освобождаем места
    if ((status === OrderStatus.CANCELLED || status === OrderStatus.REFUNDED) &&
        prevStatus !== OrderStatus.CANCELLED && prevStatus !== OrderStatus.REFUNDED) {
      const seats = await eventSeatRepo.findBy({ orderId: order.id });
      for (const seat of seats) {
        seat.status = EventSeatStatus.FREE;
        seat.reservedUntil = undefined;
        seat.orderId = undefined;
      }
      await eventSeatRepo.save(seats);
    }

    return order;
  });
}
