import { useMemo, useState } from "react";
import { Loader2, Play, FileText, Upload, Download, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Panel, Empty, Stat, Evidence, Table } from "./RacingUi";
import { callController, useRacingTable, useRacingRefresh, formatInZone } from "./racingData";
import { parseCsv, templateCsv, raceKey, normaliseRaceRows } from "../../../supabase/functions/_shared/racingImport";
import { horseForm, peopleStats, runScore, trackGroup, type Perf } from "../../../supabase/functions/_shared/racingFeatures";

const pct = (x: number | null | undefined) => (x == null || !Number.isFinite(Number(x)) ? "—" : `${Math.round(Number(x) * 100)}%`);
const num = (x: number | null | undefined, d = 2) => (x == null || !Number.isFinite(Number(x)) ? "—" : Number(x).toFixed(d));
const PERF_SELECT = "horse_id,race_date,racecourse_id,distance_m,surface,track_rating,race_class,finish_position,field_size,margin_lengths,race_time_s,weight_kg,barrier,jockey_id,trainer_id,sectionals,verified,source_provider";
const toPerf = (p: any): Perf => ({ ...p, settled: p?.sectionals?.settled ?? null });

// ---------- Import ----------
export function DataImportPanel() {
  const refresh = useRacingRefresh();
  const [kind, setKind] = useState<"races" | "form">("races");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const download = () => {
    const blob = new Blob([templateCsv(kind)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = kind === "races" ? "oracle-racing-races-template.csv" : "oracle-racing-form-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const upload = async (file: File) => {
    setResult(null);
    try {
      const rows = parseCsv(await file.text());
      if (!rows.length) throw new Error("That file has no rows.");
      // Send whole races together, about 1,000 rows at a time.
      const batches: Array<Record<string, string>[]> = [];
      if (kind === "races") {
        const keyOf = new Map<Record<string, string>, string>();
        rows.forEach((r, i) => { const n = normaliseRaceRows([r]).rows[0]; keyOf.set(r, n ? raceKey(n) : `bad-${i}`); });
        let cur: Record<string, string>[] = [], lastKey = "";
        const sorted = [...rows].sort((a, b) => (keyOf.get(a)! < keyOf.get(b)! ? -1 : 1));
        for (const r of sorted) { const k = keyOf.get(r)!; if (cur.length >= 1000 && k !== lastKey) { batches.push(cur); cur = []; } cur.push(r); lastKey = k; }
        if (cur.length) batches.push(cur);
      } else for (let i = 0; i < rows.length; i += 1000) batches.push(rows.slice(i, i + 1000));
      const total: Record<string, number> = {}; const problems: string[] = [];
      for (let i = 0; i < batches.length; i++) {
        setBusy(`Saving part ${i + 1} of ${batches.length}…`);
        const r = await callController({ action: "import_data", kind, verified, rows: batches[i] });
        for (const k of ["rows", "races", "runners", "results", "performances", "duplicates", "coursesCreated"]) if (typeof r?.[k] === "number") total[k] = (total[k] ?? 0) + r[k];
        problems.push(...(r?.problems ?? []));
      }
      setResult({ ...total, problems });
      toast.success("Import finished");
      refresh();
    } catch (e) { toast.error((e as Error).message.slice(0, 220)); } finally { setBusy(null); }
  };
  return (
    <Panel title="Import race data">
      <p className="mb-3 text-xs text-muted-foreground">
        Upload a spreadsheet (CSV) of races, fields, results or past form, for example an export from a form service you pay for.
        Only import data you're allowed to use. Imported rows are labelled as yours. Nothing is made up.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={kind === "races" ? "default" : "outline"} onClick={() => setKind("races")}>Races, fields & results</Button>
        <Button size="sm" variant={kind === "form" ? "default" : "outline"} onClick={() => setKind("form")}>Past form lines</Button>
        <Button size="sm" variant="outline" onClick={download}><Download className="mr-1 h-3.5 w-3.5" />Template</Button>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
        This comes from an official or licensed source (marks it Verified)
      </label>
      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{busy ?? "Choose CSV file"}
        <input type="file" accept=".csv,text/csv" aria-label="Choose race data file" className="hidden" disabled={!!busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
      </label>
      {result && (
        <div className="mt-3 rounded-xl border border-border bg-background/50 p-3 text-sm">
          <p>Saved: {Object.entries(result).filter(([k]) => k !== "problems").map(([k, v]) => `${v} ${k.replace("coursesCreated", "new racecourses")}`).join(" · ")}</p>
          {result.problems?.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-destructive">{result.problems.slice(0, 10).map((p: string) => <li key={p}>{p}</li>)}</ul>}
        </div>
      )}
    </Panel>
  );
}

// ---------- Race engine findings ----------
export function RaceEnginePanel({ raceId, tz }: { raceId: string; tz: string }) {
  const refresh = useRacingRefresh();
  const [busy, setBusy] = useState<string | null>(null);
  const summary = useRacingTable("race-summary", () => supabase.from("racing_engine_assessments").select("assessment,created_at,evidence_cutoff").eq("race_id", raceId).eq("engine", "master_summary").order("created_at", { ascending: false }).limit(1), [raceId]);
  const latest = summary.data?.[0];
  const rows = useRacingTable("race-assess", () => supabase.from("racing_engine_assessments").select("engine,assessment,runner_id,runner:racing_runners(saddlecloth,horse:racing_horses(name))").eq("race_id", raceId).gte("created_at", latest?.created_at ?? "2100-01-01").not("runner_id", "is", null).limit(600), [raceId, latest?.created_at]);
  const report = useRacingTable("race-report", () => supabase.from("racing_engine_assessments").select("assessment,created_at").eq("race_id", raceId).eq("engine", "oracle_report").order("created_at", { ascending: false }).limit(1), [raceId]);
  const byRunner = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of rows.data ?? []) { const e = m.get(r.runner_id) ?? { name: `${(r as any).runner?.saddlecloth ?? "?"}. ${(r as any).runner?.horse?.name ?? "?"}`, cloth: (r as any).runner?.saddlecloth ?? 99 }; e[r.engine] = r.assessment; m.set(r.runner_id, e); }
    return [...m.values()].sort((a, b) => (b.master?.p_win ?? -1) - (a.master?.p_win ?? -1) || a.cloth - b.cloth);
  }, [rows.data]);
  const run = async (action: "analyse_race" | "race_report") => {
    setBusy(action);
    try {
      const r = await callController({ action, race_id: raceId });
      toast.success(action === "race_report" ? "Oracle wrote the report" : r?.prediction ? `Analysed — top pick ${r.prediction.top3?.[0] ?? "?"}` : r?.message ?? "Analysed");
      refresh();
    } catch (e) { toast.error((e as Error).message.slice(0, 220)); } finally { setBusy(null); }
  };
  const s = latest?.assessment as any;
  return (
    <>
      <Panel title="Engine findings" right={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => run("analyse_race")} disabled={!!busy}>{busy === "analyse_race" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}Analyse now</Button>
          <Button size="sm" variant="outline" onClick={() => run("race_report")} disabled={!!busy || !latest}>{busy === "race_report" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1 h-3.5 w-3.5" />}Oracle race report</Button>
        </div>}>
        {!latest ? <Empty>Not analysed yet. Press Analyse now, or wait for the race-day timetable.</Empty> : (
          <div className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">Evidence up to {formatInZone(latest.evidence_cutoff, tz)} · stage {s.stage} · {s.model ? `model ${s.model} (scenario ${s.scenario})` : "no tested model yet, so there's no finishing order"}</p>
            <div className="grid gap-2 md:grid-cols-3">
              <Stat label="Track" value={s.track} hint={s.trackSource} />
              <Stat label="Pace" value={s.pace?.pace ?? "unknown"} hint={s.pace?.known ? `${s.pace.leaders} likely leader(s) from ${s.pace.known} known running styles` : "Running styles need early-position data"} />
              <Stat label="Runners" value={s.field} />
            </div>
            {[...(s.missing ?? []), ...(s.conflicts ?? [])].length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-xs text-primary/90">{[...(s.missing ?? []), ...(s.conflicts ?? [])].map((x: string) => <li key={x}>{x}</li>)}</ul>
            )}
            <Table
              head={["Runner", "Win chance", "Top 3", "Starts", "Win %", "Recent form", "Distance", "Course", "Condition", "Jockey win %", "Trainer win %", "Style", "Paddock", "Training"]}
              empty="No runner findings."
              rows={byRunner.map((r) => [
                r.name, r.master ? pct(r.master.p_win) : "—", r.master ? pct(r.master.top3) : "—",
                r.historical?.starts ?? 0, pct(r.historical?.winPct), num(r.historical?.recentForm),
                r.historical?.distance?.starts ? `${r.historical.distance.wins}/${r.historical.distance.starts}` : "—",
                r.historical?.course?.starts ? `${r.historical.course.wins}/${r.historical.course.starts}` : "—",
                r.environment?.condition?.starts ? `${r.environment.condition.wins}/${r.environment.condition.starts}` : "—",
                pct(r.dynamics?.jockey?.winPct), pct(r.dynamics?.trainer?.winPct), r.dynamics?.style ?? "—",
                r.paddock_vision?.available ? num(r.paddock_vision.score) : "—", r.training_vision?.available ? num(r.training_vision.score) : "—",
              ])}
            />
            <p className="text-xs text-muted-foreground">Win chances only appear once a model has passed testing. Distance, course and condition show wins/starts. Paddock and training scores are AI views of footage, from 0 to 1.</p>
          </div>
        )}
      </Panel>
      {report.data?.[0] && (
        <Panel title="Oracle race report" right={<Evidence kind="ai" />}>
          <p className="mb-2 text-xs text-muted-foreground">Written {formatInZone(report.data[0].created_at, tz)} from the engines' saved findings only.</p>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{(report.data[0].assessment as any)?.text}</div>
        </Panel>
      )}
    </>
  );
}

