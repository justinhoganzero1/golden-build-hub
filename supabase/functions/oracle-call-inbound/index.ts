// Twilio voice webhook — answers an incoming call to the user's Twilio number.
// Greets the caller in Oracle's voice, then sends them to /gather to capture intent.
// Public endpoint (Twilio calls it, no JWT). Looks up the user by the dialed number.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const form = await req.formData();
    const callSid = String(form.get("CallSid") || "");
    const from = String(form.get("From") || "");
    const to = String(form.get("To") || "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find the user this Twilio number belongs to
    const { data: settings } = await supabase
      .from("user_assistant_settings")
      .select("user_id, greeting, call_answering_enabled")
      .eq("twilio_number", to)
      .maybeSingle();

    if (!settings || !settings.call_answering_enabled) {
      return xml(`<Response><Say voice="Polly.Joanna">This number is not currently accepting calls. Goodbye.</Say><Hangup/></Response>`);
    }

    // Create the call session
    await supabase.from("call_sessions").insert({
      user_id: settings.user_id,
      direction: "inbound",
      twilio_call_sid: callSid,
      caller_number: from,
      status: "connected",
      transcript: [{ role: "oracle", text: settings.greeting, ts: Date.now() }],
    });

    const projectRef = Deno.env.get("SUPABASE_URL")!.split("//")[1].split(".")[0];
    const gatherUrl = `https://${projectRef}.supabase.co/functions/v1/oracle-call-gather`;

    return xml(`<Response>
      <Say voice="Polly.Joanna-Neural">${escapeXml(settings.greeting)}</Say>
      <Gather input="speech" timeout="6" speechTimeout="auto" action="${gatherUrl}" method="POST">
        <Say voice="Polly.Joanna-Neural">What can I help you with?</Say>
      </Gather>
      <Say voice="Polly.Joanna-Neural">I didn't catch that. Goodbye.</Say>
      <Hangup/>
    </Response>`);
  } catch (e) {
    console.error("inbound error", e);
    return xml(`<Response><Say>Sorry, something went wrong.</Say><Hangup/></Response>`);
  }
});

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!));
}
