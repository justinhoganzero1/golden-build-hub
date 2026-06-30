import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Shield, RefreshCw, Search, Download } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuditRow {
  id: string;
  created_at: string;
  user_id: string | null;
  email: string | null;
  ip: string | null;
  path: string | null;
  event_type: string;
  reason: string | null;
  metadata: Record<string, unknown> | null;
}

const RANGES: Array<{ label: string; hours: number }> = [
  { label: "1h", hours: 1 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 24 * 7 },
  { label: "30d", hours: 24 * 30 },
];

const EVENT_FILTERS = ["all", "auth_required", "forbidden", "rate_limited", "denied_free_access"] as const;
type EventFilter = (typeof EVENT_FILTERS)[number];

export default function AdminAuthAuditPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [pathQ, setPathQ] = useState("");
  const [userQ, setUserQ] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
      let q = supabase
        .from("auth_audit_log")
        .select("id, created_at, user_id, email, ip, path, event_type, reason, metadata")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      if (eventFilter !== "all") q = q.eq("event_type", eventFilter);
      const { data, error } = await q;
      if (error) throw error;
      setRows((data || []) as AuditRow[]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not load audit log.");
    } finally {
      setLoading(false);
    }
  }, [user, hours, eventFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const p = pathQ.trim().toLowerCase();
    const u = userQ.trim().toLowerCase();
    return rows.filter((r) => {
      if (p && !(r.path || "").toLowerCase().includes(p)) return false;
      if (u) {
        const hay = `${r.email ?? ""} ${r.user_id ?? ""} ${r.ip ?? ""}`.toLowerCase();
        if (!hay.includes(u)) return false;
      }
      return true;
    });
  }, [rows, pathQ, userQ]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of filtered) c[r.event_type] = (c[r.event_type] || 0) + 1;
    return c;
  }, [filtered]);

  const exportCsv = useCallback(() => {
    if (filtered.length === 0) {
      toast.error("No rows to export.");
      return;
    }
    const cols = ["created_at", "event_type", "reason", "path", "email", "user_id", "ip", "metadata"] as const;
    const esc = (v: unknown) => {
      const s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [cols.join(",")];
    for (const r of filtered) {
      lines.push(cols.map((c) => esc((r as unknown as Record<string, unknown>)[c])).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.download = `auth-audit-${hours}h-${eventFilter}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} rows.`);
  }, [filtered, hours, eventFilter]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <UniversalBackButton />
      <div className="max-w-6xl mx-auto space-y-4">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <h1 className="text-2xl font-bold">Auth Audit Log</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              disabled={loading || filtered.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="export-csv"
            >
              <Download className="w-4 h-4" />
              Export CSV ({filtered.length})
            </button>
            <button
              onClick={load}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </header>

        <p className="text-sm text-muted-foreground">
          Server-side trail of 401 (missing/invalid auth), 403 (non-owner blocked), 429 (rate limited)
          and denied privileged-column writes (e.g. <code>granted_free_access</code>). Sourced from{" "}
          <code>public.auth_audit_log</code>; only the locked owner email can read this table.
        </p>

        <section className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Range</div>
            <div className="flex gap-1 mt-1">
              {RANGES.map((r) => (
                <button
                  key={r.label}
                  onClick={() => setHours(r.hours)}
                  className={`px-2 py-1 rounded text-xs font-bold ${
                    hours === r.hours ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Event</div>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value as EventFilter)}
              className="mt-1 w-full bg-background border border-border rounded px-2 py-1 text-sm"
            >
              {EVENT_FILTERS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Endpoint / path</div>
            <div className="relative mt-1">
              <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={pathQ}
                onChange={(e) => setPathQ(e.target.value)}
                placeholder="e.g. oracle-coder"
                className="w-full bg-background border border-border rounded pl-7 pr-2 py-1 text-sm"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">User / email / IP</div>
            <div className="relative mt-1">
              <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={userQ}
                onChange={(e) => setUserQ(e.target.value)}
                placeholder="email, user id or IP"
                className="w-full bg-background border border-border rounded pl-7 pr-2 py-1 text-sm"
              />
            </div>
          </div>
        </section>

        <section className="flex gap-2 flex-wrap text-xs">
          <span className="px-2 py-1 rounded-full bg-muted">total {filtered.length}</span>
          {Object.entries(counts).map(([k, v]) => (
            <span key={k} className="px-2 py-1 rounded-full bg-muted">
              {k}: <strong>{v}</strong>
            </span>
          ))}
        </section>

        <section className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No matching audit entries in this window.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[60vh]">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-2 py-1.5">When</th>
                    <th className="px-2 py-1.5">Event</th>
                    <th className="px-2 py-1.5">Reason</th>
                    <th className="px-2 py-1.5">Path</th>
                    <th className="px-2 py-1.5">User</th>
                    <th className="px-2 py-1.5">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-t border-border/60 hover:bg-muted/30 align-top">
                      <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="px-2 py-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            r.event_type === "forbidden"
                              ? "bg-red-500/20 text-red-300"
                              : r.event_type === "rate_limited"
                                ? "bg-amber-500/20 text-amber-300"
                                : r.event_type === "denied_free_access"
                                  ? "bg-fuchsia-500/20 text-fuchsia-300"
                                  : "bg-blue-500/20 text-blue-300"
                          }`}
                        >
                          {r.event_type}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-foreground/90">{r.reason ?? "—"}</td>
                      <td className="px-2 py-1.5 font-mono text-foreground/80">{r.path ?? "—"}</td>
                      <td className="px-2 py-1.5 text-foreground/80">
                        <div>{r.email ?? <span className="text-muted-foreground">anon</span>}</div>
                        {r.user_id && (
                          <div className="text-[10px] font-mono text-muted-foreground">
                            {r.user_id.slice(0, 8)}…
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-muted-foreground">{r.ip ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
