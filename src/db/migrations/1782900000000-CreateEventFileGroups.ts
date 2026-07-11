import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateEventFileGroups1782900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "event_file_groups" (
        "id"           SERIAL PRIMARY KEY,
        "photo"        varchar NOT NULL,
        "photoStories" varchar,
        "banner"       varchar,
        "date"         date NOT NULL,
        "time"         time NOT NULL,
        "label"        varchar,
        "createdAt"    TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "event_file_groups"`);
  }
}
