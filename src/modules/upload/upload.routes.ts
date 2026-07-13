import { FastifyInstance } from "fastify";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const FOLDERS = ["events", "blog", "menu", "tours", "merch", "alem"] as const;
type Folder = typeof FOLDERS[number];

export async function uploadRoutes(app: FastifyInstance) {
  app.setErrorHandler((error: { statusCode?: number; code?: string }, _request, reply) => {
    if (error.statusCode === 413 || error.code === "FST_REQ_FILE_TOO_LARGE") {
      return reply.status(413).send({ message: "Файл слишком большой. Максимум 8MB" });
    }
    reply.send(error);
  });

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
        403: { type: "object", properties: { message: { type: "string" } } },
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

    await requirePermission(folder as Section)(request, reply);
    if (reply.sent) return;

    const file = await request.file();
    if (!file) return reply.status(400).send({ message: "No file provided" });

    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return reply.status(400).send({ message: "Only images allowed (jpg, png, webp, gif)" });
    }

    const buffer = await file.toBuffer();

    if (buffer.length > MAX_FILE_SIZE) {
      return reply.status(400).send({ message: "File too large. Max 8MB" });
    }

    const filename = `${randomUUID()}.webp`;
    const filepath = path.join(UPLOAD_DIR, folder, filename);

    await sharp(buffer).webp({ quality: 85 }).toFile(filepath);

    const url = `/uploads/${folder}/${filename}`;
    return { url };
  });

  app.post("/admin/upload/:folder/bulk", {
    schema: {
      tags: ["Upload"],
      summary: "Загрузить несколько изображений (макс. 10)",
      security: [{ bearerAuth: [] }],
      consumes: ["multipart/form-data"],
      params: {
        type: "object",
        properties: {
          folder: { type: "string", enum: FOLDERS as unknown as string[] },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            urls: { type: "array", items: { type: "string" } },
          },
        },
        400: { type: "object", properties: { message: { type: "string" } } },
        401: { type: "object", properties: { message: { type: "string" } } },
        403: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: async (request, reply) => {
      try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
    },
  }, async (request, reply) => {
    const { folder } = request.params as { folder: Folder };
    if (!FOLDERS.includes(folder)) return reply.status(400).send({ message: "Invalid folder" });

    await requirePermission(folder as Section)(request, reply);
    if (reply.sent) return;

    const parts = request.files();
    const buffers: Buffer[] = [];

    for await (const file of parts) {
      if (buffers.length >= 10) {
        file.file.resume();
        continue;
      }
      if (!ALLOWED_MIME.includes(file.mimetype)) {
        file.file.resume();
        continue;
      }
      try {
        const buffer = await file.toBuffer();
        if (buffer.length <= MAX_FILE_SIZE) buffers.push(buffer);
      } catch { /* skip unreadable files */ }
    }

    if (buffers.length === 0) return reply.status(400).send({ message: "No valid files provided" });

    const results = await Promise.allSettled(
      buffers.map(async (buffer) => {
        const filename = `${randomUUID()}.webp`;
        const filepath = path.join(UPLOAD_DIR, folder, filename);
        await sharp(buffer).webp({ quality: 85 }).toFile(filepath);
        return `/uploads/${folder}/${filename}`;
      })
    );

    const urls = results
      .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
      .map((r) => r.value);

    if (urls.length === 0) return reply.status(400).send({ message: "No valid files provided" });

    return { urls };
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
            data: { type: "array", items: { type: "string" }, description: "Имена файлов. Полный путь: /uploads/{folder}/{filename}" },
            total: { type: "number" },
            page: { type: "number" },
            limit: { type: "number" },
            pages: { type: "number" },
          },
        },
        400: { type: "object", properties: { message: { type: "string" } } },
        401: { type: "object", properties: { message: { type: "string" } } },
        403: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.FILES)],
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

  app.delete("/admin/uploads/:folder", {
    schema: {
      tags: ["Upload"],
      summary: "Удалить несколько файлов из папки",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        properties: {
          folder: { type: "string", enum: FOLDERS as unknown as string[] },
        },
      },
      body: {
        type: "object",
        required: ["filenames"],
        properties: {
          filenames: { type: "array", items: { type: "string" }, minItems: 1 },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            deleted: { type: "array", items: { type: "string" } },
            notFound: { type: "array", items: { type: "string" } },
          },
        },
        400: { type: "object", properties: { message: { type: "string" } } },
        401: { type: "object", properties: { message: { type: "string" } } },
        403: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.FILES)],
  }, async (request, reply) => {
    const { folder } = request.params as { folder: Folder };
    if (!FOLDERS.includes(folder)) return reply.status(400).send({ message: "Invalid folder" });

    const { filenames } = request.body as { filenames: string[] };

    const deleted: string[] = [];
    const notFound: string[] = [];

    for (const filename of filenames) {
      if (filename.includes("..") || filename.includes("/")) continue;
      const filepath = path.join(UPLOAD_DIR, folder, filename);
      try {
        await fs.unlink(filepath);
        deleted.push(filename);
      } catch {
        notFound.push(filename);
      }
    }

    return { deleted, notFound };
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
        403: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.FILES)],
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
