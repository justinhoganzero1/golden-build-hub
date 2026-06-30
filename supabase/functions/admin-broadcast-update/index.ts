import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OWNER_EMAIL = "justinbretthogan@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is owner
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userRes } = await userClient.auth.getUser();
    const email = (userRes?.user?.email || "").toLowerCase().trim();
    if (email !== OWNER_EMAIL) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const message: string = (body.message || "").toString().trim();
    const ctaLabel: string | null = body.cta_label ? String(body.cta_label) : null;
    const ctaUrl: string | null = body.cta_url ? String(body.cta_url) : null;
    const style: string = body.style || "promo";
    const grantCoins: number = Math.max(0, Math.min(1000, Number(body.grant_coins ?? 5)));
    // 5.37 coins per $1 → cents = round(coins / 5.37 * 100)
    const grantCents = grantCoins > 0 ? Math.round((grantCoins / 5.37) * 100) : 0;

    if (!message) {
      return new Response(JSON.stringify({ error: "message required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) Publish announcement (deactivate prior active ones, insert fresh active)
    await admin.from("site_announcements").update({ active: false }).eq("active", true);
    const { error: annErr } = await admin.from("site_announcements").insert({
      message, cta_label: ctaLabel, cta_url: ctaUrl, style, active: true,
    });
    if (annErr) throw annErr;

    // 2) Grant coins to every user
    let granted = 0;
    let failed = 0;
    if (grantCents > 0) {
      // paginate auth.users
      let page = 1;
      const perPage = 1000;
      while (true) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
        if (error) throw error;
        const users = data?.users || [];
        if (users.length === 0) break;
        for (const u of users) {
          const { error: topErr } = await admin.rpc("wallet_topup_logged", {
            _user_id: u.id,
            _amount_cents: grantCents,
            _gross_cents: grantCents,
            _fee_cents: 0,
            _source: "admin_broadcast",
            _metadata: { broadcast_message: message, grant_coins: grantCoins },
          });
          if (topErr) failed++; else granted++;
        }
        if (users.length < perPage) break;
        page++;
      }
    }

    return new Response(JSON.stringify({ ok: true, granted, failed, grant_coins: grantCoins, grant_cents: grantCents }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
