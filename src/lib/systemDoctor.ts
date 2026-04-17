/**
 * System Doctor — runtime self-diagnose & auto-repair engine.
 * The Oracle invokes this to scan every subsystem and apply live fixes.
 * Sandbox-safe: cannot rewrite source files, but CAN repair runtime state,
 * caches, stuck flags, auth, edge-function warmups, DB connectivity, etc.
 */
import { supabase } from "@/integrations/supabase/client";

export type CheckStatus = "ok" | "warn" | "fail" | "repaired";

export interface CheckResult {
  id: string;
  name: string;
  status: CheckStatus;
  detail: string;
  repairAction?: string;
  durationMs: number;
}

export interface DoctorReport {
  startedAt: string;
  finishedAt: string;
  totalMs: number;
  passed: number;
  warned: number;
  failed: number;
  repaired: number;
  results: CheckResult[];
  summary: string;
}

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const time = async <T,>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> => {
  const t0 = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - t0) };
};

// ───────────── individual checks (each returns CheckResult) ─────────────

async function checkAuth(): Promise<CheckResult> {
  const { value, ms } = await time(async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) return { status: "fail" as CheckStatus, detail: error.message };
      if (!data.session) return { status: "warn" as CheckStatus, detail: "No active session" };
      // Refresh if expiring within 5min
      const exp = data.session.expires_at ?? 0;
      const remaining = exp * 1000 - Date.now();
      if (remaining < 5 * 60 * 1000) {
        await supabase.auth.refreshSession();
        return { status: "repaired" as CheckStatus, detail: "Session refreshed", repairAction: "auth.refreshSession" };
      }
      return { status: "ok" as CheckStatus, detail: `Session valid for ${Math.round(remaining / 60000)}m` };
    } catch (e: any) {
      return { status: "fail" as CheckStatus, detail: e?.message || "Auth probe failed" };
    }
  });
  return { id: "auth", name: "Authentication", durationMs: ms, ...value };
}

async function checkDatabase(): Promise<CheckResult> {
  const { value, ms } = await time(async () => {
    try {
      const { error } = await supabase.from("user_media").select("id", { head: true, count: "exact" }).limit(1);
      if (error) return { status: "fail" as CheckStatus, detail: error.message };
      return { status: "ok" as CheckStatus, detail: "Database reachable" };
    } catch (e: any) {
      return { status: "fail" as CheckStatus, detail: e?.message || "DB unreachable" };
    }
  });
  return { id: "db", name: "Database connectivity", durationMs: ms, ...value };
}

async function checkEdgeFunction(name: string): Promise<CheckResult> {
  const { value, ms } = await time(async () => {
    try {
      const r = await fetch(`${SUPA_URL}/functions/v1/${name}`, {
        method: "OPTIONS",
        headers: { Authorization: `Bearer ${SUPA_KEY}` },
      });
      if (r.ok || r.status === 204) return { status: "ok" as CheckStatus, detail: `${name} warm` };
      return { status: "warn" as CheckStatus, detail: `${name} returned ${r.status}` };
    } catch (e: any) {
      return { status: "fail" as CheckStatus, detail: `${name} unreachable: ${e?.message}` };
    }
  });
  return { id: `fn-${name}`, name: `Edge fn: ${name}`, durationMs: ms, ...value };
}

async function checkLocalStorage(): Promise<CheckResult> {
  const { value, ms } = await time(async () => {
    try {
      const probe = "__sd_probe__";
      localStorage.setItem(probe, "1");
      if (localStorage.getItem(probe) !== "1") throw new Error("Read mismatch");
      localStorage.removeItem(probe);

      // Repair: prune broken JSON entries (defensive — only known prefixes)
      let pruned = 0;
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (!k.startsWith("solace.") && !k.startsWith("oracle.")) continue;
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        if (raw.startsWith("{") || raw.startsWith("[")) {
          try { JSON.parse(raw); } catch { localStorage.removeItem(k); pruned++; }
        }
      }
      if (pruned > 0) {
        return { status: "repaired" as CheckStatus, detail: `Pruned ${pruned} corrupt entries`, repairAction: "localStorage.prune" };
      }
      return { status: "ok" as CheckStatus, detail: `${keys.length} keys, all valid` };
    } catch (e: any) {
      return { status: "fail" as CheckStatus, detail: e?.message || "localStorage broken" };
    }
  });
  return { id: "storage", name: "Local storage", durationMs: ms, ...value };
}

async function checkServiceWorkerCache(): Promise<CheckResult> {
  const { value, ms } = await time(async () => {
    try {
      if (!("caches" in window)) return { status: "ok" as CheckStatus, detail: "No SW cache (not used)" };
      const names = await caches.keys();
      // Repair: drop stale caches > 7 days old by prefix convention
      let cleared = 0;
      for (const n of names) {
        if (n.includes("stale") || n.includes("v0") || n.includes("v1-old")) {
          await caches.delete(n);
          cleared++;
        }
      }
      if (cleared > 0) return { status: "repaired" as CheckStatus, detail: `Cleared ${cleared} stale caches`, repairAction: "caches.delete" };
      return { status: "ok" as CheckStatus, detail: `${names.length} caches healthy` };
    } catch (e: any) {
      return { status: "warn" as CheckStatus, detail: e?.message || "Cache probe failed" };
    }
  });
  return { id: "cache", name: "Service worker cache", durationMs: ms, ...value };
}

