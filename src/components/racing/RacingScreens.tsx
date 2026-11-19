import { useMemo, useState } from "react";
import { Loader2, Play, RefreshCw, KeyRound, Trash2, Eye, ScanEye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Panel, StatusBadge, Empty, Stat, Evidence, Table } from "./RacingUi";
import {
  ENGINE_INFO, callController, useControllerStatus, useRacingTable, useRacingRefresh, formatInZone, countdown, ago,
} from "./racingData";
import { ParadeClipUpload, analyseStoredClip, RACING_VIDEO_BUCKET } from "./ParadeClipUpload";
import { DataImportPanel, RaceEnginePanel, HorseInsights, PeopleStatsPanel } from "./RacingDeep";

const RACE_SELECT = "id,race_number,name,start_time_utc,distance_m,race_class,runners_count,status,data_completeness,suitability_score,suitability_reasons,has_paddock_video,has_training_video,selected,meeting:racing_meetings(track_rating,racecourse:racing_racecourses(id,name,country_code,timezone))";
const NO_PROVIDER = "No races yet. Oracle only shows real races from a licensed racing data provider — connect one under Data Providers.";

function useUpcomingRaces(selectedOnly = false) {
  return useRacingTable("races" + (selectedOnly ? "-selected" : ""), () => {
    let q = supabase.from("racing_races").select(RACE_SELECT).gte("start_time_utc", new Date(Date.now() - 2 * 3600_000).toISOString()).order("start_time_utc").limit(500);
    if (selectedOnly) q = q.eq("selected", true);
    return q;
  });
}

function useLatestPredictions() {
  return useRacingTable("predictions", () =>
    supabase.from("racing_predictions").select("id,race_id,stage,status,model_version,analytical_confidence,explanation,limitations,evidence_cutoff,locked_at,created_at,rankings:racing_prediction_rankings(predicted_rank,p_win,p_top2,p_top3,p_top4,runner:racing_runners(saddlecloth,horse:racing_horses(name)))").order("created_at", { ascending: false }).limit(200));
}

const courseOf = (r: any) => r?.meeting?.racecourse;

// ---------- 1. Dashboard ----------
export function DashboardScreen({ tz }: { tz: string }) {
  const status = useControllerStatus();
  const races = useUpcomingRaces();
  const preds = useLatestPredictions();
  const weather = useRacingTable("weather-latest", () =>
    supabase.from("racing_weather_observations").select("id,temperature_c,humidity_pct,wind_kph,rain_mm,observed_for,created_at,racecourse:racing_racecourses(name,country_code)").order("created_at", { ascending: false }).limit(40));
  const runs = status.data?.runs ?? {};
  const providers: any[] = status.data?.providers ?? [];
  const working = ENGINE_INFO.filter((e) => runs[e.id]?.status === "succeeded").length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Engines working" value={`${working}/8`} hint="Live status, not simulated" />
        <Stat label="Upcoming races" value={races.data?.length ?? "…"} />
        <Stat label="Connected sources" value={providers.filter((p) => ["connected", "ready"].includes(p.status)).length} hint={`of ${providers.length} providers`} />
        <Stat label="Saved predictions" value={preds.data?.length ?? "…"} />
      </div>
      <Panel title="Seven engines at a glance">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ENGINE_INFO.map((e) => (
            <div key={e.id} className="rounded-xl border border-border bg-background/50 p-3">
              <p className="text-xs text-muted-foreground">Engine {e.n}</p>
              <p className="text-sm font-semibold">{e.name}</p>
              <div className="mt-2"><StatusBadge status={runs[e.id]?.status} /></div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Racecourse weather now" right={<Evidence kind="estimated" />}>
        <p className="mb-2 text-xs text-muted-foreground">Forecast-model conditions from Open-Meteo, refreshed hourly. These are not official track ratings.</p>
        <Table
          head={["Racecourse", "Country", "Temp °C", "Humidity", "Wind km/h", "Rain last 24h", "As at"]}
          empty="No weather yet — run the Environmental engine in the Control Room."
          rows={(weather.data ?? []).map((w: any) => [w.racecourse?.name, w.racecourse?.country_code, w.temperature_c, `${w.humidity_pct}%`, w.wind_kph, `${w.rain_mm} mm`, formatInZone(w.observed_for, tz, { timeStyle: "short", dateStyle: "short" })])}
        />
      </Panel>
    </div>
  );
}

// ---------- 2. Calendar ----------
export function CalendarScreen({ tz }: { tz: string }) {
  const races = useUpcomingRaces();
  const byDay = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const r of races.data ?? []) {
      const d = formatInZone(r.start_time_utc, tz, { weekday: "long", day: "numeric", month: "long" });
      m.set(d, [...(m.get(d) ?? []), r]);
    }
    return [...m.entries()];
  }, [races.data, tz]);
  return (
    <Panel title="Worldwide racing calendar">
      {!byDay.length ? <Empty>{NO_PROVIDER}</Empty> : byDay.map(([day, list]) => (
        <div key={day} className="mb-4">
          <h3 className="mb-2 text-sm font-semibold text-primary">{day}</h3>
          <Table head={["Time", "Racecourse", "Country", "Race", "Distance", "Runners"]} empty="" rows={list.map((r) => [
            formatInZone(r.start_time_utc, tz, { timeStyle: "short" }), courseOf(r)?.name, courseOf(r)?.country_code, `R${r.race_number} ${r.name ?? ""}`, r.distance_m ? `${r.distance_m} m` : "—", r.runners_count ?? "—"])} />
        </div>
      ))}
    </Panel>
  );
}

