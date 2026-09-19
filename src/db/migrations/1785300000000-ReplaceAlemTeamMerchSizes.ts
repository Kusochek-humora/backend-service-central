import { MigrationInterface, QueryRunner } from "typeorm";

export class ReplaceAlemTeamMerchSizes1785300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "merch_items"
      SET "sizes" = ARRAY['S-M','M-L','XL-2XL']
      WHERE "name_ru" = 'Олимпийка "ALEM TEAM"'
    `);
  }

  public async down(): Promise<void> {}
}
