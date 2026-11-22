// Free-plan trial: 3 pictures and 1 eight-second video for the first 7 days after
// sign-up, then the paywall. No card check (Juzzy 2026-11-18). One trial per person is
// kept by hashed email/device/internet-address marks (trialIdentity.ts); older card-checked
// trials still count. Paid plans and the owner never use the trial (normal wallet billing).
import { collectMarks, findOtherTrial, rememberTrialMarks, TRIAL_USED_MESSAGE } from "./trialIdentity.ts";
export const TRIAL_LIMITS = { image: 3, video: 1 } as const;
export const TRIAL_VIDEO_SECONDS = 8;
export const TRIAL_DAYS = 7;
/** Free trial pictures/video gift. Off: trial members pay from their wallet (Option A). */
export const TRIAL_GIFTS_ON = false;
export type TrialKind = keyof typeof TRIAL_LIMITS;
export type TrialBlock = "card_required" | "expired" | "used" | "duplicate";
export type TrialOutcome = "paid" | "trial" | TrialBlock;
// deno-lint-ignore no-explicit-any
type Admin = any;

export const trialEndsAt = (verifiedAt: Date): Date => new Date(verifiedAt.getTime() + TRIAL_DAYS * 86_400_000);

/** Rules before any allowance is claimed: who pays, who needs a card, whose window closed. */
export function trialGate(opts: { isOwner: boolean; plan: string | null; trialEndsAt: string | null; blocked?: boolean; now?: Date }): "paid" | "claim" | "duplicate" | "expired" {
  if (opts.isOwner) return "paid";
  if (opts.plan && opts.plan !== "free") return "paid";
  if (opts.blocked) return "duplicate";
  if (!opts.trialEndsAt) return "expired";
  const now = opts.now ?? new Date();
  return now.getTime() < new Date(opts.trialEndsAt).getTime() ? "claim" : "expired";
}

/**
 * Oracle chat during the 7-day trial runs on the member's own Gemini key (never the
 * platform's AI or the wallet), so it opens from sign-up — no card needed — and stays
 * open while a card-checked trial is still running.
 */
export function chatTrialOpen(opts: { signedUpAt: string | null; cardTrialEndsAt: string | null; now?: Date }): boolean {
  const now = (opts.now ?? new Date()).getTime();
  const signup = opts.signedUpAt ? new Date(opts.signedUpAt).getTime() : NaN;
  const card = opts.cardTrialEndsAt ? new Date(opts.cardTrialEndsAt).getTime() : NaN;
  const ends = Math.max(Number.isFinite(signup) ? signup + TRIAL_DAYS * 86_400_000 : 0, Number.isFinite(card) ? card : 0);
  return now < ends;
}

export type ChatAccess = "paid" | "trial" | "none";

/**
 * What Oracle may create for a trial member. Creations that run on the member's own
 * Gemini key (documents, stories, poems) are open; pictures/video use the card-checked
 * trial allowance; everything that costs real money (music, sound effects, narration
 * files, app builds, live web research) is Plus/Pro — Oracle explains instead.
 * Mirrored in src/lib/oracleTrial.ts.
 */
export const TRIAL_OPEN_CREATIONS = ["DOC", "STORY", "POEM", "IMAGE", "VIDEO"] as const;
export const TRIAL_PAID_CREATIONS = ["MUSIC", "SFX", "VOICE", "APP"] as const;

/** Paid plan → full chat; otherwise the 7-day trial window; otherwise the free scripted chat only. */
export async function memberChatAccess(admin: Admin, userId: string, signedUpAt: string | null): Promise<ChatAccess> {
  const [{ data: plan }, { data: card }] = await Promise.all([
    admin.rpc("member_plan", { _user_id: userId }),
    admin.from("trial_card_checks").select("trial_ends_at").eq("user_id", userId).maybeSingle(),
  ]);
  if (plan && plan !== "free") return "paid";
  return chatTrialOpen({ signedUpAt, cardTrialEndsAt: card?.trial_ends_at ?? null }) ? "trial" : "none";
}

export const isTrialBlocked = (t: TrialOutcome): t is TrialBlock => t !== "paid" && t !== "trial";

export type TrialStart = { trial_ends_at: string; blocked: boolean };

/** Later of two trial end dates (sign-up trial vs an older card-checked trial). */
export function laterEnd(a: string | null | undefined, b: string | null | undefined): string | null {
  const ta = a ? new Date(a).getTime() : NaN, tb = b ? new Date(b).getTime() : NaN;
  if (!Number.isFinite(ta) && !Number.isFinite(tb)) return null;
  return new Date(Math.max(Number.isFinite(ta) ? ta : 0, Number.isFinite(tb) ? tb : 0)).toISOString();
}