async function checkNetwork(): Promise<CheckResult> {
  const { value, ms } = await time(async () => {
    if (!navigator.onLine) return { status: "fail" as CheckStatus, detail: "Browser reports offline" };
    return { status: "ok" as CheckStatus, detail: "Online" };
  });
  return { id: "net", name: "Network", durationMs: ms, ...value };
}

async function checkMemoryPressure(): Promise<CheckResult> {
  const { value, ms } = await time(async () => {
    const perf = (performance as any).memory;
    if (!perf) return { status: "ok" as CheckStatus, detail: "Heap stats unavailable (non-Chromium)" };
    const usedMB = Math.round(perf.usedJSHeapSize / 1048576);
    const limitMB = Math.round(perf.jsHeapSizeLimit / 1048576);
    const pct = Math.round((usedMB / limitMB) * 100);
    if (pct > 85) return { status: "warn" as CheckStatus, detail: `Heap ${usedMB}MB / ${limitMB}MB (${pct}%) — high` };
    return { status: "ok" as CheckStatus, detail: `Heap ${usedMB}MB / ${limitMB}MB (${pct}%)` };
  });
  return { id: "mem", name: "Memory pressure", durationMs: ms, ...value };
}

async function checkStuckFlags(): Promise<CheckResult> {
  const { value, ms } = await time(async () => {
    const stuckKeys = ["oracle.isLoading", "studio.exporting", "vision.streaming"];
    let cleared = 0;
    for (const k of stuckKeys) {
      const v = localStorage.getItem(k);
      if (v === "true" || v === "1") {
        // If a "loading" flag has been true for >5min, it's stuck.
        const tsKey = `${k}.ts`;
        const ts = parseInt(localStorage.getItem(tsKey) || "0", 10);
        if (!ts || Date.now() - ts > 5 * 60 * 1000) {
          localStorage.removeItem(k);
          localStorage.removeItem(tsKey);
          cleared++;
        }
      }
    }
    if (cleared > 0) return { status: "repaired" as CheckStatus, detail: `Cleared ${cleared} stuck flags`, repairAction: "flags.clear" };
    return { status: "ok" as CheckStatus, detail: "No stuck UI flags" };
  });
  return { id: "flags", name: "UI state flags", durationMs: ms, ...value };
}

// ───────────── orchestrator ─────────────

export async function runFullDiagnostic(
  onProgress?: (r: CheckResult) => void
): Promise<DoctorReport> {
  const startedAt = new Date().toISOString();
  const t0 = performance.now();

  const checks: Array<() => Promise<CheckResult>> = [
    checkNetwork,
    checkAuth,
    checkDatabase,
    checkLocalStorage,
    checkServiceWorkerCache,
    checkMemoryPressure,
    checkStuckFlags,
    () => checkEdgeFunction("oracle-chat"),
    () => checkEdgeFunction("ai-tools"),
    () => checkEdgeFunction("image-gen"),
    () => checkEdgeFunction("elevenlabs-tts"),
    () => checkEdgeFunction("script-to-scenes"),
    () => checkEdgeFunction("live-vision"),
  ];

  const results: CheckResult[] = [];
  // Run in parallel batches of 4 to avoid hammering
  for (let i = 0; i < checks.length; i += 4) {
    const batch = await Promise.all(checks.slice(i, i + 4).map((c) => c().catch((e): CheckResult => ({
      id: "err", name: "Check error", status: "fail", detail: e?.message || "unknown", durationMs: 0,
    }))));
    for (const r of batch) {
      results.push(r);
      onProgress?.(r);
    }
  }

  const totalMs = Math.round(performance.now() - t0);
  const passed = results.filter((r) => r.status === "ok").length;
  const warned = results.filter((r) => r.status === "warn").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const repaired = results.filter((r) => r.status === "repaired").length;

  const summary =
    failed === 0 && warned === 0
      ? `All systems optimal. ${passed} checks passed${repaired ? `, ${repaired} auto-repaired` : ""} in ${totalMs}ms.`
      : `${failed} failed, ${warned} warnings, ${repaired} auto-repaired, ${passed} ok (${totalMs}ms).`;

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    totalMs,
    passed,
    warned,
    failed,
    repaired,
    results,
    summary,
  };
}

/** Hard reset — last-resort repair the Oracle can offer. */
export async function emergencyReset(): Promise<string> {
  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
    // Preserve auth tokens; nuke everything else
    const keep: Record<string, string> = {};
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("sb-") || k.includes("auth")) keep[k] = localStorage.getItem(k) || "";
    }
    localStorage.clear();
    for (const [k, v] of Object.entries(keep)) localStorage.setItem(k, v);
    sessionStorage.clear();
    return "Emergency reset complete. Caches and stuck state cleared. Auth preserved.";
  } catch (e: any) {
    return `Reset partially failed: ${e?.message}`;
  }
}
