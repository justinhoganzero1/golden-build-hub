// Stripe webhook handler.
// Handles:
//   - checkout.session.completed (movie payments + app unlocks + subscriptions)
//   - payment_intent.succeeded   (fallback for movies if checkout event missed)
// For movie payments: marks project paid + kicks the script-chunker so rendering starts
// even if the user never returns to the success page.
// PUBLIC endpoint — verified via Stripe signature, no JWT.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

function log(step: string, details?: unknown) {
  console.log(`[STRIPE-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
}

async function markMoviePaid(projectId: string, paymentIntent: string | null, amount: number | null) {
  const { data: project } = await supabase
    .from("movie_projects")
    .select("id, payment_status")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) {
    log("project not found", { projectId });
    return;
  }
  if (project.payment_status === "paid") {
    log("already paid", { projectId });
    return;
  }
  await supabase
    .from("movie_projects")
    .update({
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent: paymentIntent,
      user_paid_cents: amount ?? 0,
      status: "chunking",
    })
    .eq("id", projectId);

  // Kick chunker (service-role auth)
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/movie-script-chunker`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ project_id: projectId, internal: true }),
    });
    log("chunker kicked", { projectId });
  } catch (e) {
    log("chunker kick failed", { projectId, error: String(e) });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    if (!WEBHOOK_SECRET || !signature) {
      throw new Error("missing webhook secret or signature header");
    }
    event = await stripe.webhooks.constructEventAsync(body, signature, WEBHOOK_SECRET);
  } catch (e) {
    log("signature verification failed", { error: String(e) });
    return new Response(JSON.stringify({ error: "invalid signature" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  log("event received", { type: event.type, id: event.id });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const meta = session.metadata ?? {};
        const projectId = meta.project_id;
        const appKey = meta.app_key;

        const purchaseId = meta.purchase_id;

        if (purchaseId) {
          // Shop purchase — mark paid + bump creator download count
          const { data: existing } = await supabase
            .from("shop_purchases")
            .select("id, status, item_kind, item_id")
            .eq("id", purchaseId)
            .maybeSingle();
          if (existing && existing.status !== "paid") {
            await supabase
              .from("shop_purchases")
              .update({
                status: "paid",
                completed_at: new Date().toISOString(),
                stripe_payment_intent: (session.payment_intent as string) ?? null,
              })
              .eq("id", purchaseId);

            // Bump download_count on the source item
            const table =
              existing.item_kind === "media"
                ? "user_media"
                : existing.item_kind === "gif"
                ? "living_gifs"
                : "movie_projects";
            const { data: cur } = await supabase
              .from(table)
              .select("download_count")
              .eq("id", existing.item_id)
              .maybeSingle();
            await supabase
              .from(table)
              .update({ download_count: (cur?.download_count ?? 0) + 1 })
              .eq("id", existing.item_id);
            log("shop purchase marked paid", { purchaseId });
          }
        } else if (projectId) {
          // Movie one-off
          await markMoviePaid(
            projectId,
            (session.payment_intent as string) ?? null,
            session.amount_total ?? 0
          );
        } else if (appKey && meta.user_id) {
          // App unlock — record idempotently
          const { data: existing } = await supabase
            .from("app_unlocks")
            .select("id")
            .eq("stripe_session_id", session.id)
            .maybeSingle();
          if (!existing) {
            await supabase.from("app_unlocks").insert({
              user_id: meta.user_id,
              app_key: appKey,
              amount_cents: session.amount_total ?? 0,
              currency: session.currency ?? "usd",
              stripe_session_id: session.id,
              stripe_payment_intent: (session.payment_intent as string) ?? null,
            });
            log("app unlock recorded", { user_id: meta.user_id, app_key: appKey });
          }
        } else {
          log("checkout completed (subscription or unhandled)", { session_id: session.id, mode: session.mode });
        }
        break;
      }

      case "payment_intent.succeeded": {
        // Fallback path for movie payments if checkout.session.completed was missed
        const pi = event.data.object as Stripe.PaymentIntent;
        const projectId = (pi.metadata ?? {}).project_id;
        if (projectId) {
          await markMoviePaid(projectId, pi.id, pi.amount_received ?? pi.amount ?? 0);
        }
        break;
      }

      default:
        log("ignored event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    log("handler error", { error: e instanceof Error ? e.message : String(e) });
    return new Response(JSON.stringify({ error: "handler error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
