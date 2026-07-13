import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { MenuCombo, MenuComboSlot, MenuComboSlotOption } from "../../db/entities/menu-combo.entity";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";

const bearerAuth = { security: [{ bearerAuth: [] }] };

const slotOptionSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    menuItemId: { type: "number" },
    menuItem: {
      type: "object",
      nullable: true,
      properties: {
        id: { type: "number" },
        name_ru: { type: "string" },
        name_kz: { type: "string" },
        name_en: { type: ["string", "null"] },
        price: { type: "number" },
        photo: { type: "string" },
        isAvailable: { type: "boolean" },
      },
    },
  },
};

const slotSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    name_ru: { type: "string" },
    name_kz: { type: "string" },
    name_en: { type: ["string", "null"] },
    quantity: { type: "number" },
    order: { type: "number" },
    options: { type: "array", items: slotOptionSchema },
  },
};

const comboSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    name_ru: { type: "string" },
    name_kz: { type: "string" },
    name_en: { type: ["string", "null"] },
    description_ru: { type: ["string", "null"] },
    description_kz: { type: ["string", "null"] },
    description_en: { type: ["string", "null"] },
    photo: { type: ["string", "null"] },
    price: { type: "number" },
    isAvailable: { type: "boolean" },
    order: { type: "number" },
    slots: { type: "array", items: slotSchema },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const comboBodyProperties = {
  name_ru: { type: "string" },
  name_kz: { type: "string" },
  name_en: { type: "string" },
  description_ru: { type: "string" },
  description_kz: { type: "string" },
  description_en: { type: "string" },
  photo: { type: "string" },
  price: { type: "number" },
  isAvailable: { type: "boolean" },
  order: { type: "number" },
};

