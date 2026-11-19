// Oracle Racing — daily broadcast report. Finds today's Seven-covered
// thoroughbred races (from the stored broadcast schedule), checks every
// runner against the $3.00 minimum price, value and confidence rules, and
// records every decision permanently. It never invents a selection: no data
// means "data unavailable", not "no winners".
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";
import {
  evaluateRunner, effectiveMinOdds, meetsOddsFloor, expectedValue, overroundAdjusted, reportStatus, broadcastCounts,
  localDate, localTime, paradeTime, STATUS_TEXT,
} from "../_shared/racingSelection.ts";
import { analyseRace, latestValidatedModels, priceOf } from "./analysis.ts";
import { audit, chunk, fetchAll } from "./common.ts";
import { puntersEdgeConfigured, syncCard, syncPrices, syncResults } from "./puntersedge.ts";

const TIME_BUDGET_MS = 100_000;
const MAX_RACES = 60;
const money = (x: number) => `$${x.toFixed(2)}`;
const oddsKind = (o: any) => (o?.kind === "starting_price" ? "starting_price" : o?.kind === "unknown" ? "unknown" : "indicative");

async function notify(sb: SupabaseClient, kind: string, title: string, body: string, raceId: string | null, key: string, prefs: any) {
  if (prefs && prefs[kind] === false) return;
  await sb.from("racing_notifications").upsert({ kind, title, body, race_id: raceId, dedupe_key: key }, { onConflict: "dedupe_key", ignoreDuplicates: true });
}

