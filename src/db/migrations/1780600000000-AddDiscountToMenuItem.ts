import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDiscountToMenuItem1780600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "menu_items" ADD COLUMN "discount" int
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "menu_items" DROP COLUMN "discount"`);
  }
}
