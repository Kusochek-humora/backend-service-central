import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { AlemCategory } from "../../db/entities/alem-category.entity";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";

const bearerAuth = { security: [{ bearerAuth: [] }] };

const categorySchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    name: { type: "string" },
  },
};

export async function alemCategoriesRoutes(app: FastifyInstance) {
  const repo = AppDataSource.getRepository(AlemCategory);

  const jwtGuard = async (request: any, reply: any) => {
    try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
  };

  // PUBLIC
  app.get("/alem/categories", {
    schema: {
      tags: ["Alem Public"],
      summary: "Список категорий",
      response: { 200: { type: "array", items: categorySchema } },
    },
  }, async () => repo.find());

  // ADMIN
  app.get("/admin/alem/categories", {
    schema: { tags: ["Alem Admin"], summary: "Все категории", ...bearerAuth, response: { 200: { type: "array", items: categorySchema } } },
    onRequest: [jwtGuard, requirePermission(Section.EVENTS)],
  }, async () => repo.find());

  app.post("/admin/alem/categories", {
    schema: {
      tags: ["Alem Admin"], summary: "Создать категорию", ...bearerAuth,
      body: { type: "object", required: ["name"], properties: { name: { type: "string" } } },
      response: { 201: categorySchema },
    },
    onRequest: [jwtGuard, requirePermission(Section.EVENTS)],
  }, async (request, reply) => {
    const cat = repo.create(request.body as Partial<AlemCategory>);
    await repo.save(cat);
    return reply.status(201).send(cat);
  });

  app.put("/admin/alem/categories/:id", {
    schema: {
      tags: ["Alem Admin"], summary: "Обновить категорию", ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: { type: "object", properties: { name: { type: "string" } } },
      response: { 200: categorySchema, 404: { type: "object", properties: { message: { type: "string" } } } },
    },
    onRequest: [jwtGuard, requirePermission(Section.EVENTS)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const cat = await repo.findOneBy({ id: Number(id) });
    if (!cat) return reply.status(404).send({ message: "Not found" });
    repo.merge(cat, request.body as Partial<AlemCategory>);
    await repo.save(cat);
    return cat;
  });

  app.delete("/admin/alem/categories/:id", {
    schema: {
      tags: ["Alem Admin"], summary: "Удалить категорию", ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: { 200: { type: "object", properties: { message: { type: "string" } } }, 404: { type: "object", properties: { message: { type: "string" } } } },
    },
    onRequest: [jwtGuard, requirePermission(Section.EVENTS)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const cat = await repo.findOneBy({ id: Number(id) });
    if (!cat) return reply.status(404).send({ message: "Not found" });
    await repo.remove(cat);
    return { message: "Deleted" };
  });
}
