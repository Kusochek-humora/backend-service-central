import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { Faq } from "../../db/entities/faq.entity";

const bearerAuth = { security: [{ bearerAuth: [] }] };

export async function faqRoutes(app: FastifyInstance) {
  const faqRepo = AppDataSource.getRepository(Faq);

  // PUBLIC — для витринного фронта
  app.get("/faq", {
    schema: {
      tags: ["FAQ Public"],
      summary: "Получить все FAQ (публичный)",
    },
  }, async () => {
    return faqRepo.find({ order: { order: "ASC" } });
  });

  app.get("/faq/:id", {
    schema: {
      tags: ["FAQ Public"],
      summary: "Получить FAQ по id (публичный)",
      params: { type: "object", properties: { id: { type: "number" } } },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const faq = await faqRepo.findOneBy({ id: Number(id) });
    if (!faq) return reply.status(404).send({ message: "Not found" });
    return faq;
  });

  // ADMIN — для админ панели, требует токен
  app.get("/admin/faq", {
    schema: {
      tags: ["FAQ Admin"],
      summary: "Получить все FAQ (админ)",
      ...bearerAuth,
    },
    onRequest: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch {
        reply.status(401).send({ message: "Unauthorized" });
      }
    },
  }, async () => {
    return faqRepo.find({ order: { order: "ASC" } });
  });

  app.post("/admin/faq", {
    schema: {
      tags: ["FAQ Admin"],
      summary: "Создать FAQ",
      ...bearerAuth,
      body: {
        type: "object",
        required: ["question_ru", "answer_ru", "question_kz", "answer_kz"],
        properties: {
          question_ru: { type: "string" },
          answer_ru: { type: "string" },
          question_kz: { type: "string" },
          answer_kz: { type: "string" },
          question_en: { type: "string" },
          answer_en: { type: "string" },
          order: { type: "number" },
        },
      },
    },
    onRequest: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch {
        reply.status(401).send({ message: "Unauthorized" });
      }
    },
  }, async (request, reply) => {
    const body = request.body as Partial<Faq>;
    const faq = faqRepo.create(body);
    await faqRepo.save(faq);
    return reply.status(201).send(faq);
  });

  app.put("/admin/faq/:id", {
    schema: {
      tags: ["FAQ Admin"],
      summary: "Обновить FAQ",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
    },
    onRequest: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch {
        reply.status(401).send({ message: "Unauthorized" });
      }
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const faq = await faqRepo.findOneBy({ id: Number(id) });
    if (!faq) return reply.status(404).send({ message: "Not found" });

    const body = request.body as Partial<Faq>;
    faqRepo.merge(faq, body);
    await faqRepo.save(faq);
    return faq;
  });

  app.delete("/admin/faq/:id", {
    schema: {
      tags: ["FAQ Admin"],
      summary: "Удалить FAQ",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: { type: "object", properties: { message: { type: "string" } } },
        401: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch {
        reply.status(401).send({ message: "Unauthorized" });
      }
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const faq = await faqRepo.findOneBy({ id: Number(id) });
    if (!faq) return reply.status(404).send({ message: "Not found" });

    await faqRepo.remove(faq);
    return { message: "Deleted" };
  });
}
