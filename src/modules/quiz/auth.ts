import { FastifyInstance, FastifyRequest } from "fastify";
import fastifyJwt from "@fastify/jwt";
import bcrypt from "bcryptjs";
import { AppDataSource } from "../../db/data-source";
import { QuizRole, QuizUser } from "../../db/entities/quiz/quiz.entity";
import {
  ApiError,
  AuthedQuizUser,
  QUIZ_TOKEN_TTL,
  bearerAuth,
  idParams,
  quizJwtSecret,
  validationError,
} from "./common";

type QuizJwtPayload = { uid: string; role: QuizRole };

export interface QuizAuth {
  sign(user: Pick<QuizUser, "id" | "role">): string;
  /** Проверяет токен и возвращает актуального пользователя из БД, либо null */
  authenticate(token: string | undefined | null): Promise<AuthedQuizUser | null>;
  /** preHandler: доступ только для перечисленных ролей */
  guard(roles: QuizRole[]): (request: FastifyRequest) => Promise<void>;
}

/**
 * Отдельный @fastify/jwt с namespace "quiz" и собственным секретом.
 * Регистрируется внутри плагина квиза (инкапсулированно) и не влияет на авторизацию сайта.
 */
export async function setupQuizAuth(app: FastifyInstance): Promise<QuizAuth> {
  await app.register(fastifyJwt, {
    secret: quizJwtSecret,
    namespace: "quiz",
    decoratorName: "quizUserPayload",
    jwtVerify: "quizJwtVerify",
    jwtSign: "quizJwtSign",
    sign: { expiresIn: QUIZ_TOKEN_TTL },
  });
  app.decorateRequest("quizAuth", null);

  const quizJwt = (app as any).jwt.quiz as {
    sign(payload: QuizJwtPayload): string;
    verify(token: string): QuizJwtPayload;
  };

  const authenticate: QuizAuth["authenticate"] = async (token) => {
    if (!token) return null;
    let payload: QuizJwtPayload;
    try {
      payload = quizJwt.verify(token);
    } catch {
      return null;
    }
    if (!payload?.uid) return null;
    const user = await AppDataSource.getRepository(QuizUser).findOneBy({ id: payload.uid });
    if (!user) return null;
    return { id: user.id, login: user.login, role: user.role };
  };

  return {
    sign: (user) => quizJwt.sign({ uid: user.id, role: user.role }),
    authenticate,
    guard: (roles) => async (request) => {
      const header = request.headers.authorization;
      const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
      const user = await authenticate(token);
      if (!user) throw new ApiError(401, "UNAUTHORIZED", "Требуется авторизация");
      if (!roles.includes(user.role)) throw new ApiError(403, "FORBIDDEN", "Недостаточно прав");
      request.quizAuth = user;
    },
  };
}

const publicUser = (u: QuizUser) => ({ id: u.id, login: u.login, role: u.role, createdAt: u.createdAt });

export async function quizAuthRoutes(app: FastifyInstance, auth: QuizAuth) {
  const users = () => AppDataSource.getRepository(QuizUser);
  const adminOnly = auth.guard(["admin"]);

  app.post("/auth/login", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    schema: {
      tags: ["Quiz Auth"],
      summary: "Войти (admin или host). Возвращает Bearer-токен на 12 часов",
      body: {
        type: "object",
        required: ["login", "password"],
        properties: { login: { type: "string", minLength: 1 }, password: { type: "string", minLength: 1 } },
      },
    },
  }, async (request) => {
    const { login, password } = request.body as { login: string; password: string };
    const user = await users().findOneBy({ login });
    const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !valid) throw new ApiError(401, "INVALID_CREDENTIALS", "Неверный логин или пароль");
    return { token: auth.sign(user), user: publicUser(user) };
  });

  app.get("/auth/me", {
    schema: { tags: ["Quiz Auth"], summary: "Текущий пользователь", ...bearerAuth },
    preHandler: auth.guard(["admin", "host"]),
  }, async (request) => request.quizAuth);

  // ── управление пользователями квиза (admin): создать ведущего и т.п. ──

  app.get("/users", {
    schema: { tags: ["Quiz Auth"], summary: "Список пользователей квиза (admin)", ...bearerAuth },
    preHandler: adminOnly,
  }, async () => {
    const items = await users().find({ order: { createdAt: "ASC" } });
    return { items: items.map(publicUser), total: items.length };
  });

  app.post("/users", {
    schema: {
      tags: ["Quiz Auth"],
      summary: "Создать пользователя квиза (admin)",
      ...bearerAuth,
      body: {
        type: "object",
        required: ["login", "password", "role"],
        properties: {
          login: { type: "string", minLength: 3, maxLength: 64 },
          password: { type: "string", minLength: 8, maxLength: 128 },
          role: { type: "string", enum: ["admin", "host"] },
        },
      },
    },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { login, password, role } = request.body as { login: string; password: string; role: QuizRole };
    if (await users().findOneBy({ login })) throw new ApiError(409, "LOGIN_TAKEN", "Такой логин уже занят");
    const user = await users().save(
      users().create({ login, role, passwordHash: await bcrypt.hash(password, 10) }),
    );
    return reply.status(201).send(publicUser(user));
  });

  app.patch("/users/:id", {
    schema: {
      tags: ["Quiz Auth"],
      summary: "Сменить пароль или роль (admin)",
      ...bearerAuth,
      params: idParams,
      body: {
        type: "object",
        properties: {
          password: { type: "string", minLength: 8, maxLength: 128 },
          role: { type: "string", enum: ["admin", "host"] },
        },
      },
    },
    preHandler: adminOnly,
  }, async (request) => {
    const { id } = request.params as { id: string };
    const { password, role } = request.body as { password?: string; role?: QuizRole };
    const user = await users().findOneBy({ id });
    if (!user) throw new ApiError(404, "NOT_FOUND", "Пользователь не найден");
    if (role && role !== user.role && request.quizAuth!.id === user.id) {
      throw validationError("Нельзя менять собственную роль");
    }
    if (password) user.passwordHash = await bcrypt.hash(password, 10);
    if (role) user.role = role;
    return publicUser(await users().save(user));
  });

  app.delete("/users/:id", {
    schema: { tags: ["Quiz Auth"], summary: "Удалить пользователя (admin)", ...bearerAuth, params: idParams },
    preHandler: adminOnly,
  }, async (request) => {
    const { id } = request.params as { id: string };
    if (request.quizAuth!.id === id) throw validationError("Нельзя удалить самого себя");
    const res = await users().delete({ id });
    if (!res.affected) throw new ApiError(404, "NOT_FOUND", "Пользователь не найден");
    return { ok: true };
  });
}
