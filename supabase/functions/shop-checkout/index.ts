import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: any) =>
  console.log(`[SHOP-CHECKOUT] ${s}${d ? ` ${JSON.stringify(d)}` : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY missing");

    const { item_id, item_kind } = await req.json();
    if (!item_id || !["media", "gif", "movie"].includes(item_kind))
      throw new Error("Invalid item");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("No auth");
    const { data: u } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    const buyer = u.user;
    if (!buyer?.email) throw new Error("Not authenticated");

    // Fetch item (uses service role — bypasses RLS for shop logic)
    const table = item_kind === "media" ? "user_media" : item_kind === "gif" ? "living_gifs" : "movie_projects";
    const { data: item, error: itemErr } = await supabase
      .from(table)
      .select("id,user_id,title,shop_enabled,shop_price_cents,is_public")
      .eq("id", item_id)
      .maybeSingle();

    if (itemErr || !item) throw new Error("Item not found");
    if (!item.is_public || !item.shop_enabled || item.shop_price_cents <= 0)
      throw new Error("Item is not for sale");
    if (item.user_id === buyer.id) throw new Error("You cannot buy your own item");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Lookup or create Stripe customer
    const customers = await stripe.customers.list({ email: buyer.email, limit: 1 });
    const customerId = customers.data[0]?.id;

    const platformFee = Math.ceil(item.shop_price_cents * 0.30);
    const creatorPayout = item.shop_price_cents - platformFee;

    // Create pending purchase row
    const { data: purchase, error: pErr } = await supabase
      .from("shop_purchases")
      .insert({
        buyer_id: buyer.id,
        creator_id: item.user_id,
        item_kind,
        item_id,
        amount_cents: item.shop_price_cents,
        platform_fee_cents: platformFee,
        creator_payout_cents: creatorPayout,
        status: "pending",
      })
      .select("id")
      .single();
    if (pErr) throw pErr;

    const origin = req.headers.get("origin") || "https://oracle-lunar.online";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : buyer.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: item.title || `Creator item (${item_kind})`,
              description: `Public Library purchase — ${item_kind}`,
            },
            unit_amount: item.shop_price_cents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        purchase_id: purchase.id,
        item_id,
        item_kind,
        creator_id: item.user_id,
        buyer_id: buyer.id,
      },
      success_url: `${origin}/purchase-success?purchase_id=${purchase.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/library/public?purchase=cancel`,
    });

    await supabase
      .from("shop_purchases")
      .update({ stripe_session_id: session.id })
      .eq("id", purchase.id);

    log("created", { sessionId: session.id, purchaseId: purchase.id });
    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    log("ERROR", { message: e.message });
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
