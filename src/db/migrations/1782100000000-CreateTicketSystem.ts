import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTicketSystem1782100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "t_venues" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar NOT NULL,
        "description" text,
        "svgBackground" text,
        "width" integer NOT NULL DEFAULT 1920,
        "height" integer NOT NULL DEFAULT 1080,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "t_price_zones" (
        "id" SERIAL PRIMARY KEY,
        "venueId" integer NOT NULL REFERENCES "t_venues"("id") ON DELETE CASCADE,
        "name" varchar NOT NULL,
        "color" varchar NOT NULL,
        "price" integer NOT NULL,
        "order" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "group_type_enum" AS ENUM ('table_4','table_5','sofa_2','high_table_4','row','balcony')
    `);

    await queryRunner.query(`
      CREATE TABLE "t_seat_groups" (
        "id" SERIAL PRIMARY KEY,
        "venueId" integer NOT NULL REFERENCES "t_venues"("id") ON DELETE CASCADE,
        "type" "group_type_enum" NOT NULL,
        "label" varchar NOT NULL,
        "cx" float NOT NULL,
        "cy" float NOT NULL,
        "rotation" float NOT NULL DEFAULT 0,
        "priceZoneId" integer REFERENCES "t_price_zones"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "t_venue_seats" (
        "id" SERIAL PRIMARY KEY,
        "groupId" integer NOT NULL REFERENCES "t_seat_groups"("id") ON DELETE CASCADE,
        "venueId" integer NOT NULL REFERENCES "t_venues"("id") ON DELETE CASCADE,
        "seatNumber" integer NOT NULL,
        "offsetX" float NOT NULL,
        "offsetY" float NOT NULL,
        "priceZoneId" integer REFERENCES "t_price_zones"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "ticket_event_status_enum" AS ENUM ('draft','published','cancelled')
    `);

    await queryRunner.query(`
      CREATE TABLE "t_events" (
        "id" SERIAL PRIMARY KEY,
        "venueId" integer NOT NULL REFERENCES "t_venues"("id") ON DELETE RESTRICT,
        "title" varchar NOT NULL,
        "description" text,
        "date" date NOT NULL,
        "time" time NOT NULL,
        "status" "ticket_event_status_enum" NOT NULL DEFAULT 'draft',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "event_seat_status_enum" AS ENUM ('free','reserved','sold','blocked')
    `);

    await queryRunner.query(`
      CREATE TABLE "t_event_seats" (
        "id" SERIAL PRIMARY KEY,
        "eventId" integer NOT NULL REFERENCES "t_events"("id") ON DELETE CASCADE,
        "seatId" integer NOT NULL REFERENCES "t_venue_seats"("id") ON DELETE CASCADE,
        "status" "event_seat_status_enum" NOT NULL DEFAULT 'free',
        "reservedUntil" TIMESTAMP,
        "priceOverride" integer,
        "orderId" integer
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "order_status_enum" AS ENUM ('pending','paid','cancelled','refunded')
    `);

    await queryRunner.query(`
      CREATE TABLE "t_orders" (
        "id" SERIAL PRIMARY KEY,
        "eventId" integer NOT NULL REFERENCES "t_events"("id") ON DELETE RESTRICT,
        "customerName" varchar NOT NULL,
        "customerEmail" varchar NOT NULL,
        "customerPhone" varchar NOT NULL,
        "totalAmount" integer NOT NULL,
        "status" "order_status_enum" NOT NULL DEFAULT 'pending',
        "paymentId" varchar,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "t_tickets" (
        "id" SERIAL PRIMARY KEY,
        "orderId" integer NOT NULL REFERENCES "t_orders"("id") ON DELETE CASCADE,
        "seatId" integer NOT NULL,
        "eventId" integer NOT NULL,
        "qrToken" varchar NOT NULL UNIQUE,
        "scannedAt" TIMESTAMP,
        "price" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "t_tickets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "t_orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "t_event_seats"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "t_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "t_venue_seats"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "t_seat_groups"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "t_price_zones"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "t_venues"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "order_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "event_seat_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ticket_event_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "group_type_enum"`);
  }
}
