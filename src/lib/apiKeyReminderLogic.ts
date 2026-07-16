// Pure logic for the ApiKeyReminder modal. Extracted so it can be unit-tested
// without React, Supabase, or a browser session.

export const TRIAL_DAYS = 7;

export interface ReminderInputs {
  /** ISO timestamp of user creation (auth.users.created_at). */
  createdAtIso: string | null | undefined;
  /** Is the current user the site owner / admin? */
  isOwner: boolean;
  /** Does the user have unlimited AI (paid tier / lifetime)? */
  hasUnlimitedAi: boolean;
  /** Does the user have ANY active reward grant (free_for_life, lifetime, unlimited_ai, custom)? */
  hasActiveReward: boolean;
  /** Has the user pasted their own OpenAI key (>10 chars)? */
  hasOpenAI: boolean;
  /** Has the user pasted their own Gemini key (>10 chars)? */
  hasGemini: boolean;
  /** Injectable clock for tests. Defaults to Date.now(). */
  now?: number;
}

export type ReminderDecision =
  | { show: false; reason: "no_created_at" | "not_trial_user" | "keys_present" | "still_early" }
  | {
      show: true;
      daysLeft: number;
      urgent: boolean;
      missingProvider: "openai" | "gemini" | "both";
      targetProvider: "openai" | "gemini";
    };

export function decideApiKeyReminder(inp: ReminderInputs): ReminderDecision {
  if (!inp.createdAtIso) return { show: false, reason: "no_created_at" };

  // Anyone with a real paid/free-for-life entitlement is NOT a trial user.
  if (inp.isOwner || inp.hasUnlimitedAi || inp.hasActiveReward) {
    return { show: false, reason: "not_trial_user" };
  }

  // Already brought their own keys — no nagging.
  if (inp.hasOpenAI && inp.hasGemini) return { show: false, reason: "keys_present" };

  const nowMs = inp.now ?? Date.now();
  const createdMs = new Date(inp.createdAtIso).getTime();
  const elapsedDays = Math.floor((nowMs - createdMs) / 86_400_000);
  const daysLeft = Math.max(0, TRIAL_DAYS - elapsedDays);

  // Only bother in the final 3 days of the trial.
  if (daysLeft > 3) return { show: false, reason: "still_early" };

  const missingProvider: "openai" | "gemini" | "both" =
    !inp.hasOpenAI && !inp.hasGemini ? "both" : !inp.hasOpenAI ? "openai" : "gemini";
  const targetProvider: "openai" | "gemini" = missingProvider === "gemini" ? "gemini" : "openai";

  return {
    show: true,
    daysLeft,
    urgent: daysLeft <= 1,
    missingProvider,
    targetProvider,
  };
}
