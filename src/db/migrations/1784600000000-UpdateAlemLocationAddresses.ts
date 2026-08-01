import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateAlemLocationAddresses1784600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Заменяем "ул." на "көш." во всех казахских адресах
    await queryRunner.query(`
      UPDATE "alem_locations"
      SET "address_kz" = REPLACE("address_kz", 'ул.', 'көш.')
      WHERE "address_kz" LIKE '%ул.%'
    `);

    // Punch Standup club — добавляем этаж
    await queryRunner.query(`
      UPDATE "alem_locations"
      SET
        "address_ru" = CONCAT("address_ru", ', 3 этаж'),
        "address_kz" = CONCAT("address_kz", ', 3 қабат')
      WHERE "name" = 'Punch Standup club'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "alem_locations"
      SET "address_kz" = REPLACE("address_kz", 'көш.', 'ул.')
      WHERE "address_kz" LIKE '%көш.%'
    `);

    await queryRunner.query(`
      UPDATE "alem_locations"
      SET
        "address_ru" = REPLACE("address_ru", ', 3 этаж', ''),
        "address_kz" = REPLACE("address_kz", ', 3 қабат', '')

      WHERE "name" = 'Punch Standup club'
    `);
  }
}