// ---------- 3. Discovery ----------
export function DiscoveryScreen({ tz }: { tz: string }) {
  const status = useControllerStatus();
  const countries = useRacingTable("countries", () => supabase.from("racing_countries").select("code,name,data_notes").order("name"));
  const courses = useRacingTable("courses", () => supabase.from("racing_racecourses").select("id,name,country_code,region,timezone").order("country_code"));
  const run = status.data?.runs?.discovery;
  return (
    <div className="space-y-4">
      <Panel title="Discovery engine" right={<StatusBadge status={run?.status} />}>
        <p className="text-sm text-muted-foreground">{run?.detail?.reason ?? "Not run yet."}</p>
        <p className="mt-1 text-xs text-muted-foreground">Last run {ago(run?.started_at)} · times stored in UTC, shown in {tz}.</p>
      </Panel>
      <Panel title="Jurisdictions covered">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(countries.data ?? []).map((c: any) => (
            <div key={c.code} className="rounded-xl border border-border bg-background/50 p-3 text-sm">
              <p className="font-semibold">{c.name} <span className="text-muted-foreground">({c.code})</span></p>
              <p className="text-xs text-muted-foreground">{(courses.data ?? []).filter((r: any) => r.country_code === c.code).length} reference racecourses</p>
              {c.data_notes && <p className="mt-1 text-xs text-primary/80">{c.data_notes}</p>}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Data availability differs by country; Oracle never assumes one country has what another has.</p>
      </Panel>
    </div>
  );
}

// ---------- 4. Recommended races (main screen) ----------
export function RecommendedScreen({ tz, onOpenRace }: { tz: string; onOpenRace: (id: string) => void }) {
  const races = useUpcomingRaces(true);
  const preds = useLatestPredictions();
  const predByRace = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of preds.data ?? []) if (!m.has(p.race_id)) m.set(p.race_id, p);
    return m;
  }, [preds.data]);
  return (
    <Panel title="Recommended races">
      <p className="mb-3 text-xs text-muted-foreground">Ranked by how much reliable information exists. Analytical confidence is not the chance of a horse winning.</p>
      <Table
        head={["Racecourse", "Country", "Race", "Local start", "Countdown", "Runners", "Data", "Paddock video", "Training video", "Confidence", "Predicted 1st", "Top three", "Suitability", ""]}
        empty={NO_PROVIDER}
        rows={(races.data ?? []).map((r: any) => {
          const p = predByRace.get(r.id);
          const ranks = (p?.rankings ?? []).sort((a: any, b: any) => a.predicted_rank - b.predicted_rank);
          const names = ranks.map((x: any) => x.runner?.horse?.name);
          return [
            courseOf(r)?.name, courseOf(r)?.country_code, `R${r.race_number}`,
            formatInZone(r.start_time_utc, courseOf(r)?.timezone || tz, { timeStyle: "short" }), countdown(r.start_time_utc), r.runners_count ?? "—",
            r.data_completeness != null ? `${r.data_completeness}%` : "—", r.has_paddock_video ? "Yes" : "No", r.has_training_video ? "Yes" : "No",
            p?.status === "locked" && p.analytical_confidence != null ? `${Math.round(p.analytical_confidence)}%` : "Not predicted",
            names[0] ?? "—", names.length >= 3 ? names.slice(0, 3).join(", ") : "—", r.suitability_score ?? "—",
            <Button key="o" size="sm" variant="outline" onClick={() => onOpenRace(r.id)}>Open</Button>,
          ];
        })}
      />
    </Panel>
  );
}

