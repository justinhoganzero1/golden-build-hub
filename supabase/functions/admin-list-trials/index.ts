// Admin-only: returns all users with an active reward_grants row
// (trial / freebie / free-for-life) joined with their email + last sign-in.
// Fast — no Stripe calls. Used by the Owner Dashboard "Trial Users" tab.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OWNER_EMAIL = "justinbretthogan@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: caller } = await userClient.auth.getUser();
    const callerEmail = (caller?.user?.email || "").trim().toLowerCase();
    if (callerEmail !== OWNER_EMAIL) {
      return new Response(JSON.stringify({ error: "Owner access required" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Pull all active grants
    const { data: grants, error: gErr } = await admin
      .from("reward_grants")
      .select("user_id, reward_type, reason, expires_at, created_at")
      .eq("active", true)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (gErr) throw gErr;

    // Reduce to one record per user (prefer free_for_life, then most recent)
    const byUser = new Map<string, any>();
    for (const g of grants ?? []) {
      const ffl = g.reward_type === "free_for_life" || g.reason === "free_for_life";
      const prev = byUser.get(g.user_id);
      if (!prev || (ffl && !prev.free_for_life)) {
        byUser.set(g.user_id, { ...g, free_for_life: ffl });
      }
    }

    // 2. Fetch matching auth users
    const userIds = Array.from(byUser.keys());
    const userInfo = new Map<string, { email: string; created_at: string; last_sign_in_at: string | null }>();
    // listUsers paginates; cheaper to fetch each by id (small set in practice)
    await Promise.all(userIds.map(async (id) => {
      try {
        const { data } = await admin.auth.admin.getUserById(id);
        if (data?.user) {
          userInfo.set(id, {
            email: data.user.email ?? "",
            created_at: data.user.created_at,
            last_sign_in_at: data.user.last_sign_in_at ?? null,
          });
        }
      } catch (_e) { /* skip */ }
    }));

    const trials = Array.from(byUser.entries()).map(([id, g]) => {
      const u = userInfo.get(id);
      return {
        id,
        email: u?.email ?? null,
        created_at: u?.created_at ?? null,
        last_sign_in_at: u?.last_sign_in_at ?? null,
        reward_type: g.reward_type,
        grant_reason: g.reason,
        grant_expires_at: g.expires_at,
        grant_created_at: g.created_at,
        free_for_life: !!g.free_for_life,
        freebie_active: true,
      };
    }).sort((a, b) => (b.grant_created_at || "").localeCompare(a.grant_created_at || ""));

    return new Response(JSON.stringify({ trials, count: trials.length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("admin-list-trials error", e);
    return new Response(JSON.stringify({ error: e?.message || "unknown error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
