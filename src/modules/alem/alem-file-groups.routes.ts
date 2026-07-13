import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { AlemFileGroup } from "../../db/entities/alem-file-group.entity";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";
import fs from "fs/promises";
import path from "path";

const bearerAuth = { security: [{ bearerAuth: [] }] };
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

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

function isExpired(g: AlemFileGroup): boolean {
  const now = new Date(Date.now() + 5 * 60 * 60 * 1000);
  const today = now.toISOString().split("T")[0];
  const currentTime = now.toISOString().split("T")[1].slice(0, 8);
  return g.date < today || (g.date === today && g.time <= currentTime);
}

async function deleteFile(filePath: string) {
  if (!filePath) return;
  await fs.unlink(path.join(UPLOAD_DIR, filePath.replace(/^\/uploads\//, ""))).catch(() => {});
}

export async function alemFileGroupsRoutes(app: FastifyInstance) {
  const repo = AppDataSource.getRepository(AlemFileGroup);

  const jwtGuard = async (request: any, reply: any) => {
    try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
  };

  app.get("/admin/alem/file-groups", {
    schema: {
      tags: ["Alem Admin"], summary: "Список групп фото (активные)", ...bearerAuth,
      response: { 200: { type: "array", items: groupSchema } },
    },
    onRequest: [jwtGuard, requirePermission(Section.ALEM)],
  }, async () => {
    const all = await repo.find({ order: { date: "ASC", time: "ASC" } });
    const expired = all.filter(isExpired);
    for (const g of expired) {
      await deleteFile(g.photo);
      await deleteFile(g.photoStories ?? "");
      await deleteFile(g.banner ?? "");
      await repo.remove(g);
    }
    return all.filter(g => !isExpired(g));
  });

  app.post("/admin/alem/file-groups", {
    schema: {
      tags: ["Alem Admin"], summary: "Создать группу фото", ...bearerAuth,
      body: {
        type: "object",
        required: ["photo", "date", "time"],
        properties: {
          photo: { type: "string" },
          photoStories: { type: "string" },
          banner: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD" },
          time: { type: "string", description: "HH:MM" },
          label: { type: "string" },
        },
      },
      response: { 201: groupSchema },
    },
    onRequest: [jwtGuard, requirePermission(Section.ALEM)],
  }, async (request, reply) => {
    const group = repo.create(request.body as Partial<AlemFileGroup>);
    await repo.save(group);
    return reply.status(201).send(group);
  });

  app.put("/admin/alem/file-groups/:id", {
    schema: {
      tags: ["Alem Admin"], summary: "Обновить группу фото", ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: {
        type: "object",
        properties: {
          photo: { type: "string" },
          photoStories: { type: "string" },
          banner: { type: "string" },
          date: { type: "string" },
          time: { type: "string" },
          label: { type: "string" },
        },
      },
      response: { 200: groupSchema, 404: { type: "object", properties: { message: { type: "string" } } } },
    },
    onRequest: [jwtGuard, requirePermission(Section.ALEM)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const group = await repo.findOneBy({ id: Number(id) });
    if (!group) return reply.status(404).send({ message: "Not found" });
    repo.merge(group, request.body as Partial<AlemFileGroup>);
    await repo.save(group);
    return group;
  });

  app.delete("/admin/alem/file-groups/:id", {
    schema: {
      tags: ["Alem Admin"], summary: "Удалить группу фото", ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: { 200: { type: "object", properties: { message: { type: "string" } } }, 404: { type: "object", properties: { message: { type: "string" } } } },
    },
    onRequest: [jwtGuard, requirePermission(Section.ALEM)],
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
