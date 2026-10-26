// Trusted redirect origins for Stripe success/cancel URLs.
// The Origin header is client-controlled, so it is only honoured when it is one
// of our own domains. Everything else falls back to the production domain.
// End users never route through Lovable hosts, so those are not allowlisted.
const ALLOWED_ORIGINS = [
  "https://oracle-lunar.online",
  "https://www.oracle-lunar.online",
  "http://localhost:8080",
  "http://localhost:5173",
];

export const DEFAULT_ORIGIN = "https://oracle-lunar.online";

/** Return a safe redirect origin for this request. */
export function safeOrigin(req: Request): string {
  const raw = req.headers.get("origin") || req.headers.get("Origin");
  if (raw && ALLOWED_ORIGINS.includes(raw)) return raw;
  return DEFAULT_ORIGIN;
}

// Our own editor/preview hosts (exact project only — never other *.lovable.app apps).
const PROJECT_HOSTS = [
  "https://golden-vault-builder.lovable.app",
  "https://id-preview--cac1cf82-5270-45aa-a923-5d8912216beb.lovable.app",
  "https://cac1cf82-5270-45aa-a923-5d8912216beb.lovableproject.com",
];

/** Accept an OAuth redirect only when it points at one of our origins and an expected callback path. */
export function safeRedirectUri(raw: unknown, allowedPaths: string[]): string | null {
  if (typeof raw !== "string" || raw.length > 500) return null;
  try {
    const u = new URL(raw);
    if (![...ALLOWED_ORIGINS, ...PROJECT_HOSTS].includes(u.origin)) return null;
    if (!allowedPaths.includes(u.pathname) || u.search || u.hash || u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}
