import { MigrationInterface, QueryRunner } from "typeorm";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

/**
 * Первый администратор квиза. Пароль в репозитории не хранится:
 *   QUIZ_ADMIN_LOGIN     логин (по умолчанию "admin")
 *   QUIZ_ADMIN_PASSWORD  пароль, минимум 8 символов
 * Если пароль не задан (или слишком короткий), миграция генерирует случайный и ОДИН РАЗ печатает его в лог.
 * Если пользователь с таким логином уже есть, ничего не делает. down() пользователей не удаляет.
 */
export class CreateQuizAdmin1785500000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    const login = (process.env.QUIZ_ADMIN_LOGIN || "admin").trim();

    const existing = await q.query(`SELECT 1 FROM "quiz_users" WHERE "login" = $1`, [login]);
    if (existing.length > 0) {
      console.log(`[quiz] админ "${login}" уже существует, пропускаю`);
      return;
    }

    let password = process.env.QUIZ_ADMIN_PASSWORD || "";
    let generated = false;
    if (password.length < 8) {
      if (password) console.warn("[quiz] QUIZ_ADMIN_PASSWORD короче 8 символов, генерирую случайный пароль");
      password = randomBytes(12).toString("base64url");
      generated = true;
    }

    await q.query(`INSERT INTO "quiz_users" ("login", "passwordHash", "role") VALUES ($1, $2, 'admin')`, [
      login,
      await bcrypt.hash(password, 10),
    ]);

    if (generated) {
      console.log(`[quiz] создан админ квиза. login: ${login}  password: ${password}  (показан один раз, смените через PATCH /api/users/:id)`);
    } else {
      console.log(`[quiz] создан админ квиза "${login}"`);
    }
  }

  public async down(): Promise<void> {
    // пользователей не удаляем
  }
}
