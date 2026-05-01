// Admin-only: grant freebie AI credits to a real registered user by email/userId.
// Coin economy: this no longer creates fake subscription access. It links to
// auth.users, tops up the wallet, and writes an audit reward_grants row.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
      return new Response(JSON.stringify({ error: "Owner access required" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const targetEmail = String(body.email || "").trim().toLowerCase();
    const userId = body.userId ? String(body.userId) : null;
    const days = Number.isFinite(Number(body.days)) ? Math.max(1, Math.min(3650, Number(body.days))) : 365;
    const amountCents = Number.isFinite(Number(body.amountCents)) ? Math.max(1, Math.min(50000, Number(body.amountCents))) : 1860;
    const reason = String(body.reason || "admin_grant");

    if (!targetEmail && !userId) {
      return new Response(JSON.stringify({ error: "email or userId required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Resolve user_id from email if needed
    let resolvedUserId = userId;
    let resolvedEmail = targetEmail;
    if (!resolvedUserId) {
      // Page through users to find by email (admin.listUsers)
      let page = 1;
      const perPage = 1000;
      while (page < 50 && !resolvedUserId) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
        if (error) throw error;
        const match = data.users.find((u) => (u.email || "").trim().toLowerCase() === targetEmail);
        if (match) { resolvedUserId = match.id; resolvedEmail = match.email!.toLowerCase(); break; }
        if (data.users.length < perPage) break;
        page += 1;
      }
    } else {
      const { data, error } = await admin.auth.admin.getUserById(resolvedUserId);
      if (error) throw error;
      resolvedEmail = (data.user?.email || "").toLowerCase();
    }

    if (!resolvedUserId) {
      return new Response(JSON.stringify({ error: `No registered user with email ${targetEmail}. They must sign up first.` }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { data: newBalance, error: topupErr } = await admin.rpc("wallet_topup", {
      _user_id: resolvedUserId,
      _amount_cents: amountCents,
    });
    if (topupErr) throw topupErr;

    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const { data: grant, error: insErr } = await admin
      .from("reward_grants")
      .insert({
        user_id: resolvedUserId,
        reward_type: "admin_freebie_coins",
        reason,
        starts_at: new Date().toISOString(),
        expires_at: expiresAt,
        active: true,
      })
      .select("id, expires_at")
      .single();
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ ok: true, userId: resolvedUserId, email: resolvedEmail, grantId: grant.id, expiresAt: grant.expires_at, amountCents, newBalanceCents: newBalance }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("admin-grant-free-access error", e);
    return new Response(JSON.stringify({ error: e?.message || "unknown error" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
