import { FastifyInstance } from "fastify";
import { AppDataSource } from "../../db/data-source";
import { SeatGroup, GroupType } from "../../db/entities/ticket/seat-group.entity";
import { VenueSeat } from "../../db/entities/ticket/venue-seat.entity";
import { requirePermission } from "../auth/permissions";
import { Section } from "../../db/entities/user.entity";

const bearerAuth = { security: [{ bearerAuth: [] }] };

const GROUP_SEAT_OFFSETS: Record<GroupType, { offsetX: number; offsetY: number }[]> = {
  [GroupType.TABLE_4]: [
    { offsetX: -74, offsetY: 0 },
    { offsetX: 74, offsetY: 0 },
    { offsetX: -48, offsetY: 54 },
    { offsetX: 48, offsetY: 54 },
  ],
  [GroupType.TABLE_5]: [
    { offsetX: -74, offsetY: 0 },
    { offsetX: 74, offsetY: 0 },
    { offsetX: -48, offsetY: 54 },
    { offsetX: 48, offsetY: 54 },
    { offsetX: 0, offsetY: -64 },
  ],
  [GroupType.SOFA_2]: [
    { offsetX: -30, offsetY: 0 },
    { offsetX: 30, offsetY: 0 },
  ],
  [GroupType.HIGH_TABLE_4]: [
    { offsetX: -64, offsetY: 0 },
    { offsetX: 64, offsetY: 0 },
    { offsetX: -32, offsetY: 54 },
    { offsetX: 32, offsetY: 54 },
  ],
  [GroupType.ROW]: [],
  [GroupType.BALCONY]: [],
  [GroupType.SINGLE]: [{ offsetX: 0, offsetY: 0 }],
};

const ROW_SEAT_SPACING = 50;

function buildRowOffsets(seatCount: number): { offsetX: number; offsetY: number }[] {
  const offsets: { offsetX: number; offsetY: number }[] = [];
  const half = ((seatCount - 1) * ROW_SEAT_SPACING) / 2;
  for (let i = 0; i < seatCount; i++) {
    offsets.push({ offsetX: 0, offsetY: i * ROW_SEAT_SPACING - half });
  }
  return offsets;
}

const seatGroupSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    venueId: { type: "number" },
    type: { type: "string", enum: Object.values(GroupType) },
    label: { type: "string" },
    cx: { type: "number" },
    cy: { type: "number" },
    rotation: { type: "number" },
    priceZoneId: { type: ["number", "null"] },
    seats: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "number" },
          seatNumber: { type: "number" },
          offsetX: { type: "number" },
          offsetY: { type: "number" },
          priceZoneId: { type: ["number", "null"] },
        },
      },
    },
  },
};

const groupBody = {
  type: { type: "string", enum: Object.values(GroupType) },
  label: { type: "string" },
  cx: { type: "number" },
  cy: { type: "number" },
  rotation: { type: "number" },
  priceZoneId: { type: "number" },
  seatCount: { type: "number", description: "Только для row/balcony — количество мест в ряду" },
};

