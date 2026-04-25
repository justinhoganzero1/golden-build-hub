// Outbound call: Oracle places a call to a number on behalf of the user.
// User provides the number and what the call is about. Oracle delivers the message
// using TTS, listens for a reply, then routes that reply back through the same
// gather → mute → user-reply flow (so the user can keep talking through Oracle).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROJECT_REF = Deno.env.get("SUPABASE_URL")!.split("//")[1].split(".")[0];
const OUTBOUND_TWIML_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/oracle-call-outbound?mode=twiml`;
const GATHER_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/oracle-call-gather`;

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);

  // ── TwiML mode: Twilio fetches this once the callee answers ──
  if (url.searchParams.get("mode") === "twiml") {
    const sessionId = url.searchParams.get("sid");
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: session } = await admin
      .from("call_sessions")
      .select("intent")
      .eq("id", sessionId)
      .maybeSingle();
    const message = session?.intent || "Hello, I'm calling on behalf of someone. Please hold.";
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response>
        <Say voice="Polly.Joanna-Neural">Hello. I'm a personal assistant calling on behalf of the owner.</Say>
        <Pause length="1"/>
        <Say voice="Polly.Joanna-Neural">${escapeXml(message)}</Say>
        <Pause length="1"/>
        <Gather input="speech" timeout="6" speechTimeout="auto" action="${GATHER_URL}" method="POST">
          <Say voice="Polly.Joanna-Neural">What's your reply?</Say>
        </Gather>
        <Say voice="Polly.Joanna-Neural">I didn't hear a response. Goodbye.</Say>
        <Hangup/>
      </Response>`,
      { headers: { "Content-Type": "text/xml" } },
    );
  }

  // ── Authenticated mode: user requests an outbound call ──
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;
    const { to, intent } = await req.json();

    if (!to || !/^\+[1-9]\d{6,14}$/.test(to)) {
      return new Response(JSON.stringify({ error: "Valid E.164 number required (e.g. +14155550123)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!intent || typeof intent !== "string" || intent.length > 1000) {
      return new Response(JSON.stringify({ error: "Intent is required (1-1000 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: settings } = await admin
      .from("user_assistant_settings")
      .select("twilio_number, outbound_calls_enabled")
      .eq("user_id", userId)
      .maybeSingle();

    if (!settings?.twilio_number || !settings.outbound_calls_enabled) {
      return new Response(JSON.stringify({ error: "Outbound calling is not enabled" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pre-create the session so we can pass its ID to TwiML
    const { data: session, error: sessErr } = await admin
      .from("call_sessions")
      .insert({
        user_id: userId,
        direction: "outbound",
        caller_number: to,
        intent,
        status: "ringing",
      })
      .select("id")
      .single();
    if (sessErr || !session) throw sessErr || new Error("Failed to create session");

    // Place the call
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
      return new Response(JSON.stringify({ error: "Telephony not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const r = await fetch(`https://connector-gateway.lovable.dev/twilio/Calls.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: settings.twilio_number,
        Url: `${OUTBOUND_TWIML_URL}&sid=${session.id}`,
        Method: "POST",
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      console.error("Twilio outbound failed", r.status, data);
      return new Response(JSON.stringify({ error: "Failed to place call", detail: data }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await admin.from("call_sessions").update({ twilio_call_sid: data.sid, status: "connected" }).eq("id", session.id);

    return new Response(JSON.stringify({ success: true, session_id: session.id, sid: data.sid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("outbound error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
