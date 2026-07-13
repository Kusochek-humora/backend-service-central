import { MigrationInterface, QueryRunner } from "typeorm";

export class AlemLocationCoordToFloat1783600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alem_locations" ALTER COLUMN "latitude" TYPE float8 USING latitude::float8`);
    await queryRunner.query(`ALTER TABLE "alem_locations" ALTER COLUMN "longitude" TYPE float8 USING longitude::float8`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alem_locations" ALTER COLUMN "latitude" TYPE numeric(10,7) USING latitude::numeric`);
    await queryRunner.query(`ALTER TABLE "alem_locations" ALTER COLUMN "longitude" TYPE numeric(10,7) USING longitude::numeric`);
  }
}
