import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRules1781700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "rules" (
        "id" SERIAL PRIMARY KEY,
        "title_ru" varchar NOT NULL,
        "title_kz" varchar NOT NULL,
        "title_en" varchar,
        "content_ru" text,
        "content_kz" text,
        "content_en" text,
        "order" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "rules"`);
  }
}