/**
 * Starts (once) the no-card trial for a Free account: 7 days from sign-up. If this person's
 * email, device or internet address already belongs to another trial account, the trial is
 * recorded as blocked instead. Trial accounts' marks are remembered for future checks.
 */
export async function ensureTrialStart(
  admin: Admin,
  user: { id: string; email?: string | null; created_at?: string | null },
  opts: { deviceId?: unknown; ip?: string | null } = {},
): Promise<TrialStart> {
  const marks = collectMarks({ email: user.email ?? null, deviceId: opts.deviceId, ip: opts.ip ?? null });
  const { data: existing } = await admin.from("free_trial_starts").select("trial_ends_at, blocked").eq("user_id", user.id).maybeSingle();
  if (existing) {
    if (!existing.blocked) await rememberTrialMarks(admin, user.id, marks).catch(() => undefined);
    return existing;
  }
  const other = await findOtherTrial(admin, user.id, marks);
  const signup = user.created_at ? new Date(user.created_at) : new Date();
  const row = { user_id: user.id, trial_ends_at: trialEndsAt(signup).toISOString(), blocked: !!other, blocked_by: other };
  await admin.from("free_trial_starts").upsert(row, { onConflict: "user_id", ignoreDuplicates: true });
  const { data: saved } = await admin.from("free_trial_starts").select("trial_ends_at, blocked").eq("user_id", user.id).maybeSingle();
  const result: TrialStart = saved ?? { trial_ends_at: row.trial_ends_at, blocked: row.blocked };
  if (!result.blocked) await rememberTrialMarks(admin, user.id, marks).catch(() => undefined);
  return result;
}

export async function trialDecision(admin: Admin, userId: string, kind: TrialKind, isOwner = false, ip: string | null = null): Promise<TrialOutcome> {
  if (isOwner) return "paid";
  const [{ data: plan }, { data: card }] = await Promise.all([
    admin.rpc("member_plan", { _user_id: userId }),
    admin.from("trial_card_checks").select("trial_ends_at").eq("user_id", userId).maybeSingle(),
  ]);
  if (plan && plan !== "free") return "paid";
  const { data: u } = await admin.auth.admin.getUserById(userId);
  const start = await ensureTrialStart(admin, { id: userId, email: u?.user?.email ?? null, created_at: u?.user?.created_at ?? null }, { ip });
  const gate = trialGate({
    isOwner, plan: plan ?? null,
    trialEndsAt: laterEnd(start.trial_ends_at, card?.trial_ends_at),
    blocked: start.blocked && !card,
  });
  if (gate !== "claim") return gate;
  // Option A (Juzzy 2026-11-22): trial members pay for pictures/videos from their own wallet
  // (provider cost + margin), so the owner never funds them. Flip TRIAL_GIFTS_ON to bring back
  // the free trial allowance (TRIAL_LIMITS).
  if (!TRIAL_GIFTS_ON) return "paid";
  const { data: claimed, error } = await admin.rpc("claim_free_trial", { _user_id: userId, _kind: kind });
  if (error) throw new Error(`trial check failed: ${error.message}`);
  return claimed ? "trial" : "used";
}

export async function releaseTrial(admin: Admin, userId: string, kind: TrialKind) {
  await admin.rpc("release_free_trial", { _user_id: userId, _kind: kind }).catch(() => undefined);
}

export function paywallResponse(kind: TrialKind, cors: Record<string, string>, reason: TrialBlock = "used"): Response {
  const headers = { ...cors, "Content-Type": "application/json" };
  if (reason === "card_required") {
    return new Response(JSON.stringify({
      error: "card_required",
      kind,
      message: "Verify a card ($0.00 today) to start your free trial: 3 pictures and 1 eight-second video for 7 days.",
      path: "/trial-card",
    }), { status: 402, headers });
  }
  const what = kind === "video" ? "video" : "pictures";
  return new Response(JSON.stringify({
    error: "upgrade_required",
    paywall: true,
    kind,
    reason,
    message: reason === "duplicate"
      ? TRIAL_USED_MESSAGE
      : reason === "expired"
      ? `Your 7-day free trial has finished. Upgrade to ${kind === "video" ? "Pro" : "Plus"} to keep making ${what}.`
      : kind === "video"
        ? "Your free trial video is used. Upgrade to Pro to keep making videos."
        : "Your free trial pictures are used. Upgrade to Plus to keep making pictures.",
    upgrade_path: "/membership",
  }), { status: 402, headers });
}
