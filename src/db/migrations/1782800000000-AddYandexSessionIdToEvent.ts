import { MigrationInterface, QueryRunner } from "typeorm";

export class AddYandexSessionIdToEvent1782800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" ALTER COLUMN "link" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "events" ADD COLUMN "yandexSessionId" varchar`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "yandexSessionId"`);
    await queryRunner.query(`ALTER TABLE "events" ALTER COLUMN "link" SET NOT NULL`);
  }
}
