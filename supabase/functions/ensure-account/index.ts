// Per-user account provisioning.
// Called on every sign-in / session restore. Idempotent.
// Guarantees the signed-in user has: member role, profile row, wallet row,
// and the one-time welcome coins. Returns their own wallet + AI usage summary
// so the client can show "your usage / your balance" without extra round-trips.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "auth_required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "auth_required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    // 1. Member role (idempotent)
    await admin.from("user_roles")
      .upsert({ user_id: userId, role: "user" }, { onConflict: "user_id,role", ignoreDuplicates: true });

    // 2. Profile row
    await admin.from("profiles").upsert(
      {
        user_id: userId,
        display_name:
          (user.user_metadata?.display_name as string | undefined) ??
          (user.email ? user.email.split("@")[0] : "Member"),
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    );

    // 3. Wallet row + one-time welcome coins (server-side, idempotent)
    await admin.from("wallet_balances")
      .upsert({ user_id: userId, balance_cents: 0 }, { onConflict: "user_id", ignoreDuplicates: true });
    await admin.rpc("grant_signup_welcome", { _user_id: userId });

    // 4. Return this user's own wallet + usage
    const { data: wallet } = await admin
      .from("wallet_balances")
      .select("balance_cents, currency")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: charges } = await admin
      .from("ai_charges")
      .select("service, total_cents, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);

    const spent_cents = (charges ?? []).reduce((sum, c) => sum + (c.total_cents ?? 0), 0);
    const by_service: Record<string, number> = {};
    for (const c of charges ?? []) {
      by_service[c.service] = (by_service[c.service] ?? 0) + (c.total_cents ?? 0);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        user_id: userId,
        balance_cents: wallet?.balance_cents ?? 0,
        currency: wallet?.currency ?? "AUD",
        spent_cents,
        charge_count: charges?.length ?? 0,
        by_service,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
