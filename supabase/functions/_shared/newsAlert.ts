// Oracle's live news knowledge and the one emergency rule — pure functions (tested by Vitest).
// Rule: only a REAL, CONFIRMED nuclear missile launch/strike triggers an instant alert. Tests, drills,
// threats, "nuclear-capable" launches, speculation and single-outlet reports never do.

const NUCLEAR = /\bnuclear\b|\bnuke[sd]?\b|\batomic\b/i;
const WEAPON = /\b(missiles?|icbms?|warheads?|weapons?|bombs?|strikes?|attack|rockets?)\b/i;
const ACTION = /\b(launch(?:ed|es)?|fired|fires|firing|strikes?|struck|hit|hits|detonat\w*|explod\w*|incoming|inbound|attack(?:ed|s)?|used)\b/i;
const NOT_REAL = /\b(test\w*|drills?|exercises?|simulat\w*|threat\w*|threaten\w*|warns?|warning of|could|would|may|might|capable|plans?|planned|planning|treaty|talks|deal|anniversary|film|movie|series|game|documentary|history|historic|fears?|risk\w*|if|hypothetical|rehears\w*|deterren\w*|doctrine|propos\w*|ban|sanctions?|power ?plant|reactors?|energy|aukus|submarines? deal|false alarm|hoax|denies|denied|rumou?rs?|unconfirmed|claims?|alleged|ready to|prepar\w*|readiness|scenario|war ?games?|years? ago|since|1945|hiroshima|nagasaki|cuban|cold war)\b|\?/i;

export const ALERT_WINDOW_HOURS = 3;
export const ALERT_MIN_OUTLETS = 3;

/** Headline describes an actual nuclear launch or strike happening now (not a test, threat or speculation). */
export function isNuclearLaunchHeadline(title: string): boolean {
  const t = String(title ?? "");
  return NUCLEAR.test(t) && WEAPON.test(t) && ACTION.test(t) && !NOT_REAL.test(t);
}

export interface AlertItem { title: string; url: string; publisher: string; official: boolean; at: string }
export interface NuclearAlert { headline: string; sources: Array<{ publisher: string; title: string; url: string }> }

/**
 * Confirmed only when at least three different outlets (or two, one of them an official government/UN
 * source) report it within the last three hours. One outlet alone is never enough.
 */
export function confirmedNuclearAlert(items: AlertItem[], now = Date.now()): NuclearAlert | null {
  const recent = items.filter((i) => isNuclearLaunchHeadline(i.title) && now - new Date(i.at).getTime() <= ALERT_WINDOW_HOURS * 3600_000 && now - new Date(i.at).getTime() >= -600_000);
  const byPublisher = new Map<string, AlertItem>();
  for (const i of recent.sort((a, b) => a.at.localeCompare(b.at))) if (!byPublisher.has(i.publisher)) byPublisher.set(i.publisher, i);
  const outlets = [...byPublisher.values()];
  const official = outlets.some((o) => o.official);
  if (outlets.length < ALERT_MIN_OUTLETS && !(official && outlets.length >= 2)) return null;
  return { headline: outlets[0].title, sources: outlets.slice(0, 6).map((o) => ({ publisher: o.publisher, title: o.title, url: o.url })) };
}

export interface BriefStory { headline: string; verification: string; source_count: number; is_breaking?: boolean | null; last_updated: string; summary?: string | null }

const LABEL: Record<string, string> = { corroborated: "confirmed by several outlets", single_source: "one outlet so far", developing: "developing", conflicting: "conflicting reports" };

/** Short, plain briefing of the latest stories for Oracle's private knowledge (she only mentions it when asked). */
export function newsBriefing(stories: BriefStory[], now = new Date()): string {
  const usable = stories.filter((s) => s.headline && s.verification !== "unverified" && s.verification !== "corrected_or_withdrawn").slice(0, 12);
  if (!usable.length) return "";
  const lines = usable.map((s) => {
    const sum = s.summary ? ` — ${String(s.summary).replace(/\s+/g, " ").slice(0, 170)}` : "";
    return `- ${s.is_breaking ? "BREAKING: " : ""}${s.headline.replace(/\s+/g, " ").slice(0, 180)} (${LABEL[s.verification] ?? s.verification}, ${s.source_count} outlet${s.source_count === 1 ? "" : "s"})${sum}`;
  });
  return `LATEST NEWS (from the Oracle News desk, checked ${now.toISOString().slice(0, 16).replace("T", " ")} UTC):\n${lines.join("\n")}`;
}
