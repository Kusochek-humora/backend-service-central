import { config } from "dotenv";

config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env variable: ${key}`);
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const env = {
  port:    Number(optional("PORT", "3000")),
  host:    optional("HOST", "0.0.0.0"),
  nodeEnv: optional("NODE_ENV", "development"),
  db: {
    host:     optional("DB_HOST", "localhost"),
    port:     Number(optional("DB_PORT", "5432")),
    user:     required("DB_USER"),
    password: required("DB_PASSWORD"),
    name:     required("DB_NAME"),
  },
  jwtSecret: required("JWT_SECRET"),
  redisUrl: optional("REDIS_URL", ""),
  metrika: {
    token: optional("YANDEX_METRIKA_TOKEN", ""),
    counterId: optional("YANDEX_METRIKA_ID", ""),
  },
  telegram: {
    botToken:        optional("TELEGRAM_BOT_TOKEN", ""),
    chatId:          optional("TELEGRAM_CHAT_ID", ""),
    internalChatId:  optional("INTERNAL_CHANNEL_ID", ""),
    alemChatId:      optional("TELEGRAM_ALEM", ""),
  },
};
