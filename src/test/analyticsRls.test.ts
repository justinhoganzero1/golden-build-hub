// Regression tests: analytics + install events may only record a user_id that
// matches the caller's signed-in identity. Anonymous callers must be able to
// insert with user_id = null, and must NOT be able to spoof someone else's id.
//
// Runs against the live backend using the publishable (anon) key. Skipped when
// the env vars are not available (e.g. offline CI).
import { describe, it, expect } from "vitest";

const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const REST = `${URL_BASE}/rest/v1`;
const OTHER_USER = "00000000-0000-0000-0000-000000000001";

const headers = {
  apikey: ANON ?? "",
  Authorization: `Bearer ${ANON ?? ""}`,
  "Content-Type": "application/json",
};

async function insert(table: string, row: Record<string, unknown>) {
  const res = await fetch(`${REST}/${table}`, {
    method: "POST",
    headers,
    body: JSON.stringify(row),
  });
  return res.status;
}

// 401/403 both mean "RLS refused the write".
const isDenied = (status: number) => status === 401 || status === 403;

describe.runIf(!!URL_BASE && !!ANON)("analytics RLS — user_id spoofing", () => {
  it("allows anonymous ai_discovery_events with no user_id", async () => {
    const status = await insert("ai_discovery_events", {
      event_type: "visit",
      path: "/__rls_regression__",
      engine: "vitest",
    });
    expect(status).toBe(201);
  });

  it("blocks ai_discovery_events that claim another user_id", async () => {
    const status = await insert("ai_discovery_events", {
      event_type: "visit",
      path: "/__rls_regression__",
      engine: "vitest",
      user_id: OTHER_USER,
    });
    expect(isDenied(status)).toBe(true);
  });

  it("keeps ai_discovery_events unreadable by anonymous callers", async () => {
    const res = await fetch(`${REST}/ai_discovery_events?select=id&limit=1`, { headers });
    const body = await res.json();
    expect(Array.isArray(body) ? body.length : 0).toBe(0);
  });

  it("allows anonymous install_events with no user_id", async () => {
    const status = await insert("install_events", {
      event_type: "click",
      platform: "android",
    });
    expect(status).toBe(201);
  });

  it.each([
    "click",
    "download_start",
    "guide_open",
    "step_complete",
    "install_success",
    "install_failure",
    "installed",
  ])("accepts install funnel event_type %s anonymously", async (eventType) => {
    const status = await insert("install_events", {
      event_type: eventType,
      platform: "android",
    });
    expect(status).toBe(201);
  });

  it("blocks install_events that claim another user_id", async () => {
    const status = await insert("install_events", {
      event_type: "click",
      platform: "android",
      user_id: OTHER_USER,
    });
    expect(isDenied(status)).toBe(true);
  });

  it("blocks every install funnel event_type when user_id is spoofed", async () => {
    const types = ["download_start", "guide_open", "step_complete", "install_success", "install_failure"];
    const statuses = await Promise.all(
      types.map((event_type) =>
        insert("install_events", { event_type, platform: "android", user_id: OTHER_USER }),
      ),
    );
    expect(statuses.every(isDenied)).toBe(true);
  });

  it("blocks install_events with an unexpected event_type", async () => {
    const status = await insert("install_events", {
      event_type: "totally_made_up",
      platform: "android",
    });
    expect(isDenied(status)).toBe(true);
  });

  it("blocks install_events with an unexpected platform", async () => {
    const status = await insert("install_events", {
      event_type: "click",
      platform: "toaster",
    });
    expect(isDenied(status)).toBe(true);
  });

  it("keeps install_events unreadable by anonymous callers", async () => {
    const res = await fetch(`${REST}/install_events?select=id&limit=1`, { headers });
    const body = await res.json();
    expect(Array.isArray(body) ? body.length : 0).toBe(0);
  });
});

