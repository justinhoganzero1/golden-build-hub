// New members must connect their own Google Gemini key before using the app.
// These pages stay open so nobody is trapped: the setup itself, safety help,
// and Settings (sign out / delete account).
export const GEMINI_SETUP_PATH = "/ai-key-setup";
export const GEMINI_SETUP_OPEN_PATHS = [GEMINI_SETUP_PATH, "/age-required", "/crisis-hub", "/safety-center", "/settings"];

export function geminiSetupNeeded(opts: { isOwner: boolean; path: string; verifiedAt: string | null | undefined }): boolean {
  if (opts.isOwner) return false;
  const p = opts.path.replace(/\/+$/, "") || "/";
  if (GEMINI_SETUP_OPEN_PATHS.some((o) => p === o || p.startsWith(`${o}/`))) return false;
  return !opts.verifiedAt;
}
