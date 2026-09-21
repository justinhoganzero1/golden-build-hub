import { Webhook } from "npm:svix@1.42.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const statusFor = (event: string) => {
  if (["email.delivered", "email.opened", "email.clicked"].includes(event)) return "delivered_to_mail_server";
  if (event === "email.delivery_delayed") return "delayed";
  if (["email.bounced", "email.complained"].includes(event)) return "bounced";
  if (event === "email.failed") return "failed";
  return null;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!secret) return json({ error: "Webhook verification is not configured" }, 503);

  const raw = await req.text();
  let event: any;
  try {
    event = new Webhook(secret).verify(raw, {
      "svix-id": req.headers.get("svix-id") ?? "",
      "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
      "svix-signature": req.headers.get("svix-signature") ?? "",
    });
  } catch {
    return json({ error: "Invalid signature" }, 401);
  }

  const status = statusFor(String(event?.type ?? ""));
  const providerMessageId = String(event?.data?.email_id ?? event?.data?.id ?? "");
  if (!status || !providerMessageId) return json({ received: true, ignored: true });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
  const failureReason = status === "bounced" || status === "failed"
    ? String(event?.data?.bounce?.message ?? event?.data?.reason ?? "Amazon rejected the email.").slice(0, 1000)
    : null;
  const { error } = await supabase
    .from("kindle_deliveries")
    .update({ status, failure_reason: failureReason })
    .eq("provider_message_id", providerMessageId);
  if (error) {
    console.error("resend-kindle-webhook update failed", providerMessageId, error.message);
    return json({ error: "Could not update delivery" }, 500);
  }
  console.log(JSON.stringify({ event: "kindle_status", providerMessageId, status }));
  return json({ received: true });
});