// Oracle Racing — saves spreadsheet rows the owner is allowed to use.
// Existing records are matched by name/date and reused, never duplicated.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";
import { normaliseRaceRows, normaliseFormRows, raceKey, zonedToUtc, defaultTimezone, type RaceRow, type FormRow } from "../_shared/racingImport.ts";
import { chunk, audit, markProvider } from "./common.ts";

const SOURCE = "owner-import";
const norm = (s: string) => s.trim().toLowerCase();

async function nameMap(sb: SupabaseClient, table: "racing_horses" | "racing_jockeys" | "racing_trainers", names: string[], extra: (n: string) => Record<string, unknown> = () => ({})) {
  const map = new Map<string, string>();
  const unique = [...new Set(names.filter(Boolean).map((n) => n.trim()))];
  for (const c of chunk(unique, 150)) {
    const { data } = await sb.from(table).select("id,name").in("name", c);
    for (const r of data ?? []) if (!map.has(norm(r.name))) map.set(norm(r.name), r.id);
  }
  const missing = unique.filter((n) => !map.has(norm(n)));
  for (const c of chunk(missing, 200)) {
    const { data, error } = await sb.from(table).insert(c.map((name) => ({ name, ...extra(name) }))).select("id,name");
    if (error) throw new Error(error.message);
    for (const r of data ?? []) map.set(norm(r.name), r.id);
  }
  return map;
}

async function courseMap(sb: SupabaseClient, rows: Array<{ racecourse: string | null; country: string | null; timezone?: string | null; surface?: string | null }>) {
  const { data } = await sb.from("racing_racecourses").select("id,name,timezone,country_code");
  const { data: countries } = await sb.from("racing_countries").select("code");
  const known = new Set((countries ?? []).map((c) => c.code));
  const map = new Map<string, { id: string; timezone: string }>();
  for (const c of data ?? []) map.set(norm(c.name), { id: c.id, timezone: c.timezone });
  let created = 0;
  const unknown = new Set<string>();
  for (const r of rows) {
    if (!r.racecourse || map.has(norm(r.racecourse))) continue;
    if (!r.country || !known.has(r.country)) { unknown.add(r.racecourse); continue; }
    const timezone = r.timezone || defaultTimezone(r.country);
    const { data: c, error } = await sb.from("racing_racecourses").insert({ name: r.racecourse, country_code: r.country, timezone, surface: r.surface ?? null }).select("id,timezone").single();
    if (error) throw new Error(error.message);
    map.set(norm(r.racecourse), { id: c.id, timezone: c.timezone }); created++;
  }
  return { map, created, unknown: [...unknown] };
}

