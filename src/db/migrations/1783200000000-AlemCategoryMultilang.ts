import { MigrationInterface, QueryRunner } from "typeorm";

export class AlemCategoryMultilang1783200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alem_categories" RENAME COLUMN "name" TO "name_ru"`);
    await queryRunner.query(`ALTER TABLE "alem_categories" ADD COLUMN "name_kz" varchar`);
    await queryRunner.query(`ALTER TABLE "alem_categories" ADD COLUMN "name_en" varchar`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alem_categories" DROP COLUMN "name_en"`);
    await queryRunner.query(`ALTER TABLE "alem_categories" DROP COLUMN "name_kz"`);
    await queryRunner.query(`ALTER TABLE "alem_categories" RENAME COLUMN "name_ru" TO "name"`);
  }
}
