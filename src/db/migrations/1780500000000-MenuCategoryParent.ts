import { MigrationInterface, QueryRunner } from "typeorm";

export class MenuCategoryParent1780500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "menu_categories"
      ADD COLUMN "parentId" int,
      ADD CONSTRAINT "FK_menu_categories_parent"
        FOREIGN KEY ("parentId") REFERENCES "menu_categories"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "menu_items" DROP COLUMN IF EXISTS "alcoholType"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "menu_categories" DROP CONSTRAINT "FK_menu_categories_parent"`);
    await queryRunner.query(`ALTER TABLE "menu_categories" DROP COLUMN "parentId"`);
    await queryRunner.query(`ALTER TABLE "menu_items" ADD COLUMN "alcoholType" varchar`);
  }
}