// ---------- Horse insights ----------
export function HorseInsights({ horseId, tz }: { horseId: string; tz: string }) {
  const perfs = useRacingTable("horse-perfs-full", () => supabase.from("racing_performances").select(PERF_SELECT).eq("horse_id", horseId).order("race_date"), [horseId]);
  const preds = useRacingTable("horse-preds", () => supabase.from("racing_prediction_rankings").select("predicted_rank,p_win,p_top3,prediction:racing_predictions(stage,status,model_version,created_at,race_id),runner:racing_runners!inner(horse_id)").eq("runner.horse_id", horseId).limit(50), [horseId]);
  const obs = useRacingTable("horse-obs-long", () => supabase.from("racing_visual_observations").select("observed_at,available,objective_measures,ai_interpretation,confidence,video:racing_video_sources(kind)").eq("horse_id", horseId).order("observed_at"), [horseId]);
  const list = (perfs.data ?? []).map(toPerf);
  const today = new Date().toISOString().slice(0, 10);
  const form = horseForm(list, { date: "9999-12-31", track: "unknown" });
  const chart = list.filter((p) => runScore(p) != null).map((p) => ({ date: p.race_date, score: Math.round(runScore(p)! * 100), finish: p.finish_position }));
  const byCond = ["firm", "good", "soft", "heavy", "synthetic"].map((g) => { const ps = list.filter((p) => trackGroup(p.track_rating) === g); const w = ps.filter((p) => p.finish_position === 1).length; return [g, ps.length, ps.length ? `${w}/${ps.length}` : "—"]; }).filter((r) => r[1]);
  const bands = [[0, 1200, "Sprint (to 1200 m)"], [1201, 1600, "Mile (1201–1600 m)"], [1601, 2200, "Middle (1601–2200 m)"], [2201, 9999, "Staying (2201 m+)"]] as const;
  const byDist = bands.map(([a, b, label]) => { const ps = list.filter((p) => (p.distance_m ?? 0) >= a && (p.distance_m ?? 0) <= b); const w = ps.filter((p) => p.finish_position === 1).length; return [label, ps.length, ps.length ? `${w}/${ps.length}` : "—"]; }).filter((r) => r[1]);
  return (
    <>
      <Panel title="Form summary" right={<Evidence kind={list.length && list.every((p: any) => p.verified) ? "verified" : "imported"} />}>
        {!list.length ? <Empty>No past runs stored for this horse.</Empty> : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Stat label="Starts" value={form.starts} />
              <Stat label="Win %" value={pct(form.winPct)} />
              <Stat label="Place %" value={pct(form.placePct)} />
              <Stat label="Recent form" value={num(form.recentForm)} hint="1 = won, 0 = last; recent runs count more" />
              <Stat label="Trend" value={form.trend == null ? "—" : form.trend > 0.02 ? "Improving" : form.trend < -0.02 ? "Declining" : "Steady"} />
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer>
                <LineChart data={chart}>
                  <CartesianGrid strokeOpacity={0.15} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: any, _n, p: any) => [`${v} (finished ${p.payload.finish})`, "Run score"]} />
                  <ReferenceLine y={50} strokeOpacity={0.3} />
                  <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Table head={["Distance", "Runs", "Wins/runs"]} empty="—" rows={byDist as any} />
              <Table head={["Track condition", "Runs", "Wins/runs"]} empty="No track ratings stored." rows={byCond as any} />
            </div>
            <p className="text-xs text-muted-foreground">As at {formatInZone(today + "T00:00:00Z", tz, { dateStyle: "medium" })}. Run score 100 = won, 0 = last.</p>
          </div>
        )}
      </Panel>
      <Panel title="Footage history" right={<Evidence kind="ai" />}>
        <Table head={["Date", "Footage", "What Oracle saw", "Note", "Confidence"]} empty="No footage observations for this horse."
          rows={(obs.data ?? []).map((o: any) => {
            const m = o.objective_measures ?? {};
            const facts = Object.entries(m).filter(([k]) => !["source", "kind", "frames", "label", "learning_only"].includes(k)).map(([k, v]) => `${k}: ${v}`).join(", ");
            return [String(o.observed_at ?? "").slice(0, 10), `${o.video?.kind ?? "—"}${m.learning_only ? " (learning only)" : ""}`, facts || "—", o.ai_interpretation ?? "—", o.confidence != null ? pct(o.confidence) : "—"];
          })} />
      </Panel>
      <Panel title="Prediction records">
        <Table head={["When", "Stage", "Status", "Model", "Rank", "Win chance", "Top 3"]} empty="This horse hasn't been in a prediction yet."
          rows={(preds.data ?? []).map((p: any) => [formatInZone(p.prediction?.created_at, tz), p.prediction?.stage, p.prediction?.status, p.prediction?.model_version, p.predicted_rank, pct(p.p_win), pct(p.p_top3)])} />
      </Panel>
    </>
  );
}

