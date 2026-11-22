import { MigrationInterface, QueryRunner } from "typeorm";
import { TIKO_GAME } from "../seeds/data/tiko-game.data";

/**
 * Создаёт игру «Тіко: Своя игра» (данные: src/db/seeds/data/tiko-game.data.ts):
 * два тура из Google-таблицы, бонус-раунд со своими вопросами на остальные механики и суперфинал.
 * Если игра с таким названием уже есть, ничего не делает. Всё в одной транзакции миграции.
 * down() удаляет игру по названию (вместе с её сессиями).
 */
export class SeedQuizTikoGame1785600000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    const existing = await q.query(`SELECT 1 FROM "quiz_games" WHERE "title" = $1`, [TIKO_GAME.title]);
    if (existing.length > 0) {
      console.log(`[quiz] игра "${TIKO_GAME.title}" уже существует, пропускаю`);
      return;
    }

    const [{ id: gameId }] = await q.query(
      `INSERT INTO "quiz_games" ("title", "description") VALUES ($1, $2) RETURNING "id"`,
      [TIKO_GAME.title, TIKO_GAME.description],
    );

    let questions = 0;
    for (let ri = 0; ri < TIKO_GAME.rounds.length; ri++) {
      const round = TIKO_GAME.rounds[ri];
      const [{ id: roundId }] = await q.query(
        `INSERT INTO "quiz_rounds" ("gameId", "order", "title", "description", "type", "settings")
         VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING "id"`,
        [gameId, ri, round.title, round.description, round.type, JSON.stringify(round.settings)],
      );
      for (let ti = 0; ti < round.themes.length; ti++) {
        const theme = round.themes[ti];
        const [{ id: themeId }] = await q.query(
          `INSERT INTO "quiz_themes" ("roundId", "order", "title") VALUES ($1, $2, $3) RETURNING "id"`,
          [roundId, ti, theme.title],
        );
        for (let qi = 0; qi < theme.questions.length; qi++) {
          const x = theme.questions[qi];
          await q.query(
            `INSERT INTO "quiz_questions" ("themeId", "order", "price", "kind", "settings", "content", "answerContent", "comment", "timeLimitSec")
             VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9)`,
            [themeId, qi, x.price, x.kind, JSON.stringify(x.settings), JSON.stringify(x.content), JSON.stringify(x.answerContent), x.comment, x.timeLimitSec],
          );
          questions++;
        }
      }
    }
    console.log(`[quiz] создана игра "${TIKO_GAME.title}": раундов ${TIKO_GAME.rounds.length}, вопросов ${questions}`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM "quiz_games" WHERE "title" = $1`, [TIKO_GAME.title]);
  }
}
