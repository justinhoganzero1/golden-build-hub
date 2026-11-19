// Oracle Racing — plain-English race report written by AI strictly from the
// engines' saved findings. Labelled AI interpretation; never adds facts.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";
import { askAI, audit } from "./common.ts";

const RULES = `You are Oracle, writing a short race intelligence report for the owner of an analysis tool.
Use ONLY the data supplied. Never invent horses, statistics, results, footage or tips. If something is missing, say it is missing.
Plain Australian English, short paragraphs, no betting advice, no guarantees. Describe each point once.
Sections: 1) Why this race was or wasn't a good one to analyse. 2) Main contenders by evidence (name the evidence). 3) Conditions and pace. 4) Footage (or that there is none). 5) Gaps and warnings.
Always say that analytical confidence is not a horse's chance of winning.`;

export async function raceReport(sb: SupabaseClient, actor: string, raceId: string) {
  const { data: race } = await sb.from("racing_races").select("race_number,name,start_time_utc,distance_m,race_class,suitability_score,suitability_reasons,meeting:racing_meetings(track_rating,racecourse:racing_racecourses(name,country_code))").eq("id", raceId).maybeSingle();
  if (!race) return { error: "unknown_race", status: 404 };
  const { data: summary } = await sb.from("racing_engine_assessments").select("assessment,evidence_cutoff,created_at").eq("race_id", raceId).eq("engine", "master_summary").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!summary) return { error: "not_analysed", message: "Run Analyse now first so the engines have findings to report on.", status: 409 };
  const { data: rows } = await sb.from("racing_engine_assessments").select("engine,assessment,runner:racing_runners(saddlecloth,barrier,odds,horse:racing_horses(name))").eq("race_id", raceId).gte("created_at", summary.created_at).not("runner_id", "is", null).limit(400);
  const runners: Record<string, any> = {};
  for (const r of rows ?? []) {
    const name = `${(r as any).runner?.saddlecloth ?? "?"}. ${(r as any).runner?.horse?.name ?? "Unknown"}`;
    const a = r.assessment as any;
    const slim = r.engine === "historical" ? { starts: a.starts, wins: a.wins, winPct: a.winPct, recentForm: a.recentForm, trend: a.trend, daysSinceLast: a.daysSinceLast, distance: a.distance, course: a.course }
      : r.engine === "environment" ? { condition: a.condition }
      : r.engine === "dynamics" ? { jockeyWinPct: a.jockey?.winPct, trainerWinPct: a.trainer?.winPct, comboRides: a.combo?.rides, style: a.style, paceFit: a.paceFit }
      : r.engine === "master" ? { p_win: a.p_win, top3: a.top3 } : a;
    const entry = (runners[name] ??= { barrier: (r as any).runner?.barrier ?? null, pre_race_price: (r as any).runner?.odds?.pre_race_win ?? null });
    entry[r.engine] = slim;
  }
  const { data: pred } = await sb.from("racing_predictions").select("stage,status,model_version,analytical_confidence,limitations").eq("race_id", raceId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const payload = { race, summary: summary.assessment, evidence_up_to: summary.evidence_cutoff, latest_prediction: pred, runners };
  const text = (await askAI(RULES, [{ type: "input_text", text: JSON.stringify(payload).slice(0, 60_000) }], "medium")).slice(0, 6000);
  await sb.from("racing_engine_assessments").insert({ race_id: raceId, runner_id: null, engine: "oracle_report", evidence_cutoff: summary.evidence_cutoff, assessment: { text, based_on: summary.created_at } });
  await audit(sb, actor, "race_report", { race: raceId });
  return { ok: true, text };
}
