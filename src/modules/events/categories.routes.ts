import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { Category } from "../../db/entities/category.entity";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";

const bearerAuth = { security: [{ bearerAuth: [] }] };

export async function categoriesRoutes(app: FastifyInstance) {
  const categoryRepo = AppDataSource.getRepository(Category);

  const categorySchema = {
    type: "object",
    properties: {
      id: { type: "number" },
      name: { type: "string" },
      createdAt: { type: "string" },
      updatedAt: { type: "string" },
    },
  };

  app.get("/categories", {
    schema: {
      tags: ["Categories"],
      summary: "Получить все категории (публичный)",
      response: {
        200: { type: "array", items: categorySchema },
      },
    },
  }, async () => {
    return categoryRepo.find({ order: { name: "ASC" } });
  });

  app.post("/admin/categories", {
    schema: {
      tags: ["Categories Admin"],
      summary: "Создать категорию",
      ...bearerAuth,
      body: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
        },
      },
      response: {
        201: {
          type: "object",
          properties: {
            id: { type: "number" },
            name: { type: "string" },
          },
        },
        401: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [
      async (request, reply) => {
        try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
      },
      requirePermission(Section.CATEGORIES),
    ],
  }, async (request, reply) => {
    const { name } = request.body as { name: string };
    const category = categoryRepo.create({ name });
    await categoryRepo.save(category);
    return reply.status(201).send(category);
  });

  app.delete("/admin/categories/:id", {
    schema: {
      tags: ["Categories Admin"],
      summary: "Удалить категорию",
      ...bearerAuth,
      params: {
        type: "object",
        properties: { id: { type: "number" } },
      },
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
      requirePermission(Section.CATEGORIES),
    ],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const category = await categoryRepo.findOneBy({ id: Number(id) });
    if (!category) return reply.status(404).send({ message: "Not found" });
    await categoryRepo.remove(category);
    return { message: "Deleted" };
  });
}
