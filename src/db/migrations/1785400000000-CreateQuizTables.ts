import { MigrationInterface, QueryRunner } from "typeorm";

// Квиз «Своя игра»: только новые таблицы с префиксом quiz_. Существующие таблицы сайта не затрагиваются.
export class CreateQuizTables1785400000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    const ts = `TIMESTAMPTZ NOT NULL DEFAULT NOW()`;

    await q.query(`
      CREATE TABLE IF NOT EXISTS "quiz_users" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "login" VARCHAR NOT NULL UNIQUE,
        "passwordHash" VARCHAR NOT NULL,
        "role" VARCHAR NOT NULL CHECK ("role" IN ('admin', 'host')),
        "createdAt" ${ts}, "updatedAt" ${ts}
      )`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "quiz_media" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "type" VARCHAR NOT NULL CHECK ("type" IN ('image', 'audio', 'video')),
        "path" VARCHAR NOT NULL UNIQUE,
        "originalName" VARCHAR NOT NULL,
        "mime" VARCHAR NOT NULL,
        "size" INT NOT NULL,
        "createdAt" ${ts}, "updatedAt" ${ts}
      )`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "quiz_games" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" VARCHAR NOT NULL,
        "description" TEXT NOT NULL DEFAULT '',
        "createdAt" ${ts}, "updatedAt" ${ts}
      )`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "quiz_rounds" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "gameId" UUID NOT NULL REFERENCES "quiz_games"("id") ON DELETE CASCADE,
        "order" INT NOT NULL DEFAULT 0,
        "title" VARCHAR NOT NULL,
        "description" TEXT NOT NULL DEFAULT '',
        "type" VARCHAR NOT NULL DEFAULT 'standard' CHECK ("type" IN ('standard', 'final')),
        "settings" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" ${ts}, "updatedAt" ${ts}
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_quiz_rounds_game" ON "quiz_rounds" ("gameId", "order")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "quiz_themes" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "roundId" UUID NOT NULL REFERENCES "quiz_rounds"("id") ON DELETE CASCADE,
        "order" INT NOT NULL DEFAULT 0,
        "title" VARCHAR NOT NULL,
        "createdAt" ${ts}, "updatedAt" ${ts}
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_quiz_themes_round" ON "quiz_themes" ("roundId", "order")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "quiz_questions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "themeId" UUID NOT NULL REFERENCES "quiz_themes"("id") ON DELETE CASCADE,
        "order" INT NOT NULL DEFAULT 0,
        "price" INT NOT NULL CHECK ("price" > 0),
        "kind" VARCHAR NOT NULL DEFAULT 'standard',
        "settings" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "content" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "answerContent" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "comment" TEXT NOT NULL DEFAULT '',
        "timeLimitSec" INT,
        "createdAt" ${ts}, "updatedAt" ${ts}
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_quiz_questions_theme" ON "quiz_questions" ("themeId", "price")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "quiz_question_media" (
        "questionId" UUID NOT NULL REFERENCES "quiz_questions"("id") ON DELETE CASCADE,
        "mediaId" UUID NOT NULL REFERENCES "quiz_media"("id") ON DELETE RESTRICT,
        PRIMARY KEY ("questionId", "mediaId")
      )`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "quiz_participants" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR NOT NULL,
        "color" VARCHAR NOT NULL DEFAULT '#888888',
        "photoMediaId" UUID REFERENCES "quiz_media"("id") ON DELETE RESTRICT,
        "defaultStartScore" INT NOT NULL DEFAULT 0,
        "createdAt" ${ts}, "updatedAt" ${ts}
      )`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "quiz_sessions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "gameId" UUID NOT NULL REFERENCES "quiz_games"("id") ON DELETE CASCADE,
        "status" VARCHAR NOT NULL DEFAULT 'idle'
          CHECK ("status" IN ('idle','intro','round_intro','board','question_shown','timer_running','answer_revealed','finished')),
        "hostName" VARCHAR,
        "currentRoundId" UUID,
        "currentQuestionId" UUID,
        "activeParticipantId" UUID,
        "timerEndsAt" TIMESTAMPTZ,
        "roundState" JSONB NOT NULL DEFAULT '{"finalists":null,"eliminatedThemeIds":[]}'::jsonb,
        "screenToken" VARCHAR NOT NULL UNIQUE,
        "version" INT NOT NULL DEFAULT 0,
        "startedAt" TIMESTAMPTZ,
        "finishedAt" TIMESTAMPTZ,
        "createdAt" ${ts}, "updatedAt" ${ts}
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_quiz_sessions_game" ON "quiz_sessions" ("gameId")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "quiz_session_participants" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "sessionId" UUID NOT NULL REFERENCES "quiz_sessions"("id") ON DELETE CASCADE,
        "participantId" UUID NOT NULL REFERENCES "quiz_participants"("id") ON DELETE RESTRICT,
        "order" INT NOT NULL DEFAULT 0,
        "startScore" INT NOT NULL DEFAULT 0,
        UNIQUE ("sessionId", "participantId")
      )`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "quiz_session_question_state" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "sessionId" UUID NOT NULL REFERENCES "quiz_sessions"("id") ON DELETE CASCADE,
        "questionId" UUID NOT NULL,
        "state" JSONB NOT NULL,
        "updatedAt" ${ts},
        UNIQUE ("sessionId", "questionId")
      )`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "quiz_session_played_questions" (
        "sessionId" UUID NOT NULL REFERENCES "quiz_sessions"("id") ON DELETE CASCADE,
        "questionId" UUID NOT NULL,
        PRIMARY KEY ("sessionId", "questionId")
      )`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "quiz_session_history" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "sessionId" UUID NOT NULL REFERENCES "quiz_sessions"("id") ON DELETE CASCADE,
        "version" INT NOT NULL,
        "command" VARCHAR NOT NULL,
        "stateBefore" JSONB NOT NULL,
        "createdAt" ${ts}
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_quiz_history_session" ON "quiz_session_history" ("sessionId", "version")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "quiz_score_events" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "sessionId" UUID NOT NULL REFERENCES "quiz_sessions"("id") ON DELETE CASCADE,
        "participantId" UUID NOT NULL REFERENCES "quiz_participants"("id") ON DELETE RESTRICT,
        "kind" VARCHAR NOT NULL CHECK ("kind" IN ('correct', 'wrong', 'bonus', 'penalty', 'manual')),
        "delta" INT NOT NULL CHECK ("delta" <> 0),
        "reason" TEXT,
        "questionId" UUID,
        "voided" BOOLEAN NOT NULL DEFAULT FALSE,
        "createdBy" UUID,
        "createdAt" ${ts}
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_quiz_scores_session" ON "quiz_score_events" ("sessionId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const t of [
      "quiz_score_events", "quiz_session_history", "quiz_session_played_questions", "quiz_session_question_state",
      "quiz_session_participants", "quiz_sessions", "quiz_participants", "quiz_question_media", "quiz_questions",
      "quiz_themes", "quiz_rounds", "quiz_games", "quiz_media", "quiz_users",
    ]) {
      await q.query(`DROP TABLE IF EXISTS "${t}"`);
    }
  }
}
