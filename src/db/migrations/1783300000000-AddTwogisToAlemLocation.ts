import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTwogisToAlemLocation1783300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alem_locations" ADD COLUMN IF NOT EXISTS "twogis" varchar`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alem_locations" DROP COLUMN IF EXISTS "twogis"`);
  }
}
