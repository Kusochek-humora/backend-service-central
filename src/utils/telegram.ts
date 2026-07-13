import fs from "fs/promises";
import https from "https";
import path from "path";
import sharp from "sharp";

const BASE_URL = "https://test-standup.ru";
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export type TelegramResult = { sent: boolean; msgId?: string; response?: unknown; error?: string };

async function sendTelegram(chatId: string, text: string, photoUrl?: string, parseMode?: string): Promise<TelegramResult> {
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
        if (parseMode) formData.append("parse_mode", parseMode);
        formData.append("photo", new Blob([fileBuffer], { type: "image/webp" }), path.basename(filePath));

        const res = await fetch(`${api}/sendPhoto`, { method: "POST", body: formData });
        const json = await res.json() as any;
        if (res.ok) return { sent: true, msgId: String(json.result?.message_id), response: json };
        return sendTelegram(chatId, text, undefined, parseMode);
      } catch {
        return sendTelegram(chatId, text, undefined, parseMode);
      }
    }

    const res = await fetch(`${api}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, ...(parseMode && { parse_mode: parseMode }) }),
    });
    const json = await res.json() as any;
    return { sent: res.ok, msgId: res.ok ? String(json.result?.message_id) : undefined, response: json };
  } catch (e) {
    return { sent: false, error: String(e) };
  }
}

export async function notifyEventCreated(event: {
  id: number; title: string; comedians?: string; description?: string;
  date: string; time: string; photo: string; link?: string; yandexSessionId?: string;
}): Promise<TelegramResult> {
  const chatId = process.env.TELEGRAM_CHAT_NEWS;
  if (!chatId) return { sent: false, error: "TELEGRAM_CHAT_NEWS not set" };

  const ticketLine = event.link
    ? `<a href="${event.link}">Билеты</a>`
    : event.yandexSessionId
      ? `<a href="${process.env.PUBLIC_SITE_URL}/afisha/${event.id}">Билеты</a>`
      : null;

  const lines = [
    `🎤 ${event.title}\n📅 ${fmtDate(event.date)}, ${event.time.slice(0, 5)}`,
    event.comedians ? `Состав:\n${event.comedians}` : null,
    event.description ?? null,
    ticketLine,
    `#мероприятие`,
  ].filter((l) => l !== null).join("\n\n");

  return sendTelegram(chatId, lines, event.photo, "HTML");
}

