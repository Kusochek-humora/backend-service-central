import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { PriceZone } from "../../db/entities/ticket/price-zone.entity";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";

const bearerAuth = { security: [{ bearerAuth: [] }] };

const priceZoneSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    venueId: { type: "number" },
    name: { type: "string" },
    color: { type: "string" },
    price: { type: "number" },
    order: { type: "number" },
  },
};

const priceZoneBody = {
  name: { type: "string" },
  color: { type: "string" },
  price: { type: "number" },
  order: { type: "number" },
};

export async function priceZonesRoutes(app: FastifyInstance) {
  const repo = AppDataSource.getRepository(PriceZone);

  const jwtGuard = async (request: any, reply: any) => {
    try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
  };

  // PUBLIC
  app.get("/venues/:venueId/price-zones", {
    schema: {
      tags: ["Tickets Public"],
      summary: "Ценовые зоны зала",
      params: { type: "object", properties: { venueId: { type: "number" } } },
      response: { 200: { type: "array", items: priceZoneSchema } },
    },
  }, async (request) => {
    const { venueId } = request.params as { venueId: string };
    return repo.find({ where: { venueId: Number(venueId) }, order: { order: "ASC" } });
  });

  // ADMIN — список
  app.get("/admin/venues/:venueId/price-zones", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Ценовые зоны зала (админ)",
      ...bearerAuth,
      params: { type: "object", properties: { venueId: { type: "number" } } },
      response: { 200: { type: "array", items: priceZoneSchema } },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request) => {
    const { venueId } = request.params as { venueId: string };
    return repo.find({ where: { venueId: Number(venueId) }, order: { order: "ASC" } });
  });

  // ADMIN — создать
  app.post("/admin/venues/:venueId/price-zones", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Создать ценовую зону",
      ...bearerAuth,
      params: { type: "object", properties: { venueId: { type: "number" } } },
      body: { type: "object", required: ["name", "color", "price"], properties: priceZoneBody },
      response: { 201: priceZoneSchema },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request, reply) => {
    const { venueId } = request.params as { venueId: string };
    const zone = repo.create({ ...request.body as Partial<PriceZone>, venueId: Number(venueId) });
    await repo.save(zone);
    return reply.status(201).send(zone);
  });

  // ADMIN — обновить
  app.put("/admin/price-zones/:id", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Обновить ценовую зону",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: { type: "object", properties: priceZoneBody },
      response: {
        200: priceZoneSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const zone = await repo.findOneBy({ id: Number(id) });
    if (!zone) return reply.status(404).send({ message: "Not found" });
    repo.merge(zone, request.body as Partial<PriceZone>);
    await repo.save(zone);
    return zone;
  });

  // ADMIN — удалить
  app.delete("/admin/price-zones/:id", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Удалить ценовую зону",
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
    const zone = await repo.findOneBy({ id: Number(id) });
    if (!zone) return reply.status(404).send({ message: "Not found" });
    await repo.remove(zone);
    return { message: "Deleted" };
  });
}
