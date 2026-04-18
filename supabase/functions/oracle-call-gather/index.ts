// Twilio gather webhook — receives the caller's speech, mutes them with hold music,
// announces the mute to the caller, and sets the session to "awaiting_user".
// The Oracle UI (subscribed to Realtime) will see the change and prompt the user
// for a reply. The user's reply triggers /oracle-call-reply which redirects this call.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function xml(body: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
}
function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!));
}

const PROJECT_REF = Deno.env.get("SUPABASE_URL")!.split("//")[1].split(".")[0];
const SELF_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/oracle-call-gather`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const form = await req.formData();
    const callSid = String(form.get("CallSid") || "");
    const speech = String(form.get("SpeechResult") || "").trim();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: session } = await supabase
      .from("call_sessions")
      .select("id, user_id, transcript, intent")
      .eq("twilio_call_sid", callSid)
      .maybeSingle();

    if (!session) {
      return xml(`<Response><Say>Session not found. Goodbye.</Say><Hangup/></Response>`);
    }

    // Get the user's hold-message
    const { data: settings } = await supabase
      .from("user_assistant_settings")
      .select("hold_message")
      .eq("user_id", session.user_id)
      .maybeSingle();
    const holdMessage = settings?.hold_message || "One moment please, I'm muting you while I check with the owner.";

    if (!speech) {
      return xml(`<Response>
        <Gather input="speech" timeout="6" speechTimeout="auto" action="${SELF_URL}" method="POST">
          <Say voice="Polly.Joanna-Neural">I didn't hear anything. What can I help you with?</Say>
        </Gather>
        <Hangup/>
      </Response>`);
    }

    // Save what caller said + flip to awaiting_user
    const transcript = Array.isArray(session.transcript) ? session.transcript : [];
    transcript.push({ role: "caller", text: speech, ts: Date.now() });

    await supabase
      .from("call_sessions")
      .update({
        last_caller_message: speech,
        intent: session.intent || speech.slice(0, 200),
        status: "awaiting_user",
        hold_started_at: new Date().toISOString(),
        transcript,
      })
      .eq("id", session.id);

    // Tell caller they're being muted, then play hold music while we wait for the user.
    // Twilio's <Pause> + looped hold-music keeps the line open. The /reply function
    // uses the Twilio REST API to redirect this call once the user replies.
    return xml(`<Response>
      <Say voice="Polly.Joanna-Neural">${escapeXml(holdMessage)}</Say>
      <Play loop="0">https://com.twilio.sounds.music.s3.amazonaws.com/MARKOVICHAMP-Borghestral.mp3</Play>
    </Response>`);
  } catch (e) {
    console.error("gather error", e);
    return xml(`<Response><Say>Something went wrong. Goodbye.</Say><Hangup/></Response>`);
  }
});
