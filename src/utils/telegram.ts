import fs from "fs/promises";
import path from "path";

const BASE_URL = "https://test-standup.ru";
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export type TelegramResult = { sent: boolean; response?: unknown; error?: string };

async function sendTelegram(chatId: string, text: string, photoUrl?: string): Promise<TelegramResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { sent: false, error: "TELEGRAM_BOT_TOKEN not set" };
  if (!chatId) return { sent: false, error: "chatId not set" };

  const api = `https://api.telegram.org/bot${token}`;

  try {
    if (photoUrl) {
      const relativePath = photoUrl.startsWith("/uploads/")
        ? photoUrl.slice("/uploads/".length)
        : photoUrl;
      const filePath = path.join(UPLOAD_DIR, relativePath);

      try {
        const fileBuffer = await fs.readFile(filePath);
        const formData = new FormData();
        formData.append("chat_id", chatId);
        formData.append("caption", text);
        formData.append("photo", new Blob([fileBuffer], { type: "image/webp" }), path.basename(filePath));

        const res = await fetch(`${api}/sendPhoto`, { method: "POST", body: formData });
        const json = await res.json();
        if (res.ok) return { sent: true, response: json };
        return sendTelegram(chatId, text);
      } catch {
        return sendTelegram(chatId, text);
      }
    }

    const res = await fetch(`${api}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
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

function fmtDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${d}.${m}`;
}

async function readFileBuffer(filePath: string): Promise<Buffer | null> {
  try {
    const relativePath = filePath.startsWith("/uploads/") ? filePath.slice("/uploads/".length) : filePath;
    return await fs.readFile(path.join(UPLOAD_DIR, relativePath));
  } catch {
    return null;
  }
}

async function sendDocument(chatId: string, buffer: Buffer, filename: string, caption?: string): Promise<{ ok: boolean; result?: { message_id: number } }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const api = `https://api.telegram.org/bot${token}`;
  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("document", new Blob([new Uint8Array(buffer)], { type: "application/octet-stream" }), filename);
  formData.append("disable_content_type_detection", "true");
  if (caption) formData.append("caption", caption);
  const res = await fetch(`${api}/sendDocument`, { method: "POST", body: formData });
  return res.json() as Promise<{ ok: boolean; result?: { message_id: number } }>;
}

async function sendMediaGroup(
  chatId: string,
  files: { buffer: Buffer; filename: string; caption?: string }[]
): Promise<{ ok: boolean; result?: { message_id: number }[] }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const api = `https://api.telegram.org/bot${token}`;
  const formData = new FormData();
  formData.append("chat_id", chatId);

  const media = files.map((file, i) => ({
    type: "document",
    media: `attach://file${i}`,
    disable_content_type_detection: true,
    ...(file.caption ? { caption: file.caption } : {}),
  }));

  formData.append("media", JSON.stringify(media));
  files.forEach((file, i) => {
    formData.append(`file${i}`, new Blob([new Uint8Array(file.buffer)], { type: "application/octet-stream" }), file.filename);
  });

  const res = await fetch(`${api}/sendMediaGroup`, { method: "POST", body: formData });
  return res.json() as Promise<{ ok: boolean; description?: string; result?: { message_id: number; chat?: unknown }[] }>;
}

async function editDocument(chatId: string, messageId: string, buffer: Buffer, filename: string, caption: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const api = `https://api.telegram.org/bot${token}`;
  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("message_id", messageId);
  formData.append("media", JSON.stringify({ type: "document", media: "attach://file", caption }));
  formData.append("file", new Blob([new Uint8Array(buffer)], { type: "image/webp" }), filename);
  await fetch(`${api}/editMessageMedia`, { method: "POST", body: formData });
}

