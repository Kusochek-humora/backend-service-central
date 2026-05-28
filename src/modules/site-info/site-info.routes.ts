import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { SiteInfo, SocialLink, EmailLink } from "../../db/entities/site-info.entity";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";

const bearerAuth = { security: [{ bearerAuth: [] }] };

const siteInfoSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    address_ru: { type: ["string", "null"] },
    address_kz: { type: ["string", "null"] },
    address_en: { type: ["string", "null"] },
    phone: { type: ["string", "null"] },
    work_hours: { type: ["string", "null"] },
  },
};

const socialLinkSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    type: { type: "string" },
    url: { type: "string" },
    label: { type: ["string", "null"] },
    icon: { type: ["string", "null"] },
    order: { type: "number" },
  },
};

const emailLinkSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    type: { type: "string" },
    email: { type: "string" },
    label: { type: ["string", "null"] },
    icon: { type: ["string", "null"] },
    order: { type: "number" },
  },
};

const socialLinkBody = {
  type: { type: "string" },
  url: { type: "string" },
  label: { type: "string" },
  icon: { type: "string" },
  order: { type: "number" },
};

const emailLinkBody = {
  type: { type: "string" },
  email: { type: "string" },
  label: { type: "string" },
  icon: { type: "string" },
  order: { type: "number" },
};

export async function siteInfoRoutes(app: FastifyInstance) {
  const siteInfoRepo = AppDataSource.getRepository(SiteInfo);
  const socialRepo = AppDataSource.getRepository(SocialLink);
  const emailRepo = AppDataSource.getRepository(EmailLink);

  const jwtGuard = async (request: any, reply: any) => {
    try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
  };

  // PUBLIC
  app.get("/site-info", {
    schema: {
      tags: ["SiteInfo Public"],
      summary: "Общая информация о сайте",
      response: { 200: siteInfoSchema },
    },
  }, async () => {
    return siteInfoRepo.findOneBy({ id: 1 });
  });

  app.get("/social-links", {
    schema: {
      tags: ["SiteInfo Public"],
      summary: "Список соцсетей",
      response: { 200: { type: "array", items: socialLinkSchema } },
    },
  }, async () => {
    return socialRepo.find({ order: { order: "ASC" } });
  });

  app.get("/email-links", {
    schema: {
      tags: ["SiteInfo Public"],
      summary: "Список email-адресов",
      response: { 200: { type: "array", items: emailLinkSchema } },
    },
  }, async () => {
    return emailRepo.find({ order: { order: "ASC" } });
  });

  // ADMIN — site_info
  app.put("/admin/site-info", {
    schema: {
      tags: ["SiteInfo Admin"],
      summary: "Обновить общую информацию",
      ...bearerAuth,
      body: {
        type: "object",
        properties: {
          address_ru: { type: "string" },
          address_kz: { type: "string" },
          address_en: { type: "string" },
          phone: { type: "string" },
          work_hours: { type: "string" },
        },
      },
      response: { 200: siteInfoSchema },
    },
    onRequest: [jwtGuard, requirePermission(Section.SITE_INFO)],
  }, async (request) => {
    let info = await siteInfoRepo.findOneBy({ id: 1 });
    if (!info) info = siteInfoRepo.create();
    siteInfoRepo.merge(info, request.body as Partial<SiteInfo>);
    return siteInfoRepo.save(info);
  });

  // ADMIN — social_links
  app.post("/admin/social-links", {
    schema: {
      tags: ["SiteInfo Admin"],
      summary: "Добавить соцсеть",
      ...bearerAuth,
      body: { type: "object", required: ["type", "url"], properties: socialLinkBody },
      response: { 201: socialLinkSchema },
    },
    onRequest: [jwtGuard, requirePermission(Section.SITE_INFO)],
  }, async (request, reply) => {
    const link = socialRepo.create(request.body as Partial<SocialLink>);
    await socialRepo.save(link);
    return reply.status(201).send(link);
  });

  app.put("/admin/social-links/:id", {
    schema: {
      tags: ["SiteInfo Admin"],
      summary: "Обновить соцсеть",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: { type: "object", properties: socialLinkBody },
      response: {
        200: socialLinkSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.SITE_INFO)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const link = await socialRepo.findOneBy({ id: Number(id) });
    if (!link) return reply.status(404).send({ message: "Not found" });
    socialRepo.merge(link, request.body as Partial<SocialLink>);
    await socialRepo.save(link);
    return link;
  });

  app.delete("/admin/social-links/:id", {
    schema: {
      tags: ["SiteInfo Admin"],
      summary: "Удалить соцсеть",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.SITE_INFO)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const link = await socialRepo.findOneBy({ id: Number(id) });
    if (!link) return reply.status(404).send({ message: "Not found" });
    await socialRepo.remove(link);
    return { message: "Deleted" };
  });

  // ADMIN — email_links
  app.post("/admin/email-links", {
    schema: {
      tags: ["SiteInfo Admin"],
      summary: "Добавить email",
      ...bearerAuth,
      body: { type: "object", required: ["type", "email"], properties: emailLinkBody },
      response: { 201: emailLinkSchema },
    },
    onRequest: [jwtGuard, requirePermission(Section.SITE_INFO)],
  }, async (request, reply) => {
    const link = emailRepo.create(request.body as Partial<EmailLink>);
    await emailRepo.save(link);
    return reply.status(201).send(link);
  });

  app.put("/admin/email-links/:id", {
    schema: {
      tags: ["SiteInfo Admin"],
      summary: "Обновить email",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: { type: "object", properties: emailLinkBody },
      response: {
        200: emailLinkSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.SITE_INFO)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const link = await emailRepo.findOneBy({ id: Number(id) });
    if (!link) return reply.status(404).send({ message: "Not found" });
    emailRepo.merge(link, request.body as Partial<EmailLink>);
    await emailRepo.save(link);
    return link;
  });

  app.delete("/admin/email-links/:id", {
    schema: {
      tags: ["SiteInfo Admin"],
      summary: "Удалить email",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.SITE_INFO)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const link = await emailRepo.findOneBy({ id: Number(id) });
    if (!link) return reply.status(404).send({ message: "Not found" });
    await emailRepo.remove(link);
    return { message: "Deleted" };
  });
}
