// Twilio statusCallback — detects missed calls and fires text-back SMS + drip.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY")!;

const sendSms = async (to: string, from: string, body: string) => {
  const r = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  return r.ok;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const form = await req.formData();
    const callSid = String(form.get("CallSid") || "");
    const callStatus = String(form.get("CallStatus") || "");
    const from = String(form.get("From") || "");
    const to = String(form.get("To") || "");
    const duration = parseInt(String(form.get("CallDuration") || "0"), 10);
    const recordingUrl = String(form.get("RecordingUrl") || "") || null;

    await supabase.from("voice_call_logs").upsert({
      call_sid: callSid, from_number: from, to_number: to,
      status: callStatus, duration_seconds: duration,
      recording_url: recordingUrl, ended_at: new Date().toISOString(),
    }, { onConflict: "call_sid" });

    const missed = ["no-answer", "busy", "failed", "canceled"].includes(callStatus) ||
      (callStatus === "completed" && duration < 5);

    if (missed && from) {
      const { data: cfg } = await supabase.from("voice_agent_config").select("*").limit(1).maybeSingle();
      if (!cfg) return new Response("ok");

      // find/create contact
      let contactId: string | null = null;
      const { data: existing } = await supabase.from("crm_contacts").select("id").eq("phone", from).maybeSingle();
      if (existing) contactId = existing.id;
      else {
        const { data: created } = await supabase.from("crm_contacts").insert({ phone: from, source: "missed_call" }).select("id").maybeSingle();
        contactId = created?.id ?? null;
      }

      const fromNumber = cfg.twilio_phone_number || to;
      const ok = await sendSms(from, fromNumber, cfg.missed_call_sms);

      if (contactId) {
        await supabase.from("crm_activities").insert({
          contact_id: contactId, activity_type: "missed_call", channel: "voice",
          subject: `Missed call from ${from}`, body: ok ? "Text-back SMS sent" : "Text-back FAILED",
          payload: { call_sid: callSid, status: callStatus },
        });
        // Schedule 24h + 72h reactivation drips
        const now = Date.now();
        await supabase.from("crm_followups").insert([
          { contact_id: contactId, channel: "sms", body: cfg.drip_24h_sms, send_at: new Date(now + 24*60*60*1000).toISOString() },
          { contact_id: contactId, channel: "sms", body: cfg.drip_72h_sms, send_at: new Date(now + 72*60*60*1000).toISOString() },
        ]);
        await supabase.from("crm_contacts").update({ last_contact_at: new Date().toISOString() }).eq("id", contactId);
      }
    }

    return new Response("ok");
  } catch (e) {
    console.error("voice-status error", e);
    return new Response("ok"); // Twilio retries on non-2xx
  }
});
