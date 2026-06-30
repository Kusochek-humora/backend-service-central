import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMenuItemReviews1782600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "menu_item_reviews" (
        "id"           SERIAL PRIMARY KEY,
        "menuItemId"   int NOT NULL REFERENCES "menu_items"("id") ON DELETE CASCADE,
        "rating"       int NOT NULL CHECK ("rating" >= 1 AND "rating" <= 5),
        "comment"      text,
        "isVisible"    boolean NOT NULL DEFAULT true,
        "createdAt"    TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "menu_item_reviews"`);
  }
}
