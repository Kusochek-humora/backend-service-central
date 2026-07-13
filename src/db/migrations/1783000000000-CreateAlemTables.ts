import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAlemTables1783000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "alem_locations" (
        "id"         SERIAL PRIMARY KEY,
        "label"      varchar NOT NULL,
        "address_ru" varchar,
        "address_kz" varchar,
        "address_en" varchar,
        "latitude"   decimal(10,7),
        "longitude"  decimal(10,7),
        "zoom"       varchar
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "alem_categories" (
        "id"   SERIAL PRIMARY KEY,
        "name" varchar NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "alem_file_groups" (
        "id"        SERIAL PRIMARY KEY,
        "photo1"    varchar NOT NULL,
        "photo2"    varchar,
        "photo3"    varchar,
        "photo4"    varchar,
        "photo5"    varchar,
        "date"      date NOT NULL,
        "time"      time NOT NULL,
        "label"     varchar,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "alem_events_language_enum" AS ENUM ('ru', 'kz', 'en')
    `);

    await queryRunner.query(`
      CREATE TABLE "alem_events" (
        "id"                       SERIAL PRIMARY KEY,
        "title"                    varchar NOT NULL,
        "photo1"                   varchar NOT NULL,
        "photo2"                   varchar,
        "photo3"                   varchar,
        "photo4"                   varchar,
        "photo5"                   varchar,
        "date"                     date NOT NULL,
        "time"                     time NOT NULL,
        "language"                 "alem_events_language_enum" NOT NULL DEFAULT 'ru',
        "notion"                   varchar,
        "description"              text,
        "comedians"                text,
        "link"                     varchar,
        "yandexSessionId"          varchar,
        "isSoldOut"                boolean NOT NULL DEFAULT false,
        "publishToOrganizerTelegram" boolean NOT NULL DEFAULT false,
        "publishToMainBlock"       boolean NOT NULL DEFAULT false,
        "isOnMainPage"             boolean NOT NULL DEFAULT false,
        "telegramMsgId"            bigint,
        "locationId"               integer REFERENCES "alem_locations"("id") ON DELETE SET NULL,
        "categoryId"               integer REFERENCES "alem_categories"("id") ON DELETE SET NULL,
        "createdAt"                TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"                TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "alem_events"`);
    await queryRunner.query(`DROP TYPE "alem_events_language_enum"`);
    await queryRunner.query(`DROP TABLE "alem_file_groups"`);
    await queryRunner.query(`DROP TABLE "alem_categories"`);
    await queryRunner.query(`DROP TABLE "alem_locations"`);
  }
}
