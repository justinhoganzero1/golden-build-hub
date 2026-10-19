import { validTwilioSignature } from "./webhookSignature.ts";

export async function verifyTwilioRequest(req: Request): Promise<{ params: Record<string, string>; response?: undefined } | { params?: undefined; response: Response }> {
  const token = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
  const signature = req.headers.get("x-twilio-signature") ?? "";
  const params: Record<string, string> = {};
  try {
    const form = await req.formData();
    for (const [key, value] of form.entries()) {
      if (typeof value !== "string" || key in params) return { response: forbidden() };
      params[key] = value;
    }
  } catch { return { response: forbidden() }; }
  // Use the configured public origin, never caller-controlled forwarded headers.
  const base = Deno.env.get("SUPABASE_URL");
  const url = new URL(req.url);
  const publicUrl = base ? `${base}/functions/v1/${url.pathname.split("/").pop()}${url.search}` : req.url;
  if (await validTwilioSignature(publicUrl, params, token, signature)) return { params };
  console.warn("[twilio] webhook signature could not be verified");
  return { response: forbidden() };
}
function forbidden(): Response {
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>', { status: 403, headers: { "Content-Type": "text/xml" } });
}
