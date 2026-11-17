// Free-plan trial: 3 pictures and 1 eight-second video per account, then the paywall.
// Paid plans and the owner never use the trial (they follow normal wallet billing).
export const TRIAL_LIMITS = { image: 3, video: 1 } as const;
export const TRIAL_VIDEO_SECONDS = 8;
export type TrialKind = keyof typeof TRIAL_LIMITS;
// deno-lint-ignore no-explicit-any
type Admin = any;

/** "paid" = use normal billing; "trial" = free trial item claimed; "paywall" = must upgrade. */
export async function trialDecision(admin: Admin, userId: string, kind: TrialKind, isOwner = false): Promise<"paid" | "trial" | "paywall"> {
  if (isOwner) return "paid";
  const { data: plan } = await admin.rpc("member_plan", { _user_id: userId });
  if (plan && plan !== "free") return "paid";
  const { data: claimed, error } = await admin.rpc("claim_free_trial", { _user_id: userId, _kind: kind });
  if (error) throw new Error(`trial check failed: ${error.message}`);
  return claimed ? "trial" : "paywall";
}

export async function releaseTrial(admin: Admin, userId: string, kind: TrialKind) {
  await admin.rpc("release_free_trial", { _user_id: userId, _kind: kind }).catch(() => undefined);
}

export function paywallResponse(kind: TrialKind, cors: Record<string, string>): Response {
  return new Response(JSON.stringify({
    error: "upgrade_required",
    paywall: true,
    kind,
    message: kind === "video"
      ? "Your free trial video is used. Upgrade to Pro to keep making videos."
      : "Your free trial pictures are used. Upgrade to Plus to keep making pictures.",
    upgrade_path: "/membership",
  }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
}
