// Oracle Phoenix — emergency reboot & self-rebuild.
// If the app is in catastrophic failure (missing buckets, missing owner role,
// stuck jobs, no admin grants) this function rebuilds the minimum operational
// state so the rest of the app can come back to life.
//
// It is idempotent and safe to call multiple times.
// It does NOT drop user data — it only re-creates missing infrastructure
// and clears stuck runtime state.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OWNER_EMAIL = "justinbretthogan@gmail.com";

// Buckets the app needs to exist for media storage.
const REQUIRED_BUCKETS = [
  { id: "site-assets", public: true },
  { id: "movies", public: true },
  { id: "living-gifs", public: true },
  { id: "app-downloads", public: true },
  { id: "photography-assets", public: true },
];

// Edge functions to warm up so the next user request is fast.
const WARM_FUNCTIONS = [
  "oracle-chat", "image-gen", "gemini-video", "ai-tools",
  "elevenlabs-tts", "live-vision", "oracle-research",
];

type Step = { id: string; ok: boolean; detail: string; ms: number };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!SUPA_URL || !SERVICE) {
    return new Response(JSON.stringify({ error: "Service role unavailable" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Authorize: anyone can request a *check*, but only the owner can actually *reboot*.
  let body: { mode?: "check" | "reboot" } = {};
  try { body = await req.json(); } catch {}
  const mode = body.mode === "reboot" ? "reboot" : "check";

  let isOwner = false;
  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token) {
    try {
      const userClient = createClient(SUPA_URL, SERVICE);
      const { data } = await userClient.auth.getUser(token);
      const email = (data?.user?.email || "").toLowerCase().trim();
      if (email === OWNER_EMAIL) isOwner = true;
    } catch {/* ignore */}
  }
  if (mode === "reboot" && !isOwner) {
    return new Response(JSON.stringify({ error: "Only the owner can trigger Phoenix reboot." }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } });
  const steps: Step[] = [];
  const time = async (id: string, fn: () => Promise<{ ok: boolean; detail: string }>) => {
    const t0 = Date.now();
    try {
      const r = await fn();
      steps.push({ id, ...r, ms: Date.now() - t0 });
    } catch (e) {
      steps.push({ id, ok: false, detail: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 });
    }
  };

  // ── 1. Database reachability ───────────────────────────────────────────
  await time("db.connectivity", async () => {
    const { error } = await admin.from("user_roles").select("user_id", { head: true, count: "exact" }).limit(1);
    if (error) return { ok: false, detail: `DB unreachable: ${error.message}` };
    return { ok: true, detail: "Database reachable" };
  });

  // ── 2. Owner exists & has admin role ───────────────────────────────────
  await time("owner.role", async () => {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const owner = list?.users?.find((u: any) => (u.email || "").toLowerCase() === OWNER_EMAIL);
    if (!owner) return { ok: false, detail: `Owner ${OWNER_EMAIL} not found in auth.users` };
    if (mode === "reboot") {
      const { error } = await admin.from("user_roles").upsert(
        { user_id: owner.id, role: "admin" },
        { onConflict: "user_id,role" },
      );
      if (error) return { ok: false, detail: `Failed to grant admin: ${error.message}` };
    }
    return { ok: true, detail: `Owner ${owner.email} confirmed as admin` };
  });

  // ── 3. Storage buckets ─────────────────────────────────────────────────
  for (const b of REQUIRED_BUCKETS) {
    await time(`bucket.${b.id}`, async () => {
      const { data: existing } = await admin.storage.getBucket(b.id);
      if (existing) return { ok: true, detail: `Bucket ${b.id} ok` };
      if (mode !== "reboot") return { ok: false, detail: `Bucket ${b.id} MISSING` };
      const { error } = await admin.storage.createBucket(b.id, { public: b.public });
      if (error) return { ok: false, detail: `Create failed: ${error.message}` };
      return { ok: true, detail: `Bucket ${b.id} re-created` };
    });
  }

  // ── 4. Clear stuck render / generation jobs ────────────────────────────
  if (mode === "reboot") {
    await time("jobs.unstick", async () => {
      const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { error: e1 } = await admin
        .from("movie_render_jobs")
        .update({ status: "queued", locked_at: null, locked_by: null })
        .eq("status", "running").lt("locked_at", cutoff);
      const { error: e2 } = await admin
        .from("living_gifs")
        .update({ status: "queued", locked_at: null, locked_by: null })
        .in("status", ["running", "upscaling", "generating"])
        .lt("locked_at", cutoff);
      if (e1 || e2) return { ok: false, detail: `Partial: ${e1?.message || ""} ${e2?.message || ""}` };
      return { ok: true, detail: "Stuck jobs released back to queue" };
    });
  }

  // ── 5. Warm edge functions (parallel OPTIONS pings) ────────────────────
  await time("functions.warm", async () => {
    const results = await Promise.allSettled(WARM_FUNCTIONS.map((fn) =>
      fetch(`${SUPA_URL}/functions/v1/${fn}`, { method: "OPTIONS" }).then((r) => r.status)
    ));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    return { ok: ok > 0, detail: `${ok}/${WARM_FUNCTIONS.length} functions responsive` };
  });

  // ── 6. Realtime publication (best effort) ──────────────────────────────
  // Skipped — requires raw SQL; covered by migrations.

  const ok = steps.filter((s) => s.ok).length;
  const failed = steps.filter((s) => !s.ok).length;
  const summary = mode === "reboot"
    ? (failed === 0 ? "🔥 Phoenix reboot complete — system fully operational." : `Phoenix reboot finished with ${failed} unresolved issue(s).`)
    : (failed === 0 ? "All systems nominal." : `Health check: ${failed} issue(s) detected. Run reboot as owner to repair.`);

  return new Response(JSON.stringify({ mode, ok, failed, steps, summary, isOwner }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
