import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, statusTone } from "./racingData";

export function Panel({ title, children, className, right }: { title?: ReactNode; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card/80 p-4 shadow-[0_0_30px_-12px_hsl(var(--primary)/0.35)]", className)}>
      {(title || right) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-sm font-semibold tracking-wide text-primary uppercase">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatusBadge({ status }: { status?: string | null }) {
  const tone = statusTone(status);
  const color = tone === "ok" ? "hsl(var(--racing-ok))" : tone === "bad" ? "hsl(var(--racing-bad))" : tone === "wait" ? "hsl(var(--racing-wait))" : "hsl(var(--muted-foreground))";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2 py-0.5 text-[11px] text-foreground">
      <span className={cn("h-2 w-2 rounded-full", status === "running" && "racing-pulse")} style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      {status ? STATUS_LABEL[status] ?? status : "Not run yet"}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-border bg-background/40 p-4 text-sm text-muted-foreground">{children}</p>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/50 p-3">
      <p className="text-2xl font-bold text-primary">{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

/** Labels that keep verified facts, estimates, AI views and missing data apart. */
export function Evidence({ kind }: { kind: "verified" | "estimated" | "ai" | "unavailable" }) {
  const text = { verified: "Verified", estimated: "Estimated", ai: "AI interpretation", unavailable: "Unavailable" }[kind];
  return <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{text}</span>;
}

export function Table({ head, rows, empty }: { head: string[]; rows: ReactNode[][]; empty: ReactNode }) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead className="bg-background/70 text-muted-foreground">
          <tr>{head.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border/60">
              {r.map((c, j) => <td key={j} className="px-3 py-2 align-top text-foreground">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