export async function menuCombosRoutes(app: FastifyInstance) {
  const comboRepo = AppDataSource.getRepository(MenuCombo);
  const slotRepo = AppDataSource.getRepository(MenuComboSlot);
  const optionRepo = AppDataSource.getRepository(MenuComboSlotOption);

  const jwtGuard = async (request: any, reply: any) => {
    try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
  };

  // PUBLIC — доступные комбо (опции только из публичных категорий)
  app.get("/menu/combos", {
    schema: {
      tags: ["Menu Public"],
      summary: "Список доступных комбо",
      response: { 200: { type: "array", items: comboSchema } },
    },
  }, async () => {
    const combos = await comboRepo.find({ where: { isAvailable: true }, order: { order: "ASC" } });
    // Фильтруем опции из непубличных категорий
    for (const combo of combos) {
      for (const slot of combo.slots) {
        slot.options = slot.options.filter(
          (opt) => opt.menuItem?.category && (opt.menuItem.category as any).isPublic !== false,
        );
      }
    }
    return combos;
  });

  // PUBLIC — одно комбо
  app.get("/menu/combos/:id", {
    schema: {
      tags: ["Menu Public"],
      summary: "Комбо по id",
      params: { type: "object", properties: { id: { type: "number" } } },
      response: { 200: comboSchema, 404: { type: "object", properties: { message: { type: "string" } } } },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const combo = await comboRepo.findOneBy({ id: Number(id), isAvailable: true });
    if (!combo) return reply.status(404).send({ message: "Not found" });
    return combo;
  });

  // ADMIN — все комбо
  app.get("/admin/menu/combos", {
    schema: { tags: ["Menu Admin"], summary: "Все комбо", ...bearerAuth, response: { 200: { type: "array", items: comboSchema } } },
    onRequest: [jwtGuard, requirePermission(Section.MENU)],
  }, async () => comboRepo.find({ order: { order: "ASC" } }));

  // ADMIN — одно комбо
  app.get("/admin/menu/combos/:id", {
    schema: { tags: ["Menu Admin"], summary: "Комбо по id", ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: { 200: comboSchema, 404: { type: "object", properties: { message: { type: "string" } } } },
    },
    onRequest: [jwtGuard, requirePermission(Section.MENU)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const combo = await comboRepo.findOneBy({ id: Number(id) });
    if (!combo) return reply.status(404).send({ message: "Not found" });
    return combo;
  });

  // ADMIN — создать комбо
  app.post("/admin/menu/combos", {
    schema: {
      tags: ["Menu Admin"], summary: "Создать комбо", ...bearerAuth,
      body: { type: "object", required: ["name_ru", "name_kz", "price"], properties: comboBodyProperties },
      response: { 201: comboSchema },
    },
    onRequest: [jwtGuard, requirePermission(Section.MENU)],
  }, async (request, reply) => {
    const combo = comboRepo.create(request.body as Partial<MenuCombo>);
    await comboRepo.save(combo);
    return reply.status(201).send(await comboRepo.findOneBy({ id: combo.id }));
  });

  // ADMIN — обновить комбо
  app.put("/admin/menu/combos/:id", {
    schema: {
      tags: ["Menu Admin"], summary: "Обновить комбо", ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: { type: "object", properties: comboBodyProperties },
      response: { 200: comboSchema, 404: { type: "object", properties: { message: { type: "string" } } } },
    },
    onRequest: [jwtGuard, requirePermission(Section.MENU)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const exists = await comboRepo.findOneBy({ id: Number(id) });
    if (!exists) return reply.status(404).send({ message: "Not found" });
    await comboRepo.update(Number(id), request.body as Partial<MenuCombo>);
    return comboRepo.findOneBy({ id: Number(id) });
  });

  // ADMIN — удалить комбо
  app.delete("/admin/menu/combos/:id", {
    schema: {
      tags: ["Menu Admin"], summary: "Удалить комбо", ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: { 200: { type: "object", properties: { message: { type: "string" } } } },
    },
    onRequest: [jwtGuard, requirePermission(Section.MENU)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const combo = await comboRepo.findOneBy({ id: Number(id) });
    if (!combo) return reply.status(404).send({ message: "Not found" });
    await comboRepo.remove(combo);
    return { message: "Deleted" };
  });

  // ADMIN — добавить слот к комбо
  app.post("/admin/menu/combos/:id/slots", {
    schema: {
      tags: ["Menu Admin"], summary: "Добавить слот к комбо", ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: {
        type: "object", required: ["name_ru", "name_kz"],
        properties: {
          name_ru: { type: "string" }, name_kz: { type: "string" }, name_en: { type: "string" },
          quantity: { type: "number" }, order: { type: "number" },
        },
      },
      response: { 201: slotSchema },
    },
    onRequest: [jwtGuard, requirePermission(Section.MENU)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const slot = slotRepo.create({ ...(request.body as any), comboId: Number(id) });
    await slotRepo.save(slot);
    return reply.status(201).send(await slotRepo.findOneBy({ id: slot.id }));
  });

  // ADMIN — удалить слот
  app.delete("/admin/menu/combo-slots/:id", {
    schema: {
      tags: ["Menu Admin"], summary: "Удалить слот", ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: { 200: { type: "object", properties: { message: { type: "string" } } } },
    },
    onRequest: [jwtGuard, requirePermission(Section.MENU)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const slot = await slotRepo.findOneBy({ id: Number(id) });
    if (!slot) return reply.status(404).send({ message: "Not found" });
    await slotRepo.remove(slot);
    return { message: "Deleted" };
  });

  // ADMIN — добавить опцию в слот
  app.post("/admin/menu/combo-slots/:id/options", {
    schema: {
      tags: ["Menu Admin"], summary: "Добавить опцию в слот", ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: { type: "object", required: ["menuItemId"], properties: { menuItemId: { type: "number" } } },
      response: { 201: slotOptionSchema },
    },
    onRequest: [jwtGuard, requirePermission(Section.MENU)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const option = optionRepo.create({ slotId: Number(id), menuItemId: (request.body as any).menuItemId });
    await optionRepo.save(option);
    return reply.status(201).send(await optionRepo.findOneBy({ id: option.id }));
  });

  // ADMIN — удалить опцию
  app.delete("/admin/menu/combo-slot-options/:id", {
    schema: {
      tags: ["Menu Admin"], summary: "Удалить опцию из слота", ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: { 200: { type: "object", properties: { message: { type: "string" } } } },
    },
    onRequest: [jwtGuard, requirePermission(Section.MENU)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const option = await optionRepo.findOneBy({ id: Number(id) });
    if (!option) return reply.status(404).send({ message: "Not found" });
    await optionRepo.remove(option);
    return { message: "Deleted" };
  });
}
