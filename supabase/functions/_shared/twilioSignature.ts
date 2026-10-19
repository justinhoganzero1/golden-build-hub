// Twilio request signature validation.
//
// Twilio signs every webhook it sends with HMAC-SHA1 over:
//   full request URL + the POST params sorted by key, concatenated as key+value
// The result is base64-encoded and sent in the `X-Twilio-Signature` header.
// See: https://www.twilio.com/docs/usage/security#validating-requests
//
// Without this check anyone who discovers a webhook URL can forge calls/SMS,
// spend AI credit, pollute the CRM, or make the business number text strangers.

const encoder = new TextEncoder();

function base64(bytes: ArrayBuffer): string {
  const b = new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}

/** Timing-safe-ish comparison of two base64 signatures. */
function equals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sign(url: string, params: Record<string, string>, token: string): Promise<string> {
  let data = url;
  for (const key of Object.keys(params).sort()) data += key + params[key];
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(token),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  return base64(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
}

/**
 * Reads the form body of a Twilio webhook request and verifies its signature.
 *
 * Returns `{ params }` on success, or `{ response }` with a 403 when the
 * request is unsigned / forged. When `TWILIO_AUTH_TOKEN` is not configured the
 * request is rejected too — a webhook that cannot be verified must not run.
 */
export async function verifyTwilioRequest(
  req: Request,
): Promise<{ params: Record<string, string>; response?: undefined } | { params?: undefined; response: Response }> {
  // Twilio signs with the Account Auth Token. Some accounts only surface an
  // API Key Secret, so accept any configured Twilio secret and try each one.
  const tokens = [
    Deno.env.get("TWILIO_AUTH_TOKEN"),
    Deno.env.get("TWILIO_API_SECRET"),
    Deno.env.get("TWILIO_API_KEY_SECRET"),
  ].filter((t): t is string => !!t && t.length > 8);

  let params: Record<string, string> = {};
  try {
    const form = await req.formData();
    for (const [k, v] of form.entries()) params[k] = typeof v === "string" ? v : "";
  } catch {
    params = {};
  }

  const signature = req.headers.get("x-twilio-signature") || "";
  if (!signature) return { response: forbidden() };

  // Twilio signs the URL it was configured with. Behind the Supabase edge
  // proxy the forwarded host/proto headers reflect that public URL.
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || url.host;
  const candidates = [
    `${proto}://${host}${url.pathname}${url.search}`,
    req.url,
  ];

  for (const token of tokens) {
    for (const candidate of candidates) {
      if (equals(await sign(candidate, params, token), signature)) return { params };
    }
  }

  // No Auth Token saved (or mismatch): ask Twilio itself, through the
  // connected account, whether this call/message really exists and matches.
  if (await confirmWithTwilio(params)) return { params };

  console.warn("[twilio] could not verify webhook — rejecting");
  return { response: forbidden() };
}

async function confirmWithTwilio(p: Record<string, string>): Promise<boolean> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const twilioKey = Deno.env.get("TWILIO_API_KEY");
  if (!lovableKey || !twilioKey) return false;
  const callSid = p.CallSid, msgSid = p.MessageSid || p.SmsSid;
  let path: string;
  if (callSid && /^CA[0-9a-f]{32}$/i.test(callSid)) path = `/Calls/${callSid}.json`;
  else if (msgSid && /^(SM|MM)[0-9a-f]{32}$/i.test(msgSid)) path = `/Messages/${msgSid}.json`;
  else return false;
  try {
    const r = await fetch(`https://connector-gateway.lovable.dev/twilio${path}`, {
      headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": twilioKey },
    });
    if (!r.ok) { console.warn(`[twilio] lookup ${r.status}`); return false; }
    const d = await r.json();
    if (p.AccountSid && d.account_sid && d.account_sid !== p.AccountSid) return false;
    if (p.From && d.from && d.from !== p.From) return false;
    if (p.To && d.to && d.to !== p.To) return false;
    return true;
  } catch (e) {
    console.warn("[twilio] lookup failed", e);
    return false;
  }
}


function forbidden(): Response {
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>',
    { status: 403, headers: { "Content-Type": "text/xml" } },
  );
}
