import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFaq1779733851393 implements MigrationInterface {
    name = 'CreateFaq1779733851393'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "faqs" ("id" SERIAL NOT NULL, "question_ru" character varying NOT NULL, "answer_ru" character varying NOT NULL, "question_kz" character varying NOT NULL, "answer_kz" character varying NOT NULL, "question_en" character varying, "answer_en" character varying, "order" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2ddf4f2c910f8e8fa2663a67bf0" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "faqs"`);
    }

}
