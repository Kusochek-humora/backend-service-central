import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBlog1780700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "blog_posts" (
        "id" SERIAL PRIMARY KEY,
        "title_ru" varchar NOT NULL,
        "title_kz" varchar NOT NULL,
        "title_en" varchar,
        "excerpt_ru" text,
        "excerpt_kz" text,
        "excerpt_en" text,
        "content_ru" text NOT NULL,
        "content_kz" text NOT NULL,
        "content_en" text,
        "photo" varchar NOT NULL,
        "photos" text[] NOT NULL DEFAULT '{}',
        "videoUrl" varchar,
        "mainLink" varchar,
        "links" jsonb,
        "isPublished" boolean NOT NULL DEFAULT false,
        "isOnMainPage" boolean NOT NULL DEFAULT false,
        "publishedAt" timestamp,
        "order" int NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "blog_posts"`);
  }
}