export async function seatGroupsRoutes(app: FastifyInstance) {
  const groupRepo = AppDataSource.getRepository(SeatGroup);
  const seatRepo = AppDataSource.getRepository(VenueSeat);

  const jwtGuard = async (request: any, reply: any) => {
    try { await request.jwtVerify(); } catch { reply.status(401).send({ message: "Unauthorized" }); }
  };

  // PUBLIC — группы зала со всеми местами
  app.get("/venues/:venueId/seat-groups", {
    schema: {
      tags: ["Tickets Public"],
      summary: "Группы мест зала (столы, ряды, диваны) со всеми местами",
      params: { type: "object", properties: { venueId: { type: "number" } } },
      response: { 200: { type: "array", items: seatGroupSchema } },
    },
  }, async (request) => {
    const { venueId } = request.params as { venueId: string };
    return groupRepo.find({
      where: { venueId: Number(venueId) },
      relations: { seats: true },
      order: { id: "ASC" },
    });
  });

  // ADMIN — список групп
  app.get("/admin/venues/:venueId/seat-groups", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Группы мест зала (админ)",
      ...bearerAuth,
      params: { type: "object", properties: { venueId: { type: "number" } } },
      response: { 200: { type: "array", items: seatGroupSchema } },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request) => {
    const { venueId } = request.params as { venueId: string };
    return groupRepo.find({
      where: { venueId: Number(venueId) },
      relations: { seats: true },
      order: { id: "ASC" },
    });
  });

  // ADMIN — создать группу (места создаются автоматически по типу)
  app.post("/admin/venues/:venueId/seat-groups", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Создать группу мест (места генерируются автоматически по типу)",
      ...bearerAuth,
      params: { type: "object", properties: { venueId: { type: "number" } } },
      body: { type: "object", required: ["type", "label", "cx", "cy"], properties: groupBody },
      response: { 201: seatGroupSchema },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request, reply) => {
    const { venueId } = request.params as { venueId: string };
    const { seatCount, ...rest } = request.body as Partial<SeatGroup> & { seatCount?: number };

    const group = groupRepo.create({ ...rest, venueId: Number(venueId) });
    await groupRepo.save(group);

    const isRow = group.type === GroupType.ROW || group.type === GroupType.BALCONY;
    const offsets = isRow && seatCount
      ? buildRowOffsets(seatCount)
      : GROUP_SEAT_OFFSETS[group.type] ?? [];

    const seats = offsets.map((offset, i) =>
      seatRepo.create({
        groupId: group.id,
        venueId: Number(venueId),
        seatNumber: i + 1,
        offsetX: offset.offsetX,
        offsetY: offset.offsetY,
        priceZoneId: group.priceZoneId,
      })
    );
    if (seats.length) await seatRepo.save(seats);

    const result = await groupRepo.findOne({ where: { id: group.id }, relations: { seats: true } });
    return reply.status(201).send(result);
  });

  // ADMIN — обновить группу (позиция, метка, зона цен)
  app.put("/admin/seat-groups/:id", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Обновить группу мест (позицию, метку, ценовую зону)",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: { type: "object", properties: groupBody },
      response: {
        200: seatGroupSchema,
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const group = await groupRepo.findOne({ where: { id: Number(id) }, relations: { seats: true } });
    if (!group) return reply.status(404).send({ message: "Not found" });
    groupRepo.merge(group, request.body as Partial<SeatGroup>);
    await groupRepo.save(group);
    return group;
  });

  // ADMIN — удалить группу (места удаляются каскадом)
  app.delete("/admin/seat-groups/:id", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Удалить группу мест вместе со всеми местами",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      response: {
        200: { type: "object", properties: { message: { type: "string" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const group = await groupRepo.findOneBy({ id: Number(id) });
    if (!group) return reply.status(404).send({ message: "Not found" });
    await groupRepo.remove(group);
    return { message: "Deleted" };
  });

  // ADMIN — обновить позицию места (для drag&drop)
  app.patch("/admin/venue-seats/:id/position", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Обновить offset места (drag&drop)",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: {
        type: "object",
        required: ["offsetX", "offsetY"],
        properties: { offsetX: { type: "number" }, offsetY: { type: "number" } },
      },
      response: {
        200: { type: "object", properties: { id: { type: "number" }, offsetX: { type: "number" }, offsetY: { type: "number" } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { offsetX, offsetY } = request.body as { offsetX: number; offsetY: number };
    const seat = await seatRepo.findOneBy({ id: Number(id) });
    if (!seat) return reply.status(404).send({ message: "Not found" });
    seat.offsetX = offsetX;
    seat.offsetY = offsetY;
    await seatRepo.save(seat);
    return { id: seat.id, offsetX: seat.offsetX, offsetY: seat.offsetY };
  });

  // ADMIN — обновить ценовую зону места
  app.patch("/admin/venue-seats/:id/price-zone", {
    schema: {
      tags: ["Tickets Admin"],
      summary: "Назначить ценовую зону конкретному месту",
      ...bearerAuth,
      params: { type: "object", properties: { id: { type: "number" } } },
      body: {
        type: "object",
        properties: { priceZoneId: { type: ["number", "null"] } },
      },
      response: {
        200: { type: "object", properties: { id: { type: "number" }, priceZoneId: { type: ["number", "null"] } } },
        404: { type: "object", properties: { message: { type: "string" } } },
      },
    },
    onRequest: [jwtGuard, requirePermission(Section.TICKETS)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { priceZoneId } = request.body as { priceZoneId?: number | null };
    const seat = await seatRepo.findOneBy({ id: Number(id) });
    if (!seat) return reply.status(404).send({ message: "Not found" });
    seat.priceZoneId = priceZoneId ?? undefined;
    await seatRepo.save(seat);
    return { id: seat.id, priceZoneId: seat.priceZoneId ?? null };
  });
}
