// Seller payouts: creators and founder-seat sellers view earnings and
// request withdrawal; the owner reviews and marks requests paid.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ error: "Sign in required" }, 401);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: "Sign in required" }, 401);

    const { action, ...body } = await req.json();

    const earningsOf = async (uid: string) => {
      const [{ data: shop }, { data: seats }, { data: balance }] = await Promise.all([
        supabase.from("shop_purchases").select("creator_payout_cents").eq("creator_id", uid).eq("status", "paid"),
        supabase.from("founder_seat_listings").select("price_cents").eq("seller_id", uid).eq("status", "sold"),
        supabase.rpc("seller_available_balance", { user_uuid: uid }),
      ]);
      const shopCents = (shop ?? []).reduce((s, r) => s + (r.creator_payout_cents ?? 0), 0);
      const seatCents = (seats ?? []).reduce((s, r) => s + (r.price_cents ?? 0), 0);
      return { shopCents, seatCents, availableCents: balance ?? 0 };
    };

    if (action === "balance") {
      return json(await earningsOf(user.id));
    }

    if (action === "request") {
      const amountCents = Math.floor(Number(body.amountCents));
      const method = String(body.method ?? "payid");
      const destination = String(body.destination ?? "").trim();
      if (!Number.isFinite(amountCents) || amountCents < 500) {
        return json({ error: "Minimum payout is $5." }, 400);
      }
      if (!destination || destination.length < 4 || destination.length > 200) {
        return json({ error: "Enter your PayID, bank or PayPal details." }, 400);
      }
      if (!["payid", "bank", "paypal"].includes(method)) {
        return json({ error: "Unknown payout method." }, 400);
      }
      const { availableCents } = await earningsOf(user.id);
      if (amountCents > availableCents) {
        return json({ error: "That is more than your available balance." }, 400);
      }
      const { error } = await supabase.from("payout_requests").insert({
        user_id: user.id,
        amount_cents: amountCents,
        method,
        destination,
      });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "my_requests") {
      const { data, error } = await supabase
        .from("payout_requests")
        .select("id, amount_cents, method, destination, status, admin_note, created_at, processed_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return json({ requests: data ?? [] });
    }

    // Owner-only actions below
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Owner only" }, 403);

    if (action === "list_all") {
      const { data, error } = await supabase
        .from("payout_requests")
        .select("id, user_id, amount_cents, method, destination, status, admin_note, created_at, processed_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return json({ requests: data ?? [] });
    }

    if (action === "mark") {
      const id = String(body.id ?? "");
      const status = String(body.status ?? "");
      if (!id || !["paid", "rejected"].includes(status)) {
        return json({ error: "Bad request" }, 400);
      }
      const { error } = await supabase
        .from("payout_requests")
        .update({
          status,
          admin_note: body.note ? String(body.note).slice(0, 500) : null,
          processed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("status", "pending");
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("[payouts]", e);
    return json({ error: "Something went wrong" }, 500);
  }
});