export async function sendInternalEvent(event: {
  id: number; title: string; date: string; time: string;
  photo: string; photoStories?: string; link: string;
}): Promise<{ msgId?: string; error?: string }> {
  const chatId = process.env.INTERNAL_CHANNEL_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) return { error: "INTERNAL_CHANNEL_ID or TELEGRAM_BOT_TOKEN not set" };

  const caption = `${fmtDate(event.date)} ${event.time.slice(0, 5)}\n${event.title}\n${event.link}`;

  try {
    const postBuf = await readFileBuffer(event.photo);
    if (!postBuf) return { error: "photo file not found" };

    const postFilename = `${event.date}_${event.title}_пост.webp`;
    const files: { buffer: Buffer; filename: string; caption?: string }[] = [
      { buffer: postBuf, filename: postFilename, caption },
    ];

    if (event.photoStories) {
      const storiesBuf = await readFileBuffer(event.photoStories);
      if (storiesBuf) {
        files.push({ buffer: storiesBuf, filename: `${event.date}_${event.title}_сториз.webp` });
      }
    }

    if (files.length > 1) {
      const sent = await sendMediaGroup(chatId, files);
      if (!sent.ok || !sent.result?.[0]) return { error: JSON.stringify(sent) };
      return { msgId: String(sent.result[0].message_id) };
    }

    const sent = await sendDocument(chatId, postBuf, postFilename, caption) as any;
    if (!sent.ok) return { error: sent.description ?? "failed to send post document" };
    return { msgId: String(sent.result!.message_id) };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function updateInternalEvent(event: {
  title: string; date: string; time: string;
  photo: string; photoStories?: string; internalMsgId: string; link: string;
}): Promise<void> {
  const chatId = process.env.INTERNAL_CHANNEL_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) return;

  const caption = `${fmtDate(event.date)} ${event.time.slice(0, 5)}\n${event.title}\n${event.link}\n\n📝 обновлена фотка`;

  try {
    const postBuf = await readFileBuffer(event.photo);
    if (!postBuf) return;
    const postFilename = `${event.date}_${event.title}_пост.webp`;
    await editDocument(chatId, event.internalMsgId, postBuf, postFilename, caption);
  } catch { /* silent */ }
}

export async function sendInternalTour(tour: {
  id: number; title: string; photo: string; photoStories?: string;
}, shows: { date: string; time: string; city: string; venue: string; link: string }[]): Promise<{ msgId?: string; error?: string }> {
  const chatId = process.env.INTERNAL_CHANNEL_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) return { error: "INTERNAL_CHANNEL_ID or TELEGRAM_BOT_TOKEN not set" };

  const showLines = shows
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => `${fmtDate(s.date)} ${s.time.slice(0, 5)}\n${s.city}\n${s.link}`)
    .join("\n\n");

  const caption = [`${tour.title}`, ``, showLines].join("\n");

  try {
    const postBuf = await readFileBuffer(tour.photo);
    if (!postBuf) return { error: "photo file not found" };

    const postFilename = `${tour.title}_пост.webp`;
    const files: { buffer: Buffer; filename: string; caption?: string }[] = [
      { buffer: postBuf, filename: postFilename, caption },
    ];

    if (tour.photoStories) {
      const storiesBuf = await readFileBuffer(tour.photoStories);
      if (storiesBuf) {
        files.push({ buffer: storiesBuf, filename: `${tour.title}_сториз.webp` });
      }
    }

    if (files.length > 1) {
      const sent = await sendMediaGroup(chatId, files);
      if (!sent.ok || !sent.result?.[0]) return { error: "failed to send media group" };
      return { msgId: String(sent.result[0].message_id) };
    }

    const sent = await sendDocument(chatId, postBuf, postFilename, caption);
    if (!sent.ok) return { error: "failed to send post document" };
    return { msgId: String(sent.result!.message_id) };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function updateInternalTour(tour: {
  title: string; photo: string; photoStories?: string; internalMsgId: string;
}, shows: { date: string; time: string; city: string; venue: string; link: string }[]): Promise<void> {
  const chatId = process.env.INTERNAL_CHANNEL_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) return;

  const showLines = shows
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => `${fmtDate(s.date)} ${s.time.slice(0, 5)}\n${s.city}\n${s.link}`)
    .join("\n\n");

  const caption = [`${tour.title}`, ``, showLines, ``, `📝 обновлена фотка`].join("\n");

  try {
    const postBuf = await readFileBuffer(tour.photo);
    if (!postBuf) return;
    const postFilename = `${tour.title}_пост.webp`;
    await editDocument(chatId, tour.internalMsgId, postBuf, postFilename, caption);
  } catch { /* silent */ }
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
