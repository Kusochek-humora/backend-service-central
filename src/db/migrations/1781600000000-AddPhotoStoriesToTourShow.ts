import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPhotoStoriesToTourShow1781600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tour_shows" ADD COLUMN IF NOT EXISTS "photoStories" varchar`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tour_shows" DROP COLUMN IF EXISTS "photoStories"`);
  }
}
