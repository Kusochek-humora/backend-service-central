import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAlemSection1783100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."users_permissions_enum" ADD VALUE IF NOT EXISTS 'alem'`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL не поддерживает удаление значений из enum
  }
}
