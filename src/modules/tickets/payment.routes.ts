import { FastifyInstance } from "fastify";
import { createHash } from "crypto";
import { randomUUID } from "crypto";
import { AppDataSource } from "../../db/data-source";
import { Order, OrderStatus } from "../../db/entities/ticket/order.entity";
import { EventSeat, EventSeatStatus } from "../../db/entities/ticket/event-seat.entity";
import { Ticket } from "../../db/entities/ticket/ticket.entity";
import { VenueSeat } from "../../db/entities/ticket/venue-seat.entity";
import { PriceZone } from "../../db/entities/ticket/price-zone.entity";

function md5(str: string): string {
  return createHash("md5").update(str).digest("hex").toUpperCase();
}

function getPaymentSign(amount: number, invId: number): string {
  const login = process.env.ROBOKASSA_LOGIN!;
  const pass1 = process.env.ROBOKASSA_PASSWORD1!;
  return md5(`${login}:${amount}.00:${invId}:${pass1}`);
}

function verifyWebhookSign(outSum: string, invId: string, sigValue: string): boolean {
  const pass2 = process.env.ROBOKASSA_PASSWORD2!;
  const expected = md5(`${outSum}:${invId}:${pass2}`);
  return expected === sigValue.toUpperCase();
}

export async function paymentRoutes(app: FastifyInstance) {
  const orderRepo = AppDataSource.getRepository(Order);
  const eventSeatRepo = AppDataSource.getRepository(EventSeat);
  const ticketRepo = AppDataSource.getRepository(Ticket);
  const venueSeatRepo = AppDataSource.getRepository(VenueSeat);
  const priceZoneRepo = AppDataSource.getRepository(PriceZone);

  // PUBLIC — получить ссылку на оплату Robokassa для заказа
  app.get("/orders/:orderId/payment-url", {
    schema: {
      tags: ["Tickets Public"],
      summary: "Ссылка на оплату Robokassa для заказа",
      params: { type: "object", properties: { orderId: { type: "number" } } },
      response: {
        200: { type: "object", properties: { url: { type: "string" } } },
        400: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const order = await orderRepo.findOneBy({ id: Number(orderId) });

    if (!order) return reply.status(404).send({ message: "Order not found" });
    if (order.status !== OrderStatus.PENDING) {
      return reply.status(400).send({ message: "Order is not pending" });
    }

    const login = process.env.ROBOKASSA_LOGIN!;
    const isTest = process.env.ROBOKASSA_TEST_MODE === "true" ? 1 : 0;
    const amount = order.totalAmount;
    const invId = order.id;
    const sign = getPaymentSign(amount, invId);

    const url =
      `https://auth.robokassa.ru/Merchant/Index.aspx` +
      `?MrchLogin=${login}` +
      `&OutSum=${amount}.00` +
      `&InvId=${invId}` +
      `&SignatureValue=${sign}` +
      `&IsTest=${isTest}`;

    return { url };
  });

  // WEBHOOK — уведомление от Robokassa (ResultURL)
  app.post("/payment/robokassa/webhook", {
    schema: {
      tags: ["Tickets Public"],
      summary: "Webhook Robokassa — подтверждение оплаты",
      body: {
        type: "object",
        properties: {
          OutSum: { type: "string" },
          InvId: { type: "string" },
          SignatureValue: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    const { OutSum, InvId, SignatureValue } = request.body as {
      OutSum: string;
      InvId: string;
      SignatureValue: string;
    };

    if (!verifyWebhookSign(OutSum, InvId, SignatureValue)) {
      return reply.status(400).send("bad sign");
    }

    const orderId = Number(InvId);
    const order = await orderRepo.findOneBy({ id: orderId });
    if (!order || order.status === OrderStatus.PAID) {
      return reply.status(200).send(`OK${InvId}`);
    }

    order.status = OrderStatus.PAID;
    order.paymentId = SignatureValue;
    await orderRepo.save(order);

    // Генерируем билеты
    const eventSeats = await eventSeatRepo.findBy({ orderId: order.id });
    const tickets: Ticket[] = [];

    for (const es of eventSeats) {
      const venueSeat = await venueSeatRepo.findOneBy({ id: es.seatId });
      let price = es.priceOverride ?? 0;

      if (!price && venueSeat?.priceZoneId) {
        const zone = await priceZoneRepo.findOneBy({ id: venueSeat.priceZoneId });
        price = zone?.price ?? 0;
      }

      tickets.push(ticketRepo.create({
        orderId: order.id,
        seatId: es.seatId,
        eventId: order.eventId,
        qrToken: randomUUID(),
        price,
      }));

      es.status = EventSeatStatus.SOLD;
    }

    await eventSeatRepo.save(eventSeats);
    await ticketRepo.save(tickets);

    // Robokassa ожидает ответ "OK{InvId}"
    return reply.status(200).send(`OK${InvId}`);
  });
}
