import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedAlemLocations1783400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "alem_locations" ("label", "address_ru", "latitude", "longitude", "zoom", "twogis")
      VALUES
        ('Almaty Central Standup Club', 'ул. Кабанбай батыра 71', 43.250371, 76.951169, '18', 'https://go.2gis.com/q5MKi'),
        ('Конкордия', 'ул. Богенбай батыра 151', 43.252326, 76.930586, '18', 'https://go.2gis.com/0wGF4'),
        ('Университет Туран', 'ул. Каныша Сатпаева, 16а', 43.237661, 76.940263, '18', 'https://go.2gis.com/HY7Jy'),
        ('Тотальный театр', 'ул. Шевченко, 114', 43.244907, 76.931767, '18', 'https://2gis.kz/almaty/firm/70000001054774431')
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "alem_locations"
      WHERE "label" IN ('Almaty Central Standup Club', 'Конкордия', 'Университет Туран', 'Тотальный театр')
    `);
  }
}
