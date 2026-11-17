// Free-plan trial: a verified card ($0 charged) unlocks 3 pictures and 1
// eight-second video for 7 days, then the paywall. One trial per card.
// Paid plans and the owner never use the trial (they follow normal wallet billing).
export const TRIAL_LIMITS = { image: 3, video: 1 } as const;
export const TRIAL_VIDEO_SECONDS = 8;
export const TRIAL_DAYS = 7;
export type TrialKind = keyof typeof TRIAL_LIMITS;
export type TrialBlock = "card_required" | "expired" | "used";
export type TrialOutcome = "paid" | "trial" | TrialBlock;
// deno-lint-ignore no-explicit-any
type Admin = any;

export const trialEndsAt = (verifiedAt: Date): Date => new Date(verifiedAt.getTime() + TRIAL_DAYS * 86_400_000);

/** Rules before any allowance is claimed: who pays, who needs a card, whose window closed. */
export function trialGate(opts: { isOwner: boolean; plan: string | null; trialEndsAt: string | null; now?: Date }): "paid" | "claim" | "card_required" | "expired" {
  if (opts.isOwner) return "paid";
  if (opts.plan && opts.plan !== "free") return "paid";
  if (!opts.trialEndsAt) return "card_required";
  const now = opts.now ?? new Date();
  return now.getTime() < new Date(opts.trialEndsAt).getTime() ? "claim" : "expired";
}

export const isTrialBlocked = (t: TrialOutcome): t is TrialBlock => t !== "paid" && t !== "trial";

export async function trialDecision(admin: Admin, userId: string, kind: TrialKind, isOwner = false): Promise<TrialOutcome> {
  if (isOwner) return "paid";
  const [{ data: plan }, { data: card }] = await Promise.all([
    admin.rpc("member_plan", { _user_id: userId }),
    admin.from("trial_card_checks").select("trial_ends_at").eq("user_id", userId).maybeSingle(),
  ]);
  const gate = trialGate({ isOwner, plan: plan ?? null, trialEndsAt: card?.trial_ends_at ?? null });
  if (gate !== "claim") return gate;
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
    message: reason === "expired"
      ? `Your 7-day free trial has finished. Upgrade to ${kind === "video" ? "Pro" : "Plus"} to keep making ${what}.`
      : kind === "video"
        ? "Your free trial video is used. Upgrade to Pro to keep making videos."
        : "Your free trial pictures are used. Upgrade to Plus to keep making pictures.",
    upgrade_path: "/membership",
  }), { status: 402, headers });
}
