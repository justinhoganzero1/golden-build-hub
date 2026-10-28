// Membership: founder seat ($1 AUD once, 500 max) and monthly ($19.99 AUD).
// actions: checkout {plan, environment}, verify {sessionId, environment}, status {environment}, transfer {toEmail}
// Checkout uses Lovable built-in payments: embedded checkout, clientSecret returned.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { safeOrigin } from "../_shared/origin.ts";
import { type StripeEnv, createStripeClient, createEmbeddedSession } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function envFrom(body: any): StripeEnv {
  if (body?.environment !== "sandbox" && body?.environment !== "live") throw new Error("invalid environment");
  return body.environment;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(token);
    const user = u?.user;
    if (!user) return json({ error: "auth_required" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "checkout") {
      const env = envFrom(body);
      const plan = body.plan === "founder" ? "founder" : body.plan === "monthly" ? "monthly" : null;
      if (!plan) return json({ error: "invalid plan" }, 400);
      if (plan === "founder") {
        const { data: left } = await admin.rpc("public_founder_seats_left");
        if (!left || left <= 0) return json({ error: "founder_seats_gone" }, 409);
        const { data: m } = await admin.from("memberships").select("founder_number").eq("user_id", user.id).maybeSingle();
        if (m?.founder_number) return json({ error: "already_founder" }, 409);
      }
      const origin = safeOrigin(req);
      const clientSecret = await createEmbeddedSession({
        env,
        userId: user.id,
        email: user.email ?? undefined,
        priceLookupKey: plan === "founder" ? "founder_seat_once" : "membership_monthly",
        returnUrl: `${origin}/membership?paid=1&session_id={CHECKOUT_SESSION_ID}`,
        metadata: { purchase_type: `membership_${plan}`, user_id: user.id },
      });
      return json({ clientSecret });
    }

    if (action === "verify") {
      const env = envFrom(body);
      const stripe = createStripeClient(env);
      const sid = String(body.sessionId || "");
      if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(sid)) return json({ error: "invalid session" }, 400);
      const s = await stripe.checkout.sessions.retrieve(sid);
      if (s.metadata?.user_id !== user.id) return json({ error: "not yours" }, 403);
      if (s.payment_status !== "paid") return json({ ok: false, status: s.payment_status });
      // Read-only: memberships are granted only by the signed payments webhook.
      const { data: m } = await admin.from("memberships").select("founder_number, monthly_active_until, stripe_subscription_id").eq("user_id", user.id).maybeSingle();
      if (s.metadata?.purchase_type === "membership_founder") {
        const { data: f } = await admin.from("founder_payment_fulfillments").select("stripe_session_id").eq("stripe_session_id", s.id).maybeSingle();
        if (f && m?.founder_number) return json({ ok: true, kind: "founder", founder_number: m.founder_number });
        if (f && !m?.founder_number) return json({ ok: false, error: "founder_seats_gone_refunded" });
        return json({ ok: false, pending: true });
      }
      if (s.metadata?.purchase_type === "membership_monthly") {
        if (m?.stripe_subscription_id && m.stripe_subscription_id === s.subscription && m.monthly_active_until) return json({ ok: true, kind: "monthly", until: m.monthly_active_until });
        return json({ ok: false, pending: true });
      }
      return json({ error: "not a membership purchase" }, 400);
    }

    if (action === "status") {
      const env = envFrom(body);
      // Refresh monthly status from Stripe when it looks expired.
      const { data: m } = await admin.from("memberships").select("*").eq("user_id", user.id).maybeSingle();
      if (m?.stripe_subscription_id && (!m.monthly_active_until || new Date(m.monthly_active_until) < new Date())) {
        const stripe = createStripeClient(env);
        const sub = await stripe.subscriptions.retrieve(m.stripe_subscription_id);
        if (sub.status === "active" || sub.status === "trialing") {
          const end = (sub as any).current_period_end ?? (sub.items.data[0] as any)?.current_period_end;
          const until = new Date(end * 1000).toISOString();
          await admin.from("memberships").update({ monthly_active_until: until, updated_at: new Date().toISOString() }).eq("user_id", user.id);
          m.monthly_active_until = until;
        }
      }
      return json({ membership: m });
    }

    if (action === "transfer") {
      const email = String(body.toEmail || "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 255) return json({ error: "invalid email" }, 400);
      const { data: list } = await admin.rpc("admin_list_users", { _search: email, _limit: 5, _offset: 0 }).then(
        (r) => r,
        () => ({ data: null }),
      );
      let toId: string | undefined = (list as any[] | null)?.find((x) => (x.email || "").toLowerCase() === email)?.user_id;
      if (!toId) {
        // fallback: page through auth users
        for (let page = 1; page <= 20 && !toId; page++) {
          const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
          toId = data?.users.find((x) => (x.email || "").toLowerCase() === email)?.id;
          if (!data || data.users.length < 200) break;
        }
      }
      if (!toId) return json({ error: "No member with that email. They need to sign up first." }, 404);
      if (toId === user.id) return json({ error: "That's you." }, 400);
      const { data: num, error } = await admin.rpc("transfer_founder_seat", { _from: user.id, _to: toId });
      if (error) return json({ error: error.message }, 400);
      await admin.from("founder_transfers").insert({
        founder_number: num, from_user: user.id, to_user: toId, status: "accepted", completed_at: new Date().toISOString(),
      });
      return json({ ok: true, founder_number: num });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
