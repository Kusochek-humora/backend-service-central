import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedAlemEvents1783700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Category
    await queryRunner.query(`
      INSERT INTO "alem_categories" ("name_ru") VALUES ('Стендап') ON CONFLICT DO NOTHING
    `);

    // Dastyk Hall (not in initial seed)
    await queryRunner.query(`
      INSERT INTO "alem_locations" ("label", "address_ru", "latitude", "longitude", "zoom")
      VALUES ('Dastyk Hall', 'пр. Достык, 85а', 43.2344, 76.9583, '18')
      ON CONFLICT DO NOTHING
    `);

    // Events — photo1 is placeholder, update via admin panel
    await queryRunner.query(`
      INSERT INTO "alem_events"
        ("title", "photo", "date", "time", "language", "link", "isSoldOut", "publishToOrganizerTelegram", "publishToMainBlock", "isOnMainPage", "locationId", "categoryId")
      VALUES
        (
          'Тимур Каргинов', '/uploads/alem/placeholder.jpg', '2026-09-18', '21:30:00', 'ru',
          'https://widget.afisha.yandex.kz/w/sessions/MTAyMzY3fDgzODE5N3wxMzE5NzA2OHwxNzg5NzQ5MDAwMDAw?clientKey=528ec6a9-d866-4983-9f4f-0277cb9ae218',
          false, false, false, false,
          (SELECT id FROM "alem_locations" WHERE label = 'Almaty Central Standup Club' LIMIT 1),
          (SELECT id FROM "alem_categories" WHERE name_ru = 'Стендап' LIMIT 1)
        ),
        (
          'Сауле Юсупова', '/uploads/alem/placeholder.jpg', '2026-09-19', '19:00:00', 'ru',
          'https://widget.afisha.yandex.ru/w/sessions/ticketsteam-9984@65484674?clientKey=528ec6a9-d866-4983-9f4f-0277cb9ae218&regionId=162',
          false, false, false, false,
          (SELECT id FROM "alem_locations" WHERE label = 'Конкордия' LIMIT 1),
          (SELECT id FROM "alem_categories" WHERE name_ru = 'Стендап' LIMIT 1)
        ),
        (
          'Найка Казиева', '/uploads/alem/placeholder.jpg', '2026-09-18', '21:00:00', 'ru',
          'https://widget.afisha.yandex.kz/w/sessions/MTAzMjI3fDg0MzYyN3wxMzM0ODIwOXwxNzg5NzQ3MjAwMDAw?clientKey=528ec6a9-d866-4983-9f4f-0277cb9ae218',
          false, false, false, false,
          (SELECT id FROM "alem_locations" WHERE label = 'Университет Туран' LIMIT 1),
          (SELECT id FROM "alem_categories" WHERE name_ru = 'Стендап' LIMIT 1)
        ),
        (
          'Ne Angime', '/uploads/alem/placeholder.jpg', '2026-09-18', '19:00:00', 'ru',
          'https://widget.afisha.yandex.kz/w/sessions/MTA0MDIxfDg1NDQ4OXwxMzQ2NDE0NHwxNzg5NzQwMDAwMDAw?clientKey=528ec6a9-d866-4983-9f4f-0277cb9ae218',
          false, false, false, false,
          (SELECT id FROM "alem_locations" WHERE label = 'Dastyk Hall' LIMIT 1),
          (SELECT id FROM "alem_categories" WHERE name_ru = 'Стендап' LIMIT 1)
        ),
        (
          'Алексей Квашонкин', '/uploads/alem/placeholder.jpg', '2026-09-17', '21:00:00', 'ru',
          'https://widget.afisha.yandex.kz/w/sessions/MTAyMzY3fDg1ODA4NnwxMzE5NzA2OHwxNzg5NjUzNjAwMDAw?clientKey=528ec6a9-d866-4983-9f4f-0277cb9ae218',
          false, false, false, false,
          (SELECT id FROM "alem_locations" WHERE label = 'Almaty Central Standup Club' LIMIT 1),
          (SELECT id FROM "alem_categories" WHERE name_ru = 'Стендап' LIMIT 1)
        ),
        (
          'Что такое хорошо и что такое плохо', '/uploads/alem/placeholder.jpg', '2026-09-16', '21:00:00', 'ru',
          'https://widget.afisha.yandex.kz/w/sessions/MTA1MTUzfDg1ODA4OXwxMzY3NzQ2M3wxNzg5NTc0NDAwMDAw?clientKey=528ec6a9-d866-4983-9f4f-0277cb9ae218',
          false, false, false, false,
          (SELECT id FROM "alem_locations" WHERE label = 'Тотальный театр' LIMIT 1),
          (SELECT id FROM "alem_categories" WHERE name_ru = 'Стендап' LIMIT 1)
        ),
        (
          'Элементарно, Вася!', '/uploads/alem/placeholder.jpg', '2026-09-18', '21:00:00', 'ru',
          'https://widget.afisha.yandex.kz/w/sessions/MTA1MTUzfDg1ODA4N3wxMzY3NzQ2M3wxNzg5NzQ3MjAwMDAw?clientKey=528ec6a9-d866-4983-9f4f-0277cb9ae218',
          false, false, false, false,
          (SELECT id FROM "alem_locations" WHERE label = 'Тотальный театр' LIMIT 1),
          (SELECT id FROM "alem_categories" WHERE name_ru = 'Стендап' LIMIT 1)
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "alem_events" WHERE "title" IN (
        'Тимур Каргинов', 'Сауле Юсупова', 'Найка Казиева', 'Ne Angime',
        'Алексей Квашонкин', 'Что такое хорошо и что такое плохо', 'Элементарно, Вася!'
      )
    `);
    await queryRunner.query(`DELETE FROM "alem_locations" WHERE label = 'Dastyk Hall'`);
    await queryRunner.query(`DELETE FROM "alem_categories" WHERE name_ru = 'Стендап'`);
  }
}
