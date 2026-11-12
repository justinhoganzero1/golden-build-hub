import { forwardRef, type KeyboardEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { Loader2, Search, ZoomIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type DrillColumn = { key: string; label: string; type?: "text" | "date" | "money" };
export type DrillData = {
  title?: string;
  note?: string | null;
  columns: DrillColumn[];
  rows: Record<string, unknown>[];
  total?: number;
};

interface DrillProps {
  /** Server metric for admin-drilldown. Omit when passing `local`. */
  metric?: string;
  params?: Record<string, unknown>;
  /** Details already on screen (no server call). */
  local?: DrillData;
  title: string;
  className?: string;
  children: ReactNode;
}

const fmtCell = (v: unknown, type: DrillColumn["type"], row: Record<string, unknown>) => {
  if (v === null || v === undefined || v === "") return "—";
  if (type === "date") {
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }
  if (type === "money") {
    const cur = typeof row.currency === "string" ? row.currency.toUpperCase() : "";
    const n = Number(v) / 100;
    const s = `$${n.toFixed(2)}`;
    return cur && cur !== "USD" ? `${s} ${cur}` : s;
  }
  return String(v);
};

/**
 * Wraps any dashboard figure so tapping it opens every available detail behind it.
 * Owner-only data comes from the admin-drilldown function.
 */
export const Drill = forwardRef<HTMLDivElement, DrillProps>(function Drill({ metric, params, local, title, className, children }, ref) {
  const [open, setOpen] = useState(false);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); }
  };
  return (
    <>
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        aria-label={`Show details: ${title}`}
        title="Tap for details"
        onClick={() => setOpen(true)}
        onKeyDown={onKey}
        className={cn(
          "relative cursor-pointer transition hover:ring-2 hover:ring-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98]",
          className,
        )}
      >
        {children}
        <ZoomIn aria-hidden className="pointer-events-none absolute right-1.5 top-1.5 h-3 w-3 text-primary/70" />
      </div>
      {open && (
        <DrillDialog metric={metric} params={params} local={local} title={title} onClose={() => setOpen(false)} />
      )}
    </>
  );
});

function DrillDialog({ metric, params, local, title, onClose }: Omit<DrillProps, "children" | "className"> & { onClose: () => void }) {
  const [data, setData] = useState<DrillData | null>(local ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!local);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(200);
  const paramsKey = JSON.stringify(params ?? {});

  useEffect(() => {
    if (local || !metric) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: res, error: err } = await supabase.functions.invoke("admin-drilldown", {
          body: { metric, ...(params ?? {}) },
        });
        if (err) throw err;
        if ((res as any)?.error) throw new Error((res as any).error);
        if (!cancelled) setData(res as DrillData);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load details");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric, paramsKey, local]);

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return data.rows;
    return data.rows.filter((r) => data.columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(needle)));
  }, [data, q]);
  const visible = rows.slice(0, limit);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[88vh] w-[96vw] max-w-4xl overflow-hidden p-0">
        <div className="flex max-h-[88vh] flex-col">
          <DialogHeader className="space-y-1 border-b border-border p-4">
            <DialogTitle className="pr-6 text-base">{data?.title || title}</DialogTitle>
            <DialogDescription className="text-xs">
              {loading ? "Loading details…" : data
                ? `${rows.length.toLocaleString()} of ${(data.total ?? data.rows.length).toLocaleString()} shown`
                : ""}
              {data?.note ? <span className="mt-1 block text-muted-foreground">{data.note}</span> : null}
            </DialogDescription>
            {data && data.rows.length > 5 && (
              <div className="relative pt-2">
                <Search className="absolute left-2.5 top-1/2 mt-1 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-8 pl-8 text-xs" />
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-3">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            )}
            {error && <p className="py-6 text-center text-sm text-destructive">{error}</p>}
            {!loading && !error && data && rows.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">Nothing to show here yet.</p>
            )}

            {!loading && !error && data && rows.length > 0 && (
              <>
                {/* Phones: one card per entry */}
                <ul className="space-y-2 md:hidden">
                  {visible.map((r, i) => (
                    <li key={i} className="rounded-xl border border-border bg-card/60 p-3">
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                        {data.columns.map((c) => (
                          <div key={c.key} className="contents">
                            <dt className="text-muted-foreground">{c.label}</dt>
                            <dd className="break-words text-foreground">{fmtCell(r[c.key], c.type, r)}</dd>
                          </div>
                        ))}
                      </dl>
                    </li>
                  ))}
                </ul>
                {/* Computers: table */}
                <div className="hidden md:block">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-background text-left text-muted-foreground">
                      <tr>
                        {data.columns.map((c) => (
                          <th key={c.key} className={cn("py-2 pr-3 font-medium", c.type === "money" && "text-right")}>{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((r, i) => (
                        <tr key={i} className="border-t border-border/60 align-top">
                          {data.columns.map((c) => (
                            <td key={c.key} className={cn("max-w-[18rem] break-words py-1.5 pr-3 text-foreground", c.type === "money" && "whitespace-nowrap text-right", c.type === "date" && "whitespace-nowrap")}>
                              {fmtCell(r[c.key], c.type, r)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > visible.length && (
                  <button
                    type="button"
                    onClick={() => setLimit((l) => l + 200)}
                    className="mt-3 w-full rounded-lg border border-border bg-card/60 py-2 text-xs font-semibold text-primary hover:bg-card"
                  >
                    Show more ({(rows.length - visible.length).toLocaleString()} left)
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default Drill;
