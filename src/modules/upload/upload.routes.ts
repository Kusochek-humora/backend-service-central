import { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const FOLDERS = ["events", "blog", "menu", "tours", "merch"] as const;
type Folder = typeof FOLDERS[number];

export async function uploadRoutes(app: FastifyInstance) {
  await app.register(multipart, { limits: { fileSize: MAX_FILE_SIZE } });

  for (const folder of FOLDERS) {
    await fs.mkdir(path.join(UPLOAD_DIR, folder), { recursive: true });
  }

  app.post("/admin/upload/:folder", {
    schema: {
      tags: ["Upload"],
      summary: "Загрузить изображение (конвертируется в WebP)",
      description: "Принимает multipart/form-data. Поле: `file`. Макс. 5MB. Форматы: jpg, png, webp, gif.",
      security: [{ bearerAuth: [] }],
      consumes: ["multipart/form-data"],
      params: {
        type: "object",
        properties: {
          folder: { type: "string", enum: FOLDERS as unknown as string[], description: "Папка: events | blog | menu | tours | merch" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            url: { type: "string", description: "Путь к файлу: /uploads/{folder}/{uuid}.webp" },
          },
        },
        400: { type: "object", properties: { message: { type: "string" } } },
        401: { type: "object", properties: { message: { type: "string" } } },
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
    const { folder } = request.params as { folder: Folder };

    if (!FOLDERS.includes(folder)) {
      return reply.status(400).send({ message: "Invalid folder" });
    }

    const file = await request.file();
    if (!file) return reply.status(400).send({ message: "No file provided" });

    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return reply.status(400).send({ message: "Only images allowed (jpg, png, webp, gif)" });
    }

    const buffer = await file.toBuffer();

    if (buffer.length > MAX_FILE_SIZE) {
      return reply.status(400).send({ message: "File too large. Max 5MB" });
    }

    const filename = `${randomUUID()}.webp`;
    const filepath = path.join(UPLOAD_DIR, folder, filename);

    await sharp(buffer).webp({ quality: 85 }).toFile(filepath);

    const url = `/uploads/${folder}/${filename}`;
    return { url };
  });

  const jwtGuard = async (request: any, reply: any) => {
    try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
  };

  app.get("/admin/uploads/:folder", {
    schema: {
      tags: ["Upload"],
      summary: "Список файлов в папке с пагинацией",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        properties: {
          folder: { type: "string", enum: FOLDERS as unknown as string[] },
        },
      },
      querystring: {
        type: "object",
        properties: {
          page: { type: "number", description: "Страница (по умолчанию 1)" },
          limit: { type: "number", description: "Кол-во на странице (по умолчанию 50)" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            folder: { type: "string" },
            data: { type: "array", items: { type: "string" } },
            total: { type: "number" },
            page: { type: "number" },
            limit: { type: "number" },
            pages: { type: "number" },
          },
        },
        400: { type: "object", properties: { message: { type: "string" } } },
        401: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: jwtGuard,
  }, async (request, reply) => {
    const { folder } = request.params as { folder: Folder };
    if (!FOLDERS.includes(folder)) return reply.status(400).send({ message: "Invalid folder" });

    const { page = 1, limit = 50 } = request.query as { page?: number; limit?: number };

    const dir = path.join(UPLOAD_DIR, folder);
    const allFiles = await fs.readdir(dir);
    const total = allFiles.length;
    const data = allFiles.slice((page - 1) * limit, page * limit);

    return { folder, data, total, page, limit, pages: Math.ceil(total / limit) };
  });

  app.delete("/admin/uploads/:folder/:filename", {
    schema: {
      tags: ["Upload"],
      summary: "Удалить файл из папки",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        properties: {
          folder: { type: "string", enum: FOLDERS as unknown as string[] },
          filename: { type: "string" },
        },
      },
      response: {
        200: { type: "object", properties: { message: { type: "string" } } },
        400: { type: "object", properties: { message: { type: "string" } } },
        401: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: jwtGuard,
  }, async (request, reply) => {
    const { folder, filename } = request.params as { folder: Folder; filename: string };
    if (!FOLDERS.includes(folder)) return reply.status(400).send({ message: "Invalid folder" });

    if (filename.includes("..") || filename.includes("/")) {
      return reply.status(400).send({ message: "Invalid filename" });
    }

    const filepath = path.join(UPLOAD_DIR, folder, filename);
    try {
      await fs.unlink(filepath);
      return { message: "Deleted" };
    } catch {
      return reply.status(404).send({ message: "File not found" });
    }
  });
}
