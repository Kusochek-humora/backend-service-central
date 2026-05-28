import { MigrationInterface, QueryRunner } from "typeorm";

export class FixTourShowColumns1781500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tour_shows" ADD COLUMN IF NOT EXISTS "publishToInternalChannel" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "tour_shows" ADD COLUMN IF NOT EXISTS "internalMsgId" bigint`);
    await queryRunner.query(`ALTER TABLE "tour_shows" ADD COLUMN IF NOT EXISTS "photoStories" varchar`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tour_shows" DROP COLUMN IF EXISTS "photoStories"`);
    await queryRunner.query(`ALTER TABLE "tour_shows" DROP COLUMN IF EXISTS "internalMsgId"`);
    await queryRunner.query(`ALTER TABLE "tour_shows" DROP COLUMN IF EXISTS "publishToInternalChannel"`);
  }
}
