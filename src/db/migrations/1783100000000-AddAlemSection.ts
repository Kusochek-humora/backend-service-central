import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAlemSection1783100000000 implements MigrationInterface {
  public async up(_queryRunner: QueryRunner): Promise<void> {
    // permissions stored as text[], no enum type to alter
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // nothing to revert
  }
}
