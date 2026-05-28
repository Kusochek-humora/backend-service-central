import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { Tour, TourShow } from "../../db/entities/tour.entity";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";
import { sendInternalTour, updateInternalTour, sendInternalShow, updateInternalShow, deleteMessage } from "../../utils/telegram";

const bearerAuth = { security: [{ bearerAuth: [] }] };

const showSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    city: { type: "string" },
    date: { type: "string" },
    time: { type: "string" },
    venue: { type: "string" },
    link: { type: "string" },
    photo: { type: ["string", "null"] },
    notice: { type: ["string", "null"] },
    isSoldOut: { type: "boolean" },
    isPublished: { type: "boolean" },
    publishToInternalChannel: { type: "boolean" },
    internalMsgId: { type: ["string", "null"] },
    order: { type: "number" },
    tourId: { type: "number" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const tourSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    title: { type: "string" },
    description: { type: ["string", "null"] },
    photo: { type: "string" },
    isPublished: { type: "boolean" },
    order: { type: "number" },
    photoStories: { type: ["string", "null"] },
    publishToInternalChannel: { type: "boolean" },
    internalMsgId: { type: ["string", "null"] },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const paginatedShows = {
  type: "object",
  properties: {
    data: { type: "array", items: showSchema },
    total: { type: "number" },
    page: { type: "number" },
    limit: { type: "number" },
    pages: { type: "number" },
  },
};

const tourBodyProperties = {
  title: { type: "string" },
  description: { type: "string" },
  photo: { type: "string" },
  isPublished: { type: "boolean" },
  order: { type: "number" },
  photoStories: { type: "string", description: "URL афиши для сториз (опционально)" },
  publishToInternalChannel: { type: "boolean", description: "Отправить афишу в канал для персонала" },
};

const showBodyProperties = {
  city: { type: "string" },
  date: { type: "string" },
  time: { type: "string" },
  venue: { type: "string" },
  link: { type: "string" },
  photo: { type: "string" },
  notice: { type: "string" },
  isSoldOut: { type: "boolean" },
  isPublished: { type: "boolean" },
  publishToInternalChannel: { type: "boolean" },
  order: { type: "number" },
};

export async function toursRoutes(app: FastifyInstance) {
  const tourRepo = AppDataSource.getRepository(Tour);
  const showRepo = AppDataSource.getRepository(TourShow);

  const jwtGuard = async (request: any, reply: any) => {
    try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
  };

  // PUBLIC — список туров (без выступлений)
  app.get("/tours", {
    schema: {
      tags: ["Tours Public"],
      summary: "Список опубликованных туров",
      response: { 200: { type: "array", items: tourSchema } },
    },
  }, async () => {
    return tourRepo.find({
      where: { isPublished: true },
      order: { order: "ASC", createdAt: "DESC" },
    });
  });

  // PUBLIC — один тур
  app.get("/tours/:id", {
    schema: {
      tags: ["Tours Public"],
      summary: "Один тур",
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: tourSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const tour = await tourRepo.findOneBy({ id: Number(id), isPublished: true });
    if (!tour) return reply.status(404).send({ message: "Not found" });
    return tour;
  });

  // PUBLIC — выступления тура с пагинацией
  app.get("/tours/:id/shows", {
    schema: {
      tags: ["Tours Public"],
      summary: "Выступления тура с пагинацией",
      params: { type: "object", properties: { id: { type: "number" } } },
      querystring: {
        type: "object",
        properties: {
          page: { type: "number" },
          limit: { type: "number" },
        },
      },
      response: { 200: paginatedShows },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const { page = 1, limit = 10 } = request.query as { page?: number; limit?: number };

    const [data, total] = await showRepo.findAndCount({
      where: { tourId: Number(id), isPublished: true },
      order: { order: "ASC", date: "ASC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  });

  // ADMIN — все туры
  app.get("/admin/tours", {
    schema: {
      tags: ["Tours Admin"],
      summary: "Все туры включая скрытые",
      ...bearerAuth,
      response: { 200: { type: "array", items: tourSchema } },
    },
    onRequest: [jwtGuard, requirePermission(Section.TOURS)],
  }, async () => {
    return tourRepo.find({ order: { order: "ASC", createdAt: "DESC" } });
  });

  // ADMIN — один тур
  app.get("/admin/tours/:id", {
    schema: {
      tags: ["Tours Admin"],
      summary: "Один тур",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: tourSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.TOURS)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const tour = await tourRepo.findOneBy({ id: Number(id) });
    if (!tour) return reply.status(404).send({ message: "Not found" });
    return tour;
  });

  // ADMIN — выступления тура с пагинацией
  app.get("/admin/tours/:id/shows", {
    schema: {
      tags: ["Tours Admin"],
      summary: "Выступления тура с пагинацией",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      querystring: {
        type: "object",
        properties: {
          page: { type: "number" },
          limit: { type: "number" },
        },
      },
      response: { 200: paginatedShows },
    },
    onRequest: [jwtGuard, requirePermission(Section.TOURS)],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const { page = 1, limit = 10 } = request.query as { page?: number; limit?: number };

    const [data, total] = await showRepo.findAndCount({
      where: { tourId: Number(id) },
      order: { order: "ASC", date: "ASC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  });

  // ADMIN — создать тур
  app.post("/admin/tours", {
    schema: {
      tags: ["Tours Admin"],
      summary: "Создать тур",
      ...bearerAuth,
      body: { type: "object", required: ["title", "photo"], properties: tourBodyProperties },
      response: { 201: tourSchema },
    },
    onRequest: [jwtGuard, requirePermission(Section.TOURS)],
  }, async (request, reply) => {
    const tour = tourRepo.create(request.body as Partial<Tour>);
    await tourRepo.save(tour);
    if (tour.publishToInternalChannel) {
      const shows = await showRepo.findBy({ tourId: tour.id });
      const result = await sendInternalTour(tour, shows);
      if (result.msgId) { tour.internalMsgId = result.msgId; await tourRepo.save(tour); }
    }
    return reply.status(201).send(tour);
  });

  // ADMIN — обновить тур
  app.put("/admin/tours/:id", {
    schema: {
      tags: ["Tours Admin"],
      summary: "Обновить тур",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: { type: "object", properties: tourBodyProperties },
      response: {
        200: tourSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.TOURS)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const tour = await tourRepo.findOneBy({ id: Number(id) });
    if (!tour) return reply.status(404).send({ message: "Not found" });
    const hadInternal = !!tour.internalMsgId;
    tourRepo.merge(tour, request.body as Partial<Tour>);
    await tourRepo.save(tour);
    const shows = await showRepo.findBy({ tourId: tour.id });
    if (tour.publishToInternalChannel) {
      if (hadInternal && tour.internalMsgId) {
        const result = await updateInternalTour({ ...tour, internalMsgId: tour.internalMsgId }, shows);
        if (result.msgId) { tour.internalMsgId = result.msgId; await tourRepo.save(tour); }
      } else if (!hadInternal) {
        const result = await sendInternalTour(tour, shows);
        if (result.msgId) { tour.internalMsgId = result.msgId; await tourRepo.save(tour); }
      }
    }
    return tour;
  });

  // ADMIN — удалить тур
  app.delete("/admin/tours/:id", {
    schema: {
      tags: ["Tours Admin"],
      summary: "Удалить тур",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.TOURS)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const tour = await tourRepo.findOneBy({ id: Number(id) });
    if (!tour) return reply.status(404).send({ message: "Not found" });
    await tourRepo.remove(tour);
    return { message: "Deleted" };
  });

  // ADMIN — добавить выступление
  app.post("/admin/tours/:tourId/shows", {
    schema: {
      tags: ["Tours Admin"],
      summary: "Добавить выступление в тур",
      ...bearerAuth,
      params: { type: "object", properties: { tourId: { type: "number" } } },
      body: {
        type: "object",
        required: ["city", "date", "time", "venue", "link"],
        properties: showBodyProperties,
      },
      response: {
        201: showSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.TOURS)],
  }, async (request, reply) => {
    const { tourId } = request.params as { tourId: string };
    const tour = await tourRepo.findOneBy({ id: Number(tourId) });
    if (!tour) return reply.status(404).send({ message: "Tour not found" });
    const show = showRepo.create({ ...request.body as Partial<TourShow>, tourId: Number(tourId) });
    await showRepo.save(show);
    if (show.publishToInternalChannel) {
      const result = await sendInternalShow(tour, show);
      if (result.msgId) { show.internalMsgId = result.msgId; await showRepo.save(show); }
    }
    return reply.status(201).send(show);
  });

  // ADMIN — обновить выступление
  app.put("/admin/tours/:tourId/shows/:id", {
    schema: {
      tags: ["Tours Admin"],
      summary: "Обновить выступление",
      ...bearerAuth,
      params: { type: "object", properties: { tourId: { type: "number" }, id: { type: "number" } } },
      body: { type: "object", properties: showBodyProperties },
      response: {
        200: showSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.TOURS)],
  }, async (request, reply) => {
    const { tourId, id } = request.params as { tourId: string; id: string };
    const show = await showRepo.findOneBy({ id: Number(id), tourId: Number(tourId) });
    if (!show) return reply.status(404).send({ message: "Not found" });
    showRepo.merge(show, request.body as Partial<TourShow>);
    await showRepo.save(show);
    const tour = await tourRepo.findOneBy({ id: Number(tourId) });
    if (show.publishToInternalChannel && tour) {
      if (show.internalMsgId) {
        const result = await updateInternalShow(tour, { ...show, internalMsgId: show.internalMsgId });
        if (result.msgId) { show.internalMsgId = result.msgId; await showRepo.save(show); }
      } else {
        const result = await sendInternalShow(tour, show);
        if (result.msgId) { show.internalMsgId = result.msgId; await showRepo.save(show); }
      }
    }
    return show;
  });

  // ADMIN — удалить выступление
  app.delete("/admin/tours/:tourId/shows/:id", {
    schema: {
      tags: ["Tours Admin"],
      summary: "Удалить выступление",
      ...bearerAuth,
      params: { type: "object", properties: { tourId: { type: "number" }, id: { type: "number" } } },
      response: {
        200: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.TOURS)],
  }, async (request, reply) => {
    const { tourId, id } = request.params as { tourId: string; id: string };
    const show = await showRepo.findOneBy({ id: Number(id), tourId: Number(tourId) });
    if (!show) return reply.status(404).send({ message: "Not found" });
    if (show.internalMsgId) {
      const chatId = process.env.INTERNAL_CHANNEL_ID!;
      await deleteMessage(chatId, show.internalMsgId);
      await deleteMessage(chatId, String(Number(show.internalMsgId) + 1));
    }
    await showRepo.remove(show);
    return { message: "Deleted" };
  });
}