export async function dailyScan(sb: SupabaseClient, actor: string, trigger: string) {
  const t0 = Date.now();
  const { data: settings } = await sb.from("racing_settings").select("*").eq("id", 1).single();
  const tz = settings?.display_timezone ?? "Australia/Brisbane";
  const today = localDate(tz);
  const { data: running } = await sb.from("racing_daily_reports").select("id").eq("status", "in_progress").gte("started_at", new Date(Date.now() - 3 * 60_000).toISOString()).limit(1);
  if (running?.length) return { ok: false, busy: true, message: "A daily scan is already running." };

  const minOdds = effectiveMinOdds(settings);
  const snapshot = { min_win_odds: minOdds, min_confidence: settings?.min_confidence, min_expected_value: settings?.min_expected_value, timezone: tz, parade_lead_minutes: settings?.parade_lead_minutes };
  const { data: report, error: re } = await sb.from("racing_daily_reports").insert({ report_date: today, status: "in_progress", trigger, settings_snapshot: snapshot }).select("id").single();
  if (re) throw new Error(re.message);
  const problems: string[] = [];

  try {
    if (puntersEdgeConfigured()) {
      try { await syncCard(sb, { withinMinutes: 30 }); await syncPrices(sb); }
      catch (e) { problems.push(`PuntersEdge: ${(e as Error).message.slice(0, 200)}`); }
    }
    const { data: bc } = await sb.from("racing_broadcasts").select("*, racecourse:racing_racecourses(id,name,timezone)").eq("broadcast_date", today).order("starts_at");
    const coverage = (bc ?? []).map((b: any) => ({ venue: b.racecourse?.name, network: b.network, channel: b.channel, platform: b.platform, starts_at: b.starts_at, status: b.status, races: b.race_numbers, counts: broadcastCounts(b.status), verified: b.verified, source_url: b.source_url }));
    const live = (bc ?? []).filter((b: any) => broadcastCounts(b.status));
    if (!bc?.length) problems.push("No Seven Network racing broadcast schedule is stored for today. No licensed TV-guide feed is connected, so import today's schedule under Data Providers.");
    else if (!live.length) problems.push("Today's stored coverage is only replays or unconfirmed listings, so no race counts as broadcast.");

    const models = await latestValidatedModels(sb);
    const hasModel = Object.keys(models).length > 0;
    if (!hasModel) problems.push("No prediction model has passed testing yet, so Oracle has no tested win probabilities. Nothing can qualify until one does — this is a data gap, not a no-winner day.");

    const races = new Map<string, any>();
    const meetings = new Set<string>();
    for (const b of live as any[]) {
      const venue = b.racecourse?.name ?? "Unknown venue";
      const { data: meeting } = await sb.from("racing_meetings").select("id").eq("racecourse_id", b.racecourse_id).eq("meeting_date", b.broadcast_date).maybeSingle();
      if (!meeting) { problems.push(`${venue}: no race fields stored for this meeting yet.`); continue; }
      let q = sb.from("racing_races").select("id,race_number,name,start_time_utc,parade_time_utc,race_code,status").eq("meeting_id", meeting.id).order("race_number");
      if (b.race_numbers?.length) q = q.in("race_number", b.race_numbers);
      const { data: list } = await q;
      if (!list?.length) { problems.push(`${venue}: the broadcast lists races, but none are stored.`); continue; }
      meetings.add(meeting.id);
      for (const r of list) if (r.race_code === "thoroughbred" && r.status !== "abandoned" && !races.has(r.id)) races.set(r.id, { ...r, venue, channel: b.channel });
    }
    const sortedAll = [...races.values()].sort((a, b) => (a.start_time_utc < b.start_time_utc ? -1 : 1));
    // Races already run can't be selected; they are reported as skipped, not as missing data.
    const nowMs = Date.now();
    const alreadyRun = sortedAll.filter((r) => Date.parse(r.start_time_utc) <= nowMs || r.status === "finished");
    const eligible = sortedAll.filter((r) => !alreadyRun.includes(r));
    if (eligible.length > MAX_RACES) problems.push(`${eligible.length} races found; only the first ${MAX_RACES} were analysed.`);

    let fully = 0, analysed = 0, qualifyingRaces = 0, qualifyingSel = 0, skipped = alreadyRun.length, modelVersion: string | null = null;
    const decisions: any[] = [];
    const now = new Date().toISOString();
    for (const race of eligible.slice(0, MAX_RACES)) {
      if (Date.now() - t0 > TIME_BUDGET_MS) { problems.push(`Time limit reached: ${eligible.length - analysed} race(s) not analysed. Press Refresh to finish.`); break; }
      analysed++;
      const label = `${race.venue} R${race.race_number}`;
      const { data: runners } = await sb.from("racing_runners").select("id,horse_id,jockey_id,scratched,odds,horse:racing_horses(name)").eq("race_id", race.id);
      const all = (runners ?? []) as any[];
      const active = all.filter((r) => !r.scratched);
      if (!active.length) { problems.push(`${label}: no field.`); skipped++; continue; }
      const prices = active.map((r) => priceOf(r.odds));
      const priced = prices.filter((p) => p != null).length;
      if (priced < active.length) problems.push(`${label}: ${active.length - priced} runner(s) have no win price.`);
      const { probs: marketP } = overroundAdjusted(prices);
      const probs = new Map<string, number>();
      let confidence: number | null = null, mv: string | null = null;
      if (hasModel) {
        const res: any = await analyseRace(sb, race.id, "manual");
        if (res?.prediction?.id) {
          const { data: ranks } = await sb.from("racing_prediction_rankings").select("runner_id,p_win").eq("prediction_id", res.prediction.id);
          for (const k of ranks ?? []) if (k.p_win != null) probs.set(k.runner_id, Number(k.p_win));
          confidence = res.prediction.confidence ?? null; mv = res.prediction.model ?? null; modelVersion ??= mv;
        }
      }
      if (priced === active.length && probs.size > 0) fully++;
      const base = (r: any) => ({ report_id: report.id, race_id: race.id, runner_id: r.id, horse_name: r.horse?.name ?? null, venue: race.venue, race_number: race.race_number, race_start_utc: race.start_time_utc, jockey_id: r.jockey_id, decided_at: now, odds_source: r.odds?.source ?? null, odds_kind: oddsKind(r.odds), model_version: mv, min_odds_applied: minOdds });
      let raceQual = 0;
      active.forEach((r, i) => {
        const ev = evaluateRunner({ odds: prices[i], oracleProb: probs.get(r.id) ?? null, confidence }, settings);
        if (ev.decision === "qualified") raceQual++;
        decisions.push({ ...base(r), odds_at_decision: prices[i], implied_prob: ev.implied, market_prob: marketP[i], oracle_prob: probs.get(r.id) ?? null, expected_value: ev.ev, confidence, decision: ev.decision, reasons: ev.reasons });
      });
      for (const r of all.filter((x) => x.scratched)) decisions.push({ ...base(r), odds_at_decision: priceOf(r.odds), decision: "rejected", reasons: ["Scratched."] });
      if (raceQual) { qualifyingRaces++; qualifyingSel += raceQual; } else skipped++;
    }
    const saved: any[] = [];
    for (const c of chunk(decisions, 400)) {
      const { data, error } = await sb.from("racing_selection_decisions").insert(c).select("id,race_id,runner_id,decision,horse_name,venue,race_number,odds_at_decision,expected_value");
      if (error) throw new Error(error.message);
      saved.push(...(data ?? []));
    }
    if (!eligible.length && alreadyRun.length && !problems.length) problems.push(`All ${alreadyRun.length} broadcast race(s) have already run today.`);
    const status = reportStatus({ eligibleRaces: eligible.length, fullyAnalysedRaces: fully, qualifying: qualifyingSel, dataProblems: problems.length });
    const { data: provs } = await sb.from("racing_providers").select("last_success_at").in("category", ["racing_data", "markets", "broadcast"]).not("last_success_at", "is", null).order("last_success_at", { ascending: false }).limit(1);
    await sb.from("racing_daily_reports").update({
      status, finished_at: new Date().toISOString(), meetings_analysed: meetings.size, races_analysed: analysed, qualifying_races: qualifyingRaces,
      qualifying_selections: qualifyingSel, skipped_races: skipped, coverage, problems: problems.slice(0, 40), model_version: modelVersion, data_retrieved_at: provs?.[0]?.last_success_at ?? null,
    }).eq("id", report.id);
    const prefs = settings?.notification_prefs ?? {};
    await notify(sb, "report_ready", "Daily racing report ready", STATUS_TEXT[status], null, `report:${report.id}`, prefs);
    for (const d of saved.filter((x) => x.decision === "qualified")) {
      await notify(sb, "new_selection", `New selection: ${d.horse_name}`, `${d.venue} R${d.race_number} at ${money(Number(d.odds_at_decision))}, value ${(Number(d.expected_value) * 100).toFixed(1)}%.`, d.race_id, `sel:${today}:${d.runner_id}`, prefs);
    }
    await audit(sb, actor, "daily_scan", { date: today, status, races: analysed, selections: qualifyingSel, problems: problems.length });
    return { ok: true, report_id: report.id, status, text: STATUS_TEXT[status], races: analysed, selections: qualifyingSel, problems: problems.slice(0, 10) };
  } catch (e) {
    const msg = (e as Error).message.slice(0, 300);
    await sb.from("racing_daily_reports").update({ status: "data_unavailable", finished_at: new Date().toISOString(), problems: [...problems, `Scan failed: ${msg}`].slice(0, 40) }).eq("id", report.id);
    throw e;
  }
}

