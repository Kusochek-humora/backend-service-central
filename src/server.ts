import fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import "reflect-metadata";
import { env } from "./config/env";
import { AppDataSource } from "./db/data-source";
import { authRoutes } from "./modules/auth/auth.routes";
import { usersRoutes } from "./modules/users/users.routes";

const app = fastify({ logger: true });

const start = async () => {
  try {
    await app.register(cors, {
      origin: ["https://test-standup.ru", "http://localhost:5173"],
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-type", "Authorization"],
    });

    await app.register(swagger, {
      openapi: {
        openapi: "3.0.0",
        info: {
          title: "Editorial API",
          description: "API для редакции сайта",
          version: "1.0.0",
        },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
        },
      },
    });

    await app.register(swaggerUi, {
      routePrefix: "/docs",
      uiConfig: {
        persistAuthorization: true,
      },
    });

    await app.register(fastifyJwt, {
      secret: env.jwtSecret,
    });

    await AppDataSource.initialize();
    app.log.info("Database connected");

    app.register(authRoutes);
    app.register(usersRoutes);

    await app.listen({ port: env.port, host: env.host });
    app.log.info(`Server running ${env.port} , ${env.host}`);
  } catch (error) {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    app.log.error(error);
    process.exit(1);
  }
};

app.get("/", async () => {
  return { message: "yan pedik" };
});

start();
