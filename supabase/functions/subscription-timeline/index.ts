// Returns a chronological timeline of Stripe events for the current user's customer:
// subscription created/updated/deleted, plan switches, invoice payments, etc.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RELEVANT_TYPES = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.trial_will_end",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "checkout.session.completed",
]);

function summarize(ev: Stripe.Event): { title: string; detail: string; kind: string } {
  const obj: any = ev.data.object;
  const prev: any = (ev.data as any).previous_attributes ?? {};
  switch (ev.type) {
    case "customer.subscription.created":
      return { kind: "created", title: "Subscription started", detail: `Status: ${obj.status}` };
    case "customer.subscription.deleted":
      return { kind: "canceled", title: "Subscription canceled", detail: `Ended ${new Date((obj.canceled_at ?? obj.ended_at ?? ev.created) * 1000).toLocaleDateString()}` };
    case "customer.subscription.updated": {
      if (prev.cancel_at_period_end === false && obj.cancel_at_period_end === true) {
        return { kind: "cancel_scheduled", title: "Cancellation scheduled", detail: `Ends ${new Date(obj.current_period_end * 1000).toLocaleDateString()}` };
      }
      if (prev.cancel_at_period_end === true && obj.cancel_at_period_end === false) {
        return { kind: "cancel_reverted", title: "Cancellation reverted", detail: "Subscription resumed" };
      }
      if (prev.items || prev.plan) {
        return { kind: "plan_switch", title: "Plan changed", detail: `Now ${obj.status}` };
      }
      if (prev.status && prev.status !== obj.status) {
        return { kind: "status_change", title: `Status: ${prev.status} → ${obj.status}`, detail: "" };
      }
      return { kind: "updated", title: "Subscription updated", detail: `Status: ${obj.status}` };
    }
    case "customer.subscription.trial_will_end":
      return { kind: "trial_ending", title: "Trial ending soon", detail: `Trial ends ${new Date(obj.trial_end * 1000).toLocaleDateString()}` };
    case "customer.subscription.paused":
      return { kind: "paused", title: "Subscription paused", detail: "" };
    case "customer.subscription.resumed":
      return { kind: "resumed", title: "Subscription resumed", detail: "" };
    case "invoice.paid":
    case "invoice.payment_succeeded":
      return { kind: "renewed", title: "Payment received", detail: `${(obj.amount_paid / 100).toFixed(2)} ${String(obj.currency).toUpperCase()}` };
    case "invoice.payment_failed":
      return { kind: "payment_failed", title: "Payment failed", detail: `Invoice ${obj.number ?? obj.id}` };
    case "checkout.session.completed":
      return { kind: "checkout", title: "Checkout completed", detail: obj.mode === "subscription" ? "New subscription" : "One-time payment" };
    default:
      return { kind: "other", title: ev.type, detail: "" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false } }
    );
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "auth required" }), { status: 401, headers: corsHeaders });
    const { data: c, error: ce } = await auth.auth.getClaims(token);
    if (ce || !c?.claims?.sub) {
      return new Response(JSON.stringify({ error: "auth required" }), { status: 401, headers: corsHeaders });
    }
    const email = c.claims.email as string | undefined;
    if (!email) return new Response(JSON.stringify({ events: [], customer: null }), { headers: corsHeaders });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length === 0) {
      return new Response(JSON.stringify({ events: [], customer: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const customerId = customers.data[0].id;

    // Stripe Events API filtered by customer
    const events = await stripe.events.list({ limit: 100 });
    const filtered: any[] = [];
    for (const ev of events.data) {
      if (!RELEVANT_TYPES.has(ev.type)) continue;
      const obj: any = ev.data.object;
      const cust = obj.customer ?? obj.customer_id ?? null;
      if (cust !== customerId) continue;
      const s = summarize(ev);
      filtered.push({
        id: ev.id,
        type: ev.type,
        kind: s.kind,
        title: s.title,
        detail: s.detail,
        created: ev.created,
        created_iso: new Date(ev.created * 1000).toISOString(),
      });
    }

    return new Response(
      JSON.stringify({ customer: { id: customerId, email }, events: filtered }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
