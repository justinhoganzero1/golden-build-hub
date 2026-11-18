// Free trial status. Since 2026-11-18 there is NO card check: every Free account gets
// 3 pictures + 1 eight-second video for the first 7 days after sign-up, once per person
// (hashed email/device/internet-address marks). Older card-checked trials still count.
// - status:  starts the trial on first check-in and returns its state
// - start/confirm: legacy card-check actions, kept only so old links don't break
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { requireUser, enforceRateLimit } from "../_shared/requireAuth.ts";
import { safeOrigin } from "../_shared/origin.ts";
import { type StripeEnv, createStripeClient, resolveOrCreateCustomer } from "../_shared/stripe.ts";
import { TRIAL_DAYS, TRIAL_LIMITS, trialEndsAt, ensureTrialStart, laterEnd, type TrialStart } from "../_shared/freeTrial.ts";
import { collectMarks, rememberTrialMarks, requestIp, TRIAL_USED_MESSAGE } from "../_shared/trialIdentity.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = await requireUser(req);
    if (auth.response) return auth.response;
    const user = auth.user;
    const limited = await enforceRateLimit(req, user, "trial-card-setup", { limit: 20, windowSeconds: 60 });
    if (limited) return limited;

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "status");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    const [{ data: plan }, { data: card }, { data: usage }] = await Promise.all([
      admin.rpc("member_plan", { _user_id: user.id }),
      admin.from("trial_card_checks").select("card_brand, card_last4, verified_at, trial_ends_at").eq("user_id", user.id).maybeSingle(),
      admin.from("free_trial_usage").select("images_used, videos_used").eq("user_id", user.id).maybeSingle(),
    ]);
    const [{ data: isAdmin }] = await Promise.all([admin.rpc("has_role", { _user_id: user.id, _role: "admin" })]);
    const exempt = !!isAdmin;
    const marks = collectMarks({ email: user.email, deviceId: body?.device_id, ip: requestIp(req) });
    const isFree = !plan || plan === "free";
    // No card needed: the first check-in starts the 7-day trial (or records it as already used elsewhere).
    let start: TrialStart | null = null;
    if (isFree && !exempt) {
      start = await ensureTrialStart(admin, user, { deviceId: body?.device_id, ip: requestIp(req) })
        .catch((e: unknown) => { console.error("trial start:", e); return null; });
    }
    if (card && !exempt) await rememberTrialMarks(admin, user.id, marks).catch((e: unknown) => console.error("trial marks:", e));
    const usedElsewhere = !card && !!start?.blocked;
    const endsAt = laterEnd(start?.trial_ends_at, card?.trial_ends_at);
    const status = () => ({
      trial_blocked: usedElsewhere,
      trial_blocked_message: usedElsewhere ? TRIAL_USED_MESSAGE : null,
      plan: plan ?? "free",
      card_verified: !!card,
      card_brand: card?.card_brand ?? null,
      card_last4: card?.card_last4 ?? null,
      trial_ends_at: endsAt,
      trial_open: !usedElsewhere && !!endsAt && new Date(endsAt).getTime() > Date.now(),
      images_left: Math.max(0, TRIAL_LIMITS.image - (usage?.images_used ?? 0)),
      videos_left: Math.max(0, TRIAL_LIMITS.video - (usage?.videos_used ?? 0)),
      trial_days: TRIAL_DAYS,
    });

    if (action === "status") return json(status());

    const environment = body?.environment;
    if (environment !== "sandbox" && environment !== "live") return json({ error: "invalid environment" }, 400);
    const env: StripeEnv = environment;
    const stripe = createStripeClient(env);

    if (action === "start") {
      if (card) return json({ error: "already_verified", message: "Your card is already verified.", ...status() }, 409);
      if (plan && plan !== "free") return json({ error: "not_needed", message: "Your plan already includes these tools." }, 409);
      if (usedElsewhere) return json({ error: "trial_already_used", message: TRIAL_USED_MESSAGE, ...status() }, 409);
      const customer = await resolveOrCreateCustomer(stripe, { email: user.email ?? undefined, userId: user.id });
      const origin = safeOrigin(req);
      const metadata = { purpose: "trial_card", user_id: user.id };
      const session = await stripe.checkout.sessions.create({
        mode: "setup",
        currency: "aud",
        ui_mode: "embedded_page",
        customer,
        return_url: `${origin}/trial-card?session_id={CHECKOUT_SESSION_ID}`,
        metadata,
        setup_intent_data: { metadata, description: "Oracle Lunar free trial card check — $0.00 charged" },
      } as any);
      if (!session.client_secret) throw new Error("No client secret returned");
      return json({ clientSecret: session.client_secret });
    }

    if (action === "confirm") {
      const sessionId = String(body?.session_id || "");
      if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return json({ error: "bad_session" }, 400);
      if ((env === "sandbox") !== sessionId.startsWith("cs_test_")) return json({ error: "bad_session" }, 400);
      if (card) return json({ ok: true, ...status() });

      const session: any = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["setup_intent.payment_method"] });
      if (session?.metadata?.purpose !== "trial_card" || session?.metadata?.user_id !== user.id) return json({ error: "bad_session" }, 403);
      const intent = session.setup_intent;
      if (session.status !== "complete" || !intent || intent.status !== "succeeded") {
        return json({ error: "not_finished", message: "The card check isn't finished yet. Please try again." }, 409);
      }
      const pm = intent.payment_method;
      if (usedElsewhere) {
        await stripe.paymentMethods.detach(pm?.id).catch(() => undefined);
        return json({ error: "trial_already_used", message: TRIAL_USED_MESSAGE, ...status() }, 409);
      }
      const fingerprint: string | undefined = pm?.card?.fingerprint;
      if (!fingerprint) return json({ error: "card_only", message: "Please use a debit or credit card." }, 400);
      const hash = await sha256(`${env}:${fingerprint}`);

      const { data: used } = await admin.from("trial_card_checks").select("user_id").eq("stripe_env", env).eq("card_fingerprint_hash", hash).maybeSingle();
      if (used && used.user_id !== user.id) {
        await stripe.paymentMethods.detach(pm.id).catch(() => undefined);
        return json({ error: "trial_already_used", message: TRIAL_USED_MESSAGE }, 409);
      }
      const now = new Date();
      const { error } = await admin.from("trial_card_checks").insert({
        user_id: user.id,
        stripe_env: env,
        card_fingerprint_hash: hash,
        card_brand: pm?.card?.brand ?? null,
        card_last4: pm?.card?.last4 ?? null,
        checkout_session_id: sessionId,
        verified_at: now.toISOString(),
        trial_ends_at: trialEndsAt(now).toISOString(),
      });
      if (error && error.code !== "23505") throw error;
      if (error) return json({ error: "trial_already_used", message: TRIAL_USED_MESSAGE }, 409);
      if (!exempt) await rememberTrialMarks(admin, user.id, marks).catch((e: unknown) => console.error("trial marks:", e));
      const { data: fresh } = await admin.from("trial_card_checks").select("card_brand, card_last4, verified_at, trial_ends_at").eq("user_id", user.id).maybeSingle();
      return json({
        ok: true, ...status(), trial_blocked: false, trial_blocked_message: null, card_verified: true,
        card_brand: fresh?.card_brand ?? null, card_last4: fresh?.card_last4 ?? null,
        trial_ends_at: fresh?.trial_ends_at ?? null, trial_open: true,
      });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("trial-card-setup error:", e instanceof Error ? e.message : e);
    return json({ error: "card_check_unavailable", message: "The card check isn't available right now. Please try again." }, 500);
  }
});
