import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMerch1780800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "merch_categories" (
        "id" SERIAL PRIMARY KEY,
        "name_ru" varchar NOT NULL,
        "name_kz" varchar NOT NULL,
        "name_en" varchar,
        "order" int NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "merch_items" (
        "id" SERIAL PRIMARY KEY,
        "name_ru" varchar NOT NULL,
        "name_kz" varchar NOT NULL,
        "name_en" varchar,
        "description_ru" text,
        "description_kz" text,
        "description_en" text,
        "price" decimal(10,2) NOT NULL,
        "discount" int,
        "photo" varchar NOT NULL,
        "photos" text[] NOT NULL DEFAULT '{}',
        "sizes" text[] NOT NULL DEFAULT '{}',
        "isAvailable" boolean NOT NULL DEFAULT true,
        "order" int NOT NULL DEFAULT 0,
        "categoryId" int NOT NULL REFERENCES "merch_categories"("id") ON DELETE CASCADE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "merch_orders" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar NOT NULL,
        "phone" varchar NOT NULL,
        "socialLink" varchar,
        "comment" text,
        "items" jsonb NOT NULL,
        "totalPrice" decimal(10,2) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "merch_orders"`);
    await queryRunner.query(`DROP TABLE "merch_items"`);
    await queryRunner.query(`DROP TABLE "merch_categories"`);
  }
}