// ---------- Jockey / trainer stats ----------
export function PeopleStatsPanel({ kind, id, name }: { kind: "jockey" | "trainer"; id: string; name: string }) {
  const perfs = useRacingTable(`${kind}-perfs`, () => supabase.from("racing_performances").select(PERF_SELECT).eq(kind === "jockey" ? "jockey_id" : "trainer_id", id).order("race_date", { ascending: false }).limit(2000), [id]);
  const courses = useRacingTable("courses-names", () => supabase.from("racing_racecourses").select("id,name"));
  const list = (perfs.data ?? []).map(toPerf);
  const s = peopleStats(list, { date: "9999-12-31", track: "unknown" });
  const recent = peopleStats(list, { date: new Date().toISOString().slice(0, 10), track: "unknown" });
  const name2 = new Map((courses.data ?? []).map((c: any) => [c.id, c.name]));
  const byCourse = [...list.reduce((m, p) => { const k = p.racecourse_id ?? "?"; const e = m.get(k) ?? { n: 0, w: 0 }; e.n++; if (p.finish_position === 1) e.w++; m.set(k, e); return m; }, new Map<string, { n: number; w: number }>())]
    .sort((a, b) => b[1].n - a[1].n).slice(0, 8).map(([k, v]) => [name2.get(k) ?? "Unknown course", v.n, `${v.w} (${pct(v.w / v.n)})`]);
  return (
    <Panel title={`${name} — ${kind}`} right={<Evidence kind={list.length && list.every((p: any) => p.verified) ? "verified" : "imported"} />}>
      {!list.length ? <Empty>No stored rides for this {kind}.</Empty> : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label={kind === "jockey" ? "Rides" : "Runners"} value={s.rides} />
            <Stat label="Win %" value={pct(s.winPct)} />
            <Stat label="Last 90 days" value={pct(recent.recentWinPct)} />
            <Stat label="Wins" value={s.wins} />
          </div>
          <Table head={["Racecourse", "Runs", "Wins"]} empty="—" rows={byCourse as any} />
          <p className="text-xs text-muted-foreground">Reputation isn't proof of future results. These are past records only.</p>
        </div>
      )}
    </Panel>
  );
}

