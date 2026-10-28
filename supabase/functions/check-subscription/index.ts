import { statusFor } from "../_shared/errorStatus.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Subscription status is read from the database (memberships + subscriptions
// tables), which the signed payments webhook keeps current. No direct Stripe
// calls — works with Lovable built-in payments in both test and live.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    const userId = claimsData.claims.sub as string;
    const email = typeof claimsData.claims.email === "string" ? claimsData.claims.email : null;
    if (!email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { email });

    if (body.admin_count === true || body.admin_users === true) {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail !== "justinbretthogan@gmail.com") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        });
      }

      // Page through ALL auth.users (admin API caps at 1000 per page)
      const allUsers: Array<{ id: string; email?: string; created_at?: string; last_sign_in_at?: string | null }> = [];
      let page = 1;
      while (true) {
        const { data, error } = await supabaseClient.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        allUsers.push(...data.users.map(u => ({
          id: u.id,
          email: u.email ?? "",
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
        })));
        if (data.users.length < 1000) break;
        page += 1;
        if (page > 50) break; // safety
      }

      const { count: activeTrials, error: trialsError } = await supabaseClient
        .from("reward_grants")
        .select("id", { count: "exact", head: true })
        .eq("active", true)
        .gt("expires_at", new Date().toISOString());
      if (trialsError) throw trialsError;

      // Paid members = active subscriptions (webhook-maintained) + founder seats
      const { count: activeSubs } = await supabaseClient
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .in("status", ["active", "trialing"]);
      const { count: founderCount } = await supabaseClient
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .not("founder_number", "is", null);
      const paidCount = (activeSubs ?? 0) + (founderCount ?? 0);

      // "Online" = signed in within the last 5 minutes
      const ONLINE_WINDOW_MS = 5 * 60 * 1000;
      const now = Date.now();

      // Pull all active reward grants once so we can mark trial / FFL per user
      const { data: activeGrants } = await supabaseClient
        .from("reward_grants")
        .select("user_id, reward_type, reason, expires_at, created_at")
        .eq("active", true)
        .gt("expires_at", new Date().toISOString());
      const grantsByUser = new Map<string, { reward_type: string | null; reason: string | null; expires_at: string; created_at: string; freeForLife: boolean }>();
      for (const g of (activeGrants ?? []) as any[]) {
        const ffl = g.reward_type === "free_for_life" || g.reason === "free_for_life";
        const prev = grantsByUser.get(g.user_id);
        if (!prev || (ffl && !prev.freeForLife)) {
          grantsByUser.set(g.user_id, { ...g, freeForLife: ffl });
        }
      }

      const enriched = allUsers.map(u => {
        const lastMs = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0;
        const grant = grantsByUser.get(u.id);
        return {
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          online: lastMs > 0 && (now - lastMs) <= ONLINE_WINDOW_MS,
          freebie_active: !!grant,
          free_for_life: !!grant?.freeForLife,
          grant_expires_at: grant?.expires_at ?? null,
          grant_reason: grant?.reason ?? null,
        };
      });

      const onlineCount = enriched.filter(u => u.online).length;

      // Failed signup count (last 30 days)
      const since = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { count: failedSignups } = await supabaseClient
        .from("signup_failures")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since);

      return new Response(JSON.stringify({
        total_users: enriched.length,
        paid_count: paidCount,
        trial_count: activeTrials ?? 0,
        online_count: onlineCount,
        offline_count: enriched.length - onlineCount,
        failed_signups_30d: failedSignups ?? 0,
        revenue: 0,
        users: body.admin_users === true ? enriched : undefined,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Member path: read webhook-maintained tables.
    const { data: membership } = await supabaseClient
      .from("memberships")
      .select("founder_number, monthly_active_until, stripe_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();

    const isFounder = membership?.founder_number != null;
    const monthlyActive = !!membership?.monthly_active_until && new Date(membership.monthly_active_until) > new Date();

    // AI Partner or any other active subscription
    const { data: subs } = await supabaseClient
      .from("subscriptions")
      .select("price_id, product_id, status, current_period_end, cancel_at_period_end")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    const activeSub = (subs ?? []).find((s) =>
      (["active", "trialing"].includes(s.status) && (!s.current_period_end || new Date(s.current_period_end) > new Date()))
      || (s.status === "canceled" && s.current_period_end && new Date(s.current_period_end) > new Date())
    );

    const subscribed = isFounder || monthlyActive || !!activeSub;
    logStep("Status", { isFounder, monthlyActive, activeSub: activeSub?.price_id ?? null });

    return new Response(JSON.stringify({
      subscribed,
      product_id: activeSub?.product_id ?? null,
      price_id: activeSub?.price_id ?? null,
      subscription_end: isFounder ? null : (membership?.monthly_active_until ?? activeSub?.current_period_end ?? null),
      lifetime: isFounder,
      founder_number: membership?.founder_number ?? null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: statusFor(error),
    });
  }
});
