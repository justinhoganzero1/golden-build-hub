// Maps thrown error messages to the correct HTTP status so callers
// see "not signed in" / "bad request" instead of a generic server error.
export function statusFor(err: unknown): number {
  const m = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (/(authoriz|auth header|no auth|missing auth|not authenticated|authentication error|auth error)/.test(m)) return 401;
  if (/forbidden|not allowed|admin only/.test(m)) return 403;
  if (/not found|no stripe customer|no connect account/.test(m)) return 404;
  if (/required|invalid|unknown action|is not for sale|onboard|payment not complete|has no unit_amount/.test(m)) return 400;
  return 500;
}
