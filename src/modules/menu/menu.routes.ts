import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { MenuCategory, MenuItem, MenuItemReview } from "../../db/entities/menu.entity";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";
import { IsNull } from "typeorm";
import { cacheGet, cacheSet, cacheDelPattern, cacheKey } from "../../utils/cache";

const TTL_MENU = 600;

const bearerAuth = { security: [{ bearerAuth: [] }] };

const subcategorySchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    name_ru: { type: "string" },
    name_kz: { type: "string" },
    name_en: { type: ["string", "null"] },
    order: { type: "number" },
    isPublic: { type: "boolean" },
    parentId: { type: ["number", "null"] },
  },
};

const categorySchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    name_ru: { type: "string" },
    name_kz: { type: "string" },
    name_en: { type: ["string", "null"] },
    order: { type: "number" },
    isPublic: { type: "boolean" },
    parentId: { type: ["number", "null"] },
    children: { type: "array", items: subcategorySchema },
  },
};

const itemSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    name_ru: { type: "string" },
    name_kz: { type: "string" },
    name_en: { type: ["string", "null"] },
    description_ru: { type: ["string", "null"] },
    description_kz: { type: ["string", "null"] },
    description_en: { type: ["string", "null"] },
    price: { type: "number" },
    photo: { type: "string" },
    photos: { type: "array", items: { type: "string" } },
    volume: { type: ["string", "null"] },
    weight: { type: ["string", "null"] },
    ingredients_ru: { type: ["string", "null"] },
    ingredients_kz: { type: ["string", "null"] },
    ingredients_en: { type: ["string", "null"] },
    isAvailable: { type: "boolean" },
    isNew: { type: "boolean" },
    discount: { type: ["number", "null"] },
    order: { type: "number" },
    categoryId: { type: "number" },
    category: subcategorySchema,
    avgRating: { type: ["number", "null"] },
    reviewCount: { type: "number" },
  },
};

const itemBodyProperties = {
  name_ru: { type: "string" },
  name_kz: { type: "string" },
  name_en: { type: "string" },
  description_ru: { type: "string" },
  description_kz: { type: "string" },
  description_en: { type: "string" },
  price: { type: "number" },
  photo: { type: "string" },
  photos: { type: "array", items: { type: "string" } },
  volume: { type: "string", description: "Объём: 500мл, 1л, бутылка" },
  weight: { type: "string", description: "Граммовка: 200г, порция" },
  ingredients_ru: { type: "string" },
  ingredients_kz: { type: "string" },
  ingredients_en: { type: "string" },
  isAvailable: { type: "boolean" },
  isNew: { type: "boolean" },
  discount: { type: "number", description: "Скидка в процентах (0-100)" },
  order: { type: "number" },
  categoryId: { type: "number", description: "ID подкатегории (или главной если подкатегорий нет)" },
};

const categoryBodyProperties = {
  name_ru: { type: "string" },
  name_kz: { type: "string" },
  name_en: { type: "string" },
  order: { type: "number" },
  isPublic: { type: "boolean" },
  parentId: { type: "number", description: "ID родительской категории. Не указывать для главной категории." },
};

async function withRatings(items: MenuItem[]) {
  if (!items.length) return items;
  const ids = items.map(i => i.id);
  const rows: { menuItemId: number; avgRating: string; reviewCount: string }[] =
    await AppDataSource.query(
      `SELECT "menuItemId",
              ROUND(AVG(rating)::numeric, 1) AS "avgRating",
              COUNT(id)::int                 AS "reviewCount"
       FROM menu_item_reviews
       WHERE "menuItemId" = ANY($1) AND "isVisible" = true
       GROUP BY "menuItemId"`,
      [ids]
    );
  const map = new Map(rows.map(r => [r.menuItemId, r]));
  return items.map(item => ({
    ...item,
    avgRating: map.has(item.id) ? Number(map.get(item.id)!.avgRating) : null,
    reviewCount: map.has(item.id) ? Number(map.get(item.id)!.reviewCount) : 0,
  }));
}

