import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderAndMoreinfolink1783900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alem_events" ADD COLUMN IF NOT EXISTS "moreinfolink" varchar`);
    await queryRunner.query(`ALTER TABLE "alem_events" ADD COLUMN IF NOT EXISTS "order" int`);
    await queryRunner.query(`ALTER TABLE "alem_categories" ADD COLUMN IF NOT EXISTS "order" int`);
    await queryRunner.query(`ALTER TABLE "alem_locations" ADD COLUMN IF NOT EXISTS "order" int`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alem_locations" DROP COLUMN IF EXISTS "order"`);
    await queryRunner.query(`ALTER TABLE "alem_categories" DROP COLUMN IF EXISTS "order"`);
    await queryRunner.query(`ALTER TABLE "alem_events" DROP COLUMN IF EXISTS "order"`);
    await queryRunner.query(`ALTER TABLE "alem_events" DROP COLUMN IF EXISTS "moreinfolink"`);
  }
}