// ---------- 5. Race analysis ----------
export function RaceAnalysisScreen({ tz, raceId, onPick }: { tz: string; raceId: string | null; onPick: (id: string) => void }) {
  const [past, setPast] = useState(false);
  const upcoming = useUpcomingRaces();
  const pastRaces = useRacingTable("races-past", () => supabase.from("racing_races").select(RACE_SELECT).lt("start_time_utc", new Date().toISOString()).order("start_time_utc", { ascending: false }).limit(300), [past]);
  const races = past ? pastRaces : upcoming;
  const race = [...(upcoming.data ?? []), ...(pastRaces.data ?? [])].find((r: any) => r.id === raceId);
  const runners = useRacingTable("runners", () => supabase.from("racing_runners").select("id,saddlecloth,barrier,weight_kg,scratched,odds,horse:racing_horses(id,name),jockey:racing_jockeys(name),trainer:racing_trainers(name)").eq("race_id", raceId ?? "00000000-0000-0000-0000-000000000000").order("saddlecloth"), [raceId]);
  const preds = useLatestPredictions();
  return (
    <div className="space-y-4">
      <Panel title="Choose a race" right={
        <div className="flex gap-1">
          <Button size="sm" variant={past ? "outline" : "default"} onClick={() => setPast(false)}>Upcoming</Button>
          <Button size="sm" variant={past ? "default" : "outline"} onClick={() => setPast(true)}>Past</Button>
        </div>}>
        {!(races.data ?? []).length ? <Empty>{past ? "No past races stored. Import results under Data Providers." : NO_PROVIDER}</Empty> : (
          <select className="w-full rounded-lg border border-border bg-background p-2 text-sm" value={raceId ?? ""} onChange={(e) => onPick(e.target.value)}>
            <option value="">Select a race…</option>
            {(races.data ?? []).map((r: any) => <option key={r.id} value={r.id}>{formatInZone(r.start_time_utc, tz, { dateStyle: "short", timeStyle: "short" })} · {courseOf(r)?.name} R{r.race_number}{r.name ? ` · ${r.name}` : ""}</option>)}
          </select>
        )}
      </Panel>
      {race && (
        <>
          <Panel title={`${courseOf(race)?.name} — Race ${race.race_number}${race.name ? ` · ${race.name}` : ""}`} right={<span className="text-xs text-muted-foreground">Suitability {race.suitability_score ?? "—"}</span>}>
            <p className="mb-2 text-xs text-muted-foreground">{formatInZone(race.start_time_utc, courseOf(race)?.timezone || tz)} local · {race.distance_m ? `${race.distance_m} m` : "distance unknown"} · {race.race_class ?? "class unknown"} · track {race.meeting?.track_rating ?? "not rated"}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {((race.suitability_reasons as string[] | null) ?? []).map((x: string, i: number) => <li key={i}>{x}</li>)}
            </ul>
          </Panel>
          <Panel title="Runners">
            <Table head={["No.", "Horse", "Barrier", "Weight", "Jockey", "Trainer", "Price", "Status"]} empty="No field received yet." rows={(runners.data ?? []).map((u: any) => [u.saddlecloth, u.horse?.name, u.barrier ?? "—", u.weight_kg ? `${u.weight_kg} kg` : "—", u.jockey?.name ?? "—", u.trainer?.name ?? "—", u.odds?.pre_race_win ? `$${u.odds.pre_race_win}` : "—", u.scratched ? "Scratched" : "Running"])} />
          </Panel>
          <RaceEnginePanel raceId={race.id} tz={tz} />
          <ParadeClipUpload races={[]} fixedRaceId={race.id} tz={tz} />
          <Panel title="Prediction history (permanent)">
            {!(preds.data ?? []).filter((p: any) => p.race_id === race.id).length ? <Empty>No predictions recorded for this race.</Empty> : (preds.data ?? []).filter((p: any) => p.race_id === race.id).map((p: any) => (
              <div key={p.id} className="mb-3 rounded-xl border border-border bg-background/50 p-3 text-sm">
                <p className="font-semibold">{p.stage} · {p.status} · {p.model_version}{p.analytical_confidence != null ? ` · analytical confidence ${Math.round(p.analytical_confidence)}%` : ""}</p>
                <p className="text-xs text-muted-foreground">Evidence up to {formatInZone(p.evidence_cutoff, tz)}</p>
                {p.explanation && <p className="mt-1 text-xs">{p.explanation}</p>}
                {(p.rankings ?? []).length > 0 && (
                  <ol className="mt-2 list-decimal pl-5 text-xs">
                    {[...p.rankings].sort((a: any, b: any) => a.predicted_rank - b.predicted_rank).slice(0, 8).map((x: any) => (
                      <li key={x.predicted_rank}>{x.runner?.horse?.name}{x.p_win != null && ` — win ${Math.round(x.p_win * 100)}%`}{x.p_top3 != null && `, top 3 ${Math.round(x.p_top3 * 100)}%`}{x.p_top4 != null && `, top 4 ${Math.round(x.p_top4 * 100)}%`}</li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </Panel>
        </>
      )}
    </div>
  );
}

// ---------- 6. Horses ----------
export function HorsesScreen({ tz = "Australia/Brisbane" }: { tz?: string }) {
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<string | null>(null);
  const horses = useRacingTable("horses", () => supabase.from("racing_horses").select("id,name,country_code,foaled,sex,sire,dam,dam_sire,breeder").ilike("name", `%${q}%`).order("name").limit(100), [q]);
  const perfs = useRacingTable("perfs", () => supabase.from("racing_performances").select("id,race_date,distance_m,surface,track_rating,finish_position,field_size,margin_lengths,race_time_s,verified,racecourse:racing_racecourses(name)").eq("horse_id", pick ?? "00000000-0000-0000-0000-000000000000").order("race_date", { ascending: false }).limit(60), [pick]);
  const obs = useRacingTable("obs", () => supabase.from("racing_visual_observations").select("id,observed_at,available,ai_interpretation,confidence").eq("horse_id", pick ?? "00000000-0000-0000-0000-000000000000").order("observed_at", { ascending: false }), [pick]);
  const horse = (horses.data ?? []).find((h: any) => h.id === pick);
  return (
    <div className="space-y-4">
      <Panel title="Horse intelligence profiles">
        <Input placeholder="Search horses by name" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="mt-3 flex flex-wrap gap-2">
          {(horses.data ?? []).map((h: any) => <Button key={h.id} size="sm" variant={pick === h.id ? "default" : "outline"} onClick={() => setPick(h.id)}>{h.name}</Button>)}
        </div>
        {!(horses.data ?? []).length && <div className="mt-3"><Empty>No horses stored yet. Profiles fill in from the racing data provider.</Empty></div>}
      </Panel>
      {horse && (
        <>
          <Panel title={horse.name}>
            <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
              <p>Foaled: {horse.foaled ?? "—"}</p><p>Sex: {horse.sex ?? "—"}</p><p>Sire: {horse.sire ?? "—"}</p><p>Dam: {horse.dam ?? "—"}</p>
              <p>Dam sire: {horse.dam_sire ?? "—"}</p><p>Breeder: {horse.breeder ?? "—"}</p><p>Country: {horse.country_code ?? "—"}</p>
            </div>
          </Panel>
          <HorseInsights horseId={horse.id} tz={tz} />
          <Panel title="Past performances">
            <Table head={["Date", "Course", "Distance", "Surface", "Track", "Finish", "Margin", "Time", "Source"]} empty="No past runs stored." rows={(perfs.data ?? []).map((p: any) => [p.race_date, p.racecourse?.name ?? "—", p.distance_m ? `${p.distance_m} m` : "—", p.surface ?? "—", p.track_rating ?? "—", p.finish_position ? `${p.finish_position}/${p.field_size ?? "?"}` : "—", p.margin_lengths ?? "—", p.race_time_s ?? "—", <Evidence key="e" kind={p.verified ? "verified" : "imported"} />])} />
          </Panel>
          <Panel title="Parade-ring and training observations">
            <Table head={["When", "Available", "Observation", "Confidence"]} empty="No footage observations. Shown as unavailable, never guessed." rows={(obs.data ?? []).map((o: any) => [o.observed_at ?? "—", o.available ? "Yes" : "No", <span key="i">{o.ai_interpretation ?? "—"} <Evidence kind="ai" /></span>, o.confidence ?? "—"])} />
          </Panel>
        </>
      )}
    </div>
  );
}

// ---------- 7. Jockeys and trainers ----------
export function PeopleScreen() {
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<{ kind: "jockey" | "trainer"; id: string; name: string } | null>(null);
  const jockeys = useRacingTable("jockeys", () => supabase.from("racing_jockeys").select("id,name,country_code").ilike("name", `%${q}%`).order("name").limit(300), [q]);
  const trainers = useRacingTable("trainers", () => supabase.from("racing_trainers").select("id,name,country_code").ilike("name", `%${q}%`).order("name").limit(300), [q]);
  const pickBtn = (kind: "jockey" | "trainer", r: any) => <button key={r.id} className="text-left text-primary underline-offset-2 hover:underline" onClick={() => setPick({ kind, id: r.id, name: r.name })}>{r.name}</button>;
  return (
    <div className="space-y-4">
      <Input placeholder="Search jockeys and trainers" value={q} onChange={(e) => setQ(e.target.value)} />
      {pick && <PeopleStatsPanel kind={pick.kind} id={pick.id} name={pick.name} />}
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Jockeys"><Table head={["Name", "Country"]} empty="No jockeys stored yet." rows={(jockeys.data ?? []).map((j: any) => [pickBtn("jockey", j), j.country_code ?? "—"])} /></Panel>
        <Panel title="Trainers"><Table head={["Name", "Country"]} empty="No trainers stored yet." rows={(trainers.data ?? []).map((t: any) => [pickBtn("trainer", t), t.country_code ?? "—"])} /></Panel>
      </div>
    </div>
  );
}

// ---------- 8-10. Vision screens ----------
async function signedClipUrl(path: string) {
  const { data, error } = await supabase.storage.from(RACING_VIDEO_BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "Couldn't open the clip.");
  return data.signedUrl;
}

export function VisionScreen({ engine, kinds, title, rules, tz = "Australia/Brisbane" }: { engine: string; kinds: string[]; title: string; rules: string[]; tz?: string }) {
  const status = useControllerStatus();
  const refresh = useRacingRefresh();
  const run = status.data?.runs?.[engine];
  const paddock = engine === "paddock_vision";
  const races = useUpcomingRaces();
  const [busy, setBusy] = useState<string | null>(null);
  const videos = useRacingTable("videos-" + engine, () => supabase.from("racing_video_sources").select("id,kind,source_url,storage_path,recorded_at,quality,identification_confidence,licence_note,horse:racing_horses(name)").in("kind", kinds).order("recorded_at", { ascending: false }).limit(100));
  const ids = (videos.data ?? []).map((v: any) => v.id);
  const obs = useRacingTable("clip-obs-" + engine, () => supabase.from("racing_visual_observations").select("id,video_id,observed_at,available,objective_measures,ai_interpretation,confidence").in("video_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]).order("observed_at", { ascending: false }).limit(200), [ids.join(",")]);
  const analysed = new Set((obs.data ?? []).map((o: any) => o.video_id));
  const watch = async (path: string) => {
    try { window.open(await signedClipUrl(path), "_blank", "noopener"); } catch (e) { toast.error((e as Error).message); }
  };
  const analyse = async (v: any) => {
    setBusy(v.id);
    try {
      const r = await analyseStoredClip(v.id, await signedClipUrl(v.storage_path));
      toast.success(r?.horses ? `Read ${r.horses} horse(s) · clip quality ${r?.quality ?? "unclear"}` : "Oracle couldn't see a horse clearly in that clip.");
      refresh();
    } catch (e) { toast.error((e as Error).message.slice(0, 200)); } finally { setBusy(null); }
  };
  return (
    <div className="space-y-4">
      <Panel title={title} right={<StatusBadge status={run?.status} />}>
        <p className="text-sm text-muted-foreground">{run?.detail?.reason ?? "Not run yet."}</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">{rules.map((r) => <li key={r}>{r}</li>)}</ul>
      </Panel>
      <ParadeClipUpload key={engine} races={races.data ?? []} tz={tz} defaultKind={paddock ? "paddock" : engine === "race_vision" ? "race" : "training"} />
      <Panel title="Authorised footage">
        <Table head={["Horse", "Type", "Recorded", "Quality", "ID confidence", "Licence", ""]} empty="No authorised footage connected." rows={(videos.data ?? []).map((v: any) => [
          v.horse?.name ?? "Unidentified", v.kind, v.recorded_at ? formatInZone(v.recorded_at, tz, { dateStyle: "short", timeStyle: "short" }) : "—", v.quality ?? "—",
          v.identification_confidence ?? "—", v.licence_note ?? "—",
          v.storage_path ? (
            <div key="a" className="flex flex-wrap gap-1">
              <Button size="sm" variant="outline" onClick={() => watch(v.storage_path)}><Eye className="mr-1 h-3.5 w-3.5" />Watch</Button>
              {!analysed.has(v.id) && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => analyse(v)}>{busy === v.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ScanEye className="mr-1 h-3.5 w-3.5" />}Analyse</Button>}
            </div>
          ) : "—",
        ])} />
      </Panel>
      {(obs.data ?? []).length > 0 && (
        <Panel title="What Oracle saw" right={<Evidence kind="ai" />}>
          <Table head={["Horse", "What Oracle saw", "Note", "Confidence"]} empty="" rows={(obs.data ?? []).map((o: any) => {
            const m = o.objective_measures ?? {};
            const facts = Object.entries(m).filter(([k]) => !["source", "kind", "frames", "label", "learning_only"].includes(k)).map(([k, v]) => `${k}: ${v}`).join(" · ");
            return [m.label || "—", facts || "—", o.ai_interpretation ?? "—", o.confidence != null ? `${Math.round(Number(o.confidence) * 100)}%` : "—"];
          })} />
          <p className="mt-2 text-xs text-muted-foreground">These are AI descriptions of still pictures. They don't change finishing orders until tested against past results.</p>
        </Panel>
      )}
    </div>
  );
}

// ---------- 11. Predicted finishing orders ----------
export function PredictionsScreen({ tz }: { tz: string }) {
  const preds = useLatestPredictions();
  return (
    <Panel title="Predicted finishing orders">
      <p className="mb-3 text-xs text-muted-foreground">Every prediction keeps its timestamp, model version and evidence cut-off. Locked predictions can never be edited.</p>
      {!(preds.data ?? []).length ? <Empty>No predictions yet. Oracle refuses to publish finishing orders without tested data.</Empty> : (preds.data ?? []).map((p: any) => (
        <div key={p.id} className="mb-3 rounded-xl border border-border bg-background/50 p-3 text-sm">
          <p className="font-semibold">{p.stage} · {p.status} · {p.model_version}</p>
          <p className="text-xs text-muted-foreground">Recorded {formatInZone(p.created_at, tz)} · evidence up to {formatInZone(p.evidence_cutoff, tz)}</p>
          {p.explanation && <p className="mt-1">{p.explanation}</p>}
          {p.limitations && <p className="mt-1 text-xs text-muted-foreground">{p.limitations}</p>}
          {(p.rankings ?? []).length > 0 && (
            <ol className="mt-2 list-decimal pl-5">
              {[...p.rankings].sort((a: any, b: any) => a.predicted_rank - b.predicted_rank).map((x: any) => (
                <li key={x.predicted_rank}>{x.runner?.horse?.name}{x.p_win != null && ` — win ${Math.round(x.p_win * 100)}%`}{x.p_top3 != null && `, top 3 ${Math.round(x.p_top3 * 100)}%`}</li>
              ))}
            </ol>
          )}
        </div>
      ))}
    </Panel>
  );
}

// ---------- 12-13. Laboratory and accuracy live in RacingDeep ----------
export { LabScreen, AccuracyScreen } from "./RacingDeep";

// ---------- 14. Control room ----------
export function ControlRoomScreen() {
  const status = useControllerStatus();
  const refresh = useRacingRefresh();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (engine?: string) => {
    setBusy(engine ?? "all");
    try {
      const r = await callController({ action: "run", ...(engine ? { engine } : {}) });
      if (r?.busy) toast("The controller is already running — try again in a minute.");
      else toast.success(engine ? "Engine run finished" : "All engines ran");
      refresh();
    } catch (e) {
      toast.error((e as Error).message.slice(0, 200));
    } finally { setBusy(null); }
  };
  const runs = status.data?.runs ?? {};
  return (
    <Panel title="Seven-engine control room" right={
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => status.refetch()}><RefreshCw className="mr-1 h-3.5 w-3.5" />Refresh</Button>
        <Button size="sm" onClick={() => run()} disabled={!!busy}>{busy === "all" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}Run all engines</Button>
      </div>}>
      {status.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : status.error ? <Empty>Could not reach the controller: {(status.error as Error).message}</Empty> : (
        <div className="grid gap-3 md:grid-cols-2">
          {ENGINE_INFO.map((e) => {
            const r = runs[e.id];
            return (
              <div key={e.id} className={`rounded-xl border bg-background/50 p-3 ${e.id === "master" ? "border-primary md:col-span-2" : "border-border"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Engine {e.n}</p>
                    <p className="font-semibold">{e.name}</p>
                    <p className="text-xs text-muted-foreground">{e.job}</p>
                  </div>
                  <StatusBadge status={r?.status} />
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${r?.progress ?? 0}%` }} /></div>
                <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  <p>Task: {r?.task ?? "—"} · last update {ago(r?.finished_at ?? r?.started_at)} · {r?.trigger === "schedule" ? "automatic" : r ? "manual" : ""}</p>
                  {r?.detail?.reason && <p>{r.detail.reason}</p>}
                  {r?.detail?.racecourses != null && <p>Racecourses updated: {r.detail.racecourses}</p>}
                  {r?.error && <p className="text-destructive">Error: {r.error}</p>}
                </div>
                <Button className="mt-2" size="sm" variant="outline" disabled={!!busy} onClick={() => run(e.id)}>
                  {busy === e.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}Run
                </Button>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Runs automatically every hour. Statuses are read from real runs — nothing here is simulated.</p>
    </Panel>
  );
}

// ---------- 15. Providers ----------
export function ProvidersScreen({ tz }: { tz: string }) {
  const status = useControllerStatus();
  const refresh = useRacingRefresh();
  const [editing, setEditing] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const save = async (id: string, clear = false) => {
    setSaving(true);
    try {
      await callController(clear ? { action: "clear_credentials", provider_id: id } : { action: "save_credentials", provider_id: id, values });
      toast.success(clear ? "Keys removed" : "Keys saved securely");
      setEditing(null); setValues({}); refresh();
    } catch (e) { toast.error((e as Error).message.slice(0, 200)); } finally { setSaving(false); }
  };
  return (
    <div className="space-y-4">
    <DataImportPanel />
    <Panel title="API and data providers">
      <p className="mb-3 text-xs text-muted-foreground">Keys are stored on the server only and never shown again. Oracle never invents a working connection — unconnected sources stay "Awaiting configuration".</p>
      <div className="space-y-3">
        {(status.data?.providers ?? []).map((p: any) => (
          <div key={p.id} className="rounded-xl border border-border bg-background/50 p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{p.name} <span className="text-xs text-muted-foreground">· {p.category.replace("_", " ")}</span></p>
                <p className="text-xs text-muted-foreground">Covers: {(p.coverage ?? []).join(", ")} · Provides: {(p.provides ?? []).join(", ")}</p>
              </div>
              <StatusBadge status={p.status} />
            </div>
            <div className="mt-2 grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
              <p>Last successful retrieval: {p.last_success_at ? formatInZone(p.last_success_at, tz) : "never"}</p>
              <p>Last checked: {ago(p.last_checked_at)}</p>
              <p>Rate limits: {p.rate_limit ?? "Unknown until connected"}</p>
              <p>Missing permissions: {p.missing_permissions ?? (p.status === "connected" ? "None found" : "Unknown until connected")}</p>
              {p.last_error && <p className="text-destructive md:col-span-2">API error: {p.last_error}</p>}
              {p.notes && <p className="md:col-span-2">{p.notes}</p>}
              {p.docs_url && <a className="text-primary underline md:col-span-2" href={p.docs_url} target="_blank" rel="noreferrer">Provider website</a>}
            </div>
            {(p.credential_fields ?? []).length > 0 && (
              editing === p.id ? (
                <div className="mt-3 space-y-2">
                  {p.credential_fields.map((f: string) => (
                    <Input key={f} type="password" autoComplete="off" placeholder={f.replace("_", " ")} value={values[f] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))} />
                  ))}
                  <div className="flex gap-2">
                    <Button size="sm" disabled={saving} onClick={() => save(p.id)}>{saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}Save keys</Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditing(null); setValues({}); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(p.id); setValues({}); }}><KeyRound className="mr-1 h-3.5 w-3.5" />{p.has_credentials ? "Replace keys" : "Enter keys"}</Button>
                  {p.has_credentials && <Button size="sm" variant="outline" disabled={saving} onClick={() => save(p.id, true)}><Trash2 className="mr-1 h-3.5 w-3.5" />Remove keys</Button>}
                </div>
              )
            )}
          </div>
        ))}
      </div>
    </Panel>
    </div>
  );
}

// ---------- 16. Settings ----------
export function SettingsScreen({ settings, onSaved, tz }: { settings: any; onSaved: () => void; tz: string }) {
  const [form, setForm] = useState(() => ({ display_timezone: settings?.display_timezone ?? "Australia/Brisbane", selection_mode: settings?.selection_mode ?? "top10", custom_count: settings?.custom_count ?? 10, automation_enabled: settings?.automation_enabled ?? true }));
  const audit = useRacingTable("audit", () => supabase.from("racing_audit_log").select("id,actor,action,detail,created_at").order("created_at", { ascending: false }).limit(30));
  const zones = ["Australia/Brisbane", "Australia/Sydney", "Australia/Melbourne", "Australia/Adelaide", "Australia/Perth", "Pacific/Auckland", "Asia/Hong_Kong", "Asia/Tokyo", "Asia/Dubai", "Europe/London", "Europe/Dublin", "Europe/Paris", "America/New_York", "America/Los_Angeles", "UTC"];
  const save = async () => {
    const { error } = await supabase.from("racing_settings").update({ ...form, custom_count: Math.max(1, Number(form.custom_count) || 1), updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) toast.error(error.message); else { toast.success("Settings saved"); onSaved(); }
  };
  return (
    <div className="space-y-4">
      <Panel title="System settings">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">Show times in
            <select className="mt-1 w-full rounded-lg border border-border bg-background p-2" value={form.display_timezone} onChange={(e) => setForm({ ...form, display_timezone: e.target.value })}>
              {zones.map((z) => <option key={z}>{z}</option>)}
            </select>
          </label>
          <label className="text-sm">Races to analyse in detail
            <select className="mt-1 w-full rounded-lg border border-border bg-background p-2" value={form.selection_mode} onChange={(e) => setForm({ ...form, selection_mode: e.target.value })}>
              <option value="all">All races</option><option value="top5">Top 5</option><option value="top10">Top 10</option><option value="top20">Top 20</option><option value="custom">Custom number</option>
            </select>
          </label>
          {form.selection_mode === "custom" && (
            <label className="text-sm">Custom number
              <Input type="number" min={1} max={500} value={form.custom_count} onChange={(e) => setForm({ ...form, custom_count: Number(e.target.value) })} />
            </label>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.automation_enabled} onChange={(e) => setForm({ ...form, automation_enabled: e.target.checked })} />
            Run the engines automatically
          </label>
        </div>
        <Button className="mt-3" onClick={save}>Save settings</Button>
        <p className="mt-3 text-xs text-muted-foreground">Oracle Racing is an analysis tool. It never places bets or makes payments, and predictions are never guarantees.</p>
      </Panel>
      <Panel title="Audit history">
        <Table head={["When", "Who", "Action", "Detail"]} empty="Nothing recorded yet." rows={(audit.data ?? []).map((a: any) => [formatInZone(a.created_at, tz), a.actor, a.action, JSON.stringify(a.detail)])} />
      </Panel>
    </div>
  );
}
