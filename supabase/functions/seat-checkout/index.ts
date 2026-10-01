import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { safeOrigin } from "../_shared/origin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Founder seat resale: buyer pays seller's price, Oracle Lunar keeps 20%.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Payments are not configured");
    const body = await req.json().catch(() => ({}));
    const listingId = typeof body?.listing_id === "string" ? body.listing_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(listingId)) return json({ error: "Invalid listing" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Please sign in" }, 401);
    const { data: u } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    const buyer = u.user;
    if (!buyer?.email) return json({ error: "Please sign in" }, 401);

    const { data: listing } = await supabase
      .from("founder_seat_listings").select("id,seller_id,founder_number,price_cents,status")
      .eq("id", listingId).maybeSingle();
    if (!listing || listing.status !== "active") return json({ error: "This seat is no longer for sale" }, 409);
    if (listing.seller_id === buyer.id) return json({ error: "You can't buy your own seat" }, 400);

    const { data: buyerM } = await supabase.from("memberships").select("founder_number").eq("user_id", buyer.id).maybeSingle();
    if (buyerM?.founder_number) return json({ error: "You already own a founder seat" }, 400);
    const { data: sellerM } = await supabase.from("memberships").select("founder_number").eq("user_id", listing.seller_id).maybeSingle();
    if (sellerM?.founder_number !== listing.founder_number) return json({ error: "Seller no longer owns this seat" }, 409);

    const fee = Math.ceil(listing.price_cents * 0.2);
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const { data: connect } = await supabase.from("connect_accounts").select("stripe_account_id").eq("user_id", listing.seller_id).maybeSingle();
    let destination: string | null = null;
    if (connect?.stripe_account_id) {
      try { const a = await stripe.accounts.retrieve(connect.stripe_account_id); if (a.charges_enabled) destination = a.id; } catch { /* not ready */ }
    }

    const customers = await stripe.customers.list({ email: buyer.email, limit: 1 });
    const meta = {
      purchase_type: "founder_seat_resale",
      listing_id: listing.id,
      seller_id: listing.seller_id,
      buyer_id: buyer.id,
      founder_number: String(listing.founder_number),
      platform_fee_cents: String(fee),
    };
    const origin = safeOrigin(req);
    const session = await stripe.checkout.sessions.create({
      customer: customers.data[0]?.id,
      customer_email: customers.data[0]?.id ? undefined : buyer.email,
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "aud",
          product_data: { name: `Founder Seat #${listing.founder_number}`, description: "Lifetime Oracle Lunar founding membership (resale)" },
          unit_amount: listing.price_cents,
        },
        quantity: 1,
      }],
      payment_intent_data: destination
        ? { application_fee_amount: fee, transfer_data: { destination }, metadata: meta }
        : { metadata: { ...meta, payout_pending: "seller_not_connected" } },
      metadata: meta,
      success_url: `${origin}/founder-seats?bought=${listing.founder_number}`,
      cancel_url: `${origin}/founder-seats`,
    });
    console.log("[SEAT-CHECKOUT] created", { listing: listing.id, session: session.id, destination: !!destination });
    return json({ url: session.url });
  } catch (e) {
    console.error("[SEAT-CHECKOUT]", e);
    return json({ error: e instanceof Error ? e.message : "Checkout failed" }, 500);
  }
});
