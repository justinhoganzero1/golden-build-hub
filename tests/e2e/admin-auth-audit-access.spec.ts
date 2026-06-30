/**
 * Admin gate E2E for /admin/auth-audit and the admin-reports edge function.
 *
 * Verifies three things:
 *   1. Anonymous calls to admin-reports return 401 (auth_required).
 *   2. A signed-in NON-owner gets 403 (forbidden) from admin-reports.
 *   3. A non-owner visiting /admin/auth-audit does NOT see the audit table —
 *      either the route redirects, or the page never reveals real audit rows
 *      because RLS on `auth_audit_log` only allows the locked owner email.
 *
 * The OWNER-success path is intentionally NOT tested here: the owner email is
 * locked at the DB level and we never want test infrastructure to hold owner
 * credentials. Skipped when TEST_USER_EMAIL / TEST_USER_PASSWORD are unset
 * (those creds must be a normal, non-owner account).
 */

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const TEST_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD;

const FN_URL = `${SUPABASE_URL}/functions/v1/admin-reports`;
const skip = !TEST_EMAIL || !TEST_PASSWORD;

test.describe("admin-reports + /admin/auth-audit owner gate", () => {
  test("anonymous call to admin-reports returns 401", async ({ request }) => {
    const res = await request.post(FN_URL, {
      headers: { "Content-Type": "application/json", apikey: ANON_KEY },
      data: { report: "provider_pnl", days: 7 },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("auth_required");
  });

  test.describe("non-owner signed in", () => {
    test.skip(skip, "needs TEST_USER_EMAIL / TEST_USER_PASSWORD (non-owner)");

    test("admin-reports returns 403 for non-owner", async ({ request }) => {
      const c = createClient(SUPABASE_URL, ANON_KEY);
      const { data, error } = await c.auth.signInWithPassword({
        email: TEST_EMAIL!,
        password: TEST_PASSWORD!,
      });
      expect(error, error?.message).toBeNull();
      const token = data.session?.access_token;
      expect(token).toBeTruthy();

      const res = await request.post(FN_URL, {
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${token}`,
        },
        data: { report: "provider_pnl", days: 7 },
      });
      // requireOwner returns 403 with { error: "forbidden" } for non-owner JWTs.
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.error).toBe("forbidden");
    });

    test("non-owner cannot read auth_audit_log via PostgREST", async () => {
      const c = createClient(SUPABASE_URL, ANON_KEY);
      const { error: signInErr } = await c.auth.signInWithPassword({
        email: TEST_EMAIL!,
        password: TEST_PASSWORD!,
      });
      expect(signInErr, signInErr?.message).toBeNull();

      const { data, error } = await c
        .from("auth_audit_log")
        .select("id")
        .limit(1);
      // RLS scopes this table to the locked owner only — non-owners either
      // get an error or an empty array. Both are acceptable; what's NOT
      // acceptable is real rows leaking through.
      expect(error || (data && data.length === 0)).toBeTruthy();
    });

    test("non-owner visiting /admin/auth-audit sees no audit rows", async ({ page }) => {
      // Hydrate the Supabase session into the browser before navigating so
      // that the page's own auth gate (admin check) runs against a real,
      // non-owner identity.
      const c = createClient(SUPABASE_URL, ANON_KEY);
      const { data, error } = await c.auth.signInWithPassword({
        email: TEST_EMAIL!,
        password: TEST_PASSWORD!,
      });
      expect(error, error?.message).toBeNull();
      const session = data.session!;
      const storageKey = `sb-${new URL(SUPABASE_URL).host.split(".")[0]}-auth-token`;

      await page.goto("/");
      await page.evaluate(
        ([k, v]) => window.localStorage.setItem(k, v),
        [storageKey, JSON.stringify(session)],
      );

      await page.goto("/admin/auth-audit", { waitUntil: "domcontentloaded" });

      // The audit table body must not contain any rows for a non-owner.
      // Either the page redirects, shows an admin-gate message, or RLS
      // simply returns zero rows — in all three cases there must be no
      // <tr> with an event_type badge.
      const eventBadges = page.locator("table tbody tr");
      await expect.poll(async () => await eventBadges.count(), { timeout: 5000 }).toBe(0);
    });
  });
});
