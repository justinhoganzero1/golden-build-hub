// =============================================================================
// connect-products
// -----------------------------------------------------------------------------
// Manage products on a Stripe connected account using the Stripe-Account header.
//   action: "create" -> create a product+price on the user's connected account
//   action: "list"   -> list products for an arbitrary connected account (public)
//
// "list" is intentionally public so the storefront /store/:accountId works for
// unauthenticated visitors. "create" requires auth.
// =============================================================================

import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not configured.");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const body = await req.json().catch(() => ({}));
    const action = body.action as "create" | "list";

    // -------------------------------------------------------------------------
    // LIST (public): retrieve products for a given connected account ID.
    // -------------------------------------------------------------------------
    if (action === "list") {
      const accountId = String(body.accountId || "").trim();
      if (!accountId.startsWith("acct_")) {
        throw new Error("Invalid accountId");
      }
      const products = await stripe.products.list(
        { limit: 20, active: true, expand: ["data.default_price"] },
        { stripeAccount: accountId } // Stripe-Account header → connected account
      );
      return json({
        products: products.data.map((p) => {
          const price = p.default_price as Stripe.Price | null;
          return {
            id: p.id,
            name: p.name,
            description: p.description,
            image: p.images?.[0] ?? null,
            priceId: price?.id ?? null,
            unitAmount: price?.unit_amount ?? null,
            currency: price?.currency ?? "usd",
          };
        }),
      });
    }

    // -------------------------------------------------------------------------
    // CREATE (authenticated): create on the caller's connected account.
    // -------------------------------------------------------------------------
    if (action === "create") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Missing Authorization header");

      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? ""
      );
      const { data: userRes } = await supabaseAuth.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      const user = userRes.user;
      if (!user) throw new Error("Not authenticated");

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      const { data: row } = await supabaseAdmin
        .from("connect_accounts")
        .select("stripe_account_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!row?.stripe_account_id) {
        throw new Error("Onboard a Connect account first.");
      }

      const name = String(body.name || "").trim();
      const description = String(body.description || "").trim() || undefined;
      const priceCents = Number.parseInt(body.priceCents, 10);
      const currency = String(body.currency || "usd").toLowerCase();
      if (!name) throw new Error("name is required");
      if (!Number.isFinite(priceCents) || priceCents < 50) {
        throw new Error("priceCents must be at least 50 (Stripe minimum)");
      }

      const product = await stripe.products.create(
        {
          name,
          description,
          default_price_data: { unit_amount: priceCents, currency },
        },
        { stripeAccount: row.stripe_account_id }
      );

      return json({ productId: product.id });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function json(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
