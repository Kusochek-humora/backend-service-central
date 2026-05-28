import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSeo1781900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "seo" (
        "id" SERIAL PRIMARY KEY,
        "page" varchar NOT NULL UNIQUE,
        "title_ru" varchar,
        "title_kz" varchar,
        "description_ru" text,
        "description_kz" text,
        "og_image" varchar,
        "robots" varchar NOT NULL DEFAULT 'index, follow',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "seo"`);
  }
}
