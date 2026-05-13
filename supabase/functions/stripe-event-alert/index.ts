// Sends an alert to admin email (Resend) and Slack (webhook) when a Stripe event
// is logged with status 'error' or 'signature_failed'.
// Triggered by a database AFTER INSERT trigger via pg_net.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "justinbretthogan@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({} as any));
    // Accept either {record: {...}} from pg_net trigger payload or direct fields
    const rec = body.record ?? body;
    const status = rec.status;
    const eventType = rec.event_type ?? "(unknown)";
    const source = rec.source ?? "(unknown)";
    const message = rec.message ?? "";
    const stripeEventId = rec.stripe_event_id ?? null;
    const createdAt = rec.created_at ?? new Date().toISOString();

    if (status !== "error" && status !== "signature_failed") {
      return new Response(JSON.stringify({ skipped: true, status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // De-dupe: don't re-alert for same stripe_event_id
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const sevEmoji = status === "signature_failed" ? "🔒" : "⚠️";
    const subject = `${sevEmoji} Stripe ${status} — ${eventType}`;
    const lines = [
      `Status: ${status}`,
      `Source: ${source}`,
      `Event type: ${eventType}`,
      stripeEventId ? `Stripe event id: ${stripeEventId}` : null,
      `Time: ${createdAt}`,
      message ? `Message: ${message}` : null,
    ].filter(Boolean).join("\n");

    let emailed = false;
    let slacked = false;
    const errors: string[] = [];

    // ---------- Email via Resend ----------
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY) {
      try {
        const html = `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0b0b0f;color:#f5f5f7;border-radius:12px">
            <h2 style="color:#ff9b9b;margin:0 0 12px">${sevEmoji} Stripe webhook problem</h2>
            <p>A Stripe event was logged with status <strong>${status}</strong>.</p>
            <pre style="background:#1a1a22;padding:12px;border-radius:8px;color:#f5b042;white-space:pre-wrap;font-size:13px">${lines}</pre>
            <p style="margin-top:16px">
              <a href="https://oracle-lunar.online/owner-dashboard" style="background:#f5b042;color:#0b0b0f;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Open Owner Dashboard</a>
            </p>
          </div>`;
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "ORACLE LUNAR Alerts <onboarding@resend.dev>",
            to: [ADMIN_EMAIL],
            subject,
            html,
          }),
        });
        if (resp.ok) emailed = true;
        else errors.push(`resend:${resp.status}:${await resp.text()}`);
      } catch (e) {
        errors.push(`resend_exc:${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      errors.push("resend:missing_key");
    }

    // ---------- Slack webhook ----------
    const SLACK_WEBHOOK_URL = Deno.env.get("SLACK_WEBHOOK_URL");
    if (SLACK_WEBHOOK_URL) {
      try {
        const resp = await fetch(SLACK_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `${sevEmoji} *Stripe ${status}* — \`${eventType}\``,
            blocks: [
              { type: "header", text: { type: "plain_text", text: `${sevEmoji} Stripe ${status}` } },
              { type: "section", text: { type: "mrkdwn", text: "```" + lines + "```" } },
              {
                type: "actions",
                elements: [
                  {
                    type: "button",
                    text: { type: "plain_text", text: "Owner Dashboard" },
                    url: "https://oracle-lunar.online/owner-dashboard",
                  },
                ],
              },
            ],
          }),
        });
        if (resp.ok) slacked = true;
        else errors.push(`slack:${resp.status}:${await resp.text()}`);
      } catch (e) {
        errors.push(`slack_exc:${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      errors.push("slack:missing_webhook");
    }

    // Log alert outcome back into stripe_event_log for audit
    try {
      await supabase.from("stripe_event_log").insert({
        source: "alert",
        event_type: `alert.${status}`,
        status: emailed || slacked ? "ok" : "error",
        stripe_event_id: null,
        message: `alerted email=${emailed} slack=${slacked} for ${eventType} ${stripeEventId ?? ""} ${errors.length ? "errs=" + errors.join(";") : ""}`.slice(0, 1000),
        payload: { rec, errors },
      });
    } catch { /* swallow */ }

    return new Response(JSON.stringify({ emailed, slacked, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
