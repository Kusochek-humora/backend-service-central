import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { AppDataSource } from "../../db/data-source";
import { User } from "../../db/entities/user.entity";

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/login", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    schema: {
      tags: ["Auth"],
      summary: "Войти в систему",
      body: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string" },
          password: { type: "string" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            token: { type: "string" },
          },
        },
        401: {
          type: "object",
          properties: {
            message: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ email });

    if (!user) return reply.status(401).send({ message: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return reply.status(401).send({ message: "Invalid credentials" });

    const token = app.jwt.sign({ id: user.id, role: user.role });
    return { token };
  });
}
