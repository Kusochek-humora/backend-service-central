import { Entity, PrimaryGeneratedColumn, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

// Квиз «Своя игра». Все таблицы с префиксом quiz_, с таблицами сайта не связаны.
// Колонки в camelCase, как и в остальных сущностях проекта.
// DEFAULT gen_random_uuid() для id задаётся в миграции (synchronize выключен).

export type QuizRole = "admin" | "host";
export type QuizMediaType = "image" | "audio" | "video";
export type QuizRoundType = "standard" | "final";
export type QuizSessionStatus =
  | "idle"
  | "intro"
  | "round_intro"
  | "board"
  | "question_shown"
  | "timer_running"
  | "answer_revealed"
  | "finished";
export type QuizScoreKind = "correct" | "wrong" | "bonus" | "penalty" | "manual";

export interface QuizRoundState {
  /** выбранные финалисты (раунд final); null — ещё не выбраны */
  finalists: string[] | null;
  /** вычеркнутые темы (final, режим elimination) */
  eliminatedThemeIds: string[];
}

@Entity("quiz_users")
export class QuizUser {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "varchar", unique: true }) login!: string;
  @Column({ type: "varchar" }) passwordHash!: string;
  @Column({ type: "varchar" }) role!: QuizRole;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ type: "timestamptz" }) updatedAt!: Date;
}

@Entity("quiz_media")
export class QuizMedia {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "varchar" }) type!: QuizMediaType;
  /** путь относительно корня uploads, например quiz/<uuid>.webp */
  @Column({ type: "varchar" }) path!: string;
  @Column({ type: "varchar" }) originalName!: string;
  @Column({ type: "varchar" }) mime!: string;
  @Column({ type: "int" }) size!: number;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ type: "timestamptz" }) updatedAt!: Date;
}

@Entity("quiz_games")
export class QuizGame {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "varchar" }) title!: string;
  @Column({ type: "text", default: "" }) description!: string;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ type: "timestamptz" }) updatedAt!: Date;
}

@Entity("quiz_rounds")
export class QuizRound {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "uuid" }) gameId!: string;
  @Column({ type: "int", default: 0 }) order!: number;
  @Column({ type: "varchar" }) title!: string;
  @Column({ type: "text", default: "" }) description!: string;
  @Column({ type: "varchar", default: "standard" }) type!: QuizRoundType;
  @Column({ type: "jsonb", default: () => "'{}'" }) settings!: Record<string, unknown>;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ type: "timestamptz" }) updatedAt!: Date;
}

@Entity("quiz_themes")
export class QuizTheme {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "uuid" }) roundId!: string;
  @Column({ type: "int", default: 0 }) order!: number;
  @Column({ type: "varchar" }) title!: string;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ type: "timestamptz" }) updatedAt!: Date;
}

@Entity("quiz_questions")
export class QuizQuestion {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "uuid" }) themeId!: string;
  @Column({ type: "int", default: 0 }) order!: number;
  @Column({ type: "int" }) price!: number;
  @Column({ type: "varchar", default: "standard" }) kind!: string;
  @Column({ type: "jsonb", default: () => "'{}'" }) settings!: Record<string, unknown>;
  /** блоки вопроса: { type: text|image|audio|video, text?, mediaId? }[] */
  @Column({ type: "jsonb", default: () => "'[]'" }) content!: unknown[];
  @Column({ type: "jsonb", default: () => "'[]'" }) answerContent!: unknown[];
  /** заметка ведущему, на экран не идёт */
  @Column({ type: "text", default: "" }) comment!: string;
  @Column({ type: "int", nullable: true }) timeLimitSec!: number | null;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ type: "timestamptz" }) updatedAt!: Date;
}

@Entity("quiz_question_media")
export class QuizQuestionMedia {
  @PrimaryColumn({ type: "uuid" }) questionId!: string;
  @PrimaryColumn({ type: "uuid" }) mediaId!: string;
}

@Entity("quiz_participants")
export class QuizParticipant {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "varchar" }) name!: string;
  @Column({ type: "varchar", default: "#888888" }) color!: string;
  @Column({ type: "uuid", nullable: true }) photoMediaId!: string | null;
  @Column({ type: "int", default: 0 }) defaultStartScore!: number;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ type: "timestamptz" }) updatedAt!: Date;
}

@Entity("quiz_sessions")
export class QuizSession {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "uuid" }) gameId!: string;
  @Column({ type: "varchar", default: "idle" }) status!: QuizSessionStatus;
  @Column({ type: "varchar", nullable: true }) hostName!: string | null;
  @Column({ type: "uuid", nullable: true }) currentRoundId!: string | null;
  @Column({ type: "uuid", nullable: true }) currentQuestionId!: string | null;
  @Column({ type: "uuid", nullable: true }) activeParticipantId!: string | null;
  @Column({ type: "timestamptz", nullable: true }) timerEndsAt!: Date | null;
  /** состояние текущего раунда: финалисты и вычеркнутые темы */
  @Column({ type: "jsonb", default: () => `'{"finalists":null,"eliminatedThemeIds":[]}'` }) roundState!: QuizRoundState;
  @Column({ type: "varchar", unique: true }) screenToken!: string;
  @Column({ type: "int", default: 0 }) version!: number;
  @Column({ type: "timestamptz", nullable: true }) startedAt!: Date | null;
  @Column({ type: "timestamptz", nullable: true }) finishedAt!: Date | null;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ type: "timestamptz" }) updatedAt!: Date;
}

@Entity("quiz_session_participants")
export class QuizSessionParticipant {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "uuid" }) sessionId!: string;
  @Column({ type: "uuid" }) participantId!: string;
  /** слот на экране */
  @Column({ type: "int", default: 0 }) order!: number;
  @Column({ type: "int", default: 0 }) startScore!: number;
}

@Entity("quiz_session_question_state")
export class QuizSessionQuestionState {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "uuid" }) sessionId!: string;
  @Column({ type: "uuid" }) questionId!: string;
  @Column({ type: "jsonb" }) state!: Record<string, any>;
  @UpdateDateColumn({ type: "timestamptz" }) updatedAt!: Date;
}

@Entity("quiz_session_played_questions")
export class QuizSessionPlayedQuestion {
  @PrimaryColumn({ type: "uuid" }) sessionId!: string;
  @PrimaryColumn({ type: "uuid" }) questionId!: string;
}

@Entity("quiz_session_history")
export class QuizSessionHistory {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "uuid" }) sessionId!: string;
  @Column({ type: "int" }) version!: number;
  @Column({ type: "varchar" }) command!: string;
  @Column({ type: "jsonb" }) stateBefore!: Record<string, any>;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
}

@Entity("quiz_score_events")
export class QuizScoreEvent {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "uuid" }) sessionId!: string;
  @Column({ type: "uuid" }) participantId!: string;
  @Column({ type: "varchar" }) kind!: QuizScoreKind;
  @Column({ type: "int" }) delta!: number;
  @Column({ type: "text", nullable: true }) reason!: string | null;
  @Column({ type: "uuid", nullable: true }) questionId!: string | null;
  @Column({ type: "boolean", default: false }) voided!: boolean;
  @Column({ type: "uuid", nullable: true }) createdBy!: string | null;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
}
