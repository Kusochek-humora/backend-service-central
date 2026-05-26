import { MigrationInterface, QueryRunner } from "typeorm";

export class AlcoholTypeToString1780400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "menu_items" ALTER COLUMN "alcoholType" TYPE varchar USING "alcoholType"::text`);
    await queryRunner.query(`DROP TYPE IF EXISTS "menu_items_alcoholtype_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "menu_items_alcoholtype_enum" AS ENUM('beer', 'wine', 'spirits', 'cocktail', 'other')`);
    await queryRunner.query(`ALTER TABLE "menu_items" ALTER COLUMN "alcoholType" TYPE "menu_items_alcoholtype_enum" USING "alcoholType"::"menu_items_alcoholtype_enum"`);
  }
}
