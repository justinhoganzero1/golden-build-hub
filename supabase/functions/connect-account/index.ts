// =============================================================================
// connect-account
// -----------------------------------------------------------------------------
// Stripe Connect (V2) onboarding helper. Single function with 3 actions so we
// don't pollute config.toml with multiple functions:
//   action: "create"   -> create a V2 connected account + DB mapping
//   action: "link"     -> generate an account-onboarding hosted link
//   action: "status"   -> fetch live onboarding status from Stripe
//
// Demo notes:
// - Each authenticated user gets one connected account (1:1 in connect_accounts).
// - We always read status live from Stripe, never from the DB cache.
// - In production, add per-user rate limiting and audit logging.
// =============================================================================

import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const tail = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CONNECT-ACCOUNT] ${step}${tail}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ---- Validate Stripe key (never hard-code) -----------------------------
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error(
        "STRIPE_SECRET_KEY is not configured. Add it in Lovable Cloud → Backend → Secrets."
      );
    }
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // ---- Auth: require a logged-in Lovable user ----------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    // Anon client to validate the user's JWT
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const { data: userRes, error: userErr } = await supabaseAuth.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userErr) throw new Error(`Auth error: ${userErr.message}`);
    const user = userRes.user;
    if (!user?.email) throw new Error("User not authenticated");

    // Service-role client for writing connect_accounts
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body = await req.json().catch(() => ({}));
    const action = body.action as "create" | "link" | "status";
    log("Invoked", { action, userId: user.id });

    // -----------------------------------------------------------------------
    // ACTION: create
    // -----------------------------------------------------------------------
    if (action === "create") {
      // If the user already has a Connect account, return it (idempotent).
      const { data: existing } = await supabaseAdmin
        .from("connect_accounts")
        .select("stripe_account_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing?.stripe_account_id) {
        log("Existing account found", existing);
        return json({ accountId: existing.stripe_account_id, existed: true });
      }

      const displayName: string =
        body.displayName?.toString().trim() || user.email.split("@")[0];
      const contactEmail: string =
        body.contactEmail?.toString().trim() || user.email;

      // V2 account creation per Stripe Connect spec.
      // NOTE: Do NOT pass top-level `type` — V2 uses `configuration` instead.
      const account = await (stripe as any).v2.core.accounts.create({
        display_name: displayName,
        contact_email: contactEmail,
        identity: { country: "us" },
        dashboard: "full",
        defaults: {
          responsibilities: {
            fees_collector: "stripe",
            losses_collector: "stripe",
          },
        },
        configuration: {
          customer: {},
          merchant: {
            capabilities: {
              card_payments: { requested: true },
            },
          },
        },
      });
      log("V2 account created", { accountId: account.id });

      const { error: insertErr } = await supabaseAdmin
        .from("connect_accounts")
        .insert({
          user_id: user.id,
          stripe_account_id: account.id,
          display_name: displayName,
          contact_email: contactEmail,
        });
      if (insertErr) {
        log("DB insert failed", insertErr);
        throw new Error(`Failed to store mapping: ${insertErr.message}`);
      }

      return json({ accountId: account.id, existed: false });
    }

    // -----------------------------------------------------------------------
    // ACTION: link  (hosted onboarding URL)
    // -----------------------------------------------------------------------
    if (action === "link") {
      const { data: row } = await supabaseAdmin
        .from("connect_accounts")
        .select("stripe_account_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!row?.stripe_account_id) {
        throw new Error("No Connect account found. Create one first.");
      }

      const origin =
        req.headers.get("origin") ||
        body.origin ||
        "https://oracle-lunar.online";

      const accountLink = await (stripe as any).v2.core.accountLinks.create({
        account: row.stripe_account_id,
        use_case: {
          type: "account_onboarding",
          account_onboarding: {
            configurations: ["merchant", "customer"],
            refresh_url: `${origin}/creators?connect=refresh`,
            return_url: `${origin}/creators?connect=return&accountId=${row.stripe_account_id}`,
          },
        },
      });
      return json({ url: accountLink.url });
    }

    // -----------------------------------------------------------------------
    // ACTION: status  (live read from Stripe)
    // -----------------------------------------------------------------------
    if (action === "status") {
      const { data: row } = await supabaseAdmin
        .from("connect_accounts")
        .select("stripe_account_id, display_name, contact_email")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!row?.stripe_account_id) {
        return json({ hasAccount: false });
      }

      const account = await (stripe as any).v2.core.accounts.retrieve(
        row.stripe_account_id,
        { include: ["configuration.merchant", "requirements"] }
      );

      const cardStatus =
        account?.configuration?.merchant?.capabilities?.card_payments?.status;
      const reqStatus = account?.requirements?.summary?.minimum_deadline?.status;
      const onboardingComplete =
        reqStatus !== "currently_due" && reqStatus !== "past_due";

      return json({
        hasAccount: true,
        accountId: row.stripe_account_id,
        displayName: row.display_name,
        contactEmail: row.contact_email,
        readyToProcessPayments: cardStatus === "active",
        onboardingComplete,
        requirementsStatus: reqStatus ?? null,
        cardPaymentsStatus: cardStatus ?? null,
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
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
