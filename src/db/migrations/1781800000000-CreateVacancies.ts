import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateVacancies1781800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "vacancies" (
        "id" SERIAL PRIMARY KEY,
        "title_ru" varchar NOT NULL,
        "title_kz" varchar NOT NULL,
        "title_en" varchar,
        "description_ru" text,
        "description_kz" text,
        "description_en" text,
        "salary" varchar,
        "isPublished" boolean NOT NULL DEFAULT false,
        "order" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "vacancies"`);
  }
}
