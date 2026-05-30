import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { Venue } from "../../db/entities/ticket/venue.entity";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";

const bearerAuth = { security: [{ bearerAuth: [] }] };

const venueSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    name: { type: "string" },
    description: { type: ["string", "null"] },
    svgBackground: { type: ["string", "null"] },
    width: { type: "number" },
    height: { type: "number" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const venueBody = {
  name: { type: "string" },
  description: { type: "string" },
  svgBackground: { type: "string" },
  width: { type: "number" },
  height: { type: "number" },
};

export async function venuesRoutes(app: FastifyInstance) {
  const repo = AppDataSource.getRepository(Venue);

  const jwtGuard = async (request: any, reply: any) => {
    try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
  };

  // PUBLIC — список залов
  app.get("/venues", {
    schema: {
      tags: ["Tickets Public"],
      summary: "Список залов",
      response: { 200: { type: "array", items: venueSchema } },
    },
  }, async () => {
    return repo.find({ order: { name: "ASC" } });
  });

  // PUBLIC — один зал
  app.get("/venues/:id", {
    schema: {
      tags: ["Tickets Public"],
      summary: "Один зал",
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: venueSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const venue = await repo.findOneBy({ id: Number(id) });
    if (!venue) return reply.status(404).send({ message: "Not found" });
    return venue;
  });

  // ADMIN — список
  app.get("/admin/venues", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Список залов (админ)",
      ...bearerAuth,
      response: { 200: { type: "array", items: venueSchema } },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async () => {
    return repo.find({ order: { name: "ASC" } });
  });

  // ADMIN — один зал
  app.get("/admin/venues/:id", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Один зал (админ)",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: venueSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const venue = await repo.findOneBy({ id: Number(id) });
    if (!venue) return reply.status(404).send({ message: "Not found" });
    return venue;
  });

  // ADMIN — создать
  app.post("/admin/venues", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Создать зал",
      ...bearerAuth,
      body: { type: "object", required: ["name"], properties: venueBody },
      response: { 201: venueSchema },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request, reply) => {
    const venue = repo.create(request.body as Partial<Venue>);
    await repo.save(venue);
    return reply.status(201).send(venue);
  });

  // ADMIN — обновить
  app.put("/admin/venues/:id", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Обновить зал",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: { type: "object", properties: venueBody },
      response: {
        200: venueSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const venue = await repo.findOneBy({ id: Number(id) });
    if (!venue) return reply.status(404).send({ message: "Not found" });
    repo.merge(venue, request.body as Partial<Venue>);
    await repo.save(venue);
    return venue;
  });

  // ADMIN — удалить
  app.delete("/admin/venues/:id", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Удалить зал",
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
    const venue = await repo.findOneBy({ id: Number(id) });
    if (!venue) return reply.status(404).send({ message: "Not found" });
    await repo.remove(venue);
    return { message: "Deleted" };
  });
}
