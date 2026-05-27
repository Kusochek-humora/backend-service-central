import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTelegramFields1780900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" ADD COLUMN "publishToTelegram" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "blog_posts" ADD COLUMN "publishToTelegram" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "publishToTelegram"`);
    await queryRunner.query(`ALTER TABLE "blog_posts" DROP COLUMN "publishToTelegram"`);
  }
}
