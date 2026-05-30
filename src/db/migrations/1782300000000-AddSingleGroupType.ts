import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSingleGroupType1782300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "group_type_enum" ADD VALUE IF NOT EXISTS 'single'`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL не поддерживает удаление значений из enum без пересоздания типа
  }
}
