// Схемы для OpenAPI (/docs/json): снимок состояния, команды и settings механик.
// Это документация: проверка запросов делает zod/движок, а ответы не сериализуются по этим схемам.

import { KINDS } from "./kinds";
import { ROUND_SETTINGS } from "./rounds";
import { docSchema } from "./validation";

const uuid = { type: "string", format: "uuid" };
const nullable = (s: Record<string, any>) => ({ ...s, nullable: true });

const block = {
  type: "object",
  required: ["type"],
  properties: {
    type: { type: "string", enum: ["text", "image", "audio", "video"] },
    text: { type: "string", description: "обязателен для type=text" },
    mediaId: { ...uuid, description: "обязателен для image/audio/video (id из POST /media)" },
  },
};
const blocks = { type: "array", items: block };

const player = {
  type: "object",
  properties: { id: uuid, name: { type: "string" }, color: { type: "string" }, photo: nullable({ type: "string", description: "URL фото игрока" }), score: { type: "integer" }, order: { type: "integer" } },
};

/** Снимок состояния для screen и host (поля host помечены в описании) */
export const snapshotSchema = {
  $id: "QuizSnapshot",
  title: "QuizSnapshot",
  type: "object",
  description: "Снимок состояния сессии. screen не получает: answerContent и ответ механики до answer_revealed, comment, содержимое ячеек сетки, pointsIfCorrect/pointsIfWrong, canBack, nextRoundAvailable.",
  properties: {
    sessionId: uuid,
    version: { type: "integer" },
    status: { type: "string", enum: ["idle", "intro", "round_intro", "board", "question_shown", "timer_running", "answer_revealed", "finished"] },
    serverTime: { type: "string", format: "date-time" },
    timerEndsAt: nullable({ type: "string", format: "date-time" }),
    hostName: nullable({ type: "string" }),
    round: nullable({
      type: "object",
      properties: {
        id: uuid, title: { type: "string" }, description: { type: "string" }, order: { type: "integer" }, total: { type: "integer" },
        type: { type: "string", enum: ["standard", "final"] }, settings: { type: "object", additionalProperties: true },
      },
    }),
    board: nullable({
      type: "object",
      properties: {
        themes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: uuid, title: { type: "string" }, eliminated: { type: "boolean", description: "только final в режиме elimination" },
              cells: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    questionId: uuid, price: { type: "integer" }, played: { type: "boolean" },
                    question: { type: "object", additionalProperties: true, description: "только host: { kind, content, answerContent, comment }" },
                  },
                },
              },
            },
          },
        },
      },
    }),
    question: nullable({
      type: "object",
      properties: {
        id: uuid, kind: { type: "string" }, price: { type: "integer" }, timeLimitSec: nullable({ type: "integer" }),
        themeId: uuid, themeTitle: { type: "string" },
        phase: { type: "string", enum: ["prepare", "play"] },
        content: { ...blocks, description: "в фазе prepare для screen пусто" },
        view: { type: "object", additionalProperties: true, description: "ответ project() механики: зависит от kind и роли" },
        answerContent: { ...blocks, description: "screen: только при answer_revealed" },
        pointsIfCorrect: { type: "integer", description: "только host" },
        pointsIfWrong: { type: "integer", description: "только host" },
        comment: { type: "string", description: "только host" },
      },
    }),
    finalists: nullable({ type: "array", items: uuid }),
    suggestedFinalists: { type: "array", items: uuid, description: "только host" },
    activeParticipantId: nullable(uuid),
    players: { type: "array", items: player },
    media: { type: "object", additionalProperties: { type: "object", properties: { type: { type: "string" }, url: { type: "string" } } }, description: "mediaId → файл, для всех mediaId в снимке" },
    canBack: { type: "boolean", description: "только host" },
    nextRoundAvailable: { type: "boolean", description: "только host" },
  },
} as const;

