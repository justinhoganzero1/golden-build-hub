// Cron tick — sends scheduled follow-ups (SMS, email, or task notification).
// Run every 5 minutes via Supabase cron or external scheduler.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date().toISOString();
  const { data: due } = await supabase.from("crm_followups").select("*, crm_contacts(phone,email,name)")
    .eq("status", "scheduled").lte("send_at", now).limit(50);

  let sent = 0, failed = 0;
  const { data: cfg } = await supabase.from("voice_agent_config").select("twilio_phone_number").limit(1).maybeSingle();
  const fromNumber = cfg?.twilio_phone_number;

  for (const f of (due || []) as any[]) {
    try {
      const contact = f.crm_contacts;
      if (f.channel === "sms" && contact?.phone && fromNumber) {
        const r = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": TWILIO_API_KEY, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ To: contact.phone, From: fromNumber, Body: f.body }),
        });
        if (!r.ok) throw new Error(`twilio ${r.status}`);
      } else if (f.channel === "email" && contact?.email && RESEND_API_KEY) {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: "Oracle Lunar <noreply@oracle-lunar.online>", to: contact.email, subject: f.subject || "Following up", html: `<p>${f.body}</p>` }),
        });
        if (!r.ok) throw new Error(`resend ${r.status}`);
      } else {
        throw new Error(`unsupported channel/contact: ${f.channel}`);
      }
      await supabase.from("crm_followups").update({ status: "sent", sent_at: new Date().toISOString(), attempts: f.attempts + 1 }).eq("id", f.id);
      await supabase.from("crm_activities").insert({
        contact_id: f.contact_id, activity_type: `${f.channel}_outbound`, channel: f.channel,
        subject: f.subject, body: f.body, payload: { followup_id: f.id },
      });
      sent++;
    } catch (e) {
      failed++;
      await supabase.from("crm_followups").update({
        status: f.attempts >= 3 ? "failed" : "scheduled",
        error: String(e), attempts: f.attempts + 1,
        send_at: new Date(Date.now() + 10*60*1000).toISOString(),
      }).eq("id", f.id);
    }
  }

  return new Response(JSON.stringify({ sent, failed, processed: (due || []).length }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
