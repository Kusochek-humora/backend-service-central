import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { Vacancy } from "../../db/entities/vacancy.entity";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";
import { notifyVacancyApply } from "../../utils/telegram";

const bearerAuth = { security: [{ bearerAuth: [] }] };
const MAX_RESUME_SIZE = 10 * 1024 * 1024; // 10MB

const vacancySchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    title_ru: { type: "string" },
    title_kz: { type: "string" },
    title_en: { type: ["string", "null"] },
    description_ru: { type: ["string", "null"] },
    description_kz: { type: ["string", "null"] },
    description_en: { type: ["string", "null"] },
    salary: { type: ["string", "null"] },
    isPublished: { type: "boolean" },
    order: { type: "number" },
  },
};

const vacancyBodyProperties = {
  title_ru: { type: "string" },
  title_kz: { type: "string" },
  title_en: { type: "string" },
  description_ru: { type: "string" },
  description_kz: { type: "string" },
  description_en: { type: "string" },
  salary: { type: ["string", "null"] },
  isPublished: { type: "boolean" },
  order: { type: "number" },
};

export async function vacanciesRoutes(app: FastifyInstance) {
  const vacancyRepo = AppDataSource.getRepository(Vacancy);

  const jwtGuard = async (request: any, reply: any) => {
    try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
  };

  app.get("/vacancies", {
    schema: {
      tags: ["Vacancies Public"],
      summary: "Список опубликованных вакансий",
      response: { 200: { type: "array", items: vacancySchema } },
    },
  }, async () => {
    return vacancyRepo.find({ where: { isPublished: true }, order: { order: "ASC" } });
  });

  app.get("/vacancies/:id", {
    schema: {
      tags: ["Vacancies Public"],
      summary: "Одна вакансия",
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: vacancySchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const vacancy = await vacancyRepo.findOneBy({ id: Number(id), isPublished: true });
    if (!vacancy) return reply.status(404).send({ message: "Not found" });
    return vacancy;
  });

  // PUBLIC — отклик на вакансию (multipart)
  app.post("/vacancies/:id/apply", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    schema: {
      tags: ["Vacancies Public"],
      summary: "Отклик на вакансию",
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: {
          type: "object",
          properties: {
            message: { type: "string" },
            telegram: {
              type: "object",
              properties: {
                sent: { type: "boolean" },
                error: { type: "string" },
              },
            },
          },
        },
        400: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const vacancy = await vacancyRepo.findOneBy({ id: Number(id), isPublished: true });
    if (!vacancy) return reply.status(404).send({ message: "Not found" });

    let name = "";
    let phone = "";
    let telegram = "";
    let message = "";
    let resumeBuffer: Buffer | undefined;
    let resumeFilename: string | undefined;

    for await (const part of request.parts()) {
      if (part.type === "field") {
        if (part.fieldname === "name") name = String(part.value ?? "");
        if (part.fieldname === "phone") phone = String(part.value ?? "");
        if (part.fieldname === "telegram") telegram = String(part.value ?? "");
        if (part.fieldname === "message") message = String(part.value ?? "");
      } else if (part.type === "file" && (part.mimetype === "application/pdf" || part.filename?.endsWith(".pdf"))) {
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of part.file) {
          size += chunk.length;
          if (size > MAX_RESUME_SIZE) {
            part.file.resume();
            return reply.status(400).send({ message: "Resume file too large (max 10MB)" });
          }
          chunks.push(chunk);
        }
        resumeBuffer = Buffer.concat(chunks);
        resumeFilename = part.filename ?? "resume.pdf";
      } else if (part.type === "file") {
        part.file.resume();
      }
    }

    if (!name || !phone) return reply.status(400).send({ message: "name and phone are required" });

    const tg = await notifyVacancyApply({
      vacancyTitle: vacancy.title_ru,
      name,
      phone,
      telegram: telegram || undefined,
      message: message || undefined,
      resumeBuffer,
      resumeFilename,
    });

    return { message: "Отклик отправлен", telegram: { sent: tg.sent, error: tg.error } };
  });

  app.get("/admin/vacancies", {
    schema: {
      tags: ["Vacancies Admin"],
      summary: "Все вакансии включая скрытые",
      ...bearerAuth,
      response: { 200: { type: "array", items: vacancySchema } },
    },
    onRequest: [jwtGuard, requirePermission(Section.VACANCIES)],
  }, async () => {
    return vacancyRepo.find({ order: { order: "ASC" } });
  });

  app.post("/admin/vacancies", {
    schema: {
      tags: ["Vacancies Admin"],
      summary: "Создать вакансию",
      ...bearerAuth,
      body: { type: "object", required: ["title_ru", "title_kz"], properties: vacancyBodyProperties },
      response: { 201: vacancySchema },
    },
    onRequest: [jwtGuard, requirePermission(Section.VACANCIES)],
  }, async (request, reply) => {
    const vacancy = vacancyRepo.create(request.body as Partial<Vacancy>);
    await vacancyRepo.save(vacancy);
    return reply.status(201).send(vacancy);
  });

  app.put("/admin/vacancies/:id", {
    schema: {
      tags: ["Vacancies Admin"],
      summary: "Обновить вакансию",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: { type: "object", properties: vacancyBodyProperties },
      response: {
        200: vacancySchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.VACANCIES)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const vacancy = await vacancyRepo.findOneBy({ id: Number(id) });
    if (!vacancy) return reply.status(404).send({ message: "Not found" });
    vacancyRepo.merge(vacancy, request.body as Partial<Vacancy>);
    await vacancyRepo.save(vacancy);
    return vacancy;
  });

  app.delete("/admin/vacancies/:id", {
    schema: {
      tags: ["Vacancies Admin"],
      summary: "Удалить вакансию",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.VACANCIES)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const vacancy = await vacancyRepo.findOneBy({ id: Number(id) });
    if (!vacancy) return reply.status(404).send({ message: "Not found" });
    await vacancyRepo.remove(vacancy);
    return { message: "Deleted" };
  });
}
