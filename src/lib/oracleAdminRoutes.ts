/**
 * Owner-only pages. These must never be offered as a choice to normal
 * members — the entry points stay hidden until the owner is signed in.
 *
 * Hiding is UI only: the routes themselves stay behind RequireAuth +
 * RequireAdmin, and the database keeps its own RLS gates.
 */
export const ADMIN_ONLY_PATHS = ["/owner-dashboard", "/admin"] as const;

export function isAdminOnlyPath(path: string): boolean {
  const clean = (path.split("?")[0] || "").split("#")[0];
  return ADMIN_ONLY_PATHS.some(
    (prefix) => clean === prefix || clean.startsWith(`${prefix}/`),
  );
}
