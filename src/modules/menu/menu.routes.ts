import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { MenuCategory, MenuItem } from "../../db/entities/menu.entity";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";
import { IsNull } from "typeorm";

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
    isAvailable: { type: "boolean" },
    isNew: { type: "boolean" },
    discount: { type: ["number", "null"] },
    order: { type: "number" },
    categoryId: { type: "number" },
    category: subcategorySchema,
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
    return categoryRepo.find({
      where: { parentId: IsNull(), isPublic: true },
      relations: { children: true },
      order: { order: "ASC" },
    });
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

    const qb = itemRepo.createQueryBuilder("i")
      .leftJoinAndSelect("i.category", "category")
      .leftJoinAndSelect("category.parent", "parent")
      .where("i.isAvailable = true")
      .andWhere("category.isPublic = true");

    if (categoryId) qb.andWhere("i.categoryId = :categoryId", { categoryId });

    return qb.orderBy("i.order", "ASC").getMany();
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
    return categoryRepo.find({
      where: { parentId: IsNull() },
      relations: { children: true },
      order: { order: "ASC" },
    });
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

    const qb = itemRepo.createQueryBuilder("i")
      .leftJoinAndSelect("i.category", "category")
      .leftJoinAndSelect("category.parent", "parent")
      .where("i.isAvailable = true");

    if (categoryId) qb.andWhere("i.categoryId = :categoryId", { categoryId });

    return qb.orderBy("i.order", "ASC").getMany();
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
    return qb.orderBy("i.order", "ASC").getMany();
  });

  app.post("/admin/menu", {
    schema: {
      tags: ["Menu Admin"],
      summary: "Создать позицию меню",
      ...bearerAuth,
      body: {
        type: "object",
        required: ["name_ru", "name_kz", "price", "photo", "categoryId"],
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
    return { message: "Deleted" };
  });
}
