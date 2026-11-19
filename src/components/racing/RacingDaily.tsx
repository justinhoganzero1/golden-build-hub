// Oracle Racing — Daily Broadcast Intelligence Report (opening screen).
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, Bell, BellOff, FlaskConical, Tv, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Panel, Empty, Stat, Table } from "./RacingUi";
import { callController, useRacingTable, useRacingRefresh, formatInZone, countdown, ago } from "./racingData";
import { STATUS_TEXT, localDate, paradeTime, flatBetStats, effectiveMinOdds, type ReportStatus } from "../../../supabase/functions/_shared/racingSelection";

const money = (x: any) => (x == null || !Number.isFinite(Number(x)) ? "—" : `$${Number(x).toFixed(2)}`);
const pct = (x: any, d = 0) => (x == null || !Number.isFinite(Number(x)) ? "—" : `${(Number(x) * 100).toFixed(d)}%`);
const CHANNEL_STATUS: Record<string, string> = { confirmed_live: "Confirmed live", scheduled: "Scheduled", replay: "Replay", unconfirmed: "Unconfirmed" };
const STATUS_TONE: Record<ReportStatus, string> = {
  qualifying: "border-primary bg-primary/15 text-primary",
  in_progress: "border-accent bg-accent/15 text-accent-foreground",
  no_winners: "border-border bg-muted/40 text-foreground",
  data_unavailable: "border-destructive bg-destructive/15 text-destructive",
};

