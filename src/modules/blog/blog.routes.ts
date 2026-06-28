import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { BlogPost } from "../../db/entities/blog.entity";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";
import { notifyBlogCreated, deleteMessage } from "../../utils/telegram";

const bearerAuth = { security: [{ bearerAuth: [] }] };

const linkSchema = {
  type: "object",
  properties: {
    label_ru: { type: "string" },
    label_kz: { type: "string" },
    label_en: { type: "string" },
    url: { type: "string" },
  },
};

const blogListItemSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    title_ru: { type: "string" },
    title_kz: { type: "string" },
    title_en: { type: ["string", "null"] },
    excerpt_ru: { type: ["string", "null"] },
    excerpt_kz: { type: ["string", "null"] },
    excerpt_en: { type: ["string", "null"] },
    photo: { type: "string" },
    banner: { type: ["string", "null"] },
    videoUrl: { type: ["string", "null"] },
    mainLink: { type: ["string", "null"] },
    links: { type: ["array", "null"], items: linkSchema },
    isPublished: { type: "boolean" },
    isOnMainPage: { type: "boolean" },
    publishedAt: { type: ["string", "null"] },
    order: { type: "number" },
    createdAt: { type: "string" },
  },
};

const blogAdminListItemSchema = {
  type: "object",
  properties: {
    ...blogListItemSchema.properties,
    publishToTelegram: { type: "boolean" },
  },
};

const blogFullSchema = {
  type: "object",
  properties: {
    ...blogListItemSchema.properties,
    photos: { type: "array", items: { type: "string" } },
    content_ru: { type: "string" },
    content_kz: { type: "string" },
    content_en: { type: ["string", "null"] },
    updatedAt: { type: "string" },
  },
};

const bodyProperties = {
  title_ru: { type: "string" },
  title_kz: { type: "string" },
  title_en: { type: "string" },
  excerpt_ru: { type: "string" },
  excerpt_kz: { type: "string" },
  excerpt_en: { type: "string" },
  content_ru: { type: "string" },
  content_kz: { type: "string" },
  content_en: { type: "string" },
  photo: { type: "string" },
  banner: { type: "string" },
  photos: { type: "array", items: { type: "string" } },
  videoUrl: { type: "string" },
  mainLink: { type: "string" },
  links: {
    type: "array",
    items: {
      type: "object",
      required: ["label_ru", "label_kz", "url"],
      properties: {
        label_ru: { type: "string" },
        label_kz: { type: "string" },
        label_en: { type: "string" },
        url: { type: "string" },
      },
    },
  },
  isPublished: { type: "boolean" },
  isOnMainPage: { type: "boolean" },
  publishToTelegram: { type: "boolean", description: "Опубликовать анонс в Telegram канал" },
  publishedAt: { type: "string", format: "date-time" },
  order: { type: "number" },
};

const paginationMeta = {
  total: { type: "number" },
  page: { type: "number" },
  limit: { type: "number" },
  pages: { type: "number" },
};