export async function importRaces(sb: SupabaseClient, actor: string, raw: Array<Record<string, string>>, verified: boolean) {
  const { rows, problems } = normaliseRaceRows(raw);
  if (!rows.length) return { ok: false, problems, races: 0 };
  const groups = new Map<string, RaceRow[]>();
  for (const r of rows) { const k = raceKey(r); const g = groups.get(k); if (g) g.push(r); else groups.set(k, [r]); }
  const { map: courses, created: coursesCreated, unknown } = await courseMap(sb, rows);
  for (const u of unknown) problems.push(`New racecourse "${u}" needs a country code (for example AU, GB, US) — its rows were skipped.`);
  for (const [k, g] of groups) if (!courses.has(norm(g[0].racecourse))) groups.delete(k);
  const horses = await nameMap(sb, "racing_horses", rows.map((r) => r.horse));
  const jockeys = await nameMap(sb, "racing_jockeys", rows.map((r) => r.jockey ?? ""));
  const trainers = await nameMap(sb, "racing_trainers", rows.map((r) => r.trainer ?? ""));
  // Fill in breeding where the stored horse has none.
  const breeding = rows.filter((r) => r.sire || r.dam);
  for (const r of breeding.slice(0, 2000)) {
    const id = horses.get(norm(r.horse));
    if (id) await sb.from("racing_horses").update({ ...(r.sire ? { sire: r.sire } : {}), ...(r.dam ? { dam: r.dam } : {}) }).eq("id", id).is("sire", null);
  }
  let racesSaved = 0, resultsSaved = 0, perfsSaved = 0, runnersSaved = 0;
  for (const group of groups.values()) {
    const f = group[0];
    const course = courses.get(norm(f.racecourse))!;
    let { data: meeting } = await sb.from("racing_meetings").select("id").eq("racecourse_id", course.id).eq("meeting_date", f.date).maybeSingle();
    if (!meeting) {
      const ins = await sb.from("racing_meetings").insert({ racecourse_id: course.id, meeting_date: f.date, track_rating: f.track_rating, provider_id: SOURCE, status: "imported" }).select("id").single();
      if (ins.error) throw new Error(ins.error.message);
      meeting = ins.data;
    } else if (f.track_rating) await sb.from("racing_meetings").update({ track_rating: f.track_rating }).eq("id", meeting.id);
    const finished = group.some((r) => r.finish_position != null);
    const start = zonedToUtc(f.date, f.start_time, f.timezone || course.timezone || defaultTimezone(f.country));
    const raceFields = { name: f.race_name, start_time_utc: start, distance_m: f.distance_m, race_class: f.race_class, surface: f.surface, runners_count: group.filter((r) => !r.scratched).length, status: finished ? "finished" : "scheduled", provider_id: SOURCE, updated_at: new Date().toISOString() };
    let { data: race } = await sb.from("racing_races").select("id").eq("meeting_id", meeting!.id).eq("race_number", f.race_number).maybeSingle();
    if (!race) {
      const ins = await sb.from("racing_races").insert({ meeting_id: meeting!.id, race_number: f.race_number, ...raceFields }).select("id").single();
      if (ins.error) throw new Error(ins.error.message);
      race = ins.data;
    } else await sb.from("racing_races").update(raceFields).eq("id", race.id);
    racesSaved++;
    const runnerRows = group.map((r) => ({
      race_id: race!.id, horse_id: horses.get(norm(r.horse))!, jockey_id: r.jockey ? jockeys.get(norm(r.jockey)) ?? null : null, trainer_id: r.trainer ? trainers.get(norm(r.trainer)) ?? null : null,
      saddlecloth: r.saddlecloth, barrier: r.barrier, weight_kg: r.weight_kg, scratched: r.scratched,
      odds: r.odds != null ? { pre_race_win: r.odds, source: SOURCE } : {}, updated_at: new Date().toISOString(),
    }));
    const { data: savedRunners, error: re } = await sb.from("racing_runners").upsert(runnerRows, { onConflict: "race_id,horse_id" }).select("id,horse_id");
    if (re) throw new Error(re.message);
    runnersSaved += savedRunners?.length ?? 0;
    if (!finished) continue;
    const runnerOf = new Map((savedRunners ?? []).map((x) => [x.horse_id, x.id]));
    const finishers = group.filter((r) => r.finish_position != null && !r.scratched).sort((a, b) => a.finish_position! - b.finish_position!);
    const order = finishers.map((r) => runnerOf.get(horses.get(norm(r.horse))!)).filter(Boolean);
    const { data: existingResult } = await sb.from("racing_results").select("race_id").eq("race_id", race!.id).maybeSingle();
    if (!existingResult) { await sb.from("racing_results").insert({ race_id: race!.id, official_order: order, source_provider: SOURCE, verified_at: verified ? new Date().toISOString() : null }); resultsSaved++; }
    const horseIds = finishers.map((r) => horses.get(norm(r.horse))!);
    const { data: have } = await sb.from("racing_performances").select("horse_id").in("horse_id", horseIds).eq("race_date", f.date).eq("racecourse_id", course.id);
    const already = new Set((have ?? []).map((x) => x.horse_id));
    const fieldSize = group.filter((r) => !r.scratched).length;
    const perfRows = group.filter((r) => !r.scratched && !already.has(horses.get(norm(r.horse))!)).map((r) => ({
      horse_id: horses.get(norm(r.horse))!, race_date: f.date, racecourse_id: course.id, distance_m: f.distance_m, surface: f.surface, track_rating: f.track_rating, race_class: f.race_class,
      finish_position: r.finish_position, field_size: fieldSize, margin_lengths: r.margin, race_time_s: r.race_time_s, weight_kg: r.weight_kg, barrier: r.barrier,
      jockey_id: r.jockey ? jockeys.get(norm(r.jockey)) ?? null : null, trainer_id: r.trainer ? trainers.get(norm(r.trainer)) ?? null : null,
      sectionals: r.settled != null ? { settled: r.settled } : {}, source_provider: SOURCE, verified,
    }));
    if (perfRows.length) { const { error } = await sb.from("racing_performances").insert(perfRows); if (error) throw new Error(error.message); perfsSaved += perfRows.length; }
  }
  await markProvider(sb, SOURCE, true);
  await audit(sb, actor, "data_imported", { kind: "races", rows: rows.length, races: racesSaved, results: resultsSaved, performances: perfsSaved, courses_created: coursesCreated, verified });
  return { ok: true, rows: rows.length, races: racesSaved, runners: runnersSaved, results: resultsSaved, performances: perfsSaved, coursesCreated, problems: problems.slice(0, 20) };
}