export function DailyReportScreen({ settings, tz }: { settings: any; tz: string }) {
  const refresh = useRacingRefresh();
  const today = localDate(tz);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const reports = useRacingTable<any>("daily-reports", () => supabase.from("racing_daily_reports").select("*").order("started_at", { ascending: false }).limit(20));
  const report = (reports.data ?? []).find((r: any) => r.report_date === today && r.status !== "in_progress") ?? (reports.data ?? []).find((r: any) => r.report_date === today);
  const decisions = useRacingTable("daily-decisions", () => supabase.from("racing_selection_decisions").select("*").eq("report_id", report?.id ?? "00000000-0000-0000-0000-000000000000").order("race_start_utc"), [report?.id]);
  const qualified = (decisions.data ?? []).filter((d: any) => d.decision === "qualified");
  const raceIds = [...new Set(qualified.map((d: any) => d.race_id))];
  const runnerIds = qualified.map((d: any) => d.runner_id);
  const races = useRacingTable("daily-races", () => supabase.from("racing_races").select("id,name,start_time_utc,parade_time_utc,meeting:racing_meetings(track_rating,racecourse:racing_racecourses(name,timezone))").in("id", raceIds.length ? raceIds : ["00000000-0000-0000-0000-000000000000"]), [raceIds.join()]);
  const runners = useRacingTable("daily-runners", () => supabase.from("racing_runners").select("id,barrier,jockey:racing_jockeys(name),trainer:racing_trainers(name)").in("id", runnerIds.length ? runnerIds : ["00000000-0000-0000-0000-000000000000"]), [runnerIds.join()]);
  const raceOf = (id: string) => (races.data ?? []).find((r: any) => r.id === id);
  const runnerOf = (id: string) => (runners.data ?? []).find((r: any) => r.id === id);
  const coverageOf = (venue: string) => (report?.coverage ?? []).find((c: any) => c.venue === venue && c.counts) ?? (report?.coverage ?? []).find((c: any) => c.venue === venue);

  const scan = async (auto = false) => {
    setBusy(true);
    try {
      const r = await callController({ action: "daily_scan" });
      if (r?.busy) toast.message("A scan is already running — showing the latest report.");
      else if (!auto) toast.success(r?.text ?? "Daily scan finished");
    } catch (e) { toast.error((e as Error).message.slice(0, 220)); } finally { setBusy(false); refresh(); }
  };

  // First open each day starts a fresh check (the server also refuses a second scan already running).
  const autoKey = `oracle-racing-auto-scan-${today}`;
  useEffect(() => {
    if (!reports.isSuccess || busy) return;
    const hasToday = (reports.data ?? []).some((r: any) => r.report_date === today);
    if (!hasToday && !sessionStorage.getItem(autoKey)) { sessionStorage.setItem(autoKey, "1"); scan(true); }
  }, [reports.isSuccess, reports.data, today]); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown tick, and price re-check at the chosen frequency while the screen is open.
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  const refreshMins = Number(settings?.odds_refresh_minutes ?? 15);
  useEffect(() => {
    if (!report || report.status !== "qualifying") return;
    const t = setInterval(async () => { try { await callController({ action: "recheck" }); refresh(); } catch { /* next interval retries */ } }, refreshMins * 60_000);
    return () => clearInterval(t);
  }, [report?.id, report?.status, refreshMins]); // eslint-disable-line react-hooks/exhaustive-deps

  const status = (busy && !report ? "in_progress" : report?.status ?? "in_progress") as ReportStatus;
  const live = qualified.filter((d: any) => !d.withdrawn_at).sort((a: any, b: any) => (a.race_start_utc < b.race_start_utc ? -1 : 1));
  const withdrawn = qualified.filter((d: any) => d.withdrawn_at);
  const next = live.find((d: any) => Date.parse(raceOf(d.race_id)?.start_time_utc ?? d.race_start_utc) > now);
  const lead = Number(settings?.parade_lead_minutes ?? 15);
  const minOdds = effectiveMinOdds(settings);

  const rejectedByRace = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const d of decisions.data ?? []) { const k = `${d.venue} R${d.race_number}`; m.set(k, [...(m.get(k) ?? []), d]); }
    return [...m.entries()];
  }, [decisions.data]);

  return (
    <div className="space-y-4">
      <Panel title={<span>ORACLE RACING · DAILY INTELLIGENCE REPORT</span>} right={
        <Button size="sm" disabled={busy} onClick={() => scan()}>{busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}REFRESH DAILY RACING</Button>}>
        <div className={`rounded-xl border-2 p-4 text-center text-lg font-black tracking-wide md:text-2xl ${STATUS_TONE[status]}`} role="status">
          {busy && status !== "in_progress" ? STATUS_TEXT.in_progress : STATUS_TEXT[status]}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          <Stat label="Date" value={formatInZone(`${today}T12:00:00Z`, "UTC", { dateStyle: "medium" })} />
          <Stat label="Broadcast coverage" value={(report?.coverage ?? []).filter((c: any) => c.counts).length} hint="live / scheduled meetings" />
          <Stat label="Meetings analysed" value={report?.meetings_analysed ?? "—"} />
          <Stat label="Races analysed" value={report?.races_analysed ?? "—"} />
          <Stat label="Qualifying races" value={report?.qualifying_races ?? "—"} />
          <Stat label="Qualifying selections" value={live.length} hint={withdrawn.length ? `${withdrawn.length} withdrawn` : undefined} />
          <Stat label="Skipped races" value={report?.skipped_races ?? "—"} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Minimum win price {money(minOdds)} · value above {pct(settings?.min_expected_value, 1)} · confidence {settings?.min_confidence ?? 60}+ ·
          report {report?.finished_at ? `finished ${ago(report.finished_at)}` : "not run yet"} · last successful data retrieval {report?.data_retrieved_at ? formatInZone(report.data_retrieved_at, tz) : "never"}
        </p>
        {(report?.problems ?? []).length > 0 && (
          <div className="mt-3 rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-sm">
            <p className="font-semibold text-destructive">What's missing</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">{report.problems.slice(0, 12).map((p: string) => <li key={p}>{p}</li>)}</ul>
          </div>
        )}
        {status === "no_winners" && (
          <div className="mt-3 rounded-xl border border-border bg-background/60 p-4 text-sm">
            <p className="font-bold">NO AVAILABLE MATCHING WINNERS TODAY.</p>
            <p className="mt-1">Oracle has analysed today's eligible broadcast races but has not identified a selection that meets its minimum odds and statistical value requirements.</p>
            <p className="mt-1 font-semibold">No bets recommended today.</p>
            <p className="mt-1 text-xs text-muted-foreground">This is intentional. The integrity of the selection system is more important than producing daily bets.</p>
          </div>
        )}
        {status === "qualifying" && !live.length && (
          <p className="mt-3 rounded-xl border border-border bg-background/60 p-3 text-sm">All of today's selections have since been withdrawn. No bets recommended right now.</p>
        )}
      </Panel>

      {next && (() => {
        const race = raceOf(next.race_id); const start = race?.start_time_utc ?? next.race_start_utc;
        const p = paradeTime(start, race?.parade_time_utc, lead);
        return (
          <Panel title="Next qualifying race" className="border-primary">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-2xl font-black text-primary">{next.horse_name}</p>
                <p className="text-sm">{next.venue} R{next.race_number}{race?.name ? ` · ${race.name}` : ""}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div><p className="text-xs text-muted-foreground">Parade in {p.official ? "" : "(estimate)"}</p><p className="text-xl font-bold">{countdown(p.at, now)}</p></div>
                <div><p className="text-xs text-muted-foreground">Race in</p><p className="text-xl font-bold">{countdown(start, now)}</p></div>
              </div>
            </div>
          </Panel>
        );
      })()}

      {live.length > 0 && (
        <Panel title="Today's qualifying selections (in race order)">
          <div className="grid gap-3 md:grid-cols-2">
            {live.map((d: any) => {
              const race = raceOf(d.race_id); const ru = runnerOf(d.runner_id); const cov = coverageOf(d.venue);
              const start = race?.start_time_utc ?? d.race_start_utc; const venueTz = race?.meeting?.racecourse?.timezone || tz;
              const p = paradeTime(start, race?.parade_time_utc, lead);
              const row = (k: string, v: any) => <div className="flex justify-between gap-2 border-b border-border/50 py-1"><span className="text-muted-foreground">{k}</span><span className="text-right font-medium">{v}</span></div>;
              return (
                <div key={d.id} className="rounded-xl border border-border bg-background/50 p-3 text-sm">
                  <p className="text-lg font-bold text-primary">{d.horse_name}</p>
                  <p className="mb-2 text-xs text-muted-foreground">{d.venue} · Race {d.race_number}{race?.name ? ` · ${race.name}` : ""}</p>
                  {row("Race start", `${formatInZone(start, tz, { timeStyle: "short" })} (${formatInZone(start, venueTz, { timeStyle: "short" })} local)`)}
                  {row("Mounting yard parade", <span>{formatInZone(p.at, tz, { timeStyle: "short" })} <span className={p.official ? "text-primary" : "text-muted-foreground"}>· {p.official ? "Official" : `Estimate (${lead} min before)`}</span></span>)}
                  {row("Win price", <span>{money(d.odds_at_decision)} at {formatInZone(d.decided_at, tz, { timeStyle: "short" })}{d.latest_odds != null && Number(d.latest_odds) !== Number(d.odds_at_decision) ? ` · now ${money(d.latest_odds)}` : ""} <span className="text-muted-foreground">({d.odds_kind === "indicative" ? "indicative, not a secured price" : d.odds_kind})</span></span>)}
                  {row("Oracle win chance", pct(d.oracle_prob, 1))}
                  {row("Market chance (margin removed)", pct(d.market_prob, 1))}
                  {row("Expected value per $1", pct(d.expected_value, 1))}
                  {row("Confidence (not a win chance)", d.confidence != null ? Math.round(d.confidence) : "—")}
                  {row("Jockey", ru?.jockey?.name ?? "—")}
                  {row("Trainer", ru?.trainer?.name ?? "—")}
                  {row("Barrier", ru?.barrier ?? "—")}
                  {row("Track condition", race?.meeting?.track_rating ?? "Not officially rated")}
                  {row("Broadcast", cov ? `${cov.channel}${cov.platform ? ` / ${cov.platform}` : ""}` : "—")}
                  {row("Broadcast status", cov ? CHANNEL_STATUS[cov.status] ?? cov.status : "—")}
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {withdrawn.length > 0 && (
        <Panel title="Withdrawn since the report">
          <Table head={["Horse", "Race", "Price at selection", "Why withdrawn", "When"]} empty="" rows={withdrawn.map((d: any) => [d.horse_name, `${d.venue} R${d.race_number}`, money(d.odds_at_decision), d.withdrawn_reason, formatInZone(d.withdrawn_at, tz, { timeStyle: "short" })])} />
        </Panel>
      )}

      <Panel title={<span className="inline-flex items-center gap-2"><Tv className="h-4 w-4" />Broadcast coverage today</span>}>
        <Table head={["Venue", "Network", "Channel", "Streaming", "Coverage starts", "Races", "Status", "Counts?"]} empty="No broadcast schedule stored for today."
          rows={(report?.coverage ?? []).map((c: any) => [c.venue, c.network, c.channel, c.platform ?? "—", c.starts_at ? formatInZone(c.starts_at, tz, { timeStyle: "short" }) : "—",
            c.races?.length ? c.races.join(", ") : "All", <span key="s">{CHANNEL_STATUS[c.status] ?? c.status}{c.verified ? " · verified" : ""}</span>, c.counts ? "Yes" : "No (replay / unconfirmed)"])} />
      </Panel>

      <Panel title="Every horse checked today (permanent record)">
        {!rejectedByRace.length ? <Empty>No races analysed yet today.</Empty> : rejectedByRace.map(([race, list]) => (
          <details key={race} className="mb-2 rounded-lg border border-border bg-background/40 p-2 text-sm">
            <summary className="cursor-pointer font-semibold">{race} · {list.filter((d: any) => d.decision === "qualified").length} qualified of {list.length}</summary>
            <Table head={["Horse", "Price", "Oracle chance", "Value", "Decision", "Reason"]} empty="" rows={list.map((d: any) => [d.horse_name, money(d.odds_at_decision), pct(d.oracle_prob, 1), pct(d.expected_value, 1), d.decision === "qualified" ? "Qualified" : "Rejected", (d.reasons ?? []).join(" ") || "—"])} />
          </details>
        ))}
      </Panel>

      <NotificationsPanel settings={settings} tz={tz} />
      <BacktestPanel settings={settings} />

      <Panel title="Recent daily reports">
        <Table head={["Date", "Status", "Races", "Selections", "Started"]} empty="No reports yet." rows={(reports.data ?? []).map((r: any) => [r.report_date, STATUS_TEXT[r.status as ReportStatus], r.races_analysed, r.qualifying_selections, formatInZone(r.started_at, tz, { dateStyle: "short", timeStyle: "short" })])} />
      </Panel>
      <p className="text-center text-xs text-muted-foreground">Oracle Racing never places bets. Prices shown are indicative, not secured. Gamble responsibly — Gambling Help Online 1800 858 858.</p>
    </div>
  );
}

function NotificationsPanel({ settings, tz }: { settings: any; tz: string }) {
  const refresh = useRacingRefresh();
  const prefs = settings?.notification_prefs ?? {};
  const list = useRacingTable("racing-notifications", () => supabase.from("racing_notifications").select("*").order("created_at", { ascending: false }).limit(30));
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const rows = list.data ?? [];
    if (!list.isSuccess) return;
    if (seen.current == null) { seen.current = new Set(rows.map((r: any) => r.id)); return; }
    if (!prefs.browser || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    for (const r of rows) if (!seen.current.has(r.id)) { seen.current.add(r.id); try { new Notification(r.title, { body: r.body ?? undefined }); } catch { /* not supported */ } }
  }, [list.data, list.isSuccess, prefs.browser]);
  useEffect(() => { const t = setInterval(() => list.refetch(), 60_000); return () => clearInterval(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleBrowser = async () => {
    const on = !prefs.browser;
    if (on && typeof Notification !== "undefined" && Notification.permission !== "granted") {
      const p = await Notification.requestPermission();
      if (p !== "granted") { toast.error("This browser didn't allow notifications."); return; }
    }
    const { error } = await supabase.from("racing_settings").update({ notification_prefs: { ...prefs, browser: on }, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) toast.error(error.message); else { toast.success(on ? "Pop-up alerts on" : "Pop-up alerts off"); refresh(); }
  };
  const markRead = async () => { await supabase.from("racing_notifications").update({ read_at: new Date().toISOString() }).is("read_at", null); list.refetch(); };
  const unread = (list.data ?? []).filter((n: any) => !n.read_at).length;
  return (
    <Panel title={<span className="inline-flex items-center gap-2"><Bell className="h-4 w-4" />Racing alerts{unread ? ` (${unread} new)` : ""}</span>} right={
      <div className="flex gap-1">
        <Button size="sm" variant="outline" onClick={toggleBrowser}>{prefs.browser ? <BellOff className="mr-1 h-3.5 w-3.5" /> : <Bell className="mr-1 h-3.5 w-3.5" />}{prefs.browser ? "Pop-ups off" : "Pop-ups on"}</Button>
        {unread > 0 && <Button size="sm" variant="outline" onClick={markRead}>Mark read</Button>}
      </div>}>
      <p className="mb-2 text-xs text-muted-foreground">Choose which alerts you get under Settings. Pop-ups show while Oracle Racing is open in this browser.</p>
      <Table head={["When", "Alert", "Detail"]} empty="No alerts yet." rows={(list.data ?? []).map((n: any) => [formatInZone(n.created_at, tz, { dateStyle: "short", timeStyle: "short" }), <span key="t" className={n.read_at ? "" : "font-semibold text-primary"}>{n.title}</span>, n.body ?? ""])} />
    </Panel>
  );
}

function BacktestPanel({ settings }: { settings: any }) {
  const refresh = useRacingRefresh();
  const [busy, setBusy] = useState(false);
  const rows = useRacingTable("selection-stats", () => supabase.from("racing_selection_decisions").select("is_backtest,decided_at,odds_at_decision,finish_position,withdrawn_at,settled_at").eq("decision", "qualified").not("settled_at", "is", null).limit(20000));
  const analysed = useRacingTable("selection-analysed", () => supabase.from("racing_selection_decisions").select("race_id,is_backtest").limit(50000));
  const ded = Number(settings?.betting_deduction_pct ?? 0);
  const stats = (bt: boolean) => flatBetStats((rows.data ?? []).filter((d: any) => d.is_backtest === bt && !d.withdrawn_at && d.odds_at_decision != null).map((d: any) => ({ decided_at: d.decided_at, odds: Number(d.odds_at_decision), won: d.finish_position === 1 })), ded);
  const racesOf = (bt: boolean) => new Set((analysed.data ?? []).filter((d: any) => d.is_backtest === bt).map((d: any) => d.race_id)).size;
  const run = async () => {
    setBusy(true);
    try { const r = await callController({ action: "backtest_rules" }); if (r?.ok) toast.success(`Checked ${r.predictions} past race(s)`); else toast.message(r?.reason ?? "Nothing to back-test"); refresh(); }
    catch (e) { toast.error((e as Error).message.slice(0, 200)); } finally { setBusy(false); }
  };
  const block = (title: string, bt: boolean) => {
    const s = stats(bt);
    return (
      <div>
        <p className="mb-2 text-sm font-semibold">{title}</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
          <Stat label="Races analysed" value={racesOf(bt)} />
          <Stat label="Selections" value={s.selections} hint={`${s.winners} won · ${s.losers} lost`} />
          <Stat label="Strike rate" value={pct(s.strikeRate, 1)} />
          <Stat label="Average odds" value={money(s.averageOdds)} />
          <Stat label="Staked / returned" value={`${money(s.staked)} / ${money(s.returns)}`} />
          <Stat label="Net profit · ROI" value={`${money(s.netProfit)} · ${pct(s.roi, 1)}`} />
          <Stat label="Max drawdown" value={money(s.maxDrawdown)} />
        </div>
      </div>
    );
  };
  return (
    <Panel title="Selection results ($1 flat win bets)" right={<Button size="sm" variant="outline" disabled={busy} onClick={run}>{busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="mr-1 h-3.5 w-3.5" />}Back-test the rules on past races</Button>}>
      <div className="space-y-4">
        {block("Live selections (real days)", false)}
        {block("Back-test (races the model never trained on)", true)}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Uses the price Oracle saw at selection time{ded ? `, minus ${ded}% betting deductions on winnings` : ""}. Back-tests use stored pre-race prices; if those were starting prices the results look better than real life.
        Back-tests skip the confidence rule because it wasn't recorded for past races. Withdrawn selections are not counted.
      </p>
    </Panel>
  );
}
