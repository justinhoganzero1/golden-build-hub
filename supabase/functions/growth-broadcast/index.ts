// SOLACE Growth Broadcaster — fans out a single event to 80+ channels.
// Destinations supported (any subset, configured via secrets):
//   - Telegram channel       (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)
//   - Discord webhook        (DISCORD_WEBHOOK_URL)
//   - Slack incoming webhook (SLACK_WEBHOOK_URL)
//   - Email via Resend       (RESEND_API_KEY + BROADCAST_EMAIL_TO)
//   - Generic webhooks list  (BROADCAST_WEBHOOKS = comma-separated URLs, up to 80)
//
// POST body: { event: "signup"|"referral"|"feature"|"custom", title?, message?, url?, meta? }

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload = {
  event?: string;
  title?: string;
  message?: string;
  url?: string;
  meta?: Record<string, unknown>;
};

const APP_URL = "https://oracle-lunar.online";

function buildText(p: Payload): { title: string; body: string } {
  const ev = (p.event || "custom").toLowerCase();
  const emoji =
    ev === "signup" ? "🎉" : ev === "referral" ? "🔗" : ev === "feature" ? "✨" : "📣";
  const title = p.title || `${emoji} SOLACE — ${ev.toUpperCase()}`;
  const body =
    (p.message || "Something exciting just happened on SOLACE.") +
    (p.url ? `\n\n${p.url}` : `\n\n${APP_URL}`);
  return { title, body };
}

async function safe<T>(label: string, fn: () => Promise<T>): Promise<{ ok: boolean; label: string; error?: string }> {
  try { await fn(); return { ok: true, label }; }
  catch (e) { return { ok: false, label, error: String(e) }; }
}

async function sendTelegram(title: string, body: string) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chat = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!token || !chat) return;
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: `*${title}*\n${body}`, parse_mode: "Markdown", disable_web_page_preview: false }),
  });
  if (!r.ok) throw new Error(`telegram ${r.status}`);
}

async function sendDiscord(title: string, body: string) {
  const url = Deno.env.get("DISCORD_WEBHOOK_URL");
  if (!url) return;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: `**${title}**\n${body}` }),
  });
  if (!r.ok) throw new Error(`discord ${r.status}`);
}

async function sendSlack(title: string, body: string) {
  const url = Deno.env.get("SLACK_WEBHOOK_URL");
  if (!url) return;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: `*${title}*\n${body}` }),
  });
  if (!r.ok) throw new Error(`slack ${r.status}`);
}

async function sendEmail(title: string, body: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("BROADCAST_EMAIL_TO");
  if (!key || !to) return;
  const recipients = to.split(",").map(s => s.trim()).filter(Boolean);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "SOLACE <onboarding@resend.dev>",
      to: recipients,
      subject: title,
      html: `<h2>${title}</h2><p style="white-space:pre-wrap">${body}</p><p><a href="${APP_URL}">${APP_URL}</a></p>`,
    }),
  });
  if (!r.ok) throw new Error(`resend ${r.status}: ${await r.text()}`);
}

async function sendGenericWebhooks(title: string, body: string, payload: Payload) {
  const list = Deno.env.get("BROADCAST_WEBHOOKS");
  if (!list) return;
  const urls = list.split(",").map(s => s.trim()).filter(Boolean).slice(0, 80);
  await Promise.allSettled(urls.map(u =>
    fetch(u, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, ...payload }),
    })
  ));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const payload: Payload = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const { title, body } = buildText(payload);

    const results = await Promise.all([
      safe("telegram", () => sendTelegram(title, body)),
      safe("discord", () => sendDiscord(title, body)),
      safe("slack", () => sendSlack(title, body)),
      safe("email", () => sendEmail(title, body)),
      safe("webhooks", () => sendGenericWebhooks(title, body, payload)),
    ]);

    return new Response(JSON.stringify({ ok: true, title, body, results }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[growth-broadcast]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