export async function blogRoutes(app: FastifyInstance) {
  const repo = AppDataSource.getRepository(BlogPost);

  const jwtGuard = async (request: any, reply: any) => {
    try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
  };

  // PUBLIC — список опубликованных постов
  app.get("/blog", {
    schema: {
      tags: ["Blog Public"],
      summary: "Список опубликованных новостей",
      querystring: {
        type: "object",
        properties: {
          page: { type: "number" },
          limit: { type: "number" },
          year: { type: "number" },
          month: { type: "number" },
          onMainPage: { type: "boolean" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            data: { type: "array", items: blogListItemSchema },
            ...paginationMeta,
          },
        },
      },
    },
  }, async (request) => {
    const { page = 1, limit = 10, year, month, onMainPage } = request.query as {
      page?: number; limit?: number; year?: number; month?: number; onMainPage?: boolean;
    };

    const qb = repo.createQueryBuilder("p")
      .select(["p.id", "p.title_ru", "p.title_kz", "p.title_en",
               "p.excerpt_ru", "p.excerpt_kz", "p.excerpt_en",
               "p.photo", "p.banner", "p.videoUrl", "p.mainLink", "p.links",
               "p.isPublished", "p.isOnMainPage", "p.publishedAt", "p.order", "p.createdAt"])
      .where("p.isPublished = true");

    if (onMainPage) qb.andWhere("p.isOnMainPage = true");
    if (year) qb.andWhere("EXTRACT(YEAR FROM COALESCE(p.publishedAt, p.createdAt)) = :year", { year });
    if (month) qb.andWhere("EXTRACT(MONTH FROM COALESCE(p.publishedAt, p.createdAt)) = :month", { month });

    const total = await qb.getCount();
    const data = await qb
      .orderBy("p.order", "ASC")
      .addOrderBy("COALESCE(p.publishedAt, p.createdAt)", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  });

  // PUBLIC — один пост (полный контент)
  app.get("/blog/:id", {
    schema: {
      tags: ["Blog Public"],
      summary: "Один пост полностью",
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: blogFullSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const post = await repo.findOneBy({ id: Number(id), isPublished: true });
    if (!post) return reply.status(404).send({ message: "Not found" });
    return post;
  });

  // ADMIN — все посты
  app.get("/admin/blog", {
    schema: {
      tags: ["Blog Admin"],
      summary: "Все посты включая черновики",
      ...bearerAuth,
      querystring: {
        type: "object",
        properties: {
          page: { type: "number" },
          limit: { type: "number" },
          year: { type: "number" },
          month: { type: "number" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            data: { type: "array", items: blogAdminListItemSchema },
            ...paginationMeta,
          },
        },
        401: { type: "object", properties: { message: { type: "string" } } },
        403: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.BLOG)],
  }, async (request) => {
    const { page = 1, limit = 20, year, month } = request.query as {
      page?: number; limit?: number; year?: number; month?: number;
    };

    const qb = repo.createQueryBuilder("p")
      .select(["p.id", "p.title_ru", "p.title_kz", "p.title_en",
               "p.excerpt_ru", "p.excerpt_kz", "p.excerpt_en",
               "p.photo", "p.banner", "p.videoUrl", "p.mainLink", "p.links",
               "p.isPublished", "p.isOnMainPage", "p.publishToTelegram", "p.publishedAt", "p.order", "p.createdAt"]);

    if (year) qb.andWhere("EXTRACT(YEAR FROM COALESCE(p.publishedAt, p.createdAt)) = :year", { year });
    if (month) qb.andWhere("EXTRACT(MONTH FROM COALESCE(p.publishedAt, p.createdAt)) = :month", { month });

    const total = await qb.getCount();
    const data = await qb
      .orderBy("p.order", "ASC")
      .addOrderBy("COALESCE(p.publishedAt, p.createdAt)", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  });

  // ADMIN — создать
  app.post("/admin/blog", {
    schema: {
      tags: ["Blog Admin"],
      summary: "Создать пост",
      ...bearerAuth,
      body: {
        type: "object",
        required: ["title_ru", "title_kz", "content_ru", "content_kz", "photo"],
        properties: bodyProperties,
      },
      response: {
        201: {
          type: "object",
          properties: {
            ...blogFullSchema.properties,
            telegram: { type: "object", nullable: true, additionalProperties: true },
          },
        },
        401: { type: "object", properties: { message: { type: "string" } } },
        403: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.BLOG)],
  }, async (request, reply) => {
    const post = repo.create(request.body as Partial<BlogPost>);
    await repo.save(post);
    let telegram = null;
    if (post.publishToTelegram) {
      telegram = await notifyBlogCreated(post);
      if (telegram.msgId) { post.telegramMsgId = telegram.msgId; await repo.save(post); }
    }
    return reply.status(201).send({ ...post, telegram });
  });

  // ADMIN — обновить
  app.put("/admin/blog/:id", {
    schema: {
      tags: ["Blog Admin"],
      summary: "Обновить пост",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: { type: "object", properties: bodyProperties },
      response: {
        200: {
          type: "object",
          properties: {
            ...blogFullSchema.properties,
            telegram: { type: "object", nullable: true, additionalProperties: true },
          },
        },
        401: { type: "object", properties: { message: { type: "string" } } },
        403: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.BLOG)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const post = await repo.findOneBy({ id: Number(id) });
    if (!post) return reply.status(404).send({ message: "Not found" });
    const oldTelegramMsgId = post.telegramMsgId;
    repo.merge(post, request.body as Partial<BlogPost>);
    await repo.save(post);
    let telegram = null;
    if (post.publishToTelegram) {
      const chatId = process.env.TELEGRAM_CHAT_NEWS!;
      if (oldTelegramMsgId && chatId) await deleteMessage(chatId, oldTelegramMsgId);
      telegram = await notifyBlogCreated(post);
      if (telegram.msgId) { post.telegramMsgId = telegram.msgId; await repo.save(post); }
    }
    return { ...post, telegram };
  });

  // ADMIN — удалить
  app.delete("/admin/blog/:id", {
    schema: {
      tags: ["Blog Admin"],
      summary: "Удалить пост",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: { type: "object", properties: { message: { type: "string" } } },
        401: { type: "object", properties: { message: { type: "string" } } },
        403: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.BLOG)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const post = await repo.findOneBy({ id: Number(id) });
    if (!post) return reply.status(404).send({ message: "Not found" });
    await repo.remove(post);
    return { message: "Deleted" };
  });
}
