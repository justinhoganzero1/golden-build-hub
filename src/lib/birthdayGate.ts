/**
 * Birthday step for accounts that skipped the sign-up birthday question.
 * Email sign-ups enter a birthday on the form; Google sign-ups don't, so
 * they are asked once before using the app. Oracle Lunar is 16+.
 */
export const MIN_AGE = 16;

type AuthUserLike = {
  app_metadata?: { provider?: string; providers?: string[] } | null;
  identities?: { provider?: string }[] | null;
} | null | undefined;

/** True when the account was created or linked through Google sign-in. */
export function signedInWithGoogle(user: AuthUserLike): boolean {
  if (!user) return false;
  const meta = user.app_metadata || {};
  if (meta.provider === "google") return true;
  if (Array.isArray(meta.providers) && meta.providers.includes("google")) return true;
  return (user.identities || []).some((i) => i?.provider === "google");
}

/** Latest birthday allowed today (YYYY-MM-DD) for someone exactly MIN_AGE. */
export function latestAllowedBirthday(today: Date = new Date()): string {
  const d = new Date(Date.UTC(today.getFullYear() - MIN_AGE, today.getMonth(), today.getDate()));
  return d.toISOString().slice(0, 10);
}

export type BirthdayCheck = "ok" | "missing" | "invalid" | "too-young";

/** Checks a YYYY-MM-DD birthday against the 16+ rule. */
export function checkBirthday(dob: string, today: Date = new Date()): BirthdayCheck {
  if (!dob) return "missing";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || isNaN(new Date(dob).getTime())) return "invalid";
  if (dob < "1900-01-01") return "invalid";
  if (dob > latestAllowedBirthday(today)) return "too-young";
  return "ok";
}

/** Google accounts without a saved birthday must answer the birthday step. */
export function needsBirthdayStep(user: AuthUserLike, savedDob: string | null | undefined): boolean {
  return signedInWithGoogle(user) && !savedDob;
}
