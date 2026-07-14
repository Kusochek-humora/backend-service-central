import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeMenuItemPhotoNullable1784500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "menu_items" ALTER COLUMN "photo" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "menu_items" SET "photo" = '' WHERE "photo" IS NULL`);
    await queryRunner.query(`ALTER TABLE "menu_items" ALTER COLUMN "photo" SET NOT NULL`);
  }
}
