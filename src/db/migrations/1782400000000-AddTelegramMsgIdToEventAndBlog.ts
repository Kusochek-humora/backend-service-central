import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTelegramMsgIdToEventAndBlog1782400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "telegramMsgId" bigint`);
    await queryRunner.query(`ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "telegramMsgId" bigint`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN IF EXISTS "telegramMsgId"`);
    await queryRunner.query(`ALTER TABLE "blog_posts" DROP COLUMN IF EXISTS "telegramMsgId"`);
  }
}
