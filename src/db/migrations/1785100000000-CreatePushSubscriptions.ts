import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePushSubscriptions1785100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "push_subscriptions" (
        "id"        SERIAL PRIMARY KEY,
        "endpoint"  TEXT NOT NULL UNIQUE,
        "keys"      JSON NOT NULL,
        "lang"      VARCHAR,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "push_subscriptions"`);
  }
}
