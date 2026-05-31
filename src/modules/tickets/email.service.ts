import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendTicketsEmail(params: {
  to: string;
  customerName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  tickets: { qrToken: string; seatId: number; price: number }[];
}) {
  const { to, customerName, eventTitle, eventDate, eventTime, tickets } = params;

  const ticketRows = tickets
    .map(
      (t) => `
      <tr>
        <td style="padding:8px;border:1px solid #eee">Место #${t.seatId}</td>
        <td style="padding:8px;border:1px solid #eee">${t.price} ₽</td>
        <td style="padding:8px;border:1px solid #eee;font-family:monospace;font-size:12px">${t.qrToken}</td>
      </tr>`
    )
    .join("");

  await getResend().emails.send({
    from: "tickets@test-standup.ru",
    to,
    subject: `Ваши билеты на ${eventTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2>Привет, ${customerName}!</h2>
        <p>Ваши билеты на мероприятие <strong>${eventTitle}</strong></p>
        <p>📅 ${eventDate} в ${eventTime}</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px">
          <thead>
            <tr style="background:#f5f5f5">
              <th style="padding:8px;border:1px solid #eee;text-align:left">Место</th>
              <th style="padding:8px;border:1px solid #eee;text-align:left">Цена</th>
              <th style="padding:8px;border:1px solid #eee;text-align:left">QR-токен</th>
            </tr>
          </thead>
          <tbody>${ticketRows}</tbody>
        </table>
        <p style="margin-top:24px;color:#888;font-size:12px">
          Покажите QR-код на входе. Билет действителен однократно.
        </p>
      </div>
    `,
  });
}
