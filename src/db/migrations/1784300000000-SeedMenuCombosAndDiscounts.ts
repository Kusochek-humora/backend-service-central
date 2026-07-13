import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedMenuCombosAndDiscounts1784300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Футбольное комбо
    const combo = await queryRunner.query(`
      INSERT INTO "menu_combos" ("name_ru", "name_kz", "name_en", "description_ru", "description_kz", "price", "isAvailable", "order")
      VALUES (
        'Футбольный вечер',
        'Футбол кеші',
        'Football Night',
        'Пицца, напиток и снек — всё для идеального матча',
        'Пицца, сусын және снек — матч үшін керемет жинақ',
        12900,
        true,
        1
      )
      RETURNING id
    `);
    const comboId = combo[0].id;

    // Слот 1: Пицца
    const slot1 = await queryRunner.query(`
      INSERT INTO "menu_combo_slots" ("comboId", "name_ru", "name_kz", "name_en", "quantity", "order")
      VALUES ($1, 'Пицца', 'Пицца', 'Pizza', 1, 1)
      RETURNING id
    `, [comboId]);
    const slot1Id = slot1[0].id;

    await queryRunner.query(`
      INSERT INTO "menu_combo_slot_options" ("slotId", "menuItemId") VALUES
        ($1, 8),   -- Пепперони
        ($1, 10),  -- Жая и грибы
        ($1, 12),  -- 4 сыра
        ($1, 14)   -- Маргарита
    `, [slot1Id]);

    // Слот 2: Напиток
    const slot2 = await queryRunner.query(`
      INSERT INTO "menu_combo_slots" ("comboId", "name_ru", "name_kz", "name_en", "quantity", "order")
      VALUES ($1, 'Напиток', 'Сусын', 'Drink', 1, 2)
      RETURNING id
    `, [comboId]);
    const slot2Id = slot2[0].id;

    await queryRunner.query(`
      INSERT INTO "menu_combo_slot_options" ("slotId", "menuItemId") VALUES
        ($1, 26),  -- Cola
        ($1, 27),  -- CENTRAL Cola
        ($1, 31)   -- Набеглави
    `, [slot2Id]);

    // Слот 3: Снеки
    const slot3 = await queryRunner.query(`
      INSERT INTO "menu_combo_slots" ("comboId", "name_ru", "name_kz", "name_en", "quantity", "order")
      VALUES ($1, 'Снеки', 'Снектер', 'Snacks', 1, 3)
      RETURNING id
    `, [comboId]);
    const slot3Id = slot3[0].id;

    await queryRunner.query(`
      INSERT INTO "menu_combo_slot_options" ("slotId", "menuItemId") VALUES
        ($1, 55),  -- Фисташки
        ($1, 56),  -- Арахис солёный
        ($1, 57)   -- Жареный кешью
    `, [slot3Id]);

    // ── Weekend Show ──────────────────────────────────────────────
    const combo2 = await queryRunner.query(`
      INSERT INTO "menu_combos" ("name_ru", "name_kz", "name_en", "description_ru", "description_kz", "price", "isAvailable", "order")
      VALUES (
        'Weekend Show',
        'Weekend Show',
        'Weekend Show',
        'Горячее, напиток и десерт — идеальный вечер со стендапом',
        'Ыстық тағам, сусын және десерт — стендапты кеш',
        14900,
        true,
        2
      )
      RETURNING id
    `);
    const combo2Id = combo2[0].id;

    const ws1 = await queryRunner.query(`
      INSERT INTO "menu_combo_slots" ("comboId", "name_ru", "name_kz", "name_en", "quantity", "order")
      VALUES ($1, 'Горячее', 'Ыстық тағам', 'Main', 1, 1)
      RETURNING id
    `, [combo2Id]);
    await queryRunner.query(`
      INSERT INTO "menu_combo_slot_options" ("slotId", "menuItemId") VALUES
        ($1, 20),  -- Куриная котлета
        ($1, 21),  -- Шашлычок из цыпленка
        ($1, 22),  -- Спагетти болоньезе
        ($1, 23)   -- Паста с курицей
    `, [ws1[0].id]);

    const ws2 = await queryRunner.query(`
      INSERT INTO "menu_combo_slots" ("comboId", "name_ru", "name_kz", "name_en", "quantity", "order")
      VALUES ($1, 'Напиток', 'Сусын', 'Drink', 1, 2)
      RETURNING id
    `, [combo2Id]);
    await queryRunner.query(`
      INSERT INTO "menu_combo_slot_options" ("slotId", "menuItemId") VALUES
        ($1, 27),  -- CENTRAL Cola
        ($1, 35),  -- Матча-Юдзу-Кокос
        ($1, 37)   -- Манго-Маракуйя
    `, [ws2[0].id]);

    const ws3 = await queryRunner.query(`
      INSERT INTO "menu_combo_slots" ("comboId", "name_ru", "name_kz", "name_en", "quantity", "order")
      VALUES ($1, 'Десерт', 'Десерт', 'Dessert', 1, 3)
      RETURNING id
    `, [combo2Id]);
    await queryRunner.query(`
      INSERT INTO "menu_combo_slot_options" ("slotId", "menuItemId") VALUES
        ($1, 24),  -- Баскский чизкейк
        ($1, 25)   -- Яблочный крамбл
    `, [ws3[0].id]);

    // ── Comedy Night ──────────────────────────────────────────────
    const combo3 = await queryRunner.query(`
      INSERT INTO "menu_combos" ("name_ru", "name_kz", "name_en", "description_ru", "description_kz", "price", "isAvailable", "order")
      VALUES (
        'Comedy Night',
        'Comedy Night',
        'Comedy Night',
        'Закуска и лимонад — лёгкий формат для тех, кто пришёл смеяться',
        'Тағам және лимонад — күлкі кешке арналған жеңіл жиынтық',
        7900,
        true,
        3
      )
      RETURNING id
    `);
    const combo3Id = combo3[0].id;

    const cn1 = await queryRunner.query(`
      INSERT INTO "menu_combo_slots" ("comboId", "name_ru", "name_kz", "name_en", "quantity", "order")
      VALUES ($1, 'Закуска', 'Тағам', 'Starter', 1, 1)
      RETURNING id
    `, [combo3Id]);
    await queryRunner.query(`
      INSERT INTO "menu_combo_slot_options" ("slotId", "menuItemId") VALUES
        ($1, 5),   -- Куриный попкорн
        ($1, 6),   -- Сет брускетт
        ($1, 16)   -- Мини-бургеры
    `, [cn1[0].id]);

    const cn2 = await queryRunner.query(`
      INSERT INTO "menu_combo_slots" ("comboId", "name_ru", "name_kz", "name_en", "quantity", "order")
      VALUES ($1, 'Лимонад', 'Лимонад', 'Lemonade', 1, 2)
      RETURNING id
    `, [combo3Id]);
    await queryRunner.query(`
      INSERT INTO "menu_combo_slot_options" ("slotId", "menuItemId") VALUES
        ($1, 35),  -- Матча-Юдзу-Кокос
        ($1, 37),  -- Манго-Маракуйя
        ($1, 39),  -- Имбирь-Цитрус
        ($1, 41)   -- Вишня-Ромашка
    `, [cn2[0].id]);

    // ── Скидки ───────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO "menu_discounts" ("type", "value", "label_ru", "label_kz", "label_en", "isActive", "menuItemId") VALUES
        ('percent', 15, 'Акция', 'Акция', 'Sale', true, 8),   -- 15% на Пепперони
        ('percent', 10, 'Пицца дня', 'Күннің пиццасы', 'Pizza of the Day', true, 14),  -- 10% на Маргарита
        ('percent', 20, 'Десерт дня', 'Күннің десерті', 'Dessert of the Day', true, 24) -- 20% на Баскский чизкейк
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "menu_discounts" WHERE "menuItemId" IN (8, 14, 24)`);
    await queryRunner.query(`DELETE FROM "menu_combos" WHERE "name_ru" IN ('Футбольный вечер', 'Weekend Show', 'Comedy Night')`);
  }
}