/** Re-check today's live selections: scratchings, price falls under the floor, lost value, time and jockey changes, parades. */
export async function recheckSelections(sb: SupabaseClient) {
  const { data: settings } = await sb.from("racing_settings").select("*").eq("id", 1).single();
  const tz = settings?.display_timezone ?? "Australia/Brisbane";
  const today = localDate(tz);
  const prefs = settings?.notification_prefs ?? {};
  const minOdds = effectiveMinOdds(settings);
  const minEv = Math.max(0, Number(settings?.min_expected_value ?? 0.05));
  const { data: rep } = await sb.from("racing_daily_reports").select("id").eq("report_date", today).neq("status", "in_progress").order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (!rep) return { checked: 0, withdrawn: 0 };
  const { data: list } = await sb.from("racing_selection_decisions").select("*").eq("report_id", rep.id).eq("decision", "qualified").is("withdrawn_at", null);
  const upcoming = (list ?? []).filter((d) => Date.parse(d.race_start_utc) > Date.now());
  if (upcoming.length && puntersEdgeConfigured()) {
    try { await syncPrices(sb, [...new Set(upcoming.map((d) => d.venue).filter(Boolean))] as string[], Math.max(5, Number(settings?.odds_refresh_minutes ?? 15)) - 1); }
    catch (e) { console.error("price recheck", (e as Error).message); }
  }
  let withdrawn = 0;
  const now = new Date();
  for (const d of list ?? []) {
    const { data: r } = await sb.from("racing_runners").select("scratched,odds,jockey_id").eq("id", d.runner_id).maybeSingle();
    const { data: race } = await sb.from("racing_races").select("start_time_utc,parade_time_utc").eq("id", d.race_id).maybeSingle();
    if (!r || !race) continue;
    const name = d.horse_name ?? "Selection";
    const withdraw = async (reason: string, kind: string) => {
      await sb.from("racing_selection_decisions").update({ withdrawn_at: now.toISOString(), withdrawn_reason: reason }).eq("id", d.id);
      await notify(sb, kind, `${name} withdrawn`, `${d.venue} R${d.race_number}: ${reason}`, d.race_id, `wd:${d.id}`, prefs);
      withdrawn++;
    };
    if (r.scratched) { await withdraw("Scratched.", "scratched"); continue; }
    if (r.jockey_id !== d.jockey_id) await notify(sb, "jockey_changed", `Jockey change: ${name}`, `${d.venue} R${d.race_number} has a new jockey. Re-check before betting.`, d.race_id, `jk:${d.id}:${r.jockey_id}`, prefs);
    if (race.start_time_utc !== d.race_start_utc && Date.parse(race.start_time_utc) !== Date.parse(d.race_start_utc)) await notify(sb, "time_changed", `Race time changed: ${d.venue} R${d.race_number}`, `New start time stored for ${name}'s race.`, d.race_id, `tm:${d.id}:${race.start_time_utc}`, prefs);
    const odds = priceOf(r.odds);
    if (odds != null && odds !== Number(d.latest_odds ?? d.odds_at_decision)) {
      await sb.from("racing_selection_decisions").update({ latest_odds: odds, latest_odds_at: now.toISOString() }).eq("id", d.id);
      if (!meetsOddsFloor(odds, minOdds)) { await withdraw(`Price fell to ${money(odds)}, below the ${money(minOdds)} minimum.`, "odds_below_floor"); continue; }
      if (d.oracle_prob != null && !(expectedValue(Number(d.oracle_prob), odds) > minEv)) { await withdraw(`At ${money(odds)} the value is gone.`, "withdrawn"); continue; }
    }
    const p = paradeTime(race.start_time_utc, race.parade_time_utc, settings?.parade_lead_minutes ?? 15);
    const mins = (Date.parse(p.at) - now.getTime()) / 60_000;
    if (mins > 0 && mins <= 20) await notify(sb, "parade_soon", `Parade soon: ${name}`, `${d.venue} R${d.race_number} parade in about ${Math.round(mins)} min (${p.official ? "official" : "estimated"}).`, d.race_id, `pd:${d.id}`, prefs);
  }
  return { checked: list?.length ?? 0, withdrawn };
}

