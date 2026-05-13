// Returns the current user's subscription state with plan name,
// renewal date, cancel-at-period-end status, and recent invoices.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    if (!email) return new Response(JSON.stringify({ subscribed: false }), { headers: corsHeaders });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length === 0) {
      return new Response(JSON.stringify({ subscribed: false, customer: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const customerId = customers.data[0].id;

    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 5,
      expand: ["data.items.data.price.product"],
    });

    const active = subs.data.find((s) => s.status === "active" || s.status === "trialing");
    const sub = active ?? subs.data[0];

    let plan: { name: string; amount_cents: number; interval: string | null; product_id: string; price_id: string } | null = null;
    let periodEnd: string | null = null;
    let cancelAtPeriodEnd = false;
    let cancelAt: string | null = null;
    let status: string | null = null;

    if (sub) {
      status = sub.status;
      periodEnd = new Date(sub.current_period_end * 1000).toISOString();
      cancelAtPeriodEnd = !!sub.cancel_at_period_end;
      cancelAt = sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null;
      const item = sub.items.data[0];
      const product = item.price.product as Stripe.Product;
      plan = {
        name: typeof product === "object" ? product.name : "Plan",
        amount_cents: item.price.unit_amount ?? 0,
        interval: item.price.recurring?.interval ?? null,
        product_id: typeof product === "object" ? product.id : (product as string),
        price_id: item.price.id,
      };
    }

    // Recent invoices
    const invoices = await stripe.invoices.list({ customer: customerId, limit: 5 });
    const invoiceList = invoices.data.map((i) => ({
      id: i.id,
      number: i.number,
      amount_paid: i.amount_paid,
      currency: i.currency,
      status: i.status,
      created: i.created,
      hosted_invoice_url: i.hosted_invoice_url,
      pdf: i.invoice_pdf,
    }));

    return new Response(
      JSON.stringify({
        subscribed: !!active,
        status,
        plan,
        current_period_end: periodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
        cancel_at: cancelAt,
        customer: { id: customerId, email },
        invoices: invoiceList,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
