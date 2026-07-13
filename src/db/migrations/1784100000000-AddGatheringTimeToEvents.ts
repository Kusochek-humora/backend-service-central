import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGatheringTimeToEvents1784100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "gatheringTime" time`);
    await queryRunner.query(`ALTER TABLE "alem_events" ADD COLUMN IF NOT EXISTS "gatheringTime" time`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN IF EXISTS "gatheringTime"`);
    await queryRunner.query(`ALTER TABLE "alem_events" DROP COLUMN IF EXISTS "gatheringTime"`);
  }
}
