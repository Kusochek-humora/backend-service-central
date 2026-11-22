import { z, ZodType } from "zod";
import { validationError } from "./common";

/** Разбор тела запроса через zod: ошибки идут в 422 VALIDATION_ERROR с путями полей */
export function parseWith<T>(schema: ZodType<T>, data: unknown, prefix = ""): T {
  const r = schema.safeParse(data ?? {});
  if (!r.success) {
    throw validationError("Ошибка валидации", r.error.issues.map((i) => ({
      path: [prefix, ...i.path.map(String)].filter(Boolean).join("."),
      message: i.message,
    })));
  }
  return r.data;
}

/** JSON-схема из zod для OpenAPI (без служебного $schema); при невозможности — свободный объект */
export function docSchema(schema: ZodType, io: "input" | "output" = "input"): Record<string, any> {
  try {
    const { $schema, ...rest } = z.toJSONSchema(schema, { target: "openapi-3.0", io, unrepresentable: "any" }) as Record<string, any>;
    return rest;
  } catch {
    return { type: "object", additionalProperties: true };
  }
}

/** Для роутов, где тело разбирает zod в обработчике: Ajv Fastify его не проверяет, а схема остаётся в OpenAPI */
export const skipAjv = { validatorCompiler: () => (data: unknown) => ({ value: data }) } as const;