export async function notifyBlogCreated(post: {
  id: number; title_ru: string;
  excerpt_ru?: string; excerpt_kz?: string;
  photo: string; videoUrl?: string;
}): Promise<TelegramResult> {
  const chatId = process.env.TELEGRAM_CHAT_NEWS;
  if (!chatId) return { sent: false, error: "TELEGRAM_CHAT_NEWS not set" };

  const isVideo = !!post.videoUrl;

  const link = isVideo
    ? `▶️ <a href="${post.videoUrl}">смотреть</a>`
    : `<a href="${BASE_URL}/blog/${post.id}">читать</a>`;

  const lines = [
    isVideo ? `🎬 ${post.title_ru}` : post.title_ru,
    ``,
    post.excerpt_kz ?? null,
    ``,
    post.excerpt_ru ?? null,
    ``,
    link,
    ``,
    `#news`,
  ].filter((l) => l !== null).join("\n");

  return sendTelegram(chatId, lines, post.photo, "HTML");
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
  post: { buffer: Buffer; filename: string; caption: string },
  stories: { buffer: Buffer; filename: string },
): Promise<{ ok: boolean; description?: string; result?: { message_id: number }[] }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  const [storiesJpg, postJpg] = await Promise.all([
    sharp(stories.buffer).jpeg({ quality: 85 }).toBuffer(),
    sharp(post.buffer).jpeg({ quality: 85 }).toBuffer(),
  ]);

  const boundary = `----TGBoundary${Date.now()}`;
  const mediaJson = JSON.stringify([
    { type: "document", media: "attach://file0" },
    { type: "document", media: "attach://file1", caption: post.caption },
  ]);

  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="media"\r\n\r\n${mediaJson}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file0"; filename="stories.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    storiesJpg,
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="file1"; filename="post.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    postJpg,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  return new Promise((resolve) => {
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${token}/sendMediaGroup`,
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": body.length,
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch { resolve({ ok: false, description: "failed to parse response" }); }
      });
    });
    req.on("error", (e) => resolve({ ok: false, description: String(e) }));
    req.write(body);
    req.end();
  });
}

export async function deleteMessage(chatId: string, messageId: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const api = `https://api.telegram.org/bot${token}`;
  await fetch(`${api}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: Number(messageId) }),
  }).catch(() => {});
}

export async function sendInternalEvent(event: {
  id: number; title: string; date: string; time: string;
  photo: string; photoStories?: string; link?: string; yandexSessionId?: string;
}): Promise<{ msgId?: string; error?: string }> {
  const chatId = process.env.INTERNAL_CHANNEL_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) return { error: "INTERNAL_CHANNEL_ID or TELEGRAM_BOT_TOKEN not set" };

  const ticketUrl = event.link
    ? event.link
    : event.yandexSessionId
      ? `${process.env.PUBLIC_SITE_URL}/afisha/${event.id}`
      : null;
  const caption = `${fmtDate(event.date)} ${event.time.slice(0, 5)}\n${event.title}${ticketUrl ? `\n${ticketUrl}` : ""}`;

  try {
    const postBuf = await readFileBuffer(event.photo);
    if (!postBuf) return { error: "photo file not found" };

    const postFilename = `${event.date}_${event.title}_пост.jpg`;

    if (event.photoStories) {
      const storiesBuf = await readFileBuffer(event.photoStories);
      if (storiesBuf) {
        const sent = await sendMediaGroup(
          chatId,
          { buffer: postBuf, filename: postFilename, caption },
          { buffer: storiesBuf, filename: `${event.date}_${event.title}_сториз.jpg` },
        );
        if (!sent.ok || !sent.result?.[0]) return { error: sent.description ?? "failed to send media group" };
        return { msgId: String(sent.result[0].message_id) };
      }
    }

    const sent = await sendDocument(chatId, postBuf, postFilename, caption) as any;
    if (!sent.ok) return { error: sent.description ?? "failed to send post document" };
    return { msgId: String(sent.result!.message_id) };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function updateInternalEvent(event: {
  id: number; title: string; date: string; time: string;
  photo: string; photoStories?: string; internalMsgId: string; link?: string; yandexSessionId?: string;
}): Promise<{ msgId?: string }> {
  const chatId = process.env.INTERNAL_CHANNEL_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) return {};

  await deleteMessage(chatId, event.internalMsgId);
  await deleteMessage(chatId, String(Number(event.internalMsgId) + 1));

  return sendInternalEvent(event);
}

export async function sendInternalShow(
  tour: { title: string },
  show: { date: string; time: string; city: string; link: string; photo?: string; photoStories?: string },
): Promise<{ msgId?: string; error?: string }> {
  const chatId = process.env.INTERNAL_CHANNEL_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) return { error: "INTERNAL_CHANNEL_ID or TELEGRAM_BOT_TOKEN not set" };

  const caption = `${tour.title}\n${fmtDate(show.date)} ${show.time.slice(0, 5)}\n${show.city}\n${show.link}`;

  try {
    if (!show.photo) return { error: "show photo not set" };
    const postBuf = await readFileBuffer(show.photo);
    if (!postBuf) return { error: "photo file not found" };

    const postFilename = `${show.date}_${tour.title}_пост.jpg`;

    if (show.photoStories) {
      const storiesBuf = await readFileBuffer(show.photoStories);
      if (storiesBuf) {
        const sent = await sendMediaGroup(
          chatId,
          { buffer: postBuf, filename: postFilename, caption },
          { buffer: storiesBuf, filename: `${show.date}_${tour.title}_сториз.jpg` },
        );
        if (!sent.ok || !sent.result?.[0]) return { error: sent.description ?? "failed to send media group" };
        return { msgId: String(sent.result[0].message_id) };
      }
    }

    const sent = await sendDocument(chatId, postBuf, postFilename, caption) as any;
    if (!sent.ok) return { error: sent.description ?? "failed to send post document" };
    return { msgId: String(sent.result!.message_id) };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function updateInternalShow(
  tour: { title: string },
  show: { date: string; time: string; city: string; link: string; photo?: string; photoStories?: string; internalMsgId: string },
): Promise<{ msgId?: string }> {
  const chatId = process.env.INTERNAL_CHANNEL_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) return {};

  await deleteMessage(chatId, show.internalMsgId);
  await deleteMessage(chatId, String(Number(show.internalMsgId) + 1));

  return sendInternalShow(tour, show);
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

    const postFilename = `${tour.title}_пост.jpg`;
    if (tour.photoStories) {
      const storiesBuf = await readFileBuffer(tour.photoStories);
      if (storiesBuf) {
        const sent = await sendMediaGroup(
          chatId,
          { buffer: postBuf, filename: postFilename, caption },
          { buffer: storiesBuf, filename: `${tour.title}_сториз.jpg` },
        );
        if (!sent.ok || !sent.result?.[0]) return { error: sent.description ?? "failed to send media group" };
        return { msgId: String(sent.result[0].message_id) };
      }
    }

    const sent = await sendDocument(chatId, postBuf, postFilename, caption) as any;
    if (!sent.ok) return { error: sent.description ?? "failed to send post document" };
    return { msgId: String(sent.result!.message_id) };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function updateInternalTour(tour: {
  id: number; title: string; photo: string; photoStories?: string; internalMsgId: string;
}, shows: { date: string; time: string; city: string; venue: string; link: string }[]): Promise<{ msgId?: string }> {
  const chatId = process.env.INTERNAL_CHANNEL_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) return {};

  await deleteMessage(chatId, tour.internalMsgId);
  await deleteMessage(chatId, String(Number(tour.internalMsgId) + 1));

  return sendInternalTour(tour, shows);
}

export async function notifyAlemEventCreated(event: {
  id: number; title: string; date: string; time: string;
  photo: string; link?: string; yandexSessionId?: string;
}): Promise<TelegramResult> {
  const chatId = process.env.TELEGRAM_CHAT_NEWS;
  if (!chatId) return { sent: false, error: "TELEGRAM_CHAT_NEWS not set" };

  const ticketUrl = event.link
    ? event.link
    : event.yandexSessionId
      ? `https://alemfest.kz/events/${event.id}`
      : null;

  const lines = [
    `🎤 ${event.title}\n📅 ${fmtDate(event.date)}, ${event.time.slice(0, 5)}`,
    ticketUrl ? `<a href="${ticketUrl}">Билеты</a>` : null,
    `#alem #alemfest2026`,
  ].filter((l) => l !== null).join("\n\n");

  return sendTelegram(chatId, lines, event.photo, "HTML");
}

