import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIngredientsToMenuItem1782700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "menu_items"
        ADD COLUMN "ingredients_ru" text,
        ADD COLUMN "ingredients_kz" text,
        ADD COLUMN "ingredients_en" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "menu_items"
        DROP COLUMN "ingredients_ru",
        DROP COLUMN "ingredients_kz",
        DROP COLUMN "ingredients_en"
    `);
  }
}
