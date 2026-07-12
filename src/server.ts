// Backend Service Central
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
import { faqRoutes } from "./modules/faq/faq.routes";
import { eventsRoutes } from "./modules/events/events.routes";
import { uploadRoutes } from "./modules/upload/upload.routes";
import fastifyStatic from "@fastify/static";
import multipart from "@fastify/multipart";
import path from "path";
import { categoriesRoutes } from "./modules/events/categories.routes";
import { menuRoutes } from "./modules/menu/menu.routes";
import { blogRoutes } from "./modules/blog/blog.routes";
import { merchRoutes } from "./modules/merch/merch.routes";
import { toursRoutes } from "./modules/tours/tours.routes";
import { rulesRoutes } from "./modules/rules/rules.routes";
import { vacanciesRoutes } from "./modules/vacancies/vacancies.routes";
import { seoRoutes } from "./modules/seo/seo.routes";
import { siteInfoRoutes } from "./modules/site-info/site-info.routes";
import { mainPageRoutes } from "./modules/main/main.routes";
import { eventFileGroupsRoutes } from "./modules/events/event-file-groups.routes";
import { analyticsRoutes } from "./modules/analytics/analytics.routes";
import cron from "node-cron";
import { EventFileGroup } from "./db/entities/event-file-group.entity";
import fs from "fs/promises";
import rateLimit from "@fastify/rate-limit";

const app = fastify({ logger: true, bodyLimit: 10 * 1024 * 1024, connectionTimeout: 30000, requestTimeout: 30000 }); // 10MB

const start = async () => {
  try {
    await app.register(cors, {
      origin: ["https://test-standup.ru", "http://localhost:5173", "https://kusochek-humora.github.io", "http://localhost:3000", "http://192.168.1.2:3000", "https://public-website-central.vercel.app", "https://standupclub.kz", "https://www.standupclub.kz"],
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-type", "Authorization"],
    });

    await app.register(rateLimit, {
      global: false,
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

    await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

    await app.register(fastifyJwt, {
      secret: env.jwtSecret,
    });

    await AppDataSource.initialize();
    app.log.info("Database connected");

    const UPLOAD_DIR = path.join(process.cwd(), "uploads");
    async function cleanExpiredFileGroups() {
      const repo = AppDataSource.getRepository(EventFileGroup);
      const now = new Date(Date.now() + 5 * 60 * 60 * 1000);
      const today = now.toISOString().split("T")[0];
      const currentTime = now.toISOString().split("T")[1].slice(0, 8);
      const all = await repo.find();
      for (const g of all.filter(g => g.date < today || (g.date === today && g.time <= currentTime))) {
        await fs.unlink(path.join(UPLOAD_DIR, g.photo.replace(/^\/uploads\//, ""))).catch(() => {});
        if (g.photoStories) await fs.unlink(path.join(UPLOAD_DIR, g.photoStories.replace(/^\/uploads\//, ""))).catch(() => {});
        if (g.banner) await fs.unlink(path.join(UPLOAD_DIR, g.banner.replace(/^\/uploads\//, ""))).catch(() => {});
        await repo.remove(g);
      }
    }
    cleanExpiredFileGroups();
    // каждый день в 03:00 по Алматы (UTC+5 = 22:00 UTC)
    cron.schedule("0 22 * * *", cleanExpiredFileGroups);

    app.register(authRoutes);
    app.register(usersRoutes);
    app.register(faqRoutes);
    app.register(categoriesRoutes);
    app.register(eventsRoutes);
    app.register(uploadRoutes);
    app.register(menuRoutes);
    app.register(blogRoutes);
    app.register(merchRoutes);
    app.register(toursRoutes);
    app.register(rulesRoutes);
    app.register(vacanciesRoutes);
    app.register(seoRoutes);
    app.register(siteInfoRoutes);
    app.register(mainPageRoutes);
    app.register(eventFileGroupsRoutes);
    app.register(analyticsRoutes);
    app.register(fastifyStatic, {
      root: path.join(process.cwd(), "uploads"),
      prefix: "/uploads/",
    });

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

app.get("/health", {
  schema: {
    tags: ["System"],
    summary: "Healthcheck",
    response: {
      200: {
        type: "object",
        properties: {
          status: { type: "string" },
          db: { type: "boolean" },
          uptime: { type: "number" },
        },
      },
    },
  },
}, async () => {
  return {
    status: "ok",
    db: AppDataSource.isInitialized,
    uptime: Math.floor(process.uptime()),
  };
});

start();
