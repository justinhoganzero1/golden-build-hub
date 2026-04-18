// =============================================================================
// connect-account
// -----------------------------------------------------------------------------
// Stripe Connect onboarding helper using the standard v1 API (Express accounts).
//   action: "create"   -> create an Express connected account + DB mapping
//   action: "link"     -> generate an account-onboarding hosted link
//   action: "status"   -> fetch live onboarding status from Stripe
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
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error(
        "STRIPE_SECRET_KEY is not configured. Add it in Lovable Cloud → Backend → Secrets."
      );
    }
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body = await req.json().catch(() => ({}));
    const action = body.action as "create" | "link" | "status";
    log("Invoked", { action, userId: user.id });

    // -------------------- ACTION: create --------------------
    if (action === "create") {
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

      // Standard v1 Express account — works with current Stripe SDK.
      const account = await stripe.accounts.create({
        type: "express",
        email: contactEmail,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: displayName,
        },
      });
      log("Express account created", { accountId: account.id });

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

    // -------------------- ACTION: link --------------------
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

      const accountLink = await stripe.accountLinks.create({
        account: row.stripe_account_id,
        refresh_url: `${origin}/creators?connect=refresh`,
        return_url: `${origin}/creators?connect=return&accountId=${row.stripe_account_id}`,
        type: "account_onboarding",
      });
      return json({ url: accountLink.url });
    }

    // -------------------- ACTION: status --------------------
    if (action === "status") {
      const { data: row } = await supabaseAdmin
        .from("connect_accounts")
        .select("stripe_account_id, display_name, contact_email")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!row?.stripe_account_id) {
        return json({ hasAccount: false });
      }

      const account = await stripe.accounts.retrieve(row.stripe_account_id);
      const cardStatus = account?.capabilities?.card_payments ?? null;
      const onboardingComplete =
        !!account?.details_submitted && !!account?.charges_enabled;

      return json({
        hasAccount: true,
        accountId: row.stripe_account_id,
        displayName: row.display_name,
        contactEmail: row.contact_email,
        readyToProcessPayments: !!account?.charges_enabled,
        onboardingComplete,
        requirementsStatus: account?.requirements?.disabled_reason ?? null,
        cardPaymentsStatus: cardStatus,
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
