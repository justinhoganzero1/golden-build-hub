// Oracle Assisted Calling — places an outbound Twilio call to an insurer
// (HostPlus / WorkCover QLD) and then patches it through to the user's phone.
// Charges the user's wallet at Twilio cost + 50% service fee.

import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

// AU outbound rates (cents per minute, Twilio list price approximations)
// These are billed to the user as: cost + 50% service fee.
const RATE_TABLE_CPM: Record<string, number> = {
  AU_LANDLINE: 4,    // ~AU$0.04/min
  AU_MOBILE: 8,      // ~AU$0.08/min
  AU_1300: 30,       // ~AU$0.30/min (most expensive)
  AU_DEFAULT: 30,
};

function classifyAU(num: string): keyof typeof RATE_TABLE_CPM {
  const n = num.replace(/\D/g, "");
  if (n.startsWith("611300") || n.startsWith("611800") || n.startsWith("1300") || n.startsWith("1800")) return "AU_1300";
  if (n.startsWith("614") || n.startsWith("04")) return "AU_MOBILE";
  if (n.startsWith("61") || n.startsWith("0")) return "AU_LANDLINE";
  return "AU_DEFAULT";
}

interface PlaceCallBody {
  destination: string;       // e.g. +611300467875
  user_phone: string;        // e.g. +614xxxxxxxx
  action?: "estimate" | "place";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No authorization header" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userErr || !userData.user) return json({ error: "Not authenticated" }, 401);
    const user = userData.user;

    const body = (await req.json()) as PlaceCallBody;
    const { destination, user_phone, action = "estimate" } = body;
    if (!destination || !user_phone) return json({ error: "destination and user_phone required" }, 400);

    const tier = classifyAU(destination);
    const twilioCpm = RATE_TABLE_CPM[tier];
    const totalCpm = Math.ceil(twilioCpm * 1.5); // +50% service fee

    if (action === "estimate") {
      return json({
        destination,
        tier,
        twilio_cost_per_minute_cents: twilioCpm,
        service_fee_per_minute_cents: totalCpm - twilioCpm,
        total_per_minute_cents: totalCpm,
        total_per_minute_aud: (totalCpm / 100).toFixed(2),
        note: "Final charge metered per second once the call ends.",
      });
    }

    // PLACE CALL — check wallet has at least 1 minute available
    const { data: wallet } = await supabase
      .from("wallet_balances")
      .select("balance_cents")
      .eq("user_id", user.id)
      .maybeSingle();

    const balance = wallet?.balance_cents ?? 0;
    if (balance < totalCpm) {
      return json({
        error: "insufficient_balance",
        required_cents: totalCpm,
        balance_cents: balance,
        message: `You need at least AU$${(totalCpm / 100).toFixed(2)} in your wallet to start this call.`,
      }, 402);
    }

    // Place outbound call via Twilio gateway
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!TWILIO_API_KEY || !LOVABLE_API_KEY) {
      return json({ error: "Telephony not configured" }, 500);
    }

    const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") ?? "";
    if (!TWILIO_FROM) return json({ error: "TWILIO_PHONE_NUMBER not set" }, 500);

    // TwiML: dial the destination, then connect to user
    const twiml = `<Response><Say voice="alice">Connecting you to your assistant call.</Say><Dial callerId="${TWILIO_FROM}"><Number>${destination}</Number></Dial></Response>`;

    const callRes = await fetch(`${GATEWAY_URL}/Calls.json`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: user_phone,
        From: TWILIO_FROM,
        Twiml: twiml,
      }),
    });
    const callData = await callRes.json();
    if (!callRes.ok) {
      console.error("Twilio error", callData);
      return json({ error: "Twilio call failed", detail: callData }, 502);
    }

    return json({
      ok: true,
      call_sid: callData.sid,
      status: callData.status,
      tier,
      total_per_minute_cents: totalCpm,
      message: "Call placed. You'll be billed per second when it ends.",
    });
  } catch (e: any) {
    console.error("oracle-place-call error", e);
    return json({ error: e.message ?? "Unknown error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
