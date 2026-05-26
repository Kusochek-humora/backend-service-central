import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { AppDataSource } from "../../db/data-source";
import { User, UserRole, Section } from "../../db/entities/user.entity";

type JwtUser = { id: number; role: UserRole };

const bearerAuth = { security: [{ bearerAuth: [] }] };

export async function usersRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ message: "Unauthorized" });
    }
  });

  app.get("/users", {
    schema: {
      tags: ["Users"],
      summary: "Список редакторов (только chief_editor)",
      ...bearerAuth,
      response: {
        200: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "number" },
              email: { type: "string" },
              username: { type: "string" },
              role: { type: "string" },
              permissions: { type: "array", items: { type: "string" } },
              createdAt: { type: "string" },
            },
          },
        },
        403: { type: "object", properties: { message: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const user = request.user as JwtUser;
    if (user.role !== UserRole.CHIEF_EDITOR) {
      return reply.status(403).send({ message: "Forbidden" });
    }

    const userRepo = AppDataSource.getRepository(User);
    const users = await userRepo.find({
      select: { id: true, email: true, username: true, role: true, permissions: true, createdAt: true },
    });
    return users;
  });

  app.post("/users", {
    schema: {
      tags: ["Users"],
      summary: "Создать редактора (только chief_editor)",
      ...bearerAuth,
      body: {
        type: "object",
        required: ["email", "username", "password"],
        properties: {
          email: { type: "string" },
          username: { type: "string" },
          password: { type: "string" },
        },
      },
      response: {
        201: {
          type: "object",
          properties: {
            id: { type: "number" },
            email: { type: "string" },
            username: { type: "string" },
            role: { type: "string" },
          },
        },
        403: { type: "object", properties: { message: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const user = request.user as JwtUser;
    if (user.role !== UserRole.CHIEF_EDITOR) {
      return reply.status(403).send({ message: "Forbidden" });
    }

    const { email, username, password } = request.body as {
      email: string;
      username: string;
      password: string;
    };

    const userRepo = AppDataSource.getRepository(User);
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = userRepo.create({ email, username, password: hashedPassword });
    await userRepo.save(newUser);

    const { password: _, ...result } = newUser;
    return reply.status(201).send(result);
  });

  app.patch("/users/:id/permissions", {
    schema: {
      tags: ["Users"],
      summary: "Обновить пермишены редактора (только chief_editor)",
      ...bearerAuth,
      params: {
        type: "object",
        properties: {
          id: { type: "number" },
        },
      },
      body: {
        type: "object",
        required: ["permissions"],
        properties: {
          permissions: {
            type: "array",
            items: { type: "string", enum: Object.values(Section) },
          },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            id: { type: "number" },
            email: { type: "string" },
            username: { type: "string" },
            role: { type: "string" },
            permissions: { type: "array", items: { type: "string" } },
          },
        },
        403: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const user = request.user as JwtUser;
    if (user.role !== UserRole.CHIEF_EDITOR) {
      return reply.status(403).send({ message: "Forbidden" });
    }

    const { id } = request.params as { id: string };
    const { permissions } = request.body as { permissions: Section[] };

    const userRepo = AppDataSource.getRepository(User);
    const target = await userRepo.findOneBy({ id: Number(id) });
    if (!target) return reply.status(404).send({ message: "User not found" });

    target.permissions = permissions;
    await userRepo.save(target);

    return { id: target.id, email: target.email, username: target.username, role: target.role, permissions: target.permissions };
  });

  app.delete("/users/:id", {
    schema: {
      tags: ["Users"],
      summary: "Удалить редактора (только chief_editor)",
      ...bearerAuth,
      params: {
        type: "object",
        properties: {
          id: { type: "number" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            message: { type: "string" },
          },
        },
        403: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const user = request.user as JwtUser;
    if (user.role !== UserRole.CHIEF_EDITOR) {
      return reply.status(403).send({ message: "Forbidden" });
    }

    const { id } = request.params as { id: string };
    const userRepo = AppDataSource.getRepository(User);

    const target = await userRepo.findOneBy({ id: Number(id) });
    if (!target) return reply.status(404).send({ message: "User not found" });

    await userRepo.remove(target);
    return { message: "User deleted" };
  });
}
