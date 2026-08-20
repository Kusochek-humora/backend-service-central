import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFileGroupIdToEvents1784800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "fileGroupId" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN IF EXISTS "fileGroupId"`);
  }
}
