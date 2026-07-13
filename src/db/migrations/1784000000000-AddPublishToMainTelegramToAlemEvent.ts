import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPublishToMainTelegramToAlemEvent1784000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alem_events" ADD COLUMN IF NOT EXISTS "publishToMainTelegram" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alem_events" DROP COLUMN IF EXISTS "publishToMainTelegram"`);
  }
}
