import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameAlemEventPhotos1783800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alem_events" RENAME COLUMN "photo1" TO "photo"`);
    await queryRunner.query(`ALTER TABLE "alem_events" DROP COLUMN IF EXISTS "photo2"`);
    await queryRunner.query(`ALTER TABLE "alem_events" DROP COLUMN IF EXISTS "photo3"`);
    await queryRunner.query(`ALTER TABLE "alem_events" DROP COLUMN IF EXISTS "photo4"`);
    await queryRunner.query(`ALTER TABLE "alem_events" DROP COLUMN IF EXISTS "photo5"`);
    await queryRunner.query(`ALTER TABLE "alem_events" ADD COLUMN IF NOT EXISTS "photoStories" varchar`);
    await queryRunner.query(`ALTER TABLE "alem_events" ADD COLUMN IF NOT EXISTS "banner" varchar`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alem_events" DROP COLUMN IF EXISTS "banner"`);
    await queryRunner.query(`ALTER TABLE "alem_events" DROP COLUMN IF EXISTS "photoStories"`);
    await queryRunner.query(`ALTER TABLE "alem_events" ADD COLUMN IF NOT EXISTS "photo5" varchar`);
    await queryRunner.query(`ALTER TABLE "alem_events" ADD COLUMN IF NOT EXISTS "photo4" varchar`);
    await queryRunner.query(`ALTER TABLE "alem_events" ADD COLUMN IF NOT EXISTS "photo3" varchar`);
    await queryRunner.query(`ALTER TABLE "alem_events" ADD COLUMN IF NOT EXISTS "photo2" varchar`);
    await queryRunner.query(`ALTER TABLE "alem_events" RENAME COLUMN "photo" TO "photo1"`);
  }
}
