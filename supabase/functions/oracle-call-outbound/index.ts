// Outbound call: Oracle places a call to a number on behalf of the user.
// User provides the number and what the call is about. Oracle delivers the message
// using TTS, listens for a reply, then routes that reply back through the same
// gather → mute → user-reply flow (so the user can keep talking through Oracle).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { authorizeAI, settleAI, cancelAI, InsufficientCoinsError, insufficientCoinsResponse } from "../_shared/wallet.ts";
import { claimOperation } from "../_shared/operationClaim.ts";
import { verifyTwilioRequest } from "../_shared/twilioSignature.ts";

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
    const verified = await verifyTwilioRequest(req);
    if (verified.response) return verified.response;
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
    const { to, intent, requestKey } = await req.json();
    if (typeof requestKey !== "string" || !/^[0-9a-f-]{36}$/i.test(requestKey)) return new Response(JSON.stringify({ error: "request_reference_required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !Deno.env.get("TWILIO_AUTH_TOKEN")) {
      return new Response(JSON.stringify({ error: "Calling is unavailable. No wallet charge was made." }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const claim = await claimOperation(userId, "outbound-call", requestKey);
    if (claim.duplicate) return new Response(JSON.stringify(claim.state === "confirmed" ? claim.result : { error: "Call already requested. Review call history; do not repeat it." }), { status: claim.state === "confirmed" ? 200 : 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: isOwner, error: roleError } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (roleError) throw new Error("Access check unavailable");
    // Reserve the existing five-minute allowance; no charge for a definite rejection.
    let transactionId: string | null = null;
    try {
      if (isOwner !== true) {
        const authorization = await authorizeAI(userId, `call:${requestKey}`, "ai-outbound-call", "twilio+lovable_ai", "call", 5 * 6, { minutes: 5, request_key: requestKey });
        transactionId = authorization.transaction_id;
      }
    } catch (err) {
      if (err instanceof InsufficientCoinsError) return insufficientCoinsResponse(err, corsHeaders);
      throw err;
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
    if (sessErr || !session) {
      if (transactionId) await cancelAI(transactionId, "session_not_created");
      throw sessErr || new Error("Failed to create session");
    }
    await claim.finish("prepared", { session_id: session.id, transaction_id: transactionId });

    // Place the call
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
        TimeLimit: "300",
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      // A 5xx/timeout can be ambiguous: keep its reservation and prevent replay.
      if (r.status >= 400 && r.status < 500 && transactionId) await cancelAI(transactionId, "provider_rejected");
      await claim.finish(r.status < 500 ? "rejected" : "uncertain", { session_id: session.id, transaction_id: transactionId });
      console.error("Twilio outbound failed", r.status, data);
      return new Response(JSON.stringify({ error: "Failed to place call", detail: data }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof data.sid !== "string" || !data.sid.startsWith("CA")) throw new Error("Call outcome could not be confirmed; do not repeat it");
    const { error: saveError } = await admin.from("call_sessions").update({ twilio_call_sid: data.sid, status: "connected" }).eq("id", session.id);
    if (saveError) throw new Error("Call accepted but history save failed; do not repeat it");
    // Preserve the existing capped call allowance; later actual-cost reconciliation is separate.
    if (transactionId) await settleAI(transactionId, 5 * 6, data.sid, [], { capped_allowance: true });
    await claim.finish("confirmed", { success: true, session_id: session.id, sid: data.sid });

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