export async function importForm(sb: SupabaseClient, actor: string, raw: Array<Record<string, string>>, verified: boolean) {
  const { rows, problems } = normaliseFormRows(raw);
  if (!rows.length) return { ok: false, problems, performances: 0 };
  const { map: courses, created: coursesCreated, unknown } = await courseMap(sb, rows);
  for (const u of unknown) problems.push(`New racecourse "${u}" needs a country code — those runs were saved without a course.`);
  const horses = await nameMap(sb, "racing_horses", rows.map((r) => r.horse));
  const jockeys = await nameMap(sb, "racing_jockeys", rows.map((r) => r.jockey ?? ""));
  const trainers = await nameMap(sb, "racing_trainers", rows.map((r) => r.trainer ?? ""));
  for (const r of rows.filter((x) => x.sire || x.dam).slice(0, 2000)) {
    const id = horses.get(norm(r.horse));
    if (id) await sb.from("racing_horses").update({ ...(r.sire ? { sire: r.sire } : {}), ...(r.dam ? { dam: r.dam } : {}) }).eq("id", id).is("sire", null);
  }
  const ids = [...new Set(rows.map((r) => horses.get(norm(r.horse))!))];
  const existing = new Set<string>();
  for (const c of chunk(ids, 150)) {
    const { data } = await sb.from("racing_performances").select("horse_id,race_date").in("horse_id", c).limit(20_000);
    for (const p of data ?? []) existing.add(`${p.horse_id}|${p.race_date}`);
  }
  const toSave = rows.filter((r: FormRow) => !existing.has(`${horses.get(norm(r.horse))}|${r.date}`)).map((r) => ({
    horse_id: horses.get(norm(r.horse))!, race_date: r.date, racecourse_id: r.racecourse ? courses.get(norm(r.racecourse))?.id ?? null : null,
    distance_m: r.distance_m, surface: r.surface, track_rating: r.track_rating, race_class: r.race_class, finish_position: r.finish_position, field_size: r.field_size,
    margin_lengths: r.margin, race_time_s: r.race_time_s, weight_kg: r.weight_kg, barrier: r.barrier,
    jockey_id: r.jockey ? jockeys.get(norm(r.jockey)) ?? null : null, trainer_id: r.trainer ? trainers.get(norm(r.trainer)) ?? null : null,
    sectionals: r.settled != null ? { settled: r.settled } : {}, source_provider: SOURCE, verified,
  }));
  for (const c of chunk(toSave, 500)) { const { error } = await sb.from("racing_performances").insert(c); if (error) throw new Error(error.message); }
  await markProvider(sb, SOURCE, true);
  await audit(sb, actor, "data_imported", { kind: "form", rows: rows.length, performances: toSave.length, skipped_duplicates: rows.length - toSave.length, verified });
  return { ok: true, rows: rows.length, performances: toSave.length, duplicates: rows.length - toSave.length, coursesCreated, problems: problems.slice(0, 20) };
}
