// Twilio statusCallback — detects missed calls and fires text-back SMS + drip.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { verifyTwilioRequest } from "../_shared/twilioSignature.ts";
import { chargeAI } from "../_shared/wallet.ts";
import { PROVIDER_RATES } from "../_shared/pricing.ts";

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
    // Reject forged webhooks: verify Twilio's HMAC signature before doing anything.
    const twilio = await verifyTwilioRequest(req);
    if (twilio.response) return twilio.response;
    const form = new Map(Object.entries(twilio.params));
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

    // Bill call minutes (inbound Twilio rate + 20%) to the line owner, once per call.
    if (duration > 0 && ["completed", "busy", "no-answer", "failed", "canceled"].includes(callStatus)) {
      const { data: row } = await supabase.from("voice_call_logs").select("owner_user_id, billed_minutes").eq("call_sid", callSid).maybeSingle();
      let owner = row?.owner_user_id;
      if (!owner) {
        const { data: c } = await supabase.from("voice_agent_config").select("owner_user_id").limit(1).maybeSingle();
        owner = c?.owner_user_id;
      }
      const minutes = Math.ceil(duration / 60);
      const toBill = minutes - (row?.billed_minutes ?? 0);
      if (owner && toBill > 0) {
        try {
          await chargeAI(owner, "voice-receptionist-minutes", toBill * PROVIDER_RATES.twilio_voice_per_min_inbound,
            { request_key: `vr-min:${callSid}`, provider: "twilio", model: "voice-inbound", call_sid: callSid, minutes: toBill });
        } catch (e) { console.error("minute billing failed", callSid, e); }
        await supabase.from("voice_call_logs").update({ billed_minutes: minutes, owner_user_id: owner }).eq("call_sid", callSid);
      }
    }

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
      if (ok && cfg.owner_user_id) {
        await chargeAI(cfg.owner_user_id, "voice-receptionist-sms", PROVIDER_RATES.twilio_sms_per_segment,
          { request_key: `vr-sms:${callSid}`, provider: "twilio", model: "sms", call_sid: callSid }).catch((e) => console.error("sms billing", e));
      }

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
