/**
 * Suggestions privilege-escalation E2E
 *
 * Verifies that a non-owner cannot grant themselves the `granted_free_access`
 * flag on the `suggestions` table, by BOTH paths:
 *
 *  1. UI submission via /suggestion-box (the real form path) and a follow-up
 *     direct UPDATE that tries to flip the flag on the just-inserted row.
 *  2. Direct PostgREST API insert + update with the flag forced to `true`.
 *
 * Both paths must result in `granted_free_access = false` on the persisted row
 * (RLS WITH CHECK + the `protect_suggestion_privileged_columns` BEFORE trigger
 * + the `log_suggestion_free_access_denial` audit trigger are the three
 * defense layers under test).
 *
 * Skipped when TEST_USER_EMAIL / TEST_USER_PASSWORD are not present.
 */

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const TEST_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD;

const skip = !TEST_EMAIL || !TEST_PASSWORD;

test.describe("suggestions free-access cannot be granted by non-owners", () => {
  test.skip(skip, "needs TEST_USER_EMAIL / TEST_USER_PASSWORD");

  test("direct PostgREST: insert + update with granted_free_access=true stay false", async () => {
    const c = createClient(SUPABASE_URL, ANON_KEY);
    const { error: signInErr } = await c.auth.signInWithPassword({
      email: TEST_EMAIL!,
      password: TEST_PASSWORD!,
    });
    expect(signInErr, signInErr?.message).toBeNull();

    // INSERT path
    const { data: ins, error: insErr } = await c
      .from("suggestions")
      .insert({
        suggestion: "e2e: try to self-grant free access on INSERT",
        category: "Feature",
        granted_free_access: true,
      })
      .select("id, granted_free_access")
      .single();

    if (insErr) {
      expect(insErr.message).toMatch(/policy|denied|permission/i);
    } else {
      expect(ins.granted_free_access).toBe(false);
    }

    // UPDATE path: seed clean, then try to flip
    const { data: seed, error: seedErr } = await c
      .from("suggestions")
      .insert({ suggestion: "e2e: seed for update flip", category: "Feature" })
      .select("id, granted_free_access")
      .single();
    expect(seedErr, seedErr?.message).toBeNull();
    expect(seed.granted_free_access).toBe(false);

    const { data: upd, error: upErr } = await c
      .from("suggestions")
      .update({ granted_free_access: true })
      .eq("id", seed.id)
      .select("granted_free_access")
      .single();

    if (upErr) {
      expect(upErr.message).toMatch(/policy|denied|permission/i);
    } else {
      expect(upd.granted_free_access).toBe(false);
    }

    // cleanup
    await c.from("suggestions").delete().eq("id", seed.id);
    if (ins?.id) await c.from("suggestions").delete().eq("id", ins.id);
    await c.auth.signOut();
  });

  test("UI flow: submit via /suggestion-box, then try to flip via API — stays false", async ({
    page,
  }) => {
    // Use a Supabase client for both seeding the session into localStorage
    // and for the follow-up verification.
    const c = createClient(SUPABASE_URL, ANON_KEY);
    const { data, error } = await c.auth.signInWithPassword({
      email: TEST_EMAIL!,
      password: TEST_PASSWORD!,
    });
    expect(error, error?.message).toBeNull();
    const session = data.session!;
    const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
    const storageKey = `sb-${projectRef}-auth-token`;

    await page.goto("/");
    await page.evaluate(
      ([k, s]) => window.localStorage.setItem(k, s),
      [storageKey, JSON.stringify(session)],
    );

    await page.goto("/suggestion-box");
    // The form renders a textarea and a Send button.
    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 15000 });
    await textarea.fill("e2e: UI submission — must NOT come back privileged");

    // The submit button label includes "Send" (lucide Send icon button text).
    await page.getByRole("button", { name: /send/i }).first().click();

    // Wait for the toast / list refresh
    await page.waitForTimeout(2500);

    // Verify via API that the latest row from this user did NOT come back with
    // granted_free_access=true — even though the UI form's client code could in
    // principle be modified by an attacker to attach that field.
    const { data: rows, error: readErr } = await c
      .from("suggestions")
      .select("id, suggestion, granted_free_access")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(5);
    expect(readErr, readErr?.message).toBeNull();
    expect(rows && rows.length).toBeGreaterThan(0);
    for (const r of rows!) {
      expect(r.granted_free_access).toBe(false);
    }

    // Now simulate the attacker tampering with the just-created row.
    const target = rows![0];
    const { data: upd, error: upErr } = await c
      .from("suggestions")
      .update({ granted_free_access: true })
      .eq("id", target.id)
      .select("granted_free_access")
      .single();
    if (upErr) {
      expect(upErr.message).toMatch(/policy|denied|permission/i);
    } else {
      expect(upd.granted_free_access).toBe(false);
    }

    // cleanup the e2e rows we created
    await c
      .from("suggestions")
      .delete()
      .eq("user_id", session.user.id)
      .ilike("suggestion", "e2e:%");
    await c.auth.signOut();
  });
});