export async function menuRoutes(app: FastifyInstance) {
  const categoryRepo = AppDataSource.getRepository(MenuCategory);
  const itemRepo = AppDataSource.getRepository(MenuItem);

  const jwtGuard = async (request: any, reply: any) => {
    try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
  };

  // PUBLIC — дерево категорий (только isPublic), позиции из публичных категорий
  app.get("/menu/categories", {
    schema: {
      tags: ["Menu Public"],
      summary: "Дерево категорий меню (публичный, без алко)",
      response: {
        200: { type: "array", items: categorySchema },
      },
    },
  }, async () => {
    const key = "menu:categories";
    const cached = await cacheGet(key);
    if (cached) return cached;
    const result = await categoryRepo.find({ where: { parentId: IsNull(), isPublic: true }, relations: { children: true }, order: { order: "ASC" } });
    await cacheSet(key, result, TTL_MENU);
    return result;
  });

  app.get("/menu", {
    schema: {
      tags: ["Menu Public"],
      summary: "Публичное меню (без алко категорий)",
      querystring: {
        type: "object",
        properties: {
          categoryId: { type: "number", description: "ID категории или подкатегории" },
        },
      },
      response: {
        200: { type: "array", items: itemSchema },
      },
    },
  }, async (request) => {
    const { categoryId } = request.query as { categoryId?: number };
    const key = cacheKey("menu:list", { categoryId });
    const cached = await cacheGet(key);
    if (cached) return cached;

    const qb = itemRepo.createQueryBuilder("i")
      .leftJoinAndSelect("i.category", "category")
      .leftJoinAndSelect("category.parent", "parent")
      .where("i.isAvailable = true")
      .andWhere("category.isPublic = true");

    if (categoryId) qb.andWhere("i.categoryId = :categoryId", { categoryId });

    const items = await qb.orderBy("i.order", "ASC").getMany();
    const result = await withRatings(items);
    await cacheSet(key, result, TTL_MENU);
    return result;
  });

  app.get("/menu/:id", {
    schema: {
      tags: ["Menu Public"],
      summary: "Позиция меню по ID",
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: itemSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const key = `menu:id:${id}`;
    const cached = await cacheGet(key);
    if (cached) return cached;
    const item = await itemRepo.createQueryBuilder("i")
      .leftJoinAndSelect("i.category", "category")
      .leftJoinAndSelect("category.parent", "parent")
      .where("i.id = :id AND i.isAvailable = true", { id: Number(id) })
      .getOne();
    if (!item) return reply.status(404).send({ message: "Not found" });
    const [withRating] = await withRatings([item]);
    await cacheSet(key, withRating, TTL_MENU);
    return withRating;
  });

  // FULL — для QR-меню внутри клуба
  app.get("/menu/full/categories", {
    schema: {
      tags: ["Menu Public"],
      summary: "Полное дерево категорий для QR-меню (включая алко)",
      response: {
        200: { type: "array", items: categorySchema },
      },
    },
  }, async () => {
    const key = "menu:full-categories";
    const cached = await cacheGet(key);
    if (cached) return cached;
    const result = await categoryRepo.find({ where: { parentId: IsNull() }, relations: { children: true }, order: { order: "ASC" } });
    await cacheSet(key, result, TTL_MENU);
    return result;
  });

  app.get("/menu/full", {
    schema: {
      tags: ["Menu Public"],
      summary: "Полное меню для QR в клубе (включая алко)",
      querystring: {
        type: "object",
        properties: {
          categoryId: { type: "number" },
        },
      },
      response: {
        200: { type: "array", items: itemSchema },
      },
    },
  }, async (request) => {
    const { categoryId } = request.query as { categoryId?: number };
    const key = cacheKey("menu:full", { categoryId });
    const cached = await cacheGet(key);
    if (cached) return cached;

    const qb = itemRepo.createQueryBuilder("i")
      .leftJoinAndSelect("i.category", "category")
      .leftJoinAndSelect("category.parent", "parent")
      .where("i.isAvailable = true");

    if (categoryId) qb.andWhere("i.categoryId = :categoryId", { categoryId });

    const items = await qb.orderBy("i.order", "ASC").getMany();
    const result = await withRatings(items);
    await cacheSet(key, result, TTL_MENU);
    return result;
  });

  // ADMIN — категории
  app.get("/admin/menu/categories", {
    schema: {
      tags: ["Menu Admin"],
      summary: "Дерево всех категорий меню (админ)",
      ...bearerAuth,
      response: {
        200: { type: "array", items: categorySchema },
        401: { type: "object", properties: { message: { type: "string" } } },
        403: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.MENU_CATEGORIES)],
  }, async () => {
    return categoryRepo.find({
      where: { parentId: IsNull() },
      relations: { children: true },
      order: { order: "ASC" },
    });
  });

  app.post("/admin/menu/categories", {
    schema: {
      tags: ["Menu Admin"],
      summary: "Создать категорию или подкатегорию меню",
      ...bearerAuth,
      body: {
        type: "object",
        required: ["name_ru", "name_kz"],
        properties: categoryBodyProperties,
      },
      response: {
        201: subcategorySchema,
        401: { type: "object", properties: { message: { type: "string" } } },
        403: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.MENU_CATEGORIES)],
  }, async (request, reply) => {
    const body = request.body as Partial<MenuCategory>;
    const category = categoryRepo.create(body);
    await categoryRepo.save(category);
    await cacheDelPattern("menu:*");
    return reply.status(201).send(category);
  });

  app.put("/admin/menu/categories/:id", {
    schema: {
      tags: ["Menu Admin"],
      summary: "Обновить категорию меню",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: { type: "object", properties: categoryBodyProperties },
      response: {
        200: subcategorySchema,
        401: { type: "object", properties: { message: { type: "string" } } },
        403: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.MENU_CATEGORIES)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const category = await categoryRepo.findOneBy({ id: Number(id) });
    if (!category) return reply.status(404).send({ message: "Not found" });
    categoryRepo.merge(category, request.body as Partial<MenuCategory>);
    await categoryRepo.save(category);
    await cacheDelPattern("menu:*");
    return category;
  });

  app.delete("/admin/menu/categories/:id", {
    schema: {
      tags: ["Menu Admin"],
      summary: "Удалить категорию меню (удаляет и подкатегории)",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: { type: "object", properties: { message: { type: "string" } } },
        401: { type: "object", properties: { message: { type: "string" } } },
        403: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.MENU_CATEGORIES)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const category = await categoryRepo.findOneBy({ id: Number(id) });
    if (!category) return reply.status(404).send({ message: "Not found" });
    await categoryRepo.remove(category);
    await cacheDelPattern("menu:*");
    return { message: "Deleted" };
  });

  // ADMIN — позиции
  app.get("/admin/menu", {
    schema: {
      tags: ["Menu Admin"],
      summary: "Все позиции меню (админ)",
      ...bearerAuth,
      querystring: {
        type: "object",
        properties: {
          categoryId: { type: "number" },
        },
      },
      response: {
        200: { type: "array", items: itemSchema },
        401: { type: "object", properties: { message: { type: "string" } } },
        403: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.MENU)],
  }, async (request) => {
    const { categoryId } = request.query as { categoryId?: number };
    const qb = itemRepo.createQueryBuilder("i")
      .leftJoinAndSelect("i.category", "category")
      .leftJoinAndSelect("category.parent", "parent");
    if (categoryId) qb.where("i.categoryId = :categoryId", { categoryId });
    const items = await qb.orderBy("i.order", "ASC").getMany();
    return withRatings(items);
  });

  app.post("/admin/menu", {
    schema: {
      tags: ["Menu Admin"],
      summary: "Создать позицию меню",
      ...bearerAuth,
      body: {
        type: "object",
        required: ["name_ru", "name_kz", "price", "photo"],
        properties: itemBodyProperties,
      },
      response: {
        201: itemSchema,
        401: { type: "object", properties: { message: { type: "string" } } },
        403: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.MENU)],
  }, async (request, reply) => {
    const body = request.body as Partial<MenuItem>;
    const item = itemRepo.create(body);
    await itemRepo.save(item);
    await cacheDelPattern("menu:*");
    const saved = await itemRepo.findOne({ where: { id: item.id }, relations: { category: true } });
    return reply.status(201).send(saved);
  });

  app.put("/admin/menu/:id", {
    schema: {
      tags: ["Menu Admin"],
      summary: "Обновить позицию меню",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: { type: "object", properties: itemBodyProperties },
      response: {
        200: itemSchema,
        401: { type: "object", properties: { message: { type: "string" } } },
        403: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.MENU)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = await itemRepo.findOneBy({ id: Number(id) });
    if (!item) return reply.status(404).send({ message: "Not found" });
    itemRepo.merge(item, request.body as Partial<MenuItem>);
    await itemRepo.save(item);
    await cacheDelPattern("menu:*");
    return itemRepo.findOne({ where: { id: item.id }, relations: { category: true } });
  });

  app.delete("/admin/menu/:id", {
    schema: {
      tags: ["Menu Admin"],
      summary: "Удалить позицию меню",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: { type: "object", properties: { message: { type: "string" } } },
        401: { type: "object", properties: { message: { type: "string" } } },
        403: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.MENU)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = await itemRepo.findOneBy({ id: Number(id) });
    if (!item) return reply.status(404).send({ message: "Not found" });
    await itemRepo.remove(item);
    await cacheDelPattern("menu:*");
    return { message: "Deleted" };
  });

  // ── Reviews ──────────────────────────────────────────────────────────────

  const reviewRepo = AppDataSource.getRepository(MenuItemReview);

  const reviewSchema = {
    type: "object",
    properties: {
      id: { type: "number" },
      menuItemId: { type: "number" },
      rating: { type: "number" },
      comment: { type: ["string", "null"] },
      isVisible: { type: "boolean" },
      createdAt: { type: "string" },
    },
  };

  // PUBLIC — оставить отзыв
  app.post("/menu/:id/reviews", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    schema: {
      tags: ["Menu Public"],
      summary: "Оставить отзыв на позицию меню",
      params: { type: "object", properties: { id: { type: "number" } } },
      body: {
        type: "object",
        required: ["rating"],
        properties: {
          rating: { type: "number", minimum: 1, maximum: 5 },
          comment: { type: "string" },
        },
      },
      response: {
        201: reviewSchema,
        400: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = await itemRepo.findOneBy({ id: Number(id) });
    if (!item) return reply.status(404).send({ message: "Not found" });

    const { rating, comment } = request.body as { rating: number; comment?: string };
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return reply.status(400).send({ message: "rating must be 1–5" });
    }

    const review = reviewRepo.create({ menuItemId: Number(id), rating, comment });
    await reviewRepo.save(review);
    return reply.status(201).send(review);
  });

  // ADMIN — список отзывов по позиции
  app.get("/admin/menu/:id/reviews", {
    schema: {
      tags: ["Menu Admin"],
      summary: "Отзывы на позицию меню",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: {
          type: "object",
          properties: {
            data: { type: "array", items: reviewSchema },
            total: { type: "number" },
            avgRating: { type: ["number", "null"] },
          },
        },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.MENU)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = await itemRepo.findOneBy({ id: Number(id) });
    if (!item) return reply.status(404).send({ message: "Not found" });

    const data = await reviewRepo.find({
      where: { menuItemId: Number(id) },
      order: { createdAt: "DESC" },
    });

    const avgRating = data.length
      ? Math.round((data.reduce((s, r) => s + r.rating, 0) / data.length) * 10) / 10
      : null;

    return { data, total: data.length, avgRating };
  });

  // ADMIN — скрыть/показать отзыв
  app.patch("/admin/menu/reviews/:reviewId", {
    schema: {
      tags: ["Menu Admin"],
      summary: "Изменить видимость отзыва",
      ...bearerAuth,
      params: { type: "object", properties: { reviewId: { type: "number" } } },
      body: {
        type: "object",
        required: ["isVisible"],
        properties: { isVisible: { type: "boolean" } },
      },
      response: {
        200: reviewSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.MENU)],
  }, async (request, reply) => {
    const { reviewId } = request.params as { reviewId: string };
    const review = await reviewRepo.findOneBy({ id: Number(reviewId) });
    if (!review) return reply.status(404).send({ message: "Not found" });

    review.isVisible = (request.body as { isVisible: boolean }).isVisible;
    await reviewRepo.save(review);
    return review;
  });

  // ADMIN — удалить отзыв
  app.delete("/admin/menu/reviews/:reviewId", {
    schema: {
      tags: ["Menu Admin"],
      summary: "Удалить отзыв",
      ...bearerAuth,
      params: { type: "object", properties: { reviewId: { type: "number" } } },
      response: {
        200: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.MENU)],
  }, async (request, reply) => {
    const { reviewId } = request.params as { reviewId: string };
    const review = await reviewRepo.findOneBy({ id: Number(reviewId) });
    if (!review) return reply.status(404).send({ message: "Not found" });
    await reviewRepo.remove(review);
    return { message: "Deleted" };
  });
}
