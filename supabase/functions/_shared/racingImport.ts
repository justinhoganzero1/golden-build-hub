// Oracle Racing — spreadsheet (CSV) import helpers. Pure functions shared by
// the upload screen (parsing/preview) and the controller (saving). Only data
// the owner is allowed to use should be imported; nothing here invents values.

export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

export const RACE_COLUMNS = ["date", "racecourse", "country", "race_number", "race_name", "start_time", "timezone", "distance_m", "surface", "track_rating", "race_class", "horse", "saddlecloth", "barrier", "weight_kg", "jockey", "trainer", "sire", "dam", "odds", "finish_position", "margin", "race_time_s", "settled", "scratched", "parade_time", "code"] as const;
export const FORM_COLUMNS = ["horse", "date", "racecourse", "country", "distance_m", "surface", "track_rating", "race_class", "finish_position", "field_size", "margin", "race_time_s", "weight_kg", "barrier", "jockey", "trainer", "settled", "sire", "dam"] as const;

export const BROADCAST_COLUMNS = ["date", "racecourse", "country", "network", "channel", "platform", "broadcast_start", "timezone", "status", "races", "code", "source_url"] as const;

export function templateCsv(kind: "races" | "form" | "broadcast"): string {
  if (kind === "broadcast") return BROADCAST_COLUMNS.join(",") + "\n2026-11-21,Flemington,AU,Seven Network,7two,7plus,12:00,Australia/Melbourne,scheduled,3-9,thoroughbred,https://example.com/official-tv-guide\n";
  if (kind === "form") return FORM_COLUMNS.join(",") + "\nExample Horse,2025-10-18,Caulfield,AU,2400,turf,Good 4,Group 1,1,18,0,148.9,54,8,Jamie Melham,Tony & C McEvoy,3,Example Sire,Example Dam\n";
  return RACE_COLUMNS.join(",") + "\n2025-11-04,Flemington,AU,7,Melbourne Cup,15:00,Australia/Melbourne,3200,turf,Soft 5,Group 1,Half Yours,14,8,53,Jamie Melham,Tony & C McEvoy,,,7.5,1,0,202.46,6,,,thoroughbred\n";
}

const num = (v?: string) => { if (v == null || v === "") return null; const n = Number(String(v).replace(/[$,\s]/g, "").replace(/kg$|m$|L$/i, "")); return Number.isFinite(n) ? n : null; };
const int = (v?: string) => { const n = num(v); return n == null ? null : Math.round(n); };

/** Accepts 2025-11-04, 4/11/2025 (day first) or 04-11-2025. */
export function normaliseDate(v?: string): string | null {
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
  return null;
}

/** Finish codes: numbers are positions; DNF/FF/PU/scratched etc. become null. */
export function normaliseFinish(v?: string): number | null {
  const s = String(v ?? "").trim().toLowerCase().replace(/(st|nd|rd|th)$/, "").replace(/^=/, "");
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= 40 ? n : null;
}

const COUNTRY_TZ: Record<string, string> = { AU: "Australia/Sydney", NZ: "Pacific/Auckland", GB: "Europe/London", UK: "Europe/London", IE: "Europe/Dublin", US: "America/New_York", CA: "America/Toronto", JP: "Asia/Tokyo", HK: "Asia/Hong_Kong", SG: "Asia/Singapore", FR: "Europe/Paris", DE: "Europe/Berlin", ZA: "Africa/Johannesburg", AE: "Asia/Dubai" };
export const countryCode = (v?: string) => { const c = String(v ?? "").trim().toUpperCase(); return c === "UK" ? "GB" : c.slice(0, 2) || null; };
export const defaultTimezone = (country?: string | null) => COUNTRY_TZ[String(country ?? "").toUpperCase()] ?? "UTC";

/** Local race date + time in a timezone → exact UTC moment (handles daylight saving). */
export function zonedToUtc(date: string, time: string | null | undefined, timeZone: string): string {
  const [h, mi] = String(time || "12:00").split(":").map((x) => Number(x) || 0);
  const guess = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), h, mi);
  const offsetAt = (t: number) => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(t));
    const g = (k: string) => Number(parts.find((p) => p.type === k)?.value);
    return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")) - t;
  };
  let t = guess - offsetAt(guess);
  t = guess - offsetAt(t);
  return new Date(t).toISOString();
}

export interface RaceRow {
  date: string; racecourse: string; country: string | null; race_number: number; race_name: string | null;
  start_time: string | null; timezone: string | null; distance_m: number | null; surface: string | null; track_rating: string | null; race_class: string | null;
  horse: string; saddlecloth: number | null; barrier: number | null; weight_kg: number | null; jockey: string | null; trainer: string | null;
  sire: string | null; dam: string | null; odds: number | null; finish_position: number | null; margin: number | null; race_time_s: number | null; settled: number | null; scratched: boolean;
  parade_time: string | null;
}
export interface FormRow {
  horse: string; date: string; racecourse: string | null; country: string | null; distance_m: number | null; surface: string | null; track_rating: string | null; race_class: string | null;
  finish_position: number | null; field_size: number | null; margin: number | null; race_time_s: number | null; weight_kg: number | null; barrier: number | null;
  jockey: string | null; trainer: string | null; settled: number | null; sire: string | null; dam: string | null;
}

const text = (v?: string, max = 120) => { const s = String(v ?? "").trim(); return s ? s.slice(0, max) : null; };

