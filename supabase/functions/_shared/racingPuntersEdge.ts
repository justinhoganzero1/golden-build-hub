// Pure helpers for the PuntersEdge racing feed (tested in src/lib).

/** "2:55PM" → "14:55". */
export function localClock(v?: string | null): string | null {
  const m = String(v ?? "").trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const ap = m[3]?.toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

const ALIASES: Record<string, string> = { randwick: "Royal Randwick", rosehill: "Rosehill Gardens", ascot: "Ascot (Perth)", "the valley": "Moonee Valley" };
export const canonicalVenue = (v: string) => ALIASES[v.trim().toLowerCase()] ?? v.trim().replace(/\b\w/g, (c) => c.toUpperCase());

/** Offset (minutes east of UTC) a zone has at a moment. */
export function zoneOffsetMinutes(tz: string, at: Date): number {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(at);
  const g = (k: string) => Number(p.find((x) => x.type === k)?.value);
  return Math.round((Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")) - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000);
}

/** Pick an Australian timezone from a race's UTC start and its local clock time. */
export function australianZoneFor(startUtc: string, localHHMM: string): string | null {
  const at = new Date(startUtc);
  const [h, m] = localHHMM.split(":").map(Number);
  let off = h * 60 + m - (at.getUTCHours() * 60 + at.getUTCMinutes());
  if (off < -720) off += 1440; if (off > 840) off -= 1440;
  for (const tz of ["Australia/Sydney", "Australia/Brisbane", "Australia/Adelaide", "Australia/Darwin", "Australia/Perth"]) if (zoneOffsetMinutes(tz, at) === off) return tz;
  return null;
}

export interface BookPrice { key: string; win_price?: number | null; stale?: boolean }
/** Best and median fresh win price across bookmakers (stale quotes ignored). */
export function summarisePrices(books: BookPrice[] | null | undefined): { best: number | null; bestBook: string | null; median: number | null; books: number } {
  const fresh = (books ?? []).filter((b) => !b.stale && Number(b.win_price) > 1).map((b) => ({ key: b.key, p: Number(b.win_price) }));
  if (!fresh.length) return { best: null, bestBook: null, median: null, books: 0 };
  const sorted = [...fresh].sort((a, b) => a.p - b.p);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid].p : (sorted[mid - 1].p + sorted[mid].p) / 2;
  const top = sorted[sorted.length - 1];
  return { best: top.p, bestBook: top.key, median: Math.round(median * 100) / 100, books: fresh.length };
}
