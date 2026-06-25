import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { Event } from "../../db/entities/event.entity";
import { BlogPost } from "../../db/entities/blog.entity";

const ALMATY_OFFSET_MS = 5 * 60 * 60 * 1000;

function almatyNow(): Date {
  return new Date(Date.now() + ALMATY_OFFSET_MS);
}

const mainEventSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    title: { type: "string" },
    photo: { type: "string" },
    hall: { type: "string", enum: ["big", "small"] },
    language: { type: "string", enum: ["ru", "kz", "en"] },
    link: { type: "string" },
    date: { type: "string", description: "YYYY-MM-DD" },
    time: { type: "string", description: "HH:MM" },
    isDonation: { type: "boolean" },
    isSoldOut: { type: "boolean" },
    isOnMainPage: { type: "boolean" },
    photoStories: { type: ["string", "null"] },
    notion: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
    comedians: { type: ["string", "null"] },
    subtext: { type: ["string", "null"] },
    categoryId: { type: ["number", "null"] },
    category: {
      nullable: true,
      type: "object",
      properties: {
        id: { type: "number" },
        name: { type: "string" },
      },
    },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const mainNewsSchema = {
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
    videoUrl: { type: ["string", "null"] },
    mainLink: { type: ["string", "null"] },
    links: {
      type: ["array", "null"],
      items: {
        type: "object",
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
    publishedAt: { type: ["string", "null"] },
    order: { type: "number" },
    createdAt: { type: "string" },
  },
};

export async function mainPageRoutes(app: FastifyInstance) {
  const eventRepo = AppDataSource.getRepository(Event);
  const blogRepo = AppDataSource.getRepository(BlogPost);

  app.get("/main-page", {
    schema: {
      tags: ["Main Page"],
      summary: "Получить события и новости для главной страницы",
      description:
        "Возвращает предстоящие события с `isOnMainPage = true` и опубликованные новости с `isOnMainPage = true`, отсортированные по дате.",
      response: {
        200: {
          type: "object",
          properties: {
            events: { type: "array", items: mainEventSchema },
            news: { type: "array", items: mainNewsSchema },
          },
        },
      },
    },
  }, async () => {
    const now = almatyNow();
    const today = now.toISOString().split("T")[0];
    const currentTime = now.toISOString().split("T")[1].slice(0, 8);

    const [events, news] = await Promise.all([
      eventRepo
        .createQueryBuilder("e")
        .leftJoinAndSelect("e.category", "category")
        .where("e.isOnMainPage = true")
        .andWhere("(e.date > :today OR (e.date = :today AND e.time >= :currentTime))", { today, currentTime })
        .orderBy("e.date", "ASC")
        .addOrderBy("e.time", "ASC")
        .getMany(),

      blogRepo
        .createQueryBuilder("p")
        .select([
          "p.id", "p.title_ru", "p.title_kz", "p.title_en",
          "p.excerpt_ru", "p.excerpt_kz", "p.excerpt_en",
          "p.photo", "p.videoUrl", "p.mainLink", "p.links",
          "p.isPublished", "p.isOnMainPage", "p.publishedAt", "p.order", "p.createdAt",
        ])
        .where("p.isPublished = true")
        .andWhere("p.isOnMainPage = true")
        .orderBy("p.order", "ASC")
        .addOrderBy("COALESCE(p.publishedAt, p.createdAt)", "DESC")
        .getMany(),
    ]);

    return { events, news };
  });
}
