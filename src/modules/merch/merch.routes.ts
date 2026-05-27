import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { MerchCategory, MerchItem, MerchOrder } from "../../db/entities/merch.entity";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";
import { notifyMerchOrder } from "../../utils/telegram";

const bearerAuth = { security: [{ bearerAuth: [] }] };

const categorySchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    name_ru: { type: "string" },
    name_kz: { type: "string" },
    name_en: { type: ["string", "null"] },
    order: { type: "number" },
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
    discount: { type: ["number", "null"] },
    photo: { type: "string" },
    photos: { type: "array", items: { type: "string" } },
    sizes: { type: "array", items: { type: "string" } },
    isAvailable: { type: "boolean" },
    order: { type: "number" },
    category: categorySchema,
    categoryId: { type: "number" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const orderItemSchema = {
  type: "object",
  required: ["name", "quantity", "price"],
  properties: {
    name: { type: "string" },
    size: { type: "string" },
    quantity: { type: "number" },
    price: { type: "number" },
  },
};


export async function merchRoutes(app: FastifyInstance) {
  const categoryRepo = AppDataSource.getRepository(MerchCategory);
  const itemRepo = AppDataSource.getRepository(MerchItem);
  const orderRepo = AppDataSource.getRepository(MerchOrder);

  const jwtGuard = async (request: any, reply: any) => {
    try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
  };

  // PUBLIC — категории
  app.get("/merch/categories", {
    schema: {
      tags: ["Merch Public"],
      summary: "Список категорий мерча",
      response: { 200: { type: "array", items: categorySchema } },
    },
  }, async () => {
    return categoryRepo.find({ order: { order: "ASC" } });
  });

  // PUBLIC — товары
  app.get("/merch", {
    schema: {
      tags: ["Merch Public"],
      summary: "Список доступных товаров",
      querystring: {
        type: "object",
        properties: {
          categoryId: { type: "number" },
          page: { type: "number" },
          limit: { type: "number" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            data: { type: "array", items: itemSchema },
            total: { type: "number" },
            page: { type: "number" },
            limit: { type: "number" },
            pages: { type: "number" },
          },
        },
      },
    },
  }, async (request) => {
    const { categoryId, page = 1, limit = 20 } = request.query as {
      categoryId?: number; page?: number; limit?: number;
    };

    const qb = itemRepo.createQueryBuilder("i")
      .leftJoinAndSelect("i.category", "category")
      .where("i.isAvailable = true");

    if (categoryId) qb.andWhere("i.categoryId = :categoryId", { categoryId });

    const total = await qb.getCount();
    const data = await qb
      .orderBy("i.order", "ASC")
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  });

  // PUBLIC — один товар
  app.get("/merch/:id", {
    schema: {
      tags: ["Merch Public"],
      summary: "Один товар",
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: itemSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = await itemRepo.findOneBy({ id: Number(id), isAvailable: true });
    if (!item) return reply.status(404).send({ message: "Not found" });
    return item;
  });

  // PUBLIC — оформить заказ
  app.post("/merch/order", {
    schema: {
      tags: ["Merch Public"],
      summary: "Оформить заказ",
      body: {
        type: "object",
        required: ["name", "phone", "items", "totalPrice"],
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          socialLink: { type: "string" },
          comment: { type: "string" },
          items: { type: "array", items: orderItemSchema, minItems: 1 },
          totalPrice: { type: "number" },
        },
      },
      response: {
        201: { type: "object", properties: { id: { type: "number" }, message: { type: "string" } } },
        400: { type: "object", properties: { message: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const body = request.body as Partial<MerchOrder>;
    const order = orderRepo.create(body);
    await orderRepo.save(order);
    await notifyMerchOrder(order);
    return reply.status(201).send({ id: order.id, message: "Order placed" });
  });

  // ADMIN — категории
  const err401 = { type: "object", properties: { message: { type: "string" } } };
  const err403 = { type: "object", properties: { message: { type: "string" } } };
  const err404 = { type: "object", properties: { message: { type: "string" } } };

  app.get("/admin/merch/categories", {
    schema: { tags: ["Merch Admin"], summary: "Все категории", ...bearerAuth,
      response: { 200: { type: "array", items: categorySchema }, 401: err401, 403: err403 } },
    onRequest: [jwtGuard, requirePermission(Section.MERCH)],
  }, async () => categoryRepo.find({ order: { order: "ASC" } }));

  app.post("/admin/merch/categories", {
    schema: { tags: ["Merch Admin"], summary: "Создать категорию", ...bearerAuth,
      body: { type: "object", required: ["name_ru", "name_kz"],
        properties: { name_ru: { type: "string" }, name_kz: { type: "string" }, name_en: { type: "string" }, order: { type: "number" } } },
      response: { 201: categorySchema, 401: err401, 403: err403 } },
    onRequest: [jwtGuard, requirePermission(Section.MERCH)],
  }, async (request, reply) => {
    const cat = categoryRepo.create(request.body as Partial<MerchCategory>);
    await categoryRepo.save(cat);
    return reply.status(201).send(cat);
  });

  app.put("/admin/merch/categories/:id", {
    schema: { tags: ["Merch Admin"], summary: "Обновить категорию", ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: { type: "object", properties: { name_ru: { type: "string" }, name_kz: { type: "string" }, name_en: { type: "string" }, order: { type: "number" } } },
      response: { 200: categorySchema, 401: err401, 403: err403, 404: err404 } },
    onRequest: [jwtGuard, requirePermission(Section.MERCH)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const cat = await categoryRepo.findOneBy({ id: Number(id) });
    if (!cat) return reply.status(404).send({ message: "Not found" });
    categoryRepo.merge(cat, request.body as Partial<MerchCategory>);
    await categoryRepo.save(cat);
    return cat;
  });

  app.delete("/admin/merch/categories/:id", {
    schema: { tags: ["Merch Admin"], summary: "Удалить категорию", ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: { 200: { type: "object", properties: { message: { type: "string" } } }, 401: err401, 403: err403, 404: err404 } },
    onRequest: [jwtGuard, requirePermission(Section.MERCH)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const cat = await categoryRepo.findOneBy({ id: Number(id) });
    if (!cat) return reply.status(404).send({ message: "Not found" });
    await categoryRepo.remove(cat);
    return { message: "Deleted" };
  });

  // ADMIN — товары
  app.get("/admin/merch", {
    schema: { tags: ["Merch Admin"], summary: "Все товары", ...bearerAuth,
      querystring: { type: "object", properties: { categoryId: { type: "number" }, page: { type: "number" }, limit: { type: "number" } } },
      response: { 200: { type: "object", properties: { data: { type: "array", items: itemSchema }, total: { type: "number" }, page: { type: "number" }, limit: { type: "number" }, pages: { type: "number" } } }, 401: err401, 403: err403 } },
    onRequest: [jwtGuard, requirePermission(Section.MERCH)],
  }, async (request) => {
    const { categoryId, page = 1, limit = 20 } = request.query as { categoryId?: number; page?: number; limit?: number };
    const qb = itemRepo.createQueryBuilder("i").leftJoinAndSelect("i.category", "category");
    if (categoryId) qb.where("i.categoryId = :categoryId", { categoryId });
    const total = await qb.getCount();
    const data = await qb.orderBy("i.order", "ASC").skip((page - 1) * limit).take(limit).getMany();
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  });

  app.post("/admin/merch", {
    schema: { tags: ["Merch Admin"], summary: "Создать товар", ...bearerAuth,
      body: { type: "object", required: ["name_ru", "name_kz", "price", "photo", "categoryId"],
        properties: { name_ru: { type: "string" }, name_kz: { type: "string" }, name_en: { type: "string" },
          description_ru: { type: "string" }, description_kz: { type: "string" }, description_en: { type: "string" },
          price: { type: "number" }, discount: { type: "number" }, photo: { type: "string" },
          photos: { type: "array", items: { type: "string" } }, sizes: { type: "array", items: { type: "string" } },
          isAvailable: { type: "boolean" }, order: { type: "number" }, categoryId: { type: "number" } } },
      response: { 201: itemSchema, 401: err401, 403: err403 } },
    onRequest: [jwtGuard, requirePermission(Section.MERCH)],
  }, async (request, reply) => {
    const item = itemRepo.create(request.body as Partial<MerchItem>);
    await itemRepo.save(item);
    const saved = await itemRepo.findOne({ where: { id: item.id }, relations: { category: true } });
    return reply.status(201).send(saved);
  });

  app.put("/admin/merch/:id", {
    schema: { tags: ["Merch Admin"], summary: "Обновить товар", ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: { type: "object", properties: { name_ru: { type: "string" }, name_kz: { type: "string" }, name_en: { type: "string" },
          description_ru: { type: "string" }, description_kz: { type: "string" }, description_en: { type: "string" },
          price: { type: "number" }, discount: { type: "number" }, photo: { type: "string" },
          photos: { type: "array", items: { type: "string" } }, sizes: { type: "array", items: { type: "string" } },
          isAvailable: { type: "boolean" }, order: { type: "number" }, categoryId: { type: "number" } } },
      response: { 200: itemSchema, 401: err401, 403: err403, 404: err404 } },
    onRequest: [jwtGuard, requirePermission(Section.MERCH)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = await itemRepo.findOneBy({ id: Number(id) });
    if (!item) return reply.status(404).send({ message: "Not found" });
    itemRepo.merge(item, request.body as Partial<MerchItem>);
    await itemRepo.save(item);
    return itemRepo.findOne({ where: { id: item.id }, relations: { category: true } });
  });

  app.delete("/admin/merch/:id", {
    schema: { tags: ["Merch Admin"], summary: "Удалить товар", ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: { 200: { type: "object", properties: { message: { type: "string" } } }, 401: err401, 403: err403, 404: err404 } },
    onRequest: [jwtGuard, requirePermission(Section.MERCH)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = await itemRepo.findOneBy({ id: Number(id) });
    if (!item) return reply.status(404).send({ message: "Not found" });
    await itemRepo.remove(item);
    return { message: "Deleted" };
  });

  // ADMIN — заказы
  app.get("/admin/merch/orders", {
    schema: { tags: ["Merch Admin"], summary: "Все заказы", ...bearerAuth,
      querystring: { type: "object", properties: { page: { type: "number" }, limit: { type: "number" } } },
      response: { 401: err401, 403: err403, 200: { type: "object", properties: {
        data: { type: "array", items: { type: "object", properties: {
          id: { type: "number" }, name: { type: "string" }, phone: { type: "string" },
          socialLink: { type: ["string", "null"] }, comment: { type: ["string", "null"] },
          items: { type: "array" }, totalPrice: { type: "number" }, createdAt: { type: "string" },
        }}},
        total: { type: "number" }, page: { type: "number" }, limit: { type: "number" }, pages: { type: "number" },
      }}},
    },
    onRequest: [jwtGuard, requirePermission(Section.MERCH)],
  }, async (request) => {
    const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };
    const [data, total] = await orderRepo.findAndCount({
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  });
}
