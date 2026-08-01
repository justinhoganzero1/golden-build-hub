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
  const token = Deno.env.get("TWILIO_AUTH_TOKEN") || "";

  let params: Record<string, string> = {};
  try {
    const form = await req.formData();
    for (const [k, v] of form.entries()) params[k] = typeof v === "string" ? v : "";
  } catch {
    params = {};
  }

  if (!token) {
    console.error("[twilio] TWILIO_AUTH_TOKEN not configured — rejecting webhook");
    return { response: forbidden() };
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

  for (const candidate of candidates) {
    if (equals(await sign(candidate, params, token), signature)) return { params };
  }

  console.warn("[twilio] signature mismatch — rejecting webhook");
  return { response: forbidden() };
}

function forbidden(): Response {
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>',
    { status: 403, headers: { "Content-Type": "text/xml" } },
  );
}
