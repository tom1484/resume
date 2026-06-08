// Telegram batch summary (stage: notify). TELEGRAM_* stay secrets (env, §6.1).
const API = 'https://api.telegram.org';

export async function sendTelegram(text: string): Promise<boolean> {
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
  const body = (await resp.json()) as { ok?: boolean };
  if (!body.ok)
    throw new Error(`telegram sendMessage failed: ${JSON.stringify(body)}`);
  return true;
}

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export interface TailoredSummaryItem {
  id: string;
  score: number;
  company: string;
  title: string;
  company_flags?: string[];
  patches?: number;
}

// Summary of a scoring cycle. `tailored` jobs are linked to their review page
// (reviewBase + #/app/<id>); the resume is ready to approve there.
export function batchSummary({
  scored,
  threshold,
  tailored = [],
  reviewBase = '',
}: {
  scored: number;
  threshold: number;
  tailored?: TailoredSummaryItem[];
  reviewBase?: string;
}): string {
  const lines = tailored.map((j) => {
    const flags = j.company_flags?.length ? ` [${j.company_flags.join(',')}]` : '';
    const link = `${reviewBase}/#/app/${encodeURIComponent(j.id)}`;
    const edits =
      j.patches != null ? ` · ${j.patches} edit${j.patches === 1 ? '' : 's'}` : '';
    return `• <b>${j.score.toFixed(2)}</b> ${esc(j.company)}${flags} — <a href="${esc(
      link
    )}">${esc(j.title)}</a>${edits}`;
  });
  const head = `🧭 ${scored} job${scored === 1 ? '' : 's'} scored, ${
    tailored.length
  } tailored & ready to review (≥ ${threshold})`;
  return [head, ...lines].join('\n');
}
