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
