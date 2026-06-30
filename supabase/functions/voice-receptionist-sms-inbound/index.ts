// Twilio inbound SMS webhook — records the reply, cancels pending drips,
// and (optionally) lets the AI agent auto-reply.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const xml = (body: string) => new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`, {
  headers: { "Content-Type": "text/xml; charset=utf-8" },
});

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const form = await req.formData();
    const from = String(form.get("From") || "");
    const body = String(form.get("Body") || "").trim();

    let contactId: string | null = null;
    const { data: existing } = await supabase.from("crm_contacts").select("id,stage_id").eq("phone", from).maybeSingle();
    if (existing) contactId = existing.id;
    else {
      const { data: created } = await supabase.from("crm_contacts").insert({ phone: from, source: "sms" }).select("id").maybeSingle();
      contactId = created?.id ?? null;
    }

    if (contactId) {
      await supabase.from("crm_activities").insert({
        contact_id: contactId, activity_type: "sms_inbound", channel: "sms", body, payload: { from },
      });
      // STOP keyword handling
      if (/\bstop\b/i.test(body)) {
        await supabase.from("crm_followups").update({ status: "cancelled" }).eq("contact_id", contactId).eq("status", "scheduled");
        return xml(`<Response><Message>You're opted out. We won't text you again.</Message></Response>`);
      }
      // Cancel pending drips since they replied
      await supabase.from("crm_followups").update({ status: "cancelled" }).eq("contact_id", contactId).eq("status", "scheduled");
      await supabase.from("crm_contacts").update({ last_contact_at: new Date().toISOString() }).eq("id", contactId);
    }

    // AI reply
    const { data: cfg } = await supabase.from("voice_agent_config").select("system_prompt").limit(1).maybeSingle();
    let reply = "Got your message — we'll be in touch shortly!";
    try {
      const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: `${cfg?.system_prompt || ""}\nReply via SMS in under 25 words.` },
            { role: "user", content: body },
          ],
        }),
      });
      const aj = await ai.json();
      reply = aj.choices?.[0]?.message?.content?.trim() || reply;
    } catch (e) { console.error("ai sms reply fail", e); }

    if (contactId) {
      await supabase.from("crm_activities").insert({
        contact_id: contactId, activity_type: "sms_outbound", channel: "sms", body: reply,
      });
    }

    return xml(`<Response><Message>${escapeXml(reply)}</Message></Response>`);
  } catch (e) {
    console.error("sms-inbound error", e);
    return xml(`<Response/>`);
  }
});
