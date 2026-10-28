// Payments webhook for Lovable built-in Stripe payments.
// Registered URL: /functions/v1/payments-webhook?env=sandbox|live
// Fulfils EVERY purchase type server-side so delivery never depends on the
// user returning to a success page:
//   founder seat, monthly membership, coin top-ups, founder seat resale,
//   Creator Shop purchases, movie renders, app unlocks, AI friend avatar,
//   AI partner subscription, living GIFs, movie scene blocks.
// PUBLIC endpoint — verified via Stripe signature, no JWT.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { type StripeEnv, createStripeClient, verifyWebhook } from "../_shared/stripe.ts";
import { validateAppPayment, validateCoinPayment, validateMoviePayment } from "../_shared/paymentValidation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
  }
  return _supabase;
}

function log(step: string, details?: unknown) {
  console.log(`[PAYMENTS-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
}

async function logEvent(row: {
  source?: string;
  event_type?: string | null;
  status?: string;
  stripe_event_id?: string | null;
  stripe_session_id?: string | null;
  stripe_customer_id?: string | null;
  user_id?: string | null;
  amount_cents?: number | null;
  message?: string | null;
  payload?: Record<string, unknown>;
}) {
  try {
    await getSupabase().from("stripe_event_log").insert({
      source: row.source ?? "payments-webhook",
      event_type: row.event_type ?? null,
      status: row.status ?? "ok",
      stripe_event_id: row.stripe_event_id ?? null,
      stripe_session_id: row.stripe_session_id ?? null,
      stripe_customer_id: row.stripe_customer_id ?? null,
      user_id: row.user_id ?? null,
      amount_cents: row.amount_cents ?? null,
      message: row.message ?? null,
      payload: row.payload ?? {},
    });
  } catch (e) {
    console.error("[PAYMENTS-WEBHOOK] failed to write event log", e);
  }
}

// ---------- fulfilment helpers ----------

async function markMoviePaid(session: any) {
  const supabase = getSupabase();
  const projectId = session.metadata?.project_id;
  if (!projectId) throw new Error("missing movie project");
  const { data: project } = await supabase
    .from("movie_projects")
    .select("id, user_id, payment_status, stripe_session_id, quality_tier")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) {
    log("project not found", { projectId });
    return;
  }
  validateMoviePayment(session, project);
  if (project.payment_status === "paid") {
    log("already paid", { projectId });
    return;
  }
  const { error: paymentError } = await supabase
    .from("movie_projects")
    .update({
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : null,
      user_paid_cents: session.amount_total ?? 0,
      status: "chunking",
    })
    .eq("id", projectId).eq("stripe_session_id", session.id);
  if (paymentError) throw paymentError;

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

async function grantCoinTopup(session: any, eventId: string) {
  const supabase = getSupabase();
  const meta = session.metadata ?? {};
  const userId = meta.user_id;
  const walletCents = validateCoinPayment(session, userId || "");
  const grossCents = Number(session.amount_total ?? 0);
  if (!userId || !Number.isFinite(walletCents) || walletCents <= 0 || grossCents <= 0) {
    log("coin topup missing metadata", { session_id: session.id, userId, walletCents, grossCents });
    return;
  }

  const { data, error } = await supabase.rpc("billing_credit_stripe_topup", {
    _user_id: userId,
    _stripe_event_id: eventId,
    _stripe_session_id: session.id,
    _stripe_payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : null,
    _wallet_cents: Math.round(walletCents),
    _gross_cents: Math.round(grossCents),
    _currency: session.currency ?? "usd",
    _metadata: { checkout_mode: session.mode },
  });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  log(result?.duplicate ? "duplicate coin topup ignored" : "coin topup credited", { user_id: userId, wallet_cents: Math.round(walletCents), session_id: session.id });

  try {
    await supabase.from("ai_discovery_events").insert({
      event_type: "topup",
      path: "/wallet",
      user_id: userId,
      amount_cents: Math.round(walletCents),
    });
  } catch (e) {
    console.error("[PAYMENTS-WEBHOOK] discovery log failed", e);
  }
}

async function grantAvatarPurchase(session: any) {
  // AI Friend Avatar (one-time) or AI Partner (subscription) — record an
  // app_unlock so the avatar page can verify server-side, not by URL param.
  const supabase = getSupabase();
  const meta = session.metadata ?? {};
  const userId = meta.user_id;
  const product = meta.avatar_product; // "avatar" | "partner"
  if (!userId || (product !== "avatar" && product !== "partner")) {
    log("avatar purchase missing metadata", { session_id: session.id });
    return;
  }
  const appKey = product === "partner" ? "ai_partner" : "ai_friend_avatar";
  const { data: existing } = await supabase
    .from("app_unlocks")
    .select("id")
    .eq("stripe_session_id", session.id)
    .maybeSingle();
  if (existing) {
    log("avatar purchase already recorded", { session_id: session.id });
    return;
  }
  const { error } = await supabase.from("app_unlocks").insert({
    user_id: userId,
    app_key: appKey,
    amount_cents: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
    stripe_session_id: session.id,
    stripe_payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : null,
  });
  if (error) throw error;
  log("avatar purchase recorded", { user_id: userId, app_key: appKey });
}

async function markGifPaid(session: any) {
  const supabase = getSupabase();
  const meta = session.metadata ?? {};
  const gifId = meta.gif_id;
  if (!gifId) {
    log("gif payment missing gif_id", { session_id: session.id });
    return;
  }
  const { data: gif } = await supabase
    .from("living_gifs")
    .select("id, user_id, status, stripe_session_id")
    .eq("id", gifId)
    .maybeSingle();
  if (!gif || gif.user_id !== meta.user_id || gif.stripe_session_id !== session.id) {
    throw new Error("gif payment mismatch");
  }
  if (gif.status !== "pending_payment") {
    log("gif already handled", { gifId, status: gif.status });
    return;
  }
  const { error } = await supabase
    .from("living_gifs")
    .update({
      status: "paid",
      stripe_payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : null,
    })
    .eq("id", gifId);
  if (error) throw error;
  log("gif marked paid", { gifId });
}

async function recordBlockPayment(session: any) {
  const supabase = getSupabase();
  const meta = session.metadata ?? {};
  const userId = meta.user_id;
  const block = Number(meta.block);
  if (!userId || !Number.isFinite(block) || block < 1) {
    log("block payment missing metadata", { session_id: session.id });
    return;
  }
  const { error } = await supabase.from("movie_block_payments").upsert({
    user_id: userId,
    block_number: block,
    amount_cents: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
    stripe_session_id: session.id,
    stripe_payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : null,
    paid_at: new Date().toISOString(),
  }, { onConflict: "stripe_session_id" });
  if (error) throw error;
  log("block payment recorded", { user_id: userId, block });
}

// ---------- subscription tracking ----------

function priceKeyFromSubscription(subscription: any): string | null {
  const item = subscription.items?.data?.[0];
  return item?.price?.lookup_key
    || item?.price?.metadata?.lovable_external_id
    || item?.price?.id
    || null;
}

async function upsertSubscriptionRow(subscription: any, env: StripeEnv) {
  const supabase = getSupabase();
  const userId = subscription.metadata?.userId || subscription.metadata?.user_id;
  if (!userId) {
    log("subscription without userId metadata", { sub: subscription.id });
    return;
  }
  const item = subscription.items?.data?.[0];
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  await supabase.from("subscriptions").upsert({
    user_id: userId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
    product_id: typeof item?.price?.product === "string" ? item.price.product : item?.price?.product?.id ?? "",
    price_id: priceKeyFromSubscription(subscription) ?? "",
    status: subscription.status,
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    environment: env,
    updated_at: new Date().toISOString(),
  }, { onConflict: "stripe_subscription_id" });
}

async function syncMembershipFromSubscription(subscription: any) {
  // Keep the memberships table in step with monthly membership + AI partner
  // subscription lifecycle (renewals, cancellations, payment failures).
  const supabase = getSupabase();
  const userId = subscription.metadata?.userId || subscription.metadata?.user_id;
  if (!userId) return;
  const priceKey = priceKeyFromSubscription(subscription);
  const item = subscription.items?.data?.[0];
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  const until = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
  const active = ["active", "trialing", "past_due"].includes(subscription.status)
    || (subscription.status === "canceled" && periodEnd && periodEnd * 1000 > Date.now());

  if (priceKey === "membership_monthly") {
    const { error } = await supabase.from("memberships").upsert({
      user_id: userId,
      kind: "monthly",
      monthly_active_until: active ? until : null,
      stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : null,
      stripe_subscription_id: subscription.id,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    log("membership synced", { user_id: userId, status: subscription.status, active });
  }
}

// ---------- main handler ----------

async function handleCheckoutCompleted(session: any, eventId: string, env: StripeEnv) {
  const supabase = getSupabase();
  const meta = session.metadata ?? {};
  const purchaseType = meta.purchase_type;

  if (purchaseType === "membership_founder" && meta.user_id) {
    if (session.mode !== "payment" || session.currency !== "aud" || session.amount_total !== 100) throw new Error("founder payment mismatch");
    const { data: num, error: seatErr } = await supabase.rpc("claim_founder_seat", { _user_id: meta.user_id, _session_id: session.id });
    if (seatErr?.message.includes("already consumed")) log("founder payment already consumed", { session_id: session.id });
    else if (seatErr) throw seatErr;
    else if (!num) {
      if (typeof session.payment_intent === "string") {
        const stripe = createStripeClient(env);
        await stripe.refunds.create({ payment_intent: session.payment_intent }, { idempotencyKey: `founder-sold-out:${session.id}` });
      }
      await supabase.from("founder_payment_fulfillments").insert({ stripe_session_id: session.id, user_id: meta.user_id, founder_number: null });
      log("founder seats gone; refunded", { session_id: session.id });
    } else log("founder seat granted", { user_id: meta.user_id, seat: num });
    return;
  }

  if (purchaseType === "membership_monthly" && meta.user_id && typeof session.subscription === "string") {
    const stripe = createStripeClient(env);
    const sub = await stripe.subscriptions.retrieve(session.subscription);
    const end = (sub as any).current_period_end ?? (sub.items.data[0] as any)?.current_period_end;
    const until = new Date((end ?? Date.now() / 1000 + 31 * 86400) * 1000).toISOString();
    const { error: memErr } = await supabase.from("memberships").upsert({
      user_id: meta.user_id, kind: "monthly", monthly_active_until: until,
      stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
      stripe_subscription_id: sub.id, updated_at: new Date().toISOString(),
    });
    if (memErr) throw memErr;
    log("monthly membership granted", { user_id: meta.user_id });
    return;
  }

  if (purchaseType === "coin_topup") {
    await grantCoinTopup(session, eventId);
    return;
  }

  if (purchaseType === "founder_seat_resale" && meta.listing_id && meta.seller_id && meta.buyer_id) {
    const { data: claimed } = await supabase
      .from("founder_seat_listings")
      .update({ status: "sold", buyer_id: meta.buyer_id, sold_at: new Date().toISOString() })
      .eq("id", meta.listing_id)
      .eq("status", "active")
      .select("id")
      .maybeSingle();
    if (claimed) {
      const { data: num, error: tErr } = await supabase.rpc("transfer_founder_seat", {
        _from: meta.seller_id, _to: meta.buyer_id,
      });
      if (tErr) log("SEAT TRANSFER FAILED — needs refund/manual fix", { listing: meta.listing_id, err: tErr.message });
      else log("founder seat transferred", { listing: meta.listing_id, seat: num });
    } else {
      log("seat listing already handled", { listing: meta.listing_id });
    }
    return;
  }

  if (purchaseType === "avatar_purchase") {
    await grantAvatarPurchase(session);
    return;
  }

  if (purchaseType === "living_gif" || meta.kind === "living_gif") {
    await markGifPaid(session);
    return;
  }

  if (purchaseType === "movie_block" || meta.kind === "movie-block") {
    await recordBlockPayment(session);
    return;
  }

  if (meta.purchase_id) {
    // Creator Shop purchase — mark paid + bump creator download count
    const purchaseId = meta.purchase_id;
    const { data: existing } = await supabase
      .from("shop_purchases")
      .select("id, status, item_kind, item_id, buyer_id, stripe_session_id, amount_cents, currency")
      .eq("id", purchaseId)
      .maybeSingle();
    if (existing && (existing.buyer_id !== meta.buyer_id || existing.stripe_session_id !== session.id || existing.amount_cents !== session.amount_total || existing.currency.toLowerCase() !== session.currency?.toLowerCase())) throw new Error("shop payment mismatch");
    if (existing && existing.status !== "paid") {
      const { error: purchaseError } = await supabase
        .from("shop_purchases")
        .update({
          status: "paid",
          completed_at: new Date().toISOString(),
          stripe_payment_intent: (session.payment_intent as string) ?? null,
        })
        .eq("id", purchaseId);
      if (purchaseError) throw purchaseError;

      const table =
        existing.item_kind === "media"
          ? "user_media"
          : existing.item_kind === "gif"
          ? "living_gifs"
          : existing.item_kind === "realm"
          ? "user_realms"
          : existing.item_kind === "module"
          ? "creator_modules"
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
    return;
  }

  if (meta.project_id) {
    await markMoviePaid(session);
    return;
  }

  if (meta.app_key && meta.user_id) {
    validateAppPayment(session, meta.user_id, meta.app_key);
    const { data: existing } = await supabase
      .from("app_unlocks")
      .select("id")
      .eq("stripe_session_id", session.id)
      .maybeSingle();
    if (!existing) {
      const { error: unlockError } = await supabase.from("app_unlocks").insert({
        user_id: meta.user_id,
        app_key: meta.app_key,
        amount_cents: session.amount_total ?? 0,
        currency: session.currency ?? "usd",
        stripe_session_id: session.id,
        stripe_payment_intent: (session.payment_intent as string) ?? null,
      });
      if (unlockError) throw unlockError;
      log("app unlock recorded", { user_id: meta.user_id, app_key: meta.app_key });
    }
    return;
  }

  log("checkout completed (unhandled purchase type)", { session_id: session.id, mode: session.mode, purchaseType });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    console.error("Webhook received with invalid or missing env query parameter:", rawEnv);
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  const env: StripeEnv = rawEnv;

  let event: { type: string; data: { object: any } };
  try {
    event = await verifyWebhook(req, env);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("signature verification failed", { error: msg });
    await logEvent({ source: "payments-webhook", status: "signature_failed", message: msg });
    return new Response(JSON.stringify({ error: "invalid signature" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const obj = event.data.object as Record<string, any>;
  log("event received", { type: event.type, id: (event as any).id });
  await logEvent({
    source: "payments-webhook",
    status: "ok",
    event_type: event.type,
    stripe_event_id: (event as any).id ?? null,
    stripe_session_id: typeof obj?.id === "string" && obj.id.startsWith("cs_") ? obj.id : null,
    stripe_customer_id: typeof obj?.customer === "string" ? obj.customer : null,
    user_id: (obj?.metadata ?? {}).user_id ?? (obj?.metadata ?? {}).userId ?? null,
    amount_cents: Number(obj?.amount_total ?? obj?.amount_received ?? obj?.amount ?? 0) || null,
    message: "received",
  });

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        // Fulfill unless payment is still unsettled (delayed-notification
        // methods). "no_payment_required" (free/zero-total) is final.
        if (session.payment_status === "unpaid") {
          log("checkout awaiting confirmed payment", { session_id: session.id });
          break;
        }
        await handleCheckoutCompleted(session, (event as any).id ?? session.id, env);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object;
        await upsertSubscriptionRow(sub, env);
        await syncMembershipFromSubscription(sub);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await upsertSubscriptionRow({ ...sub, status: "canceled" }, env);
        await syncMembershipFromSubscription({ ...sub, status: "canceled" });
        break;
      }

      case "invoice.paid":
        // Subscription state handled by customer.subscription.* events.
        break;

      case "invoice.payment_failed":
      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        const meta = pi.metadata ?? {};
        await logEvent({
          source: "payments-webhook",
          status: "payment_failed",
          event_type: event.type,
          stripe_event_id: (event as any).id ?? null,
          stripe_customer_id: typeof pi.customer === "string" ? pi.customer : null,
          user_id: meta.user_id ?? meta.userId ?? null,
          amount_cents: pi.amount ?? null,
          message: pi.last_payment_error?.message ?? "payment failed",
          payload: { decline_code: pi.last_payment_error?.decline_code ?? null, metadata: meta },
        });
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
    const msg = e instanceof Error ? e.message : String(e);
    log("handler error", { error: msg });
    await logEvent({
      source: "payments-webhook",
      status: "error",
      event_type: event?.type ?? null,
      stripe_event_id: (event as any)?.id ?? null,
      message: msg,
    });
    return new Response(JSON.stringify({ error: "handler error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
