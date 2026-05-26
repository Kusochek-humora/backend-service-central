import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCategoryAndEvent1779900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_categories" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE TYPE "public"."events_hall_enum" AS ENUM('big', 'small')`);

    await queryRunner.query(`
      CREATE TABLE "events" (
        "id" SERIAL NOT NULL,
        "title" character varying NOT NULL,
        "photo" character varying NOT NULL,
        "hall" "public"."events_hall_enum" NOT NULL,
        "link" character varying NOT NULL,
        "date" date NOT NULL,
        "time" time NOT NULL,
        "isDonation" boolean NOT NULL DEFAULT false,
        "isOnMainPage" boolean NOT NULL DEFAULT false,
        "notion" character varying,
        "description" text,
        "comedians" text,
        "subtext" character varying,
        "categoryId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_events_category" FOREIGN KEY ("categoryId")
          REFERENCES "categories"("id") ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "events"`);
    await queryRunner.query(`DROP TYPE "public"."events_hall_enum"`);
    await queryRunner.query(`DROP TABLE "categories"`);
  }
}
