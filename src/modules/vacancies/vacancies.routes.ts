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
  salary: { type: "string" },
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
    schema: {
      tags: ["Vacancies Public"],
      summary: "Отклик на вакансию",
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: { type: "object", properties: { message: { type: "string" } } },
        400: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const vacancy = await vacancyRepo.findOneBy({ id: Number(id), isPublished: true });
    if (!vacancy) return reply.status(404).send({ message: "Not found" });

    const data = await request.file();
    if (!data) return reply.status(400).send({ message: "Multipart body required" });

    let name = "";
    let phone = "";
    let message = "";
    let resumeBuffer: Buffer | undefined;
    let resumeFilename: string | undefined;

    // @ts-ignore
    for (const [key, value] of Object.entries(data.fields ?? {})) {
      const field = value as any;
      if (key === "name") name = field.value ?? "";
      if (key === "phone") phone = field.value ?? "";
      if (key === "message") message = field.value ?? "";
    }

    if (!name || !phone) return reply.status(400).send({ message: "name and phone are required" });

    if (data.mimetype === "application/pdf" || data.filename?.endsWith(".pdf")) {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of data.file) {
        size += chunk.length;
        if (size > MAX_RESUME_SIZE) return reply.status(400).send({ message: "Resume file too large (max 10MB)" });
        chunks.push(chunk);
      }
      resumeBuffer = Buffer.concat(chunks);
      resumeFilename = data.filename ?? "resume.pdf";
    } else {
      data.file.resume();
    }

    await notifyVacancyApply({
      vacancyTitle: vacancy.title_ru,
      name,
      phone,
      message: message || undefined,
      resumeBuffer,
      resumeFilename,
    });

    return { message: "Отклик отправлен" };
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
