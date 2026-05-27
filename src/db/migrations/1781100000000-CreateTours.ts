import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTours1781100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tours" (
        "id" SERIAL PRIMARY KEY,
        "title" varchar NOT NULL,
        "description" text,
        "photo" varchar NOT NULL,
        "isPublished" boolean NOT NULL DEFAULT false,
        "order" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tour_shows" (
        "id" SERIAL PRIMARY KEY,
        "city" varchar NOT NULL,
        "date" date NOT NULL,
        "time" time NOT NULL,
        "venue" varchar NOT NULL,
        "link" varchar NOT NULL,
        "photo" varchar,
        "notice" varchar,
        "isSoldOut" boolean NOT NULL DEFAULT false,
        "isPublished" boolean NOT NULL DEFAULT false,
        "order" integer NOT NULL DEFAULT 0,
        "tourId" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_tour_shows_tour" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tour_shows"`);
    await queryRunner.query(`DROP TABLE "tours"`);
  }
}
