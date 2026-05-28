import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInternalMsgIdToTourShow1781400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tour_shows" ADD COLUMN "internalMsgId" bigint`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tour_shows" DROP COLUMN "internalMsgId"`);
  }
}
