import { MigrationInterface, QueryRunner } from "typeorm";

export class RefactorDiscountRelationship1784400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Удаляем старое поле discount (int %) из menu_items
    await queryRunner.query(`ALTER TABLE "menu_items" DROP COLUMN IF EXISTS "discount"`);

    // Добавляем discountId FK на menu_items
    await queryRunner.query(`
      ALTER TABLE "menu_items"
      ADD COLUMN IF NOT EXISTS "discountId" int REFERENCES "menu_discounts"("id") ON DELETE SET NULL
    `);

    // Переносим данные: позиции, у которых был menuItemId в menu_discounts → ставим discountId
    const discounts = await queryRunner.query(`SELECT id, "menuItemId" FROM "menu_discounts" WHERE "menuItemId" IS NOT NULL`);
    for (const d of discounts) {
      await queryRunner.query(
        `UPDATE "menu_items" SET "discountId" = $1 WHERE id = $2`,
        [d.id, d.menuItemId],
      );
    }

    // Удаляем старые столбцы из menu_discounts
    await queryRunner.query(`ALTER TABLE "menu_discounts" DROP COLUMN IF EXISTS "menuItemId"`);
    await queryRunner.query(`ALTER TABLE "menu_discounts" DROP COLUMN IF EXISTS "comboId"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "menu_discounts" ADD COLUMN IF NOT EXISTS "comboId" int`);
    await queryRunner.query(`ALTER TABLE "menu_discounts" ADD COLUMN IF NOT EXISTS "menuItemId" int`);
    await queryRunner.query(`ALTER TABLE "menu_items" DROP COLUMN IF EXISTS "discountId"`);
    await queryRunner.query(`ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "discount" int`);
  }
}
