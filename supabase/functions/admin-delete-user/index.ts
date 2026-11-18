// Owner-only: permanently delete a member's account.
// - The caller must hold the protected admin role (requireOwner), never an email check alone.
// - Admin accounts (including the owner) and the caller themself can never be deleted.
// - Any live Stripe plan is cancelled first, so a deleted member is never billed again.
// - Their Gemini key, Library entries and Oracle memories are removed; money records
//   (wallet, billing ledgers, purchases) and one-trial-per-person marks are kept.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireOwner } from "../_shared/requireAuth.ts";
import { createStripeClient, type StripeEnv } from "../_shared/stripe.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = await requireOwner(req);
  if (auth.response) return new Response(auth.response.body, { status: auth.response.status, headers: { ...cors, "Content-Type": "application/json" } });

  const body = await req.json().catch(() => ({}));
  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  const confirmEmail = typeof body?.confirmEmail === "string" ? body.confirmEmail.trim().toLowerCase() : "";
  if (!UUID.test(userId)) return json({ error: "invalid_user", message: "That member couldn't be found." }, 400);
  if (userId === auth.user.id) return json({ error: "cannot_delete_self", message: "You can't delete your own account here." }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const { data: target, error: getErr } = await admin.auth.admin.getUserById(userId);
  if (getErr || !target?.user) return json({ error: "not_found", message: "That member no longer exists." }, 404);
  const email = (target.user.email || "").toLowerCase();
  // The owner must confirm the exact account, so a stale list can never delete the wrong person.
  if (!email || confirmEmail !== email) return json({ error: "confirm_mismatch", message: "The email didn't match that member." }, 400);

  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (isAdmin === true) return json({ error: "protected_account", message: "Admin accounts can't be deleted." }, 403);

  // Stop any live paid plan before the account disappears (plan and legacy subscription records).
  const toCancel = new Map<string, StripeEnv[]>();
  const { data: subs } = await admin.from("subscriptions")
    .select("stripe_subscription_id, environment, status")
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due", "unpaid", "incomplete"]);
  for (const s of subs ?? []) {
    if (s.stripe_subscription_id) toCancel.set(s.stripe_subscription_id, [s.environment === "live" ? "live" : "sandbox"]);
  }
  const { data: m } = await admin.from("memberships")
    .select("plan, plan_subscription_id, stripe_subscription_id, plan_active_until, monthly_active_until")
    .eq("user_id", userId).maybeSingle();
  const now = Date.now();
  if (m?.plan_subscription_id && m.plan !== "free" && m.plan_active_until && new Date(m.plan_active_until).getTime() > now && !toCancel.has(m.plan_subscription_id)) {
    toCancel.set(m.plan_subscription_id, ["live", "sandbox"]);
  }
  if (m?.stripe_subscription_id && m.monthly_active_until && new Date(m.monthly_active_until).getTime() > now && !toCancel.has(m.stripe_subscription_id)) {
    toCancel.set(m.stripe_subscription_id, ["live", "sandbox"]);
  }
  let cancelled = 0;
  for (const [subId, envs] of toCancel) {
    let done = false;
    for (const env of envs) {
      try {
        await createStripeClient(env).subscriptions.cancel(subId);
        done = true; cancelled++; break;
      } catch (e) {
        const msg = String((e as Error)?.message || e);
        if (/already been canceled|is canceled|status of canceled/i.test(msg)) { done = true; break; }
        if (/No such subscription/i.test(msg)) continue; // try the other payment mode
        console.error("cancel failed", msg);
        return json({ error: "cancel_failed", message: "Their paid plan couldn't be cancelled, so the account was kept. Try again shortly." }, 502);
      }
    }
    if (!done) console.warn("subscription not found in any mode:", subId);
  }

  // Remove personal content. Money records and trial marks are deliberately kept.
  for (const table of ["user_ai_keys", "member_ai_setup", "user_media", "oracle_memories", "agent_chats", "user_agents"]) {
    const { error } = await admin.from(table).delete().eq("user_id", userId);
    if (error) console.warn(`cleanup ${table}:`, error.message);
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) {
    console.error("delete user failed", delErr.message);
    return json({ error: "delete_failed", message: "The account couldn't be deleted. Please try again." }, 500);
  }

  await admin.from("auth_audit_log").insert({
    user_id: auth.user.id, email: auth.user.email, event_type: "admin_deleted_user", reason: `deleted ${userId}`, path: "/admin-delete-user",
  }).then(() => undefined, () => undefined);

  return json({ ok: true, deleted: userId, cancelled_plans: cancelled });
});
