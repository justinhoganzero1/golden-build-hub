// Voice AI Receptionist — Twilio inbound voice webhook.
// Returns TwiML that greets the caller, gathers their speech, sends it to
// Gemini for a reply, and either continues the conversation, books an
// appointment, or transfers to a human handoff number.
//
// Twilio Voice Webhook URL (POST): /functions/v1/voice-receptionist-incoming
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

const xml = (body: string) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`, {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const form = await req.formData();
    const callSid = String(form.get("CallSid") || "");
    const from = String(form.get("From") || "");
    const to = String(form.get("To") || "");
    const speech = String(form.get("SpeechResult") || "").trim();
    const url = new URL(req.url);
    const turn = parseInt(url.searchParams.get("turn") || "0", 10);

    // Load config + knowledge
    const { data: cfg } = await supabase.from("voice_agent_config").select("*").limit(1).maybeSingle();
    const { data: kb } = await supabase.from("voice_knowledge_items").select("question,answer").eq("active", true).order("priority", { ascending: false }).limit(50);

    if (!cfg?.enabled) {
      return xml(`<Response><Say voice="Polly.Joanna">This line is currently offline. Please try again later.</Say><Hangup/></Response>`);
    }

    // Upsert call log + contact
    if (turn === 0) {
      // Find or create contact
      let contactId: string | null = null;
      if (from) {
        const { data: existing } = await supabase.from("crm_contacts").select("id").eq("phone", from).maybeSingle();
        if (existing) contactId = existing.id;
        else {
          const { data: created } = await supabase.from("crm_contacts").insert({ phone: from, source: "voice_call" }).select("id").maybeSingle();
          contactId = created?.id ?? null;
        }
      }
      await supabase.from("voice_call_logs").upsert({
        call_sid: callSid, from_number: from, to_number: to,
        direction: "inbound", status: "in-progress", contact_id: contactId,
      }, { onConflict: "call_sid" });
      if (contactId) {
        await supabase.from("crm_activities").insert({
          contact_id: contactId, activity_type: "call_started", channel: "voice",
          subject: `Inbound call ${callSid}`, payload: { from, to, call_sid: callSid },
        });
        await supabase.from("crm_contacts").update({ last_contact_at: new Date().toISOString() }).eq("id", contactId);
      }

      // Initial greeting
      const next = `${url.origin}${url.pathname}?turn=1`;
      return xml(`<Response>
        <Gather input="speech" timeout="5" speechTimeout="auto" action="${escapeXml(next)}" method="POST">
          <Say voice="Polly.Joanna">${escapeXml(cfg.greeting)}</Say>
        </Gather>
        <Say voice="Polly.Joanna">I didn't catch that. Please call back when you're ready.</Say>
        <Hangup/>
      </Response>`);
    }

    // Subsequent turns — fetch existing transcript
    const { data: callRow } = await supabase.from("voice_call_logs").select("*").eq("call_sid", callSid).maybeSingle();
    const transcript: Array<{ role: string; text: string }> = (callRow?.transcript as any) || [];
    if (speech) transcript.push({ role: "user", text: speech });

    // Build messages for Gemini
    const knowledgeBlock = (kb || []).map((k: any) => `Q: ${k.question}\nA: ${k.answer}`).join("\n\n");
    const messages = [
      { role: "system", content: `${cfg.system_prompt}\n\nKnowledge base (use to answer FAQs):\n${knowledgeBlock}\n\nAt the end of EVERY reply, on a new line, emit JSON intent: {"intent":"info|book|handoff|end","summary":"..."}. Keep spoken text under 25 words.` },
      ...transcript.map((t) => ({ role: t.role === "user" ? "user" : "assistant", content: t.text })),
    ];

    let aiReply = "Let me transfer you to a person.";
    let intent: any = { intent: "handoff", summary: "AI error" };
    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
      });
      const aj = await aiRes.json();
      const raw = aj.choices?.[0]?.message?.content || "";
      // Split spoken text and trailing JSON
      const jsonMatch = raw.match(/\{[^{}]*"intent"[^{}]*\}\s*$/);
      if (jsonMatch) {
        try { intent = JSON.parse(jsonMatch[0]); } catch { /* ignore */ }
        aiReply = raw.slice(0, jsonMatch.index).trim();
      } else {
        aiReply = raw.trim();
        intent = { intent: "info", summary: aiReply.slice(0, 120) };
      }
    } catch (e) { console.error("AI fail", e); }

    transcript.push({ role: "assistant", text: aiReply });
    await supabase.from("voice_call_logs").update({
      transcript, intent: intent.intent, outcome: intent.summary,
    }).eq("call_sid", callSid);

    // Check handoff rules
    const rules: any[] = (cfg.handoff_rules as any[]) || [];
    const shouldHandoff = intent.intent === "handoff" || rules.some((r) => r.trigger === "intent" && r.value === intent.intent && r.action === "transfer");

    if (shouldHandoff && cfg.handoff_number) {
      return xml(`<Response>
        <Say voice="Polly.Joanna">${escapeXml(aiReply || "Transferring you now.")}</Say>
        <Dial timeout="20">${escapeXml(cfg.handoff_number)}</Dial>
        <Say voice="Polly.Joanna">Sorry, no one's available. We'll text you shortly.</Say>
        <Hangup/>
      </Response>`);
    }

    if (intent.intent === "book") {
      // Hand off to booking flow — log task; admin will see in CRM
      if (callRow?.contact_id) {
        await supabase.from("crm_activities").insert({
          contact_id: callRow.contact_id, activity_type: "booking_request", channel: "voice",
          subject: "AI requested booking", body: intent.summary || aiReply,
          payload: { call_sid: callSid, intent },
        });
        // Schedule a follow-up SMS with booking link
        await supabase.from("crm_followups").insert({
          contact_id: callRow.contact_id, channel: "sms",
          body: "Thanks for calling! Book a time here: https://oracle-lunar.online/calendar",
          send_at: new Date(Date.now() + 30_000).toISOString(),
        });
      }
      return xml(`<Response>
        <Say voice="Polly.Joanna">${escapeXml(aiReply)} I'll text you a booking link now. Goodbye!</Say>
        <Hangup/>
      </Response>`);
    }

    if (intent.intent === "end" || turn >= 8) {
      return xml(`<Response><Say voice="Polly.Joanna">${escapeXml(aiReply)} Thanks for calling.</Say><Hangup/></Response>`);
    }

    // Continue gathering
    const next = `${url.origin}${url.pathname}?turn=${turn + 1}`;
    return xml(`<Response>
      <Gather input="speech" timeout="5" speechTimeout="auto" action="${escapeXml(next)}" method="POST">
        <Say voice="Polly.Joanna">${escapeXml(aiReply)}</Say>
      </Gather>
      <Say voice="Polly.Joanna">Still there? Goodbye for now.</Say>
      <Hangup/>
    </Response>`);
  } catch (e) {
    console.error("voice-incoming error", e);
    return xml(`<Response><Say>System error. Goodbye.</Say><Hangup/></Response>`);
  }
});
