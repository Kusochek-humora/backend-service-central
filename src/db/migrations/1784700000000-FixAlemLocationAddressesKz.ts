import { MigrationInterface, QueryRunner } from "typeorm";

export class FixAlemLocationAddressesKz1784700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const updates: { name: string; address_kz: string }[] = [
      { name: "Конкордия",                  address_kz: "Богенбай батыр к-сі, 151" },
      { name: "Университет Туран",           address_kz: "Қаныш Сәтбаев к-сі, 16а" },
      { name: "Тотальный театр",             address_kz: "Шевченко к-сі, 114" },
      { name: "Almaty Central Standup Club", address_kz: "Қабанбай батыр к-сі, 71" },
      { name: "Dostyk Hall",                 address_kz: "Достық д-лы, 85а" },
      { name: "Кинопавильон",               address_kz: "Зенков к-сі, 24А" },
      { name: "Punch Standup club",          address_kz: "Қайырбекова к-сі, 35А, 3 қабат" },
    ];

    for (const { name, address_kz } of updates) {
      await queryRunner.query(
        `UPDATE "alem_locations" SET "address_kz" = $1 WHERE "label" = $2`,
        [address_kz, name]
      );
    }

    await queryRunner.query(`
      UPDATE "alem_locations"
      SET "address_ru" = 'Каирбекова, 35А, 3 этаж'
      WHERE "label" = 'Punch Standup club'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const reverts: { name: string; address_kz: string }[] = [
      { name: "Конкордия",                  address_kz: "ул. Богенбай батыра 151" },
      { name: "Университет Туран",           address_kz: "ул. Каныша Сатпаева, 16а" },
      { name: "Тотальный театр",             address_kz: "Мысал к-сі, 1" },
      { name: "Almaty Central Standup Club", address_kz: "ул. Кабанбай батыра 71" },
      { name: "Dostyk Hall",                 address_kz: "пр. Достык, 85а" },
      { name: "Кинопавильон",               address_kz: "ул. Зенкова, 24А" },
      { name: "Punch Standup club",          address_kz: "Каирбекова, 35А" },
    ];

    for (const { name, address_kz } of reverts) {
      await queryRunner.query(
        `UPDATE "alem_locations" SET "address_kz" = $1 WHERE "label" = $2`,
        [address_kz, name]
      );
    }

    await queryRunner.query(`
      UPDATE "alem_locations"
      SET "address_ru" = 'Каирбекова, 35A'
      WHERE "label" = 'Punch Standup club'
    `);
  }
}