// ---------- Laboratory ----------
export function LabScreen() {
  const refresh = useRacingRefresh();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<any>(null);
  const models = useRacingTable<any>("models", () => supabase.from("racing_model_versions").select("*").order("created_at", { ascending: false }).limit(40));
  const stored = useRacingTable("results-count", () => supabase.from("racing_results").select("race_id").limit(5000));
  const train = async () => {
    setBusy(true);
    try {
      const r = await callController({ action: "train_models" });
      setLast(r);
      if (!r?.ok) toast(r?.reason ?? "Not enough data to train yet."); else toast.success("Training and testing finished");
      refresh();
    } catch (e) { toast.error((e as Error).message.slice(0, 220)); } finally { setBusy(false); }
  };
  const trained = (models.data ?? []).filter((m: any) => m.trained_at);
  const latestBy = (sc: string) => trained.find((m: any) => m.scenario === sc);
  const label = { A: "Statistics only", B: "Statistics + paddock vision", C: "Statistics + training footage", D: "Full seven engines" } as Record<string, string>;
  const latestA = latestBy("A");
  const cal = (latestA?.test_metrics?.calibration ?? []) as any[];
  return (
    <div className="space-y-4">
      <Panel title="Train and test" right={<Button size="sm" onClick={train} disabled={busy}>{busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="mr-1 h-3.5 w-3.5" />}Train & test models</Button>}>
        <p className="text-sm text-muted-foreground">
          Oracle learns from the oldest 60% of stored past races, tunes its chances on the next 15%, and is tested on the newest 25%, which it has never seen.
          It only uses information dated before each race. A model is allowed to make live predictions only if it beats the betting market (and equal chances) on those unseen races, over at least 100 races.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">Past races with results stored: {stored.data?.length ?? "…"}</p>
        {last && !last.ok && <p className="mt-2 text-sm text-primary">{last.reason}</p>}
      </Panel>
      <Panel title="Does vision really help? (A/B/C/D)">
        <Table head={["Scenario", "Engines used", "Status", "Test races", "Winner right", "Top 3 right", "Log loss (lower = better)", "Market log loss", "Equal-chance log loss", "Why"]} empty=""
          rows={["A", "B", "C", "D"].map((sc) => {
            const m = latestBy(sc); const t = m?.test_metrics;
            return [sc, label[sc], m ? (m.status === "validated" ? "Passed" : "Not passed") : "Not trained", t?.test?.races ?? "—", pct(t?.test?.winner), pct(t?.test?.top3), num(t?.test?.logLoss, 3), t?.market ? num(t.market.logLoss, 3) : "—", num(t?.uniform?.logLoss, 3), t?.validation?.reason ?? (m ? "" : "Needs enough past races (and footage for B–D).")];
          })} />
        <p className="mt-2 text-xs text-muted-foreground">Original predictions are never changed after results. Every back-test prediction is saved and locked.</p>
      </Panel>
      {latestA && (
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="Calibration (scenario A)">
            <Table head={["Predicted chance", "Runners", "Average predicted", "Actually won"]} empty="—" rows={cal.map((b) => [`${Math.round(b.from * 100)}–${Math.round(b.to * 100)}%`, b.runners, pct(b.predicted), pct(b.actual)])} />
            <p className="mt-2 text-xs text-muted-foreground">Honest chances: the last two columns should be close.</p>
          </Panel>
          <Panel title="By country and race type (scenario A)">
            <Table head={["Group", "Races", "Winner right", "Top 3 right"]} empty="—"
              rows={[...Object.entries(latestA.test_metrics?.byCountry ?? {}), ...Object.entries(latestA.test_metrics?.byClass ?? {})].map(([k, v]: any) => [k, v.races, pct(v.winner), pct(v.top3)])} />
          </Panel>
        </div>
      )}
      <Panel title="Model versions">
        <Table head={["Version", "Status", "Method", "What it does", "Trained"]} empty="No models."
          rows={(models.data ?? []).map((m: any) => [m.id, m.status, m.method, m.description, m.trained_at ? String(m.trained_at).slice(0, 16).replace("T", " ") : "—"])} />
      </Panel>
    </div>
  );
}

