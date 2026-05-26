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
      security: [{ bearerAuth: [] }],
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
            url: { type: "string" },
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
}
