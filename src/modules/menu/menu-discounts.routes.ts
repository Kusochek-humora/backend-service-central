import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { MenuDiscount } from "../../db/entities/menu-combo.entity";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";

const bearerAuth = { security: [{ bearerAuth: [] }] };

const discountSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    type: { type: "string", enum: ["percent", "fixed"] },
    value: { type: "number" },
    label_ru: { type: ["string", "null"] },
    label_kz: { type: ["string", "null"] },
    label_en: { type: ["string", "null"] },
    validFrom: { type: ["string", "null"] },
    validTo: { type: ["string", "null"] },
    isActive: { type: "boolean" },
    menuItemId: { type: ["number", "null"] },
    comboId: { type: ["number", "null"] },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const discountBodyProperties = {
  type: { type: "string", enum: ["percent", "fixed"] },
  value: { type: "number" },
  label_ru: { type: "string" },
  label_kz: { type: "string" },
  label_en: { type: "string" },
  validFrom: { type: "string" },
  validTo: { type: "string" },
  isActive: { type: "boolean" },
  menuItemId: { type: ["number", "null"] },
  comboId: { type: ["number", "null"] },
};

export async function menuDiscountsRoutes(app: FastifyInstance) {
  const repo = AppDataSource.getRepository(MenuDiscount);

  const jwtGuard = async (request: any, reply: any) => {
    try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
  };

  // PUBLIC — активные скидки (для рендера зачёркнутых цен)
  app.get("/menu/discounts/active", {
    schema: {
      tags: ["Menu Public"],
      summary: "Активные скидки по позициям и комбо",
      response: { 200: { type: "array", items: discountSchema } },
    },
  }, async () => {
    const today = new Date().toISOString().split("T")[0];
    return repo.createQueryBuilder("d")
      .where("d.isActive = true")
      .andWhere("(d.validFrom IS NULL OR d.validFrom <= :today)", { today })
      .andWhere("(d.validTo IS NULL OR d.validTo >= :today)", { today })
      .getMany();
  });

  // ADMIN — все скидки
  app.get("/admin/menu/discounts", {
    schema: { tags: ["Menu Admin"], summary: "Все скидки", ...bearerAuth, response: { 200: { type: "array", items: discountSchema } } },
    onRequest: [jwtGuard, requirePermission(Section.MENU)],
  }, async () => repo.find({ order: { createdAt: "DESC" } }));

  // ADMIN — создать скидку
  app.post("/admin/menu/discounts", {
    schema: {
      tags: ["Menu Admin"], summary: "Создать скидку", ...bearerAuth,
      body: { type: "object", required: ["type", "value"], properties: discountBodyProperties },
      response: { 201: discountSchema },
    },
    onRequest: [jwtGuard, requirePermission(Section.MENU)],
  }, async (request, reply) => {
    const discount = repo.create(request.body as Partial<MenuDiscount>);
    await repo.save(discount);
    return reply.status(201).send(discount);
  });

  // ADMIN — обновить скидку
  app.put("/admin/menu/discounts/:id", {
    schema: {
      tags: ["Menu Admin"], summary: "Обновить скидку", ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: { type: "object", properties: discountBodyProperties },
      response: { 200: discountSchema, 404: { type: "object", properties: { message: { type: "string" } } } },
    },
    onRequest: [jwtGuard, requirePermission(Section.MENU)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const exists = await repo.findOneBy({ id: Number(id) });
    if (!exists) return reply.status(404).send({ message: "Not found" });
    await repo.update(Number(id), request.body as Partial<MenuDiscount>);
    return repo.findOneBy({ id: Number(id) });
  });

  // ADMIN — удалить скидку
  app.delete("/admin/menu/discounts/:id", {
    schema: {
      tags: ["Menu Admin"], summary: "Удалить скидку", ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: { 200: { type: "object", properties: { message: { type: "string" } } } },
    },
    onRequest: [jwtGuard, requirePermission(Section.MENU)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const discount = await repo.findOneBy({ id: Number(id) });
    if (!discount) return reply.status(404).send({ message: "Not found" });
    await repo.remove(discount);
    return { message: "Deleted" };
  });
}
