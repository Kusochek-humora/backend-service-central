import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFileGroupIdToAlemEvents1784900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alem_events" ADD COLUMN IF NOT EXISTS "fileGroupId" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alem_events" DROP COLUMN IF EXISTS "fileGroupId"`);
  }
}
