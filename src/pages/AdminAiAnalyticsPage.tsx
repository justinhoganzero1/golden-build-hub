// Admin — AI search discovery analytics.
// Shows crawler hits per bot, human visits per answer engine, the search phrases that
// brought people in, and the signup / top-up conversions attributed to each engine.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Bot, Users, Coins, Search } from "lucide-react";
import SEO from "@/components/SEO";

interface Row {
  id: string;
  event_type: string;
  engine: string | null;
  bot: string | null;
  path: string | null;
  query_hint: string | null;
  amount_cents: number | null;
  created_at: string;
}

const WINDOWS = [
  { label: "24h", days: 1 },
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

export default function AdminAiAnalyticsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    const { data } = await supabase
      .from("ai_discovery_events")
      .select("id, event_type, engine, bot, path, query_hint, amount_cents, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [days]);

  const stats = useMemo(() => {
    const byEngine: Record<string, { visits: number; signups: number; topups: number; revenue: number }> = {};
    const byBot: Record<string, number> = {};
    const queries: Record<string, number> = {};
    for (const r of rows) {
      if (r.event_type === "crawler_hit") {
        byBot[r.bot ?? "unknown"] = (byBot[r.bot ?? "unknown"] ?? 0) + 1;
        continue;
      }
      const key = r.engine ?? "direct";
      const e = (byEngine[key] ??= { visits: 0, signups: 0, topups: 0, revenue: 0 });
      if (r.event_type === "visit") e.visits++;
      if (r.event_type === "signup") e.signups++;
      if (r.event_type === "topup") { e.topups++; e.revenue += r.amount_cents ?? 0; }
      if (r.query_hint) queries[r.query_hint] = (queries[r.query_hint] ?? 0) + 1;
    }
    return {
      byEngine: Object.entries(byEngine).sort((a, b) => b[1].visits - a[1].visits),
      byBot: Object.entries(byBot).sort((a, b) => b[1] - a[1]),
      queries: Object.entries(queries).sort((a, b) => b[1] - a[1]).slice(0, 25),
      totals: {
        crawls: rows.filter(r => r.event_type === "crawler_hit").length,
        visits: rows.filter(r => r.event_type === "visit").length,
        signups: rows.filter(r => r.event_type === "signup").length,
        topups: rows.filter(r => r.event_type === "topup").length,
      },
    };
  }, [rows]);

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <SEO title="AI Search Analytics — Oracle Lunar Admin" description="AI crawler and answer-engine traffic analytics." path="/admin/ai-analytics" />
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-xl font-bold">AI Search Analytics</h1>
          <div className="flex items-center gap-1">
            {WINDOWS.map(w => (
              <Button key={w.days} size="sm" variant={days === w.days ? "default" : "outline"}
                className="h-8 text-xs" onClick={() => setDays(w.days)}>{w.label}</Button>
            ))}
            <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Crawler hits", value: stats.totals.crawls, icon: Bot },
                { label: "Visits", value: stats.totals.visits, icon: Search },
                { label: "Signups", value: stats.totals.signups, icon: Users },
                { label: "Top-ups", value: stats.totals.topups, icon: Coins },
              ].map(s => (
                <Card key={s.label} className="p-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                    <s.icon className="w-3.5 h-3.5" /> {s.label}
                  </div>
                  <p className="text-2xl font-bold mt-1">{s.value}</p>
                </Card>
              ))}
            </div>

            <Card className="p-4">
              <h2 className="text-sm font-bold mb-2">By answer engine</h2>
              {stats.byEngine.length === 0 ? (
                <p className="text-xs text-muted-foreground">No visits recorded in this window yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr className="text-left"><th className="py-1">Engine</th><th>Visits</th><th>Signups</th><th>Top-ups</th><th>Revenue</th><th>Conv.</th></tr>
                    </thead>
                    <tbody>
                      {stats.byEngine.map(([engine, e]) => (
                        <tr key={engine} className="border-t border-border/40">
                          <td className="py-1.5 font-medium">{engine}</td>
                          <td>{e.visits}</td>
                          <td>{e.signups}</td>
                          <td>{e.topups}</td>
                          <td>${(e.revenue / 100).toFixed(2)}</td>
                          <td>{e.visits ? `${((e.signups / e.visits) * 100).toFixed(0)}%` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card className="p-4">
              <h2 className="text-sm font-bold mb-2">AI crawlers fetching us</h2>
              {stats.byBot.length === 0 ? (
                <p className="text-xs text-muted-foreground">No crawler hits recorded yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {stats.byBot.map(([bot, n]) => (
                    <Badge key={bot} variant="outline" className="text-[10px]">{bot} · {n}</Badge>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <h2 className="text-sm font-bold mb-2">Search phrases that brought people in</h2>
              {stats.queries.length === 0 ? (
                <p className="text-xs text-muted-foreground">No query terms passed through yet.</p>
              ) : (
                <ul className="space-y-1">
                  {stats.queries.map(([q, n]) => (
                    <li key={q} className="flex justify-between text-xs border-b border-border/30 py-1">
                      <span className="truncate mr-2">{q}</span><span className="text-muted-foreground">{n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
