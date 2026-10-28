import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { safeOrigin } from "../_shared/origin.ts";
import { type StripeEnv, createEmbeddedSession } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Founder seat resale: buyer pays the seller's listed price via Lovable
// built-in payments (embedded checkout). The full amount is collected by the
// platform; the seller's 80% share is paid out from the platform. The
// payments webhook transfers the seat exactly once.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const listingId = typeof body?.listing_id === "string" ? body.listing_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(listingId)) return json({ error: "Invalid listing" }, 400);
    if (body?.environment !== "sandbox" && body?.environment !== "live") return json({ error: "invalid environment" }, 400);
    const env: StripeEnv = body.environment;

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
    const meta = {
      purchase_type: "founder_seat_resale",
      listing_id: listing.id,
      seller_id: listing.seller_id,
      buyer_id: buyer.id,
      founder_number: String(listing.founder_number),
      platform_fee_cents: String(fee),
    };
    const origin = safeOrigin(req);
    const { clientSecret } = await createEmbeddedSession({
      env,
      userId: buyer.id,
      email: buyer.email,
      priceData: {
        currency: "aud",
        unit_amount: listing.price_cents,
        name: `Founder Seat #${listing.founder_number} (resale)`,
        description: "Lifetime founder membership transferred from the current owner.",
      },
      returnUrl: `${origin}/founder-seats?bought=${listing.founder_number}&session_id={CHECKOUT_SESSION_ID}`,
      metadata: meta,
    });
    console.log("[SEAT-CHECKOUT] created", { listing: listing.id });
    return json({ clientSecret });
  } catch (e) {
    console.error("[SEAT-CHECKOUT]", e);
    return json({ error: e instanceof Error ? e.message : "Checkout failed" }, 500);
  }
});
