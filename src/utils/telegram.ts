const BASE_URL = "https://test-standup.ru";

export type TelegramResult = { sent: boolean; response?: unknown; error?: string };

async function sendTelegram(chatId: string, text: string, photoUrl?: string): Promise<TelegramResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { sent: false, error: "TELEGRAM_BOT_TOKEN not set" };
  if (!chatId) return { sent: false, error: "chatId not set" };

  const api = `https://api.telegram.org/bot${token}`;

  try {
    let res: Response;
    if (photoUrl) {
      const fullPhotoUrl = photoUrl.startsWith("http") ? photoUrl : `${BASE_URL}${photoUrl}`;
      res = await fetch(`${api}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, photo: fullPhotoUrl, caption: text }),
      });
    } else {
      res = await fetch(`${api}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
    }
    const json = await res.json();
    return { sent: res.ok, response: json };
  } catch (e) {
    return { sent: false, error: String(e) };
  }
}

export async function notifyEventCreated(event: {
  id: number; title: string; comedians?: string;
  date: string; time: string; photo: string;
}): Promise<TelegramResult> {
  const chatId = process.env.TELEGRAM_CHAT_NEWS;
  if (!chatId) return { sent: false, error: "TELEGRAM_CHAT_NEWS not set" };

  const lines = [
    `🎭 Новое мероприятие!`,
    ``,
    event.title,
    event.comedians ? `👤 ${event.comedians}` : null,
    `📅 ${event.date}, ${event.time.slice(0, 5)}`,
    ``,
    `${BASE_URL}/events/${event.id}`,
  ].filter((l) => l !== null).join("\n");

  return sendTelegram(chatId, lines, event.photo);
}

export async function notifyBlogCreated(post: {
  id: number; title_ru: string; excerpt_ru?: string;
  photo: string; videoUrl?: string;
}): Promise<TelegramResult> {
  const chatId = process.env.TELEGRAM_CHAT_NEWS;
  if (!chatId) return { sent: false, error: "TELEGRAM_CHAT_NEWS not set" };

  const lines = [
    `📰 Новая новость!`,
    ``,
    post.title_ru,
    post.excerpt_ru ? post.excerpt_ru : null,
    post.videoUrl ? `\n▶️ ${post.videoUrl}` : null,
    ``,
    `${BASE_URL}/blog/${post.id}`,
  ].filter((l) => l !== null).join("\n");

  return sendTelegram(chatId, lines, post.photo);
}

export async function notifyMerchOrder(order: {
  id: number; name: string; phone: string;
  socialLink?: string; comment?: string;
  items: { name: string; size?: string; quantity: number; price: number }[];
  totalPrice: number;
}): Promise<TelegramResult> {
  const chatId = process.env.TELEGRAM_CHAT_MERCH;
  if (!chatId) return { sent: false, error: "TELEGRAM_CHAT_MERCH not set" };

  const itemLines = order.items
    .map((i) => `— ${i.name}${i.size ? `, размер ${i.size}` : ""}, ${i.quantity} шт. — ${i.price} ₸`)
    .join("\n");

  const lines = [
    `🛍 Новый заказ #${order.id}`,
    ``,
    `Имя: ${order.name}`,
    `Телефон: ${order.phone}`,
    order.socialLink ? `Соцсеть: ${order.socialLink}` : null,
    order.comment ? `Комментарий: ${order.comment}` : null,
    ``,
    `Товары:`,
    itemLines,
    ``,
    `Итого: ${order.totalPrice} ₸`,
  ].filter((l) => l !== null).join("\n");

  return sendTelegram(chatId, lines);
}
