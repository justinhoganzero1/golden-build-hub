import { statusFor } from "../_shared/errorStatus.ts";
import { safeOrigin } from "../_shared/origin.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { type StripeEnv, createEmbeddedSession } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: any) =>
  console.log(`[SHOP-CHECKOUT] ${s}${d ? ` ${JSON.stringify(d)}` : ""}`);

// Creator Shop checkout via Lovable built-in payments (embedded).
// The full amount is collected by the platform; the creator's 80% share is
// recorded on the purchase row (creator_payout_cents) and paid out from the
// creator earnings ledger. The payments webhook marks the purchase paid.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { item_id, item_kind, environment } = await req.json();
    if (!item_id || !["media", "gif", "movie", "realm", "module"].includes(item_kind))
      throw new Error("Invalid item");
    if (environment !== "sandbox" && environment !== "live") throw new Error("invalid environment");
    const env: StripeEnv = environment;

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
    const table =
      item_kind === "media" ? "user_media"
      : item_kind === "gif" ? "living_gifs"
      : item_kind === "realm" ? "user_realms"
      : item_kind === "module" ? "creator_modules"
      : "movie_projects";
    const { data: item, error: itemErr } = await supabase
      .from(table)
      .select("id,user_id,title,shop_enabled,shop_price_cents,is_public")
      .eq("id", item_id)
      .maybeSingle();

    if (itemErr || !item) throw new Error("Item not found");
    if (!item.is_public || !item.shop_enabled || item.shop_price_cents <= 0)
      throw new Error("Item is not for sale");
    if (item.user_id === buyer.id) throw new Error("You cannot buy your own item");

    const platformFee = Math.ceil(item.shop_price_cents * 0.20);
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

    const origin = safeOrigin(req);
    const { clientSecret, sessionId } = await createEmbeddedSession({
      env,
      userId: buyer.id,
      email: buyer.email,
      priceData: {
        currency: "usd",
        unit_amount: item.shop_price_cents,
        name: item.title || `Creator item (${item_kind})`,
        description: `Public Library purchase — ${item_kind}`,
      },
      returnUrl: item_kind === "module"
        ? `${origin}/module-shop?bought=${item_id}&session_id={CHECKOUT_SESSION_ID}`
        : `${origin}/purchase-success?purchase_id=${purchase.id}&item_kind=${item_kind}&item_id=${item_id}&session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        purchase_id: purchase.id,
        item_id,
        item_kind,
        creator_id: item.user_id,
        buyer_id: buyer.id,
      },
    });

    await supabase
      .from("shop_purchases")
      .update({ stripe_session_id: sessionId })
      .eq("id", purchase.id);

    log("created", { sessionId, purchaseId: purchase.id });
    return new Response(JSON.stringify({ clientSecret, creatorReady: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    log("ERROR", { message: e.message });
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: statusFor(e),
    });
  }
});
