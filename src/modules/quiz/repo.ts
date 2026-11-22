import { EntityManager, In } from "typeorm";
import { AppDataSource } from "../../db/data-source";
import { QuizGame, QuizQuestion, QuizRound, QuizSession, QuizTheme } from "../../db/entities/quiz/quiz.entity";
import { ApiError } from "./common";
import { GameModel } from "./engine";

export type FullGame = GameModel & { description: string; createdAt: Date; updatedAt: Date };

/**
 * Игра целиком: раунды (по order) → темы (по order) → вопросы (по цене по возрастанию, затем по order).
 * Те же данные отдаёт GET /games/:id и использует движок.
 */
export async function loadGame(gameId: string, em: EntityManager = AppDataSource.manager): Promise<FullGame | null> {
  const game = await em.findOneBy(QuizGame, { id: gameId });
  if (!game) return null;
  const rounds = await em.find(QuizRound, { where: { gameId }, order: { order: "ASC", createdAt: "ASC" } });
  const roundIds = rounds.map((r) => r.id);
  const themes = roundIds.length ? await em.find(QuizTheme, { where: { roundId: In(roundIds) }, order: { order: "ASC", createdAt: "ASC" } }) : [];
  const themeIds = themes.map((t) => t.id);
  const questions = themeIds.length
    ? await em.find(QuizQuestion, { where: { themeId: In(themeIds) }, order: { price: "ASC", order: "ASC", createdAt: "ASC" } })
    : [];

  return {
    id: game.id, title: game.title, description: game.description, createdAt: game.createdAt, updatedAt: game.updatedAt,
    rounds: rounds.map((r) => ({
      ...r,
      themes: themes.filter((t) => t.roundId === r.id).map((t) => ({ ...t, questions: questions.filter((q) => q.themeId === t.id) })),
    })) as unknown as GameModel["rounds"],
  };
}

/** Пока игра идёт (сессия не idle и не finished), править её контент нельзя */
export async function assertGameEditable(gameId: string, em: EntityManager = AppDataSource.manager) {
  const live = await em
    .createQueryBuilder(QuizSession, "s")
    .where("s.gameId = :gameId", { gameId })
    .andWhere("s.status NOT IN ('idle', 'finished')")
    .getCount();
  if (live > 0) throw new ApiError(409, "GAME_IN_USE", "Игра сейчас идёт в одной из сессий — править её нельзя");
}

export async function touchGame(em: EntityManager, gameId: string) {
  await em.query(`UPDATE quiz_games SET "updatedAt" = NOW() WHERE id = $1`, [gameId]);
}
