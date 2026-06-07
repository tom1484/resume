// Telegram batch summary (stage: notify).
const API = 'https://api.telegram.org';

export async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('telegram env missing, skipping notification');
    return false;
  }
  const resp = await fetch(`${API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  const body = await resp.json();
  if (!body.ok) throw new Error(`telegram sendMessage failed: ${JSON.stringify(body)}`);
  return true;
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function batchSummary({ scored, threshold, top }) {
  const lines = top.map((j) => {
    const flags = j.company_flags?.length ? ` [${j.company_flags.join(',')}]` : '';
    return `• <b>${j.score.toFixed(2)}</b> ${esc(j.company)}${flags} — <a href="${esc(j.url)}">${esc(j.title)}</a>`;
  });
  const above = top.length;
  return [
    `🧭 ${scored} job${scored === 1 ? '' : 's'} scored, ${above} ≥ ${threshold}`,
    ...lines,
  ].join('\n');
}
