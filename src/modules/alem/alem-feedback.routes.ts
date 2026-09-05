import { FastifyInstance } from "fastify";

export async function alemFeedbackRoutes(app: FastifyInstance) {
  app.post("/alem/feedback", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    schema: {
      tags: ["Alem Public"],
      summary: "Обратная связь с alemfest",
      body: {
        type: "object",
        required: ["message"],
        properties: {
          message:       { type: "string", minLength: 1, maxLength: 1000 },
          name:          { type: "string", maxLength: 100 },
          contactType:   { type: "string", enum: ["telegram", "whatsapp", "email"] },
          contactValue:  { type: "string", maxLength: 200 },
        },
      },
      response: {
        200: { type: "object", properties: { ok: { type: "boolean" } } },
        400: { type: "object", properties: { message: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const { message, name, contactType, contactValue } = request.body as {
      message: string;
      name?: string;
      contactType?: string;
      contactValue?: string;
    };

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_VACANCIES;

    if (!token || !chatId) return reply.status(200).send({ ok: true });

    const contactLabel: Record<string, string> = {
      telegram: "Telegram",
      whatsapp: "WhatsApp",
      email: "Email",
    };

    const lines = [
      `📩 <b>Обратная связь Alem</b>`,
      name ? `\n👤 <b>Имя:</b> ${name}` : "",
      contactType && contactValue
        ? `📬 <b>${contactLabel[contactType] ?? contactType}:</b> ${contactValue}`
        : "",
      `\n💬 ${message}`,
    ].filter(Boolean).join("\n");

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: lines, parse_mode: "HTML" }),
    }).catch(() => {});

    return { ok: true };
  });
}
