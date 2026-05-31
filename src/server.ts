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
import { priceZonesRoutes } from "./modules/tickets/price-zones.routes";
import { venuesRoutes } from "./modules/tickets/venues.routes";
import { seatGroupsRoutes } from "./modules/tickets/seat-groups.routes";
import { ticketEventsRoutes } from "./modules/tickets/ticket-events.routes";
import { eventSeatsRoutes } from "./modules/tickets/event-seats.routes";
import { ordersRoutes } from "./modules/tickets/orders.routes";
import { ticketsRoutes } from "./modules/tickets/tickets.routes";
import { paymentRoutes } from "./modules/tickets/payment.routes";
import formbody from "@fastify/formbody";

const app = fastify({ logger: true });

const start = async () => {
  try {
    await app.register(cors, {
      origin: ["https://test-standup.ru", "http://localhost:5173", "https://kusochek-humora.github.io"],
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

    await app.register(formbody);
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
    app.register(priceZonesRoutes);
    app.register(venuesRoutes);
    app.register(seatGroupsRoutes);
    app.register(ticketEventsRoutes);
    app.register(eventSeatsRoutes);
    app.register(ordersRoutes);
    app.register(ticketsRoutes);
    app.register(paymentRoutes);
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

start();
