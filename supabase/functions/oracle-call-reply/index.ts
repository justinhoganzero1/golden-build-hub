// Called from the Oracle UI when the user has typed/spoken their reply.
// Builds a TwiML response for the on-hold caller, then uses Twilio's REST API
// to redirect the live call to that TwiML — which unmutes them and reads the reply.
// JWT-protected: only the authenticated user who owns the session can reply.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROJECT_REF = Deno.env.get("SUPABASE_URL")!.split("//")[1].split(".")[0];
const TWIML_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/oracle-call-reply?mode=twiml`;
const GATHER_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/oracle-call-gather`;

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);

  // ── TwiML mode: Twilio fetches this URL after we redirect the live call ──
  if (url.searchParams.get("mode") === "twiml") {
    const sessionId = url.searchParams.get("sid");
    if (!sessionId) {
      return new Response(`<?xml version="1.0"?><Response><Say>Missing session.</Say><Hangup/></Response>`, {
        headers: { "Content-Type": "text/xml" },
      });
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: session } = await admin
      .from("call_sessions")
      .select("pending_user_reply, transcript, status")
      .eq("id", sessionId)
      .maybeSingle();

    const reply = session?.pending_user_reply || "I'm sorry, I don't have an answer right now.";
    const transcript = Array.isArray(session?.transcript) ? session!.transcript : [];
    transcript.push({ role: "user", text: reply, ts: Date.now() });

    await admin
      .from("call_sessions")
      .update({
        status: "connected",
        last_caller_message: null,
        pending_user_reply: null,
        transcript,
      })
      .eq("id", sessionId);

    // Read the reply, then go back to gather for a follow-up question
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response>
        <Say voice="Polly.Joanna-Neural">${escapeXml(reply)}</Say>
        <Pause length="1"/>
        <Gather input="speech" timeout="6" speechTimeout="auto" action="${GATHER_URL}" method="POST">
          <Say voice="Polly.Joanna-Neural">Is there anything else?</Say>
        </Gather>
        <Say voice="Polly.Joanna-Neural">Thank you, goodbye.</Say>
        <Hangup/>
      </Response>`,
      { headers: { "Content-Type": "text/xml" } },
    );
  }

  // ── Authenticated mode: user posts their reply ──
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
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;
    const body = await req.json();
    const { session_id, reply } = body;
    if (!session_id || !reply || typeof reply !== "string") {
      return new Response(JSON.stringify({ error: "session_id and reply are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: session } = await admin
      .from("call_sessions")
      .select("id, user_id, twilio_call_sid, status")
      .eq("id", session_id)
      .maybeSingle();

    if (!session || session.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!session.twilio_call_sid) {
      return new Response(JSON.stringify({ error: "Call has no SID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stash the reply so the TwiML callback can read it
    await admin
      .from("call_sessions")
      .update({ pending_user_reply: reply, status: "replying" })
      .eq("id", session.id);

    // Redirect the live Twilio call to our TwiML mode
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
      return new Response(JSON.stringify({ error: "Telephony not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const r = await fetch(`https://connector-gateway.lovable.dev/twilio/Calls/${session.twilio_call_sid}.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ Url: `${TWIML_URL}&sid=${session.id}`, Method: "POST" }),
    });
    if (!r.ok) {
      const errText = await r.text();
      console.error("Twilio redirect failed", r.status, errText);
      return new Response(JSON.stringify({ error: "Failed to relay reply", detail: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("reply error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
