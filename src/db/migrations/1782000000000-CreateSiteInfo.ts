import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSiteInfo1782000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "site_info" (
        "id" SERIAL PRIMARY KEY,
        "address_ru" varchar,
        "address_kz" varchar,
        "address_en" varchar,
        "phone" varchar,
        "work_hours" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`INSERT INTO "site_info" DEFAULT VALUES`);

    await queryRunner.query(`
      CREATE TABLE "social_links" (
        "id" SERIAL PRIMARY KEY,
        "type" varchar NOT NULL,
        "url" varchar NOT NULL,
        "label" varchar,
        "icon" text,
        "order" integer NOT NULL DEFAULT 0
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "email_links" (
        "id" SERIAL PRIMARY KEY,
        "type" varchar NOT NULL,
        "email" varchar NOT NULL,
        "label" varchar,
        "icon" text,
        "order" integer NOT NULL DEFAULT 0
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "email_links"`);
    await queryRunner.query(`DROP TABLE "social_links"`);
    await queryRunner.query(`DROP TABLE "site_info"`);
  }
}