/** Fill in results and $1 flat-bet returns once official results are stored. */
export async function settleDecisions(sb: SupabaseClient) {
  const { data: settings } = await sb.from("racing_settings").select("betting_deduction_pct").eq("id", 1).single();
  const cut = Math.min(Math.max(Number(settings?.betting_deduction_pct ?? 0), 0), 50) / 100;
  const open = await fetchAll<any>((a, b) => sb.from("racing_selection_decisions").select("id,race_id,runner_id,decision,withdrawn_at,odds_at_decision").is("settled_at", null).lt("race_start_utc", new Date().toISOString()).range(a, b), 5_000);
  if (!open.length) return { settled: 0 };
  const raceIds = [...new Set(open.map((d) => d.race_id))];
  const results = new Map<string, string[]>();
  for (const c of chunk(raceIds, 200)) { const { data } = await sb.from("racing_results").select("race_id,official_order").in("race_id", c); for (const r of data ?? []) results.set(r.race_id, (r.official_order as string[]) ?? []); }
  let settled = 0;
  for (const d of open) {
    const order = results.get(d.race_id);
    if (!order) continue;
    const pos = order.indexOf(d.runner_id);
    const finish = pos >= 0 ? pos + 1 : null;
    const { data: ru } = await sb.from("racing_runners").select("odds").eq("id", d.runner_id).maybeSingle();
    const sp = Number(ru?.odds?.sp ?? ru?.odds?.starting_price);
    const bet = d.decision === "qualified" && !d.withdrawn_at && d.odds_at_decision != null;
    const payout = bet ? (finish === 1 ? +(1 + (Number(d.odds_at_decision) - 1) * (1 - cut)).toFixed(4) : 0) : null;
    await sb.from("racing_selection_decisions").update({ finish_position: finish, starting_price: Number.isFinite(sp) && sp > 1 ? sp : null, payout, profit: payout == null ? null : +(payout - 1).toFixed(4), settled_at: new Date().toISOString() }).eq("id", d.id);
    settled++;
  }
  return { settled };
}

