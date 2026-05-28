import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { Seo } from "../../db/entities/seo.entity";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";

const bearerAuth = { security: [{ bearerAuth: [] }] };

const seoSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    page: { type: "string" },
    title_ru: { type: ["string", "null"] },
    title_kz: { type: ["string", "null"] },
    description_ru: { type: ["string", "null"] },
    description_kz: { type: ["string", "null"] },
    og_image: { type: ["string", "null"] },
    robots: { type: "string" },
  },
};

const seoBodyProperties = {
  title_ru: { type: "string" },
  title_kz: { type: "string" },
  description_ru: { type: "string" },
  description_kz: { type: "string" },
  og_image: { type: "string" },
  robots: { type: "string" },
};

export async function seoRoutes(app: FastifyInstance) {
  const seoRepo = AppDataSource.getRepository(Seo);

  const jwtGuard = async (request: any, reply: any) => {
    try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
  };

  app.get("/seo/:page", {
    schema: {
      tags: ["SEO Public"],
      summary: "SEO по ключу страницы",
      params: { type: "object", properties: { page: { type: "string" } } },
      response: {
        200: seoSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const { page } = request.params as { page: string };
    const seo = await seoRepo.findOneBy({ page });
    if (!seo) return reply.status(404).send({ message: "Not found" });
    return seo;
  });

  app.get("/admin/seo", {
    schema: {
      tags: ["SEO Admin"],
      summary: "Все SEO записи",
      ...bearerAuth,
      response: { 200: { type: "array", items: seoSchema } },
    },
    onRequest: [jwtGuard, requirePermission(Section.SEO)],
  }, async () => {
    return seoRepo.find({ order: { page: "ASC" } });
  });

  app.post("/admin/seo", {
    schema: {
      tags: ["SEO Admin"],
      summary: "Создать SEO запись",
      ...bearerAuth,
      body: {
        type: "object",
        required: ["page"],
        properties: { page: { type: "string" }, ...seoBodyProperties },
      },
      response: { 201: seoSchema },
    },
    onRequest: [jwtGuard, requirePermission(Section.SEO)],
  }, async (request, reply) => {
    const body = request.body as Partial<Seo> & { page: string };
    const existing = await seoRepo.findOneBy({ page: body.page });
    if (existing) return reply.status(409).send({ message: "Page already exists" });
    const seo = seoRepo.create(body);
    await seoRepo.save(seo);
    return reply.status(201).send(seo);
  });

  app.put("/admin/seo/:page", {
    schema: {
      tags: ["SEO Admin"],
      summary: "Обновить SEO по ключу страницы",
      ...bearerAuth,
      params: { type: "object", properties: { page: { type: "string" } } },
      body: { type: "object", properties: seoBodyProperties },
      response: {
        200: seoSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.SEO)],
  }, async (request, reply) => {
    const { page } = request.params as { page: string };
    const seo = await seoRepo.findOneBy({ page });
    if (!seo) return reply.status(404).send({ message: "Not found" });
    seoRepo.merge(seo, request.body as Partial<Seo>);
    await seoRepo.save(seo);
    return seo;
  });

  app.delete("/admin/seo/:page", {
    schema: {
      tags: ["SEO Admin"],
      summary: "Удалить SEO запись",
      ...bearerAuth,
      params: { type: "object", properties: { page: { type: "string" } } },
      response: {
        200: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.SEO)],
  }, async (request, reply) => {
    const { page } = request.params as { page: string };
    const seo = await seoRepo.findOneBy({ page });
    if (!seo) return reply.status(404).send({ message: "Not found" });
    await seoRepo.remove(seo);
    return { message: "Deleted" };
  });
}
