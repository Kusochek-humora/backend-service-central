import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInternalChannelToTours1781300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tours" ADD COLUMN "photoStories" varchar`);
    await queryRunner.query(`ALTER TABLE "tours" ADD COLUMN "publishToInternalChannel" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "tours" ADD COLUMN "internalMsgId" bigint`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tours" DROP COLUMN "internalMsgId"`);
    await queryRunner.query(`ALTER TABLE "tours" DROP COLUMN "publishToInternalChannel"`);
    await queryRunner.query(`ALTER TABLE "tours" DROP COLUMN "photoStories"`);
  }
}
