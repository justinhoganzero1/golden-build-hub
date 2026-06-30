// Security regression tests.
//
// Verifies the AI/owner endpoints reject unauthenticated callers, and that
// the suggestions free-access protection trigger blocks non-owner attempts
// to flip granted_free_access.
//
// Run via the Edge Function test runner. Requires VITE_SUPABASE_URL and
// VITE_SUPABASE_PUBLISHABLE_KEY in the project's .env (loaded automatically).
// Optional: set TEST_USER_EMAIL / TEST_USER_PASSWORD to a non-owner account
// to run the authenticated trigger checks; otherwise those tests are skipped.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const ANON_KEY =
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

const TEST_EMAIL = Deno.env.get("TEST_USER_EMAIL");
const TEST_PASSWORD = Deno.env.get("TEST_USER_PASSWORD");

// Endpoints that must reject any caller without a valid Bearer token.
const USER_ENDPOINTS = [
  "oracle-coder",
  "app-builder-autonomous",
  "ai-tools",
  "oracle-research",
  "gemini-video",
  "elevenlabs-tts",
  "speech-therapist",
  "ai-friends-chat",
  "oracle-voice-director",
];

// Endpoints that must reject any non-owner caller.
const OWNER_ENDPOINTS = ["growth-broadcast"];

async function postNoAuth(name: string) {
  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  const body = await res.text();
  return { status: res.status, body };
}

async function postWithToken(name: string, token: string) {
  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });
  const body = await res.text();
  return { status: res.status, body };
}

Deno.test("user endpoints reject missing auth", async () => {
  for (const name of USER_ENDPOINTS) {
    const { status, body } = await postNoAuth(name);
    assertEquals(
      status,
      401,
      `expected 401 from ${name}, got ${status} body=${body.slice(0, 200)}`,
    );
  }
});

Deno.test("owner endpoints reject missing auth", async () => {
  for (const name of OWNER_ENDPOINTS) {
    const { status, body } = await postNoAuth(name);
    assertEquals(
      status,
      401,
      `expected 401 from ${name}, got ${status} body=${body.slice(0, 200)}`,
    );
  }
});

Deno.test({
  name: "owner endpoints reject non-owner auth",
  ignore: !(TEST_EMAIL && TEST_PASSWORD),
  fn: async () => {
    const c = createClient(SUPABASE_URL, ANON_KEY);
    const { data, error } = await c.auth.signInWithPassword({
      email: TEST_EMAIL!,
      password: TEST_PASSWORD!,
    });
    if (error) throw error;
    const token = data.session!.access_token;
    for (const name of OWNER_ENDPOINTS) {
      const { status, body } = await postWithToken(name, token);
      assertEquals(
        status,
        403,
        `expected 403 from ${name}, got ${status} body=${body.slice(0, 200)}`,
      );
    }
    await c.auth.signOut();
  },
});

Deno.test({
  name: "non-owner cannot create suggestion with granted_free_access=true",
  ignore: !(TEST_EMAIL && TEST_PASSWORD),
  fn: async () => {
    const c = createClient(SUPABASE_URL, ANON_KEY);
    const { error: signInErr } = await c.auth.signInWithPassword({
      email: TEST_EMAIL!,
      password: TEST_PASSWORD!,
    });
    if (signInErr) throw signInErr;

    const { data, error } = await c
      .from("suggestions")
      .insert({
        suggestion: "security test 2014 non-owner trying to grant free access",
        
        granted_free_access: true,
      })
      .select("id, granted_free_access")
      .single();

    // The protect_suggestion_privileged_columns trigger strips the value.
    // Either the row is inserted with granted_free_access=false (trigger stripped),
    // or the INSERT policy blocks it outright. Both are acceptable.
    if (error) {
      assert(
        /policy|denied|permission/i.test(error.message),
        `unexpected error: ${error.message}`,
      );
    } else {
      assertEquals(
        data.granted_free_access,
        false,
        "trigger must strip granted_free_access for non-owners on INSERT",
      );
      // cleanup
      await c.from("suggestions").delete().eq("id", data.id);
    }
    await c.auth.signOut();
  },
});

Deno.test({
  name: "non-owner cannot update granted_free_access on existing suggestion",
  ignore: !(TEST_EMAIL && TEST_PASSWORD),
  fn: async () => {
    const c = createClient(SUPABASE_URL, ANON_KEY);
    const { error: signInErr } = await c.auth.signInWithPassword({
      email: TEST_EMAIL!,
      password: TEST_PASSWORD!,
    });
    if (signInErr) throw signInErr;

    // Seed a plain suggestion (no privileged field).
    const { data: seed, error: seedErr } = await c
      .from("suggestions")
      .insert({ suggestion: "security test 2014 seed for update", category: "Feature" })
      .select("id, granted_free_access")
      .single();
    if (seedErr) throw seedErr;
    assertEquals(seed.granted_free_access, false, "seed row should not be privileged");

    // Try to flip the flag as non-owner.
    const { data: updated, error: upErr } = await c
      .from("suggestions")
      .update({ granted_free_access: true })
      .eq("id", seed.id)
      .select("granted_free_access")
      .single();

    if (upErr) {
      assert(
        /policy|denied|permission/i.test(upErr.message),
        `unexpected error: ${upErr.message}`,
      );
    } else {
      assertEquals(
        updated.granted_free_access,
        false,
        "trigger must preserve OLD.granted_free_access for non-owners on UPDATE",
      );
    }

    await c.from("suggestions").delete().eq("id", seed.id);
    await c.auth.signOut();
  },
});
