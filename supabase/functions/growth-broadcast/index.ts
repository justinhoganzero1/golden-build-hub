// ORACLE LUNAR Growth Broadcaster — fans out a single event to 80+ channels.
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
  const title = p.title || `${emoji} ORACLE LUNAR — ${ev.toUpperCase()}`;
  const body =
    (p.message || "Something exciting just happened on ORACLE LUNAR.") +
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
      from: "ORACLE LUNAR <onboarding@resend.dev>",
      to: recipients,
      subject: title,
      html: `<h2>${title}</h2><p style="white-space:pre-wrap">${body}</p><p><a href="${APP_URL}">${APP_URL}</a></p>`,
    }),
  });
  if (!r.ok) throw new Error(`resend ${r.status}: ${await r.text()}`);
}

// === X (Twitter) v2 — posts a tweet using OAuth 1.0a user context ===
async function sendTwitter(title: string, body: string, url?: string) {
  const ck = Deno.env.get("TWITTER_CONSUMER_KEY");
  const cs = Deno.env.get("TWITTER_CONSUMER_SECRET");
  const at = Deno.env.get("TWITTER_ACCESS_TOKEN");
  const ats = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET");
  if (!ck || !cs || !at || !ats) return;

  const text = `${title}\n${body}`.slice(0, 275) + (url ? `\n${url}` : "");
  const endpoint = "https://api.x.com/2/tweets";
  const method = "POST";

  // OAuth 1.0a signature (no body params in signature for JSON POST)
  const oauth: Record<string, string> = {
    oauth_consumer_key: ck,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ""),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: at,
    oauth_version: "1.0",
  };
  const enc = (s: string) => encodeURIComponent(s).replace(/[!*'()]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  const paramStr = Object.keys(oauth).sort().map(k => `${enc(k)}=${enc(oauth[k])}`).join("&");
  const baseStr = `${method}&${enc(endpoint)}&${enc(paramStr)}`;
  const signingKey = `${enc(cs)}&${enc(ats)}`;
  const keyData = new TextEncoder().encode(signingKey);
  const msgData = new TextEncoder().encode(baseStr);
  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sigBytes = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const signature = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));
  oauth.oauth_signature = signature;

  const authHeader = "OAuth " + Object.keys(oauth).sort().map(k => `${enc(k)}="${enc(oauth[k])}"`).join(", ");
  const r = await fetch(endpoint, {
    method,
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!r.ok) throw new Error(`twitter ${r.status}: ${await r.text()}`);
}

// === Instagram Graph API — posts an image+caption to a Business/Creator account ===
async function sendInstagram(title: string, body: string, url?: string, imageUrl?: string) {
  const token = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
  const igUserId = Deno.env.get("INSTAGRAM_BUSINESS_ACCOUNT_ID");
  if (!token || !igUserId) return;
  // Instagram requires an image — fall back to a default brand image if none supplied
  const image = imageUrl || Deno.env.get("INSTAGRAM_DEFAULT_IMAGE_URL") || `${APP_URL}/icon-512.png`;
  const caption = `${title}\n\n${body}${url ? `\n\n${url}` : ""}`.slice(0, 2200);

  // Step 1: create media container
  const createRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: image, caption, access_token: token }),
  });
  if (!createRes.ok) throw new Error(`instagram create ${createRes.status}: ${await createRes.text()}`);
  const { id: creationId } = await createRes.json();

  // Step 2: publish container
  const pubRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: creationId, access_token: token }),
  });
  if (!pubRes.ok) throw new Error(`instagram publish ${pubRes.status}: ${await pubRes.text()}`);
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

// === Search engine discovery: pings Google, Bing, Yandex, Seznam, IndexNow ===
async function pingSearchEngines(payload: Payload) {
  const sitemap = `${APP_URL}/sitemap.xml`;
  const targetUrl = payload.url || APP_URL;
  const sitemapPings = [
    `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemap)}`,
    `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemap)}`,
    `https://webmaster.yandex.com/ping?sitemap=${encodeURIComponent(sitemap)}`,
  ];
  await Promise.allSettled(sitemapPings.map(u => fetch(u, { method: "GET" })));

  // IndexNow — single key shared across Bing, Yandex, Seznam, Naver
  const indexNowKey = Deno.env.get("INDEXNOW_KEY");
  if (indexNowKey) {
    const host = new URL(APP_URL).host;
    const urlList = [targetUrl, APP_URL, `${APP_URL}/portal`, `${APP_URL}/dashboard`];
    await Promise.allSettled([
      fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host,
          key: indexNowKey,
          keyLocation: `${APP_URL}/${indexNowKey}.txt`,
          urlList,
        }),
      }),
      fetch("https://www.bing.com/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, key: indexNowKey, keyLocation: `${APP_URL}/${indexNowKey}.txt`, urlList }),
      }),
      fetch("https://yandex.com/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, key: indexNowKey, keyLocation: `${APP_URL}/${indexNowKey}.txt`, urlList }),
      }),
    ]);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const payload: Payload = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const { title, body } = buildText(payload);

    const imageUrl = (payload.meta as any)?.imageUrl as string | undefined;
    const results = await Promise.all([
      safe("telegram", () => sendTelegram(title, body)),
      safe("discord", () => sendDiscord(title, body)),
      safe("slack", () => sendSlack(title, body)),
      safe("email", () => sendEmail(title, body)),
      safe("twitter", () => sendTwitter(title, body, payload.url)),
      safe("instagram", () => sendInstagram(title, body, payload.url, imageUrl)),
      safe("webhooks", () => sendGenericWebhooks(title, body, payload)),
      safe("search-engines", () => pingSearchEngines(payload)),
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
