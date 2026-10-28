import { statusFor } from "../_shared/errorStatus.ts";
import { safeOrigin } from "../_shared/origin.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { type StripeEnv, createEmbeddedSession } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Sliding-scale price for a 10-scene Movie Studio block.
// 1st block: $5, 2nd: $10, 3rd: $30, 4th: $50, 5th: $70, ... +$20 each up to block 20.
// Block 21+ : $1000 each. Admin bypasses entirely on the client.
function priceForBlockUSD(blockNumber: number): number {
  if (blockNumber <= 0) return 0;
  if (blockNumber === 1) return 5;
  if (blockNumber === 2) return 10;
  if (blockNumber <= 20) return 10 + (blockNumber - 2) * 20; // 30, 50, 70 ... 370
  return 1000;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const { blockNumber, environment } = await req.json();
    if (environment !== "sandbox" && environment !== "live") throw new Error("invalid environment");
    const env: StripeEnv = environment;
    const block = Math.max(1, Math.floor(Number(blockNumber) || 1));
    const usd = priceForBlockUSD(block);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseClient.auth.getUser(token);
    if (userErr) throw new Error(`Auth error: ${userErr.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");

    const origin = safeOrigin(req);

    const { clientSecret, sessionId } = await createEmbeddedSession({
      env,
      userId: user.id,
      email: user.email,
      priceData: {
        currency: "usd",
        unit_amount: usd * 100,
        name: `Movie Studio — Scene Block ${block} (10 scenes)`,
        description: block === 1
          ? "First-time launch pricing for your first 10 scenes."
          : `Sliding-scale price for your block #${block} of 10 scenes.`,
      },
      returnUrl: `${origin}/photography-hub?block_paid=${block}&session_id={CHECKOUT_SESSION_ID}`,
      metadata: { purchase_type: "movie_block", kind: "movie-block", block: String(block), user_id: user.id },
    });

    return new Response(JSON.stringify({ clientSecret, amount_usd: usd, block }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: statusFor(e),
    });
  }
});