export async function sendAlemEvent(event: {
  id: number; title: string; date: string; time: string;
  photo: string; photoStories?: string; link?: string; yandexSessionId?: string; moreinfolink?: string;
}): Promise<{ msgId?: string; error?: string }> {
  const chatId = process.env.TELEGRAM_ALEM;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) return { error: "TELEGRAM_ALEM or TELEGRAM_BOT_TOKEN not set" };

  const lines: string[] = [
    `${fmtDate(event.date)} ${event.time.slice(0, 5)} ${event.title}`,
  ];
  if (event.link) lines.push(`Ссылка на виджет:\n${event.link}`);
  if (event.yandexSessionId) lines.push(`Alemfest:\nhttps://alemfest.kz/events/${event.id}`);
  if (event.moreinfolink) lines.push(`Афиша:\n${event.moreinfolink}`);

  const caption = lines.join("\n\n");

  try {
    const postBuf = await readFileBuffer(event.photo);
    if (!postBuf) return { error: "photo file not found" };

    const postFilename = `${event.date}_${event.title}_пост.jpg`;

    if (event.photoStories) {
      const storiesBuf = await readFileBuffer(event.photoStories);
      if (storiesBuf) {
        const sent = await sendMediaGroup(
          chatId,
          { buffer: postBuf, filename: postFilename, caption },
          { buffer: storiesBuf, filename: `${event.date}_${event.title}_сториз.jpg` },
        );
        if (!sent.ok || !sent.result?.[0]) return { error: sent.description ?? "failed to send media group" };
        return { msgId: String(sent.result[0].message_id) };
      }
    }

    const sent = await sendDocument(chatId, postBuf, postFilename, caption) as any;
    if (!sent.ok) return { error: sent.description ?? "failed to send post document" };
    return { msgId: String(sent.result!.message_id) };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function notifyVacancyApply(data: {
  vacancyTitle: string;
  name: string;
  phone: string;
  telegram?: string;
  message?: string;
  resumeBuffer?: Buffer;
  resumeFilename?: string;
}): Promise<TelegramResult> {
  const chatId = process.env.TELEGRAM_CHAT_VACANCIES;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) return { sent: false, error: "TELEGRAM_CHAT_VACANCIES not set" };

  const lines = [
    `💼 Новый отклик на вакансию`,
    ``,
    `Вакансия: ${data.vacancyTitle}`,
    `Имя: ${data.name}`,
    `Телефон: ${data.phone}`,
    data.telegram ? `Telegram: ${data.telegram}` : null,
    data.message ? `Сообщение: ${data.message}` : null,
  ].filter((l) => l !== null).join("\n");

  const api = `https://api.telegram.org/bot${token}`;

  try {
    if (data.resumeBuffer && data.resumeFilename) {
      const formData = new FormData();
      formData.append("chat_id", chatId);
      formData.append("caption", lines);
      formData.append("document", new Blob([new Uint8Array(data.resumeBuffer)], { type: "application/pdf" }), data.resumeFilename);
      const res = await fetch(`${api}/sendDocument`, { method: "POST", body: formData });
      const json = await res.json();
      return { sent: res.ok, response: json };
    }

    const res = await fetch(`${api}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: lines }),
    });
    const json = await res.json();
    return { sent: res.ok, response: json };
  } catch (e) {
    return { sent: false, error: String(e) };
  }
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
