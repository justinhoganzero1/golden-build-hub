// Oracle Racing — PuntersEdge adapter (licensed odds/race-card API, owner's own key
// through the Lovable connector gateway). Loads the day's AU thoroughbred
// acceptance card, best bookmaker prices and settled results. Credits are
// limited, so each pull is throttled and the remaining balance is recorded.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";
import { zonedToUtc } from "../_shared/racingImport.ts";
import { localDate } from "../_shared/racingSelection.ts";
import { localClock, canonicalVenue, australianZoneFor, summarisePrices } from "../_shared/racingPuntersEdge.ts";
import { nameMap } from "./importer.ts";
import { chunk } from "./common.ts";

export const PE = "puntersedge";
const GATEWAY = "https://connector-gateway.lovable.dev/udc_puntersedge";
const norm = (s: string) => s.trim().toLowerCase();
export const puntersEdgeConfigured = () => !!Deno.env.get("UDC_PUNTERSEDGE_API_KEY") && !!Deno.env.get("LOVABLE_API_KEY");

async function setProvider(sb: SupabaseClient, patch: Record<string, unknown>) {
  await sb.from("racing_providers").update({ ...patch, last_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", PE);
}

export async function peGet(sb: SupabaseClient, path: string, params: Record<string, string | number | boolean> = {}): Promise<any> {
  const key = Deno.env.get("UDC_PUNTERSEDGE_API_KEY"), lk = Deno.env.get("LOVABLE_API_KEY");
  if (!key || !lk) throw new Error("PuntersEdge is not connected.");
  const url = new URL(GATEWAY + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": key, Accept: "application/json" }, signal: AbortSignal.timeout(45_000) });
  const text = await res.text();
  const remaining = res.headers.get("x-credits-remaining"), limit = res.headers.get("x-credits-limit");
  if (remaining) await setProvider(sb, { rate_limit: `${Number(remaining).toLocaleString("en-AU")} of ${Number(limit ?? 0).toLocaleString("en-AU")} credits left this month` });
  if (!res.ok) {
    const msg = `PuntersEdge ${res.status}: ${text.slice(0, 300)}`;
    await setProvider(sb, { status: "error", last_error: msg.slice(0, 500) });
    throw new Error(res.status === 402 ? "PuntersEdge monthly credits are used up. Upgrade the plan or wait for the monthly reset." : msg);
  }
  await setProvider(sb, { status: "connected", last_success_at: new Date().toISOString(), last_error: null });
  return JSON.parse(text);
}

/** Skip a pull if the same kind succeeded recently (credits are limited). */
async function recently(sb: SupabaseClient, action: string, minutes: number) {
  const { data } = await sb.from("racing_audit_log").select("created_at").eq("action", action).gte("created_at", new Date(Date.now() - minutes * 60_000).toISOString()).limit(1);
  return !!data?.length;
}

async function courseFor(sb: SupabaseClient, venue: string): Promise<{ id: string; timezone: string | null }> {
  const name = canonicalVenue(venue);
  const { data: found } = await sb.from("racing_racecourses").select("id,timezone").eq("country_code", "AU").ilike("name", name).maybeSingle();
  if (found) return found;
  const { data, error } = await sb.from("racing_racecourses").insert({ name, country_code: "AU", timezone: null, surface: "turf" }).select("id,timezone").single();
  if (error) throw new Error(error.message);
  return data;
}

/** Today's (Sydney date) acceptance card: meetings, races, runners, official track ratings. 2 credits. */
export async function syncCard(sb: SupabaseClient, opts: { force?: boolean; date?: string; withinMinutes?: number } = {}) {
  const date = opts.date ?? localDate("Australia/Sydney");
  if (!opts.force && await recently(sb, `pe_card_${date}`, opts.withinMinutes ?? 180)) return { skipped: true };
  const card = await peGet(sb, "/v1/racing/acceptances", { date });
  let races = 0, runners = 0, meetings = 0;
  for (const m of card?.meetings ?? []) {
    if (!m?.acceptances_published || !(m.races ?? []).length) continue;
    const course = await courseFor(sb, m.venue);
    const tz = course.timezone || "Australia/Sydney";
    const rating = m.track?.track_condition ?? null;
    const extMeeting = `${date}|${m.venue_norm ?? norm(m.venue)}`;
    let { data: meeting } = await sb.from("racing_meetings").select("id").eq("racecourse_id", course.id).eq("meeting_date", date).maybeSingle();
    if (!meeting) {
      const ins = await sb.from("racing_meetings").insert({ racecourse_id: course.id, meeting_date: date, provider_id: PE, external_id: extMeeting, track_rating: rating, rail_position: m.track?.rail ?? null, status: "scheduled" }).select("id").single();
      if (ins.error) throw new Error(ins.error.message);
      meeting = ins.data;
    } else await sb.from("racing_meetings").update({ track_rating: rating, rail_position: m.track?.rail ?? null }).eq("id", meeting.id);
    meetings++;
    const all = (m.races ?? []).flatMap((r: any) => r.runners ?? []);
    const horses = await nameMap(sb, "racing_horses", all.map((x: any) => x.runner_name).filter(Boolean));
    const jockeys = await nameMap(sb, "racing_jockeys", all.map((x: any) => x.jockey ?? "").filter(Boolean));
    const trainers = await nameMap(sb, "racing_trainers", all.map((x: any) => x.trainer ?? "").filter(Boolean));
    const withBreeding = all.filter((x: any) => x.sire || x.dam);
    const needIds = withBreeding.map((x: any) => horses.get(norm(x.runner_name))).filter(Boolean) as string[];
    const missing = new Set<string>();
    for (const c of chunk(needIds, 150)) { const { data } = await sb.from("racing_horses").select("id").in("id", c).is("sire", null); for (const h of data ?? []) missing.add(h.id); }
    await Promise.all(withBreeding.filter((x: any) => missing.has(horses.get(norm(x.runner_name))!)).map((x: any) =>
      sb.from("racing_horses").update({ sire: x.sire ?? null, dam: x.dam ?? null }).eq("id", horses.get(norm(x.runner_name))!)));
    for (const r of m.races ?? []) {
      const clock = localClock(r.start_time_local);
      const fields: Record<string, unknown> = {
        name: r.race_name ?? null, distance_m: r.distance_m ?? null, race_class: r.race_class ?? null, surface: (r.track_type ?? m.track?.track_type ?? "").toLowerCase() || null,
        prize_money: r.prize_total ?? null, start_time_local: clock, provider_id: PE, external_id: r.race_id, race_code: "thoroughbred", updated_at: new Date().toISOString(),
      };
      let { data: race } = await sb.from("racing_races").select("id,start_time_utc,status").eq("meeting_id", meeting!.id).eq("race_number", r.race_number).maybeSingle();
      if (!race) {
        const ins = await sb.from("racing_races").insert({ meeting_id: meeting!.id, race_number: r.race_number, start_time_utc: zonedToUtc(date, clock, tz), status: "scheduled", ...fields }).select("id,start_time_utc,status").single();
        if (ins.error) throw new Error(ins.error.message);
        race = ins.data;
      } else await sb.from("racing_races").update(course.timezone && clock ? { ...fields, start_time_utc: zonedToUtc(date, clock, course.timezone) } : fields).eq("id", race.id);
      races++;
      const rows = (r.runners ?? []).filter((x: any) => x.runner_name).map((x: any) => ({
        race_id: race!.id, horse_id: horses.get(norm(x.runner_name))!, jockey_id: x.jockey ? jockeys.get(norm(x.jockey)) ?? null : null,
        trainer_id: x.trainer ? trainers.get(norm(x.trainer)) ?? null : null, saddlecloth: x.number ?? null, barrier: x.barrier ?? null,
        weight_kg: x.weight_kg ?? null, scratched: !!x.scratched || !!x.emergency, updated_at: new Date().toISOString(),
      }));
      // Keep any prices already stored: only field details change here.
      const { data: saved, error } = await sb.from("racing_runners").upsert(rows, { onConflict: "race_id,horse_id" }).select("id,horse_id");
      if (error) throw new Error(error.message);
      runners += saved?.length ?? 0;
      await sb.from("racing_races").update({ runners_count: rows.filter((x: any) => !x.scratched).length }).eq("id", race!.id);
      // Last start from the card becomes a form line when we don't already hold it.
      const last = (r.runners ?? []).filter((x: any) => x.last_start_date && x.last_start_position != null);
      for (const c of chunk(last, 100)) {
        const ids = c.map((x: any) => horses.get(norm(x.runner_name))!).filter(Boolean);
        const { data: have } = await sb.from("racing_performances").select("horse_id,race_date").in("horse_id", ids);
        const seen = new Set((have ?? []).map((p) => `${p.horse_id}|${p.race_date}`));
        const ins = c.filter((x: any) => !seen.has(`${horses.get(norm(x.runner_name))}|${String(x.last_start_date).slice(0, 10)}`)).map((x: any) => ({
          horse_id: horses.get(norm(x.runner_name))!, race_date: String(x.last_start_date).slice(0, 10), finish_position: Number(x.last_start_position) || null,
          weight_kg: x.last_start_weight_kg ?? null, barrier: x.last_start_barrier ?? null, jockey_id: x.last_start_jockey ? jockeys.get(norm(x.last_start_jockey)) ?? null : null,
          source_provider: PE, verified: true, sectionals: {},
        })).filter((p: any) => p.finish_position);
        if (ins.length) await sb.from("racing_performances").insert(ins);
      }
    }
  }
  await sb.from("racing_audit_log").insert({ actor: "puntersedge", action: `pe_card_${date}`, detail: { meetings, races, runners } });
  return { ok: true, meetings, races, runners };
}

/** Best current bookmaker win price per runner, and authoritative UTC start times. 4 credits (2 with venues). */
export async function syncPrices(sb: SupabaseClient, venues?: string[], throttleMinutes = 0) {
  if (throttleMinutes && await recently(sb, "pe_prices", throttleMinutes)) return { skipped: true };
  const params: Record<string, string | number | boolean> = { num_races: 200, categories: "horse", country: "AU", include_unresolved: true };
  if (venues?.length) params.venue = venues.join(",");
  const list: any[] = await peGet(sb, "/v1/racing/next-to-go", params);
  let priced = 0, races = 0;
  for (const r of list ?? []) {
    const { data: byExt } = await sb.from("racing_races").select("id,meeting_id").eq("provider_id", PE).eq("external_id", r.race_id).maybeSingle();
    let race = byExt;
    if (!race) {
      const date = localDate("Australia/Sydney", new Date(r.start_time));
      const { data: course } = await sb.from("racing_racecourses").select("id").eq("country_code", "AU").ilike("name", canonicalVenue(r.venue)).maybeSingle();
      if (!course) continue;
      const { data: meeting } = await sb.from("racing_meetings").select("id").eq("racecourse_id", course.id).eq("meeting_date", date).maybeSingle();
      if (!meeting) continue;
      const { data: rr } = await sb.from("racing_races").select("id,meeting_id").eq("meeting_id", meeting.id).eq("race_number", r.race_number).maybeSingle();
      race = rr;
    }
    if (!race) continue;
    races++;
    await sb.from("racing_races").update({ start_time_utc: r.start_time, updated_at: new Date().toISOString() }).eq("id", race.id);
    // Learn a new venue's timezone from the authoritative UTC start and the card's local clock.
    const { data: rinfo } = await sb.from("racing_races").select("start_time_local,meeting:racing_meetings(racecourse_id,racecourse:racing_racecourses(timezone))").eq("id", race.id).single();
    const rc: any = (rinfo as any)?.meeting;
    if (rc && !rc.racecourse?.timezone && (rinfo as any)?.start_time_local) {
      const tz = australianZoneFor(r.start_time, (rinfo as any).start_time_local);
      if (tz) await sb.from("racing_racecourses").update({ timezone: tz }).eq("id", rc.racecourse_id).is("timezone", null);
    }
    const { data: runners } = await sb.from("racing_runners").select("id,race_id,horse_id,saddlecloth,odds,scratched").eq("race_id", race.id);
    const scratchedNos = new Set((r.scratchings ?? []).map((x: any) => x.number));
    const now = new Date().toISOString();
    const rows = (runners ?? []).map((ru) => {
      const q = (r.runners ?? []).find((x: any) => x.number === ru.saddlecloth);
      const s = summarisePrices(q?.bookmakers);
      if (s.best != null) priced++;
      return {
        id: ru.id, race_id: ru.race_id, horse_id: ru.horse_id, updated_at: now,
        scratched: ru.scratched || scratchedNos.has(ru.saddlecloth),
        odds: s.best != null ? { ...(ru.odds ?? {}), pre_race_win: s.best, best_book: s.bestBook, median_win: s.median, books: s.books, source: PE, kind: "indicative", updated_at: now } : (ru.odds ?? {}),
      };
    });
    if (rows.length) { const { error } = await sb.from("racing_runners").upsert(rows, { onConflict: "id" }); if (error) throw new Error(error.message); }
  }
  await sb.from("racing_audit_log").insert({ actor: "puntersedge", action: "pe_prices", detail: { races, priced, venues: venues ?? "all" } });
  return { ok: true, races, priced };
}

/** Settled results for a Sydney day: official order, races marked finished, placed runs saved as form. 2 credits a page. */
export async function syncResults(sb: SupabaseClient, date: string, force = false, throttleMinutes = 180) {
  if (!force && await recently(sb, `pe_results_${date}`, throttleMinutes)) return { skipped: true };
  let saved = 0, offset = 0;
  for (let page = 0; page < 3; page++) {
    const list: any[] = await peGet(sb, "/v1/racing/results", { date, categories: "horse", country: "AU", status: "final", limit: 200, offset });
    for (const r of list ?? []) {
      const { data: race } = await sb.from("racing_races").select("id,meeting_id,distance_m,race_class,surface").eq("provider_id", PE).eq("external_id", r.race_id).maybeSingle();
      if (!race) continue;
      const { data: runners } = await sb.from("racing_runners").select("id,horse_id,saddlecloth,jockey_id,trainer_id,weight_kg,barrier,odds").eq("race_id", race.id);
      const placings = [...(r.placings ?? [])].filter((p: any) => p.position != null).sort((a: any, b: any) => a.position - b.position);
      const order = placings.map((p: any) => (runners ?? []).find((u) => u.saddlecloth === p.number)?.id).filter(Boolean);
      if (!order.length) continue;
      const { data: exists } = await sb.from("racing_results").select("race_id").eq("race_id", race.id).maybeSingle();
      if (!exists) { await sb.from("racing_results").insert({ race_id: race.id, official_order: order, source_provider: PE, verified_at: new Date().toISOString() }); saved++; }
      await sb.from("racing_races").update({ status: "finished", updated_at: new Date().toISOString() }).eq("id", race.id);
      const { data: mt } = await sb.from("racing_meetings").select("racecourse_id,track_rating").eq("id", race.meeting_id).single();
      const field = (runners ?? []).length;
      for (const p of placings) {
        const u = (runners ?? []).find((x) => x.saddlecloth === p.number);
        if (!u) continue;
        if (p.win_price) await sb.from("racing_runners").update({ odds: { ...(u.odds ?? {}), settled_win: p.win_price } }).eq("id", u.id);
        const { count } = await sb.from("racing_performances").select("id", { count: "exact", head: true }).eq("horse_id", u.horse_id).eq("race_date", date);
        if (count) continue;
        await sb.from("racing_performances").insert({ horse_id: u.horse_id, race_date: date, racecourse_id: mt?.racecourse_id ?? null, distance_m: race.distance_m, surface: race.surface, track_rating: mt?.track_rating ?? null, race_class: race.race_class,
          finish_position: p.position, field_size: field || null, weight_kg: u.weight_kg, barrier: u.barrier, jockey_id: u.jockey_id, trainer_id: u.trainer_id, sectionals: {}, source_provider: PE, verified: true });
      }
    }
    if ((list ?? []).length < 200) break;
    offset += 200;
  }
  await sb.from("racing_audit_log").insert({ actor: "puntersedge", action: `pe_results_${date}`, detail: { results: saved } });
  return { ok: true, results: saved };
}
