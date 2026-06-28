import { MigrationInterface, QueryRunner } from "typeorm";

export class MainLinkToJsonb1782500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "blog_posts"
      ALTER COLUMN "mainLink" TYPE jsonb
      USING CASE
        WHEN "mainLink" IS NULL THEN NULL
        ELSE jsonb_build_object('url', "mainLink", 'label_ru', '', 'label_kz', '')
      END
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "blog_posts"
      ALTER COLUMN "mainLink" TYPE character varying
      USING ("mainLink"->>'url')
    `);
  }
}
