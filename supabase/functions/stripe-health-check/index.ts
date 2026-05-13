// Stripe Health Check — owner-only.
// Verifies: secret key works, webhook endpoint is registered & enabled,
// customer portal config exists, and Connect/payouts settings.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PROJECT_REF = Deno.env.get("SUPABASE_URL")?.match(/https:\/\/([^.]+)\./)?.[1] ?? "";
const EXPECTED_WEBHOOK_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/stripe-webhook`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const checks: Array<{ name: string; ok: boolean; detail: string }> = [];
  const ok = (name: string, detail = "OK") => checks.push({ name, ok: true, detail });
  const fail = (name: string, detail: string) => checks.push({ name, ok: false, detail });

  try {
    // Auth: owner only
    const auth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false } }
    );
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "auth required" }), { status: 401, headers: corsHeaders });
    const { data: c, error: ce } = await auth.auth.getClaims(token);
    const email = (c?.claims?.email as string | undefined)?.toLowerCase().trim();
    if (ce || email !== "justinbretthogan@gmail.com") {
      return new Response(JSON.stringify({ error: "owner only" }), { status: 403, headers: corsHeaders });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

    if (!stripeKey) {
      fail("STRIPE_SECRET_KEY", "Not configured");
      return new Response(JSON.stringify({ checks, expected_webhook_url: EXPECTED_WEBHOOK_URL }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    ok("STRIPE_SECRET_KEY", `${stripeKey.startsWith("sk_live_") ? "LIVE" : "TEST"} mode`);

    if (!webhookSecret) fail("STRIPE_WEBHOOK_SECRET", "Not configured");
    else ok("STRIPE_WEBHOOK_SECRET", "Configured");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Account
    let accountId = "";
    try {
      const acct = await stripe.accounts.retrieve();
      accountId = acct.id;
      ok("Stripe account", `${acct.business_profile?.name ?? acct.email ?? acct.id} (${acct.country})`);
      if (acct.charges_enabled) ok("Charges enabled", "Live charges allowed");
      else fail("Charges enabled", "Account cannot accept charges yet");
      if (acct.payouts_enabled) ok("Payouts enabled", "Bank payouts active");
      else fail("Payouts enabled", "No bank account linked yet");
    } catch (e) {
      fail("Stripe account", e instanceof Error ? e.message : String(e));
    }

    // Webhook endpoint
    try {
      const eps = await stripe.webhookEndpoints.list({ limit: 100 });
      const match = eps.data.find((e) => e.url === EXPECTED_WEBHOOK_URL);
      if (!match) {
        fail(
          "Webhook endpoint",
          `No endpoint registered for ${EXPECTED_WEBHOOK_URL}. Register it in Stripe Dashboard → Webhooks.`
        );
      } else if (match.status !== "enabled") {
        fail("Webhook endpoint", `Endpoint exists but status=${match.status}`);
      } else {
        const required = ["checkout.session.completed", "payment_intent.succeeded"];
        const enabled = match.enabled_events ?? [];
        const missing = enabled.includes("*") ? [] : required.filter((r) => !enabled.includes(r));
        if (missing.length === 0) ok("Webhook endpoint", `Enabled — ${enabled.length} events`);
        else fail("Webhook endpoint", `Missing events: ${missing.join(", ")}`);
      }
    } catch (e) {
      fail("Webhook endpoint", e instanceof Error ? e.message : String(e));
    }

    // Customer portal
    try {
      const portals = await stripe.billingPortal.configurations.list({ limit: 5 });
      const active = portals.data.find((p) => p.active);
      if (active) ok("Customer portal", "Active configuration found");
      else fail("Customer portal", "No active portal config — activate at https://dashboard.stripe.com/settings/billing/portal");
    } catch (e) {
      fail("Customer portal", e instanceof Error ? e.message : String(e));
    }

    // Connect (creators payout) — capability check
    try {
      const acct = await stripe.accounts.retrieve();
      const caps = acct.capabilities ?? {};
      if (caps.transfers === "active") ok("Stripe Connect", "Transfers capability active (creator payouts ready)");
      else if (caps.transfers) fail("Stripe Connect", `Transfers capability=${caps.transfers}`);
      else fail("Stripe Connect", "Transfers capability not enabled — request it in Stripe Connect settings");
    } catch (e) {
      fail("Stripe Connect", e instanceof Error ? e.message : String(e));
    }

    // Recent webhook health from event log
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: recent } = await svc
      .from("stripe_event_log")
      .select("status")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    const total = recent?.length ?? 0;
    const failed = (recent ?? []).filter((r) => r.status === "error" || r.status === "signature_failed").length;
    if (total === 0) {
      fail("Recent webhook traffic", "No events in the last 24h — webhook may not be wired up yet");
    } else if (failed > 0) {
      fail("Recent webhook traffic", `${failed}/${total} failed in last 24h`);
    } else {
      ok("Recent webhook traffic", `${total} events processed cleanly in last 24h`);
    }

    return new Response(
      JSON.stringify({
        checks,
        all_ok: checks.every((c) => c.ok),
        expected_webhook_url: EXPECTED_WEBHOOK_URL,
        account_id: accountId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e), checks }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
