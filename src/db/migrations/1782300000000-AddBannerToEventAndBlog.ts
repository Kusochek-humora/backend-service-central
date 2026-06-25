import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBannerToEventAndBlog1782300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "banner" character varying`);
    await queryRunner.query(`ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "banner" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN IF EXISTS "banner"`);
    await queryRunner.query(`ALTER TABLE "blog_posts" DROP COLUMN IF EXISTS "banner"`);
  }
}