// payload команд (кроме тех, что без параметров)
const PAYLOADS: Record<string, Record<string, any>> = {
  open_question: { type: "object", required: ["questionId"], properties: { questionId: uuid } },
  goto_round: { type: "object", required: ["roundId"], properties: { roundId: uuid } },
  set_active: { type: "object", required: ["participantId"], properties: { participantId: nullable(uuid) } },
  select_finalists: { type: "object", required: ["participantIds"], properties: { participantIds: { type: "array", items: uuid } } },
  eliminate_theme: { type: "object", required: ["themeId"], properties: { themeId: uuid } },
  choose_recipient: { type: "object", required: ["participantId"], properties: { participantId: uuid } },
  place_bid: { type: "object", required: ["participantId", "amount"], properties: { participantId: uuid, amount: { type: "integer" } } },
  set_stake: { type: "object", required: ["amount"], properties: { participantId: { ...uuid, description: "обязателен в раунде final" }, amount: { type: "integer", minimum: 1 } } },
  reveal_letter: { type: "object", required: ["letter"], properties: { letter: { type: "string", minLength: 1, maxLength: 1 } } },
};

const COMMANDS: { type: string; description: string }[] = [
  { type: "start", description: "idle → intro" },
  { type: "next_round", description: "intro, board → round_intro. 409 NO_MORE_ROUNDS, если раундов больше нет" },
  { type: "goto_round", description: "intro, round_intro, board → round_intro выбранного раунда (в том числе предыдущего). Сыгранные вопросы остаются сыгранными; финалисты и вычёркнутые темы раунда сбрасываются. next_round после этого продолжает с выбранного раунда" },
  { type: "show_board", description: "round_intro, answer_revealed → board" },
  { type: "open_question", description: "board → question_shown. Вопрос помечается сыгранным; повторно — 409 ALREADY_PLAYED" },
  { type: "start_timer", description: "question_shown (фаза play) → timer_running. 409 NO_TIMER без лимита времени" },
  { type: "reveal_answer", description: "question_shown, timer_running → answer_revealed" },
  { type: "set_active", description: "board, question_shown, timer_running, answer_revealed: активный игрок (participantId или null)" },
  { type: "finish", description: "любой статус, кроме idle → finished" },
  { type: "back", description: "откат последнего изменения по session_history (кроме idle)" },
  { type: "begin_play", description: "question_shown (фаза prepare) → фаза play (cat_in_bag, auction, stake, final)" },
  { type: "reveal_hint", description: "механика hints" },
  { type: "choose_recipient", description: "механика cat_in_bag, фаза prepare" },
  { type: "place_bid", description: "механика auction, фаза prepare" },
  { type: "close_bidding", description: "механика auction, фаза prepare" },
  { type: "set_stake", description: "механики stake и final, фаза prepare" },
  { type: "blitz_next", description: "механика blitz" },
  { type: "blitz_back", description: "механика blitz" },
  { type: "reveal_step", description: "механика reveal_image" },
  { type: "reveal_letter", description: "механика word_guess" },
  { type: "select_finalists", description: "round_intro, board; раунд final" },
  { type: "eliminate_theme", description: "board; раунд final, режим elimination" },
];

/** Команда: тип, payload и защита от двойного клика expectedVersion */
export const commandSchema = {
  $id: "QuizCommand",
  title: "QuizCommand",
  description: "Команда ведущего. Допустимые статусы и фазы — в описании каждой команды; недопустимая → 409 INVALID_TRANSITION.",
  oneOf: COMMANDS.map((c) => ({
    type: "object",
    title: c.type,
    description: c.description,
    required: ["type"],
    properties: {
      type: { type: "string", enum: [c.type] },
      ...(PAYLOADS[c.type] ? { payload: PAYLOADS[c.type] } : {}),
      expectedVersion: { type: "integer", description: "если не совпадает с текущей версией сессии — 409 VERSION_MISMATCH" },
    },
  })),
} as const;

/**
 * Имена общих схем в OpenAPI берутся из $id (QuizSnapshot, QuizCommand) вместо def-0, def-1:
 * по ним фронт генерирует типы. Схемы без $id (в том числе все схемы сайта) называются как раньше.
 */
export const swaggerRefResolver = {
  buildLocalReference(json: { $id?: string; title?: string }, _baseUri: unknown, _fragment: unknown, i: number) {
    if (!json.title && json.$id) json.title = json.$id;
    return json.$id ? String(json.$id) : `def-${i}`;
  },
};

export const COMMAND_TYPES = COMMANDS.map((c) => c.type);

/** Схемы settings всех механик одним списком (для тела вопроса в OpenAPI) */
export const kindSettingsDocs = () =>
  Object.values(KINDS).map((k) => ({ title: k.kind, ...docSchema(k.settingsSchema) }));

export const roundSettingsDocs = () => Object.entries(ROUND_SETTINGS).map(([type, s]) => ({ title: type, ...docSchema(s) }));
