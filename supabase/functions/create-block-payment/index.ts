import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const { blockNumber } = await req.json();
    const block = Math.max(1, Math.floor(Number(blockNumber) || 1));
    const usd = priceForBlockUSD(block);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseClient.auth.getUser(token);
    if (userErr) throw new Error(`Auth error: ${userErr.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;

    const origin = req.headers.get("origin") || "https://golden-vault-builder.lovable.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: `Movie Studio — Scene Block ${block} (10 scenes)`,
            description: block === 1
              ? "First-time launch pricing for your first 10 scenes."
              : `Sliding-scale price for your block #${block} of 10 scenes.`,
          },
          unit_amount: usd * 100,
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${origin}/photography-hub?block_paid=${block}`,
      cancel_url: `${origin}/photography-hub?block_canceled=1`,
      metadata: { kind: "movie-block", block: String(block), user_id: user.id },
    });

    return new Response(JSON.stringify({ url: session.url, amount_usd: usd, block }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