export function normaliseRaceRows(raw: Array<Record<string, string>>): { rows: RaceRow[]; problems: string[] } {
  const rows: RaceRow[] = [], problems: string[] = [];
  raw.forEach((r, i) => {
    const date = normaliseDate(r.date), horse = text(r.horse ?? r.horse_name, 80), course = text(r.racecourse ?? r.track ?? r.venue, 80), rn = int(r.race_number ?? r.race);
    if (!date || !horse || !course || rn == null) { problems.push(`Row ${i + 2}: needs date, racecourse, race_number and horse.`); return; }
    if (!isThoroughbredCode(r.code ?? r.race_code)) { problems.push(`Row ${i + 2}: only thoroughbred racing is accepted (got "${r.code ?? r.race_code}").`); return; }
    const scratched = /^(y|yes|true|1|scr|scratched)$/i.test(String(r.scratched ?? "")) || /^scr/i.test(String(r.finish_position ?? ""));
    rows.push({
      date, racecourse: course, country: countryCode(r.country), race_number: rn, race_name: text(r.race_name, 120),
      start_time: /^\d{1,2}:\d{2}/.test(r.start_time ?? "") ? r.start_time!.slice(0, 5) : null, timezone: text(r.timezone, 60),
      distance_m: int(r.distance_m ?? r.distance), surface: text(r.surface, 30), track_rating: text(r.track_rating ?? r.track_condition, 30), race_class: text(r.race_class ?? r.class, 60),
      horse, saddlecloth: int(r.saddlecloth ?? r.number), barrier: int(r.barrier ?? r.draw), weight_kg: num(r.weight_kg ?? r.weight),
      jockey: text(r.jockey, 80), trainer: text(r.trainer, 80), sire: text(r.sire, 80), dam: text(r.dam, 80),
      odds: num(r.odds ?? r.price ?? r.sp), finish_position: scratched ? null : normaliseFinish(r.finish_position ?? r.finish ?? r.place),
      margin: num(r.margin), race_time_s: num(r.race_time_s ?? r.time), settled: int(r.settled), scratched,
      parade_time: /^\d{1,2}:\d{2}/.test(r.parade_time ?? "") ? r.parade_time!.slice(0, 5) : null,
    });
  });
  return { rows, problems };
}

export function normaliseFormRows(raw: Array<Record<string, string>>): { rows: FormRow[]; problems: string[] } {
  const rows: FormRow[] = [], problems: string[] = [];
  raw.forEach((r, i) => {
    const date = normaliseDate(r.date), horse = text(r.horse ?? r.horse_name, 80);
    if (!date || !horse) { problems.push(`Row ${i + 2}: needs horse and date.`); return; }
    rows.push({
      horse, date, racecourse: text(r.racecourse ?? r.track ?? r.venue, 80), country: countryCode(r.country), distance_m: int(r.distance_m ?? r.distance),
      surface: text(r.surface, 30), track_rating: text(r.track_rating ?? r.track_condition, 30), race_class: text(r.race_class ?? r.class, 60),
      finish_position: normaliseFinish(r.finish_position ?? r.finish ?? r.place), field_size: int(r.field_size ?? r.runners), margin: num(r.margin),
      race_time_s: num(r.race_time_s ?? r.time), weight_kg: num(r.weight_kg ?? r.weight), barrier: int(r.barrier ?? r.draw),
      jockey: text(r.jockey, 80), trainer: text(r.trainer, 80), settled: int(r.settled), sire: text(r.sire, 80), dam: text(r.dam, 80),
    });
  });
  return { rows, problems };
}

export const raceKey = (r: Pick<RaceRow, "date" | "racecourse" | "race_number">) => `${r.date}|${r.racecourse.toLowerCase()}|${r.race_number}`;

const isThoroughbredCode = (code?: string) => { const c = String(code ?? "").trim().toLowerCase(); return !c || /^(thoroughbred|gallops?|horse racing|tb|flat|jumps?)$/.test(c); };

export interface BroadcastRow {
  date: string; racecourse: string; country: string | null; network: string; channel: string; platform: string | null;
  broadcast_start: string | null; timezone: string | null; status: string; races: string; source_url: string | null;
}

/** Broadcast schedule rows. Non-thoroughbred coverage is refused. */
export function normaliseBroadcastRows(raw: Array<Record<string, string>>): { rows: BroadcastRow[]; problems: string[] } {
  const rows: BroadcastRow[] = [], problems: string[] = [];
  raw.forEach((r, i) => {
    const date = normaliseDate(r.date), course = text(r.racecourse ?? r.venue ?? r.track, 80), channel = text(r.channel, 60);
    if (!date || !course || !channel) { problems.push(`Row ${i + 2}: needs date, racecourse and channel.`); return; }
    if (!isThoroughbredCode(r.code ?? r.race_code)) { problems.push(`Row ${i + 2}: only thoroughbred racing is included (got "${r.code ?? r.race_code}").`); return; }
    const url = text(r.source_url ?? r.source, 300);
    rows.push({
      date, racecourse: course, country: countryCode(r.country) ?? "AU", network: text(r.network, 60) ?? "Seven Network", channel,
      platform: text(r.platform, 60), broadcast_start: /^\d{1,2}:\d{2}/.test(r.broadcast_start ?? r.start ?? "") ? String(r.broadcast_start ?? r.start).slice(0, 5) : null,
      timezone: text(r.timezone, 60), status: String(r.status ?? "").trim(), races: String(r.races ?? r.race_numbers ?? "").trim(),
      source_url: url && /^https:\/\//i.test(url) ? url : null,
    });
  });
  return { rows, problems };
}
