import { FastifyInstance } from "fastify";
import { In } from "typeorm";
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

const orderItemInputSchema = {
  type: "object",
  required: ["itemId", "quantity"],
  properties: {
    itemId: { type: "number" },
    size: { type: "string", maxLength: 30 },
    quantity: { type: "integer", minimum: 1, maximum: 20 },
  },
};

const PHONE_PATTERN = "^\\+?[0-9]{10,15}$";
const SOCIAL_LINK_PATTERN =
  "^(@[a-zA-Z0-9_.]{2,32}|https?:\\/\\/(www\\.)?(instagram\\.com|t\\.me|wa\\.me|whatsapp\\.com|vk\\.com|facebook\\.com|threads\\.net)\\/[a-zA-Z0-9_.\\/-]+)$";
const MAX_ORDER_ITEMS = 20;
const MAX_TOTAL_QUANTITY = 50;


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
    config: { rateLimit: { max: 3, timeWindow: "1 minute" } },
    schema: {
      tags: ["Merch Public"],
      summary: "Оформить заказ",
      body: {
        type: "object",
        required: ["name", "phone", "items"],
        properties: {
          name: { type: "string", minLength: 2, maxLength: 100 },
          phone: { type: "string", pattern: PHONE_PATTERN },
          socialLink: { type: "string", maxLength: 200, pattern: SOCIAL_LINK_PATTERN },
          comment: { type: "string", maxLength: 500 },
          items: { type: "array", items: orderItemInputSchema, minItems: 1, maxItems: MAX_ORDER_ITEMS },
        },
      },
      response: {
        201: { type: "object", properties: { id: { type: "number" }, message: { type: "string" } } },
        400: { type: "object", properties: { message: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const { name, phone, socialLink, comment, items } = request.body as {
      name: string; phone: string; socialLink?: string; comment?: string;
      items: { itemId: number; size?: string; quantity: number }[];
    };

    const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
    if (totalQuantity > MAX_TOTAL_QUANTITY) {
      return reply.status(400).send({ message: "Слишком большое количество товаров" });
    }

    const itemIds = [...new Set(items.map((i) => i.itemId))];
    const merchItems = await itemRepo.findBy({ id: In(itemIds) });
    const itemById = new Map(merchItems.map((i) => [i.id, i]));

    const orderItems: { name: string; size?: string; quantity: number; price: number }[] = [];
    let totalPrice = 0;

    for (const line of items) {
      const item = itemById.get(line.itemId);
      if (!item || !item.isAvailable) {
        return reply.status(400).send({ message: `Товар ${line.itemId} недоступен` });
      }
      if (item.sizes?.length && (!line.size || !item.sizes.includes(line.size))) {
        return reply.status(400).send({ message: `Некорректный размер для товара "${item.name_ru}"` });
      }

      const unitPrice = item.discount
        ? Math.round(Number(item.price) * (1 - item.discount / 100) * 100) / 100
        : Number(item.price);

      orderItems.push({ name: item.name_ru, size: line.size, quantity: line.quantity, price: unitPrice });
      totalPrice += unitPrice * line.quantity;
    }

    const order = orderRepo.create({ name, phone, socialLink, comment, items: orderItems, totalPrice });
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
