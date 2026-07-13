import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { AlemLocation } from "../../db/entities/alem-location.entity";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";

const bearerAuth = { security: [{ bearerAuth: [] }] };

const locationSchema = {
  type: "object",
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

const locationBody = {
  type: "object",
  properties: {
    label: { type: "string" },
    address_ru: { type: "string" },
    address_kz: { type: "string" },
    address_en: { type: "string" },
    latitude: { type: "number" },
    longitude: { type: "number" },
    zoom: { type: "string" },
    twogis: { type: "string" },
  },
};

export async function alemLocationsRoutes(app: FastifyInstance) {
  const repo = AppDataSource.getRepository(AlemLocation);

  const jwtGuard = async (request: any, reply: any) => {
    try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
  };

  // PUBLIC
  app.get("/alem/locations", {
    schema: {
      tags: ["Alem Public"],
      summary: "Список локаций",
      response: { 200: { type: "array", items: locationSchema } },
    },
  }, async () => repo.find());

  // ADMIN
  app.get("/admin/alem/locations", {
    schema: { tags: ["Alem Admin"], summary: "Все локации", ...bearerAuth, response: { 200: { type: "array", items: locationSchema } } },
    onRequest: [jwtGuard, requirePermission(Section.ALEM)],
  }, async () => repo.find());

  app.post("/admin/alem/locations", {
    schema: {
      tags: ["Alem Admin"], summary: "Создать локацию", ...bearerAuth,
      body: { ...locationBody, required: ["label"] },
      response: { 201: locationSchema },
    },
    onRequest: [jwtGuard, requirePermission(Section.ALEM)],
  }, async (request, reply) => {
    const loc = repo.create(request.body as Partial<AlemLocation>);
    await repo.save(loc);
    return reply.status(201).send(loc);
  });

  app.put("/admin/alem/locations/:id", {
    schema: {
      tags: ["Alem Admin"], summary: "Обновить локацию", ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: locationBody,
      response: { 200: locationSchema, 404: { type: "object", properties: { message: { type: "string" } } } },
    },
    onRequest: [jwtGuard, requirePermission(Section.ALEM)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const loc = await repo.findOneBy({ id: Number(id) });
    if (!loc) return reply.status(404).send({ message: "Not found" });
    repo.merge(loc, request.body as Partial<AlemLocation>);
    await repo.save(loc);
    return loc;
  });

  app.delete("/admin/alem/locations/:id", {
    schema: {
      tags: ["Alem Admin"], summary: "Удалить локацию", ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: { 200: { type: "object", properties: { message: { type: "string" } } }, 404: { type: "object", properties: { message: { type: "string" } } } },
    },
    onRequest: [jwtGuard, requirePermission(Section.ALEM)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const loc = await repo.findOneBy({ id: Number(id) });
    if (!loc) return reply.status(404).send({ message: "Not found" });
    await repo.remove(loc);
    return { message: "Deleted" };
  });
}
