import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLanguageToEvent1780000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "events_language_enum" AS ENUM('ru', 'kz', 'en')`);
    await queryRunner.query(`ALTER TABLE "events" ADD "language" "events_language_enum" NOT NULL DEFAULT 'ru'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "language"`);
    await queryRunner.query(`DROP TYPE "events_language_enum"`);
  }
}
