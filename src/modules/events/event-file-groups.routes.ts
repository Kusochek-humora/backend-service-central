import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { EventFileGroup } from "../../db/entities/event-file-group.entity";
import { Event } from "../../db/entities/event.entity";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";
import { cacheDelPattern } from "../../utils/cache";
import fs from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

async function deleteFile(filePath: string) {
  if (!filePath) return;
  const abs = path.join(UPLOAD_DIR, filePath.replace(/^\/uploads\//, ""));
  await fs.unlink(abs).catch(() => {});
}

export async function eventFileGroupsRoutes(app: FastifyInstance) {
  const repo = AppDataSource.getRepository(EventFileGroup);
  const eventRepo = AppDataSource.getRepository(Event);

  const jwtGuard = async (request: any, reply: any) => {
    try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
  };

  const groupSchema = {
    type: "object",
    properties: {
      id: { type: "number" },
      photo: { type: "string" },
      photoStories: { type: ["string", "null"] },
      banner: { type: ["string", "null"] },
      date: { type: "string" },
      time: { type: "string" },
      label: { type: ["string", "null"] },
      createdAt: { type: "string" },
    },
  };

  // GET — список групп (удаляет просроченные)
  app.get("/admin/event-file-groups", {
    schema: {
      tags: ["Event File Groups"],
      summary: "Список наборов фото для ивентов (автоочистка просроченных)",
      security: [{ bearerAuth: [] }],
      response: { 200: { type: "array", items: groupSchema } },
    },
    onRequest: [jwtGuard, requirePermission(Section.EVENTS)],
  }, async () => {
    const now = new Date(Date.now() + 5 * 60 * 60 * 1000);
    const today = now.toISOString().split("T")[0];
    const currentTime = now.toISOString().split("T")[1].slice(0, 8);

    const all = await repo.find({ order: { date: "ASC", time: "ASC" } });

    const expired = all.filter(g =>
      g.date < today || (g.date === today && g.time <= currentTime)
    );

    for (const g of expired) {
      await deleteFile(g.photo);
      await deleteFile(g.photoStories ?? "");
      await deleteFile(g.banner ?? "");
      await repo.remove(g);
    }

    return all.filter(g =>
      g.date > today || (g.date === today && g.time > currentTime)
    );
  });

  // POST — создать группу
  app.post("/admin/event-file-groups", {
    schema: {
      tags: ["Event File Groups"],
      summary: "Создать набор фото (photo, photoStories, banner, date, time, label)",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["photo", "date", "time"],
        properties: {
          photo: { type: "string" },
          photoStories: { type: "string" },
          banner: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD" },
          time: { type: "string", description: "HH:MM" },
          label: { type: "string", description: "Название набора (опционально)" },
        },
      },
      response: { 201: groupSchema },
    },
    onRequest: [jwtGuard, requirePermission(Section.EVENTS)],
  }, async (request, reply) => {
    const body = request.body as Partial<EventFileGroup>;
    const group = repo.create(body);
    await repo.save(group);
    return reply.status(201).send(group);
  });

  // PUT — обновить группу
  app.put("/admin/event-file-groups/:id", {
    schema: {
      tags: ["Event File Groups"],
      summary: "Обновить набор фото",
      security: [{ bearerAuth: [] }],
      params: { type: "object", properties: { id: { type: "number" } } },
      body: {
        type: "object",
        properties: {
          photo: { type: "string" },
          photoStories: { type: "string" },
          banner: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD" },
          time: { type: "string", description: "HH:MM" },
          label: { type: "string" },
        },
      },
      response: {
        200: groupSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.EVENTS)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const group = await repo.findOneBy({ id: Number(id) });
    if (!group) return reply.status(404).send({ message: "Not found" });

    const body = request.body as Partial<EventFileGroup>;
    repo.merge(group, body);
    await repo.save(group);

    // синкаем фото во все привязанные события
    const linked = await eventRepo.findBy({ fileGroupId: group.id });
    if (linked.length > 0) {
      await eventRepo.save(
        linked.map(e => ({
          ...e,
          photo: group.photo,
          ...(group.banner !== undefined ? { banner: group.banner } : {}),
          ...(group.photoStories !== undefined ? { photoStories: group.photoStories } : {}),
        }))
      );
      await cacheDelPattern("events:*");
    }

    return group;
  });

  // DELETE — удалить группу вручную
  app.delete("/admin/event-file-groups/:id", {
    schema: {
      tags: ["Event File Groups"],
      summary: "Удалить набор фото (удаляет файлы с диска)",
      security: [{ bearerAuth: [] }],
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.EVENTS)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const group = await repo.findOneBy({ id: Number(id) });
    if (!group) return reply.status(404).send({ message: "Not found" });

    await deleteFile(group.photo);
    await deleteFile(group.photoStories ?? "");
    await deleteFile(group.banner ?? "");
    await repo.remove(group);

    return { message: "Deleted" };
  });
}
