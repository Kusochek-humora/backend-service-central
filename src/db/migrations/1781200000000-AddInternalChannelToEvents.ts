import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInternalChannelToEvents1781200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" ADD COLUMN "photoStories" varchar`);
    await queryRunner.query(`ALTER TABLE "events" ADD COLUMN "publishToInternalChannel" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "events" ADD COLUMN "internalMsgId" bigint`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "internalMsgId"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "publishToInternalChannel"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "photoStories"`);
  }
}
