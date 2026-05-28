import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { Rule } from "../../db/entities/rule.entity";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";

const bearerAuth = { security: [{ bearerAuth: [] }] };

const ruleSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    title_ru: { type: "string" },
    title_kz: { type: "string" },
    title_en: { type: ["string", "null"] },
    content_ru: { type: ["string", "null"] },
    content_kz: { type: ["string", "null"] },
    content_en: { type: ["string", "null"] },
    order: { type: "number" },
  },
};

const ruleBodyProperties = {
  title_ru: { type: "string" },
  title_kz: { type: "string" },
  title_en: { type: "string" },
  content_ru: { type: "string" },
  content_kz: { type: "string" },
  content_en: { type: "string" },
  order: { type: "number" },
};

export async function rulesRoutes(app: FastifyInstance) {
  const ruleRepo = AppDataSource.getRepository(Rule);

  const jwtGuard = async (request: any, reply: any) => {
    try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
  };

  app.get("/rules", {
    schema: {
      tags: ["Rules Public"],
      summary: "Список правил",
      response: { 200: { type: "array", items: ruleSchema } },
    },
  }, async () => {
    return ruleRepo.find({ order: { order: "ASC" } });
  });

  app.get("/rules/:id", {
    schema: {
      tags: ["Rules Public"],
      summary: "Одно правило",
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: ruleSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const rule = await ruleRepo.findOneBy({ id: Number(id) });
    if (!rule) return reply.status(404).send({ message: "Not found" });
    return rule;
  });

  app.get("/admin/rules", {
    schema: {
      tags: ["Rules Admin"],
      summary: "Список правил (админ)",
      ...bearerAuth,
      response: { 200: { type: "array", items: ruleSchema } },
    },
    onRequest: [jwtGuard, requirePermission(Section.RULES)],
  }, async () => {
    return ruleRepo.find({ order: { order: "ASC" } });
  });

  app.post("/admin/rules", {
    schema: {
      tags: ["Rules Admin"],
      summary: "Создать правило",
      ...bearerAuth,
      body: { type: "object", required: ["title_ru", "title_kz"], properties: ruleBodyProperties },
      response: { 201: ruleSchema },
    },
    onRequest: [jwtGuard, requirePermission(Section.RULES)],
  }, async (request, reply) => {
    const rule = ruleRepo.create(request.body as Partial<Rule>);
    await ruleRepo.save(rule);
    return reply.status(201).send(rule);
  });

  app.put("/admin/rules/:id", {
    schema: {
      tags: ["Rules Admin"],
      summary: "Обновить правило",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: { type: "object", properties: ruleBodyProperties },
      response: {
        200: ruleSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.RULES)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const rule = await ruleRepo.findOneBy({ id: Number(id) });
    if (!rule) return reply.status(404).send({ message: "Not found" });
    ruleRepo.merge(rule, request.body as Partial<Rule>);
    await ruleRepo.save(rule);
    return rule;
  });

  app.delete("/admin/rules/:id", {
    schema: {
      tags: ["Rules Admin"],
      summary: "Удалить правило",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.RULES)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const rule = await ruleRepo.findOneBy({ id: Number(id) });
    if (!rule) return reply.status(404).send({ message: "Not found" });
    await ruleRepo.remove(rule);
    return { message: "Deleted" };
  });
}
