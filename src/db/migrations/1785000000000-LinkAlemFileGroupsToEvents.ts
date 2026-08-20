import { MigrationInterface, QueryRunner } from "typeorm";

export class LinkAlemFileGroupsToEvents1785000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // groupId → eventId (сопоставлено по label + дате)
    const mapping: Array<{ groupId: number; eventId: number }> = [
      { groupId: 23, eventId: 24 }, // Книга жалоб с Андреем Айрапетовым
      { groupId: 29, eventId: 36 }, // Арзан психологтар
      { groupId: 30, eventId: 35 }, // Армандастар
      { groupId: 32, eventId: 33 }, // Клуб разбитых сердец
      { groupId: 6,  eventId: 8  }, // Вася Шакулин
      { groupId: 11, eventId: 12 }, // Саша Малой
      { groupId: 38, eventId: 40 }, // Dinara Kerey
      { groupId: 18, eventId: 20 }, // HR: Humour Resources
      { groupId: 31, eventId: 34 }, // Ұят емес
      { groupId: 28, eventId: 37 }, // Лова лова
      { groupId: 20, eventId: 16 }, // PAPANG
      { groupId: 40, eventId: 42 }, // Комики решают проблемы
      { groupId: 27, eventId: 13 }, // Андрей Айрапетов
      { groupId: 26, eventId: 39 }, // Мадияр Нурманбетов
      { groupId: 36, eventId: 29 }, // Откровенно о детях 17.09 21:00
      { groupId: 37, eventId: 28 }, // Откровенно о детях 17.09 23:00
      { groupId: 12, eventId: 22 }, // Тимур Каргинов 17.09
      { groupId: 41, eventId: 43 }, // Comedy Table 17.09
      { groupId: 15, eventId: 17 }, // Весёлое шоу Айрапетов
      { groupId: 10, eventId: 11 }, // Гарик Оганисян
      { groupId: 7,  eventId: 4  }, // Ne Angime
      { groupId: 33, eventId: 32 }, // Stand.up Astana
      { groupId: 13, eventId: 23 }, // Джавид Курбанов 18.09
      { groupId: 43, eventId: 46 }, // Творческий вечер Ильи Овечкина
      { groupId: 39, eventId: 41 }, // Комики жалуются
      { groupId: 2,  eventId: 7  }, // Элементарно, Вася!
      { groupId: 8,  eventId: 1  }, // Тимур Каргинов 18.09
      { groupId: 42, eventId: 44 }, // Comedy Table 18.09
      { groupId: 24, eventId: 25 }, // О, сұрақ
      { groupId: 34, eventId: 31 }, // Может замутим?
      { groupId: 5,  eventId: 2  }, // Сауле Юсупова
      { groupId: 35, eventId: 30 }, // Женский чат
      { groupId: 44, eventId: 45 }, // Вотафлаг 19.09 23:00
      { groupId: 14, eventId: 16 }, // Вотафлаг 19.09 21:00
      { groupId: 25, eventId: 26 }, // Аңсағанды Тілеген
      { groupId: 1,  eventId: 3  }, // Найка Казиева
      { groupId: 19, eventId: 21 }, // IZI Money: Битва за миллион
      { groupId: 22, eventId: 27 }, // Ансаған Садирханов и Мадияр Нурманбетов
      { groupId: 3,  eventId: 5  }, // Алексей Квашонкин
    ];

    for (const { groupId, eventId } of mapping) {
      await queryRunner.query(`
        UPDATE "alem_events" e
        SET
          "fileGroupId" = g.id,
          "photo"       = g.photo,
          "photoStories" = CASE WHEN g."photoStories" = '' THEN e."photoStories" ELSE g."photoStories" END,
          "banner"       = CASE WHEN g."banner" = '' THEN e."banner" ELSE g."banner" END
        FROM "alem_file_groups" g
        WHERE e.id = ${eventId} AND g.id = ${groupId}
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "alem_events" SET "fileGroupId" = NULL WHERE "fileGroupId" IS NOT NULL
    `);
  }
}
