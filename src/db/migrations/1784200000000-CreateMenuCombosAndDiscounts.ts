import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMenuCombosAndDiscounts1784200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "menu_discounts_type_enum" AS ENUM('percent', 'fixed')`);

    await queryRunner.query(`
      CREATE TABLE "menu_combos" (
        "id" SERIAL PRIMARY KEY,
        "name_ru" varchar NOT NULL,
        "name_kz" varchar NOT NULL,
        "name_en" varchar,
        "description_ru" text,
        "description_kz" text,
        "description_en" text,
        "photo" varchar,
        "price" decimal(10,2) NOT NULL,
        "isAvailable" boolean NOT NULL DEFAULT true,
        "order" int NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "menu_discounts" (
        "id" SERIAL PRIMARY KEY,
        "type" "menu_discounts_type_enum" NOT NULL,
        "value" decimal(10,2) NOT NULL,
        "label_ru" varchar,
        "label_kz" varchar,
        "label_en" varchar,
        "validFrom" date,
        "validTo" date,
        "isActive" boolean NOT NULL DEFAULT true,
        "menuItemId" int REFERENCES "menu_items"("id") ON DELETE SET NULL,
        "comboId" int REFERENCES "menu_combos"("id") ON DELETE SET NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "menu_combo_slots" (
        "id" SERIAL PRIMARY KEY,
        "comboId" int NOT NULL REFERENCES "menu_combos"("id") ON DELETE CASCADE,
        "name_ru" varchar NOT NULL,
        "name_kz" varchar NOT NULL,
        "name_en" varchar,
        "quantity" int NOT NULL DEFAULT 1,
        "order" int NOT NULL DEFAULT 0
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "menu_combo_slot_options" (
        "id" SERIAL PRIMARY KEY,
        "slotId" int NOT NULL REFERENCES "menu_combo_slots"("id") ON DELETE CASCADE,
        "menuItemId" int NOT NULL REFERENCES "menu_items"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "menu_combo_slot_options"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "menu_combo_slots"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "menu_discounts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "menu_combos"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "menu_discounts_type_enum"`);
  }
}
