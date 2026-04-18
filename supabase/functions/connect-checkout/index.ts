// =============================================================================
// connect-checkout
// -----------------------------------------------------------------------------
// Create a Stripe Checkout session as a DIRECT CHARGE on the connected account
// with an application_fee_amount that goes back to the SOLACE platform account.
//
// Public endpoint (no auth required) — buyers don't need a SOLACE account.
// =============================================================================

import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Platform fee: 10% of the price (matches the SOLACE fee policy).
const PLATFORM_FEE_BPS = 1000; // basis points = 10.00%

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not configured.");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const body = await req.json();
    const accountId = String(body.accountId || "");
    const priceId = String(body.priceId || "");
    const quantity = Math.max(1, Number.parseInt(body.quantity, 10) || 1);

    if (!accountId.startsWith("acct_")) throw new Error("Invalid accountId");
    if (!priceId.startsWith("price_")) throw new Error("Invalid priceId");

    // We need the unit amount to compute the application fee.
    const price = await stripe.prices.retrieve(priceId, {
      stripeAccount: accountId,
    });
    if (!price.unit_amount) throw new Error("Price has no unit_amount");

    const subtotal = price.unit_amount * quantity;
    const applicationFee = Math.floor((subtotal * PLATFORM_FEE_BPS) / 10_000);

    const origin =
      req.headers.get("origin") || "https://oracle-lunar.online";

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [{ price: priceId, quantity }],
        payment_intent_data: { application_fee_amount: applicationFee },
        success_url: `${origin}/store/${accountId}?success=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/store/${accountId}?canceled=1`,
      },
      { stripeAccount: accountId } // direct charge on the connected account
    );

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