/** Apply today's rules to the Laboratory's saved back-test predictions (races the model never trained on). */
export async function backtestRules(sb: SupabaseClient, actor: string) {
  const { data: settings } = await sb.from("racing_settings").select("*").eq("id", 1).single();
  const cut = Math.min(Math.max(Number(settings?.betting_deduction_pct ?? 0), 0), 50) / 100;
  const minOdds = effectiveMinOdds(settings);
  const preds = await fetchAll<any>((a, b) => sb.from("racing_predictions").select("id,race_id,model_version,evidence_cutoff,rankings:racing_prediction_rankings(runner_id,p_win)").eq("stage", "backtest").eq("status", "locked").range(a, b), 5_000);
  if (!preds.length) return { ok: false, reason: "No back-test predictions saved yet. Train & test a model in the Prediction Laboratory first (it needs a few hundred past races)." };
  const done = new Set((await fetchAll<any>((a, b) => sb.from("racing_selection_decisions").select("prediction_id").eq("is_backtest", true).range(a, b), 100_000)).map((x) => x.prediction_id));
  const todo = preds.filter((p) => !done.has(p.id)).slice(0, 400);
  let inserted = 0, noPrices = 0;
  for (const c of chunk(todo, 50)) {
    const raceIds = c.map((p) => p.race_id);
    const { data: races } = await sb.from("racing_races").select("id,race_number,start_time_utc,meeting:racing_meetings(racecourse:racing_racecourses(name))").in("id", raceIds);
    const { data: results } = await sb.from("racing_results").select("race_id,official_order").in("race_id", raceIds);
    const runners = await fetchAll<any>((a, b) => sb.from("racing_runners").select("id,race_id,scratched,odds,horse:racing_horses(name)").in("race_id", raceIds).range(a, b), 20_000);
    const rows: any[] = [];
    for (const p of c) {
      const race = (races ?? []).find((r: any) => r.id === p.race_id) as any;
      const order = ((results ?? []).find((r: any) => r.race_id === p.race_id)?.official_order as string[]) ?? [];
      const prob = new Map<string, number>((p.rankings ?? []).map((k: any) => [k.runner_id, Number(k.p_win)]));
      const field = runners.filter((r) => r.race_id === p.race_id && !r.scratched);
      if (!field.some((r) => priceOf(r.odds) != null)) noPrices++;
      const { probs: market } = overroundAdjusted(field.map((r) => priceOf(r.odds)));
      field.forEach((r, i) => {
        const odds = priceOf(r.odds);
        const ev = evaluateRunner({ odds, oracleProb: prob.get(r.id) ?? null, confidence: null }, settings, { applyConfidence: false });
        const pos = order.indexOf(r.id); const finish = pos >= 0 ? pos + 1 : null;
        const bet = ev.decision === "qualified";
        const payout = bet ? (finish === 1 ? +(1 + (odds! - 1) * (1 - cut)).toFixed(4) : 0) : null;
        rows.push({
          prediction_id: p.id, is_backtest: true, race_id: p.race_id, runner_id: r.id, horse_name: r.horse?.name ?? null, venue: race?.meeting?.racecourse?.name ?? null,
          race_number: race?.race_number ?? null, race_start_utc: race?.start_time_utc ?? null, decided_at: p.evidence_cutoff, odds_at_decision: odds, odds_source: r.odds?.source ?? null,
          odds_kind: oddsKind(r.odds), implied_prob: ev.implied, market_prob: market[i], oracle_prob: prob.get(r.id) ?? null, expected_value: ev.ev, model_version: p.model_version,
          min_odds_applied: minOdds, decision: ev.decision, reasons: [...ev.reasons, "Back-test: confidence threshold not applied (not recorded for past races)."],
          finish_position: finish, payout, profit: payout == null ? null : +(payout - 1).toFixed(4), settled_at: order.length ? new Date().toISOString() : null,
        });
      });
    }
    for (const rc of chunk(rows, 500)) { const { error } = await sb.from("racing_selection_decisions").insert(rc); if (error) throw new Error(error.message); inserted += rc.length; }
  }
  await audit(sb, actor, "backtest_rules", { predictions: todo.length, decisions: inserted, races_without_prices: noPrices });
  return { ok: true, predictions: todo.length, decisions: inserted, racesWithoutPrices: noPrices, remaining: Math.max(0, preds.length - done.size - todo.length) };
}

/** Scheduler: run today's scan once after the chosen time, then keep selections and results up to date. */
export async function dailyTick(sb: SupabaseClient) {
  const { data: settings } = await sb.from("racing_settings").select("display_timezone,daily_scan_time").eq("id", 1).single();
  const tz = settings?.display_timezone ?? "Australia/Brisbane";
  const today = localDate(tz);
  if (localTime(tz) >= (settings?.daily_scan_time ?? "07:00")) {
    const { count } = await sb.from("racing_daily_reports").select("id", { count: "exact", head: true }).eq("report_date", today);
    if (!count) await dailyScan(sb, "scheduler", "schedule");
  }
  await recheckSelections(sb);
  if (puntersEdgeConfigured()) {
    const sydney = localDate("Australia/Sydney");
    try {
      if (localTime("Australia/Sydney") >= "13:00") await syncResults(sb, sydney);
      const y = localDate("Australia/Sydney", new Date(Date.now() - 86_400_000));
      await syncResults(sb, y, false, 1440);
    } catch (e) { console.error("results sync", (e as Error).message); }
  }
  await settleDecisions(sb);
}