// ---------- Accuracy ----------
export function AccuracyScreen() {
  const acc = useRacingTable("accuracy-full", () => supabase.from("racing_accuracy").select("id,scenario,winner_hit,top2_hit,top3_hit,exacta_hit,rank_correlation,brier_score,computed_at,prediction:racing_predictions(stage,model_version)").limit(5000));
  const groups = [
    { title: "Live race-day predictions", rows: (acc.data ?? []).filter((r: any) => r.prediction?.stage !== "backtest") },
    { title: "Back-tests on past races", rows: (acc.data ?? []).filter((r: any) => r.prediction?.stage === "backtest") },
  ];
  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const rows = g.rows;
        const p = (k: string) => (rows.length ? `${Math.round((rows.filter((r: any) => r[k]).length / rows.length) * 100)}%` : "—");
        const rc = rows.filter((r: any) => r.rank_correlation != null);
        return (
          <Panel key={g.title} title={g.title}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Stat label="Races scored" value={rows.length} />
              <Stat label="Winner right" value={p("winner_hit")} />
              <Stat label="Top three right" value={p("top3_hit")} />
              <Stat label="Exacta right" value={p("exacta_hit")} />
              <Stat label="Order match" value={rc.length ? (rc.reduce((a: number, r: any) => a + Number(r.rank_correlation), 0) / rc.length).toFixed(2) : "—"} hint="Rank correlation, 1 = perfect" />
            </div>
            {!rows.length && <div className="mt-3"><Empty>Nothing scored here yet.</Empty></div>}
          </Panel>
        );
      })}
      <p className="text-xs text-muted-foreground">For comparison: across 60,000+ Australian races, the betting favourite wins about 35% of the time.</p>
    </div>
  );
}
