import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMenu1780300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "menu_categories" (
        "id" SERIAL PRIMARY KEY,
        "name_ru" varchar NOT NULL,
        "name_kz" varchar NOT NULL,
        "name_en" varchar,
        "order" int NOT NULL DEFAULT 0,
        "isPublic" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE TYPE "menu_items_alcoholtype_enum" AS ENUM('beer', 'wine', 'spirits', 'cocktail', 'other')`);

    await queryRunner.query(`
      CREATE TABLE "menu_items" (
        "id" SERIAL PRIMARY KEY,
        "name_ru" varchar NOT NULL,
        "name_kz" varchar NOT NULL,
        "name_en" varchar,
        "description_ru" text,
        "description_kz" text,
        "description_en" text,
        "price" decimal(10,2) NOT NULL,
        "photo" varchar NOT NULL,
        "photos" text[] NOT NULL DEFAULT '{}',
        "volume" varchar,
        "weight" varchar,
        "alcoholType" "menu_items_alcoholtype_enum",
        "isAvailable" boolean NOT NULL DEFAULT true,
        "isNew" boolean NOT NULL DEFAULT false,
        "order" int NOT NULL DEFAULT 0,
        "categoryId" int NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_menu_items_category" FOREIGN KEY ("categoryId") REFERENCES "menu_categories"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "menu_items"`);
    await queryRunner.query(`DROP TYPE "menu_items_alcoholtype_enum"`);
    await queryRunner.query(`DROP TABLE "menu_categories"`);
  }
}
