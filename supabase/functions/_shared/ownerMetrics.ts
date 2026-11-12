// Pure helpers for owner-dashboard figures. No Deno/Node imports so the
// browser test suite can verify the same rules the server uses.

/** Only live-mode Stripe subscriptions are real money; sandbox is test money. */
export function isRealMoneyEnvironment(environment: string | null | undefined): boolean {
  return String(environment ?? "").trim().toLowerCase() === "live";
}

export interface PaidSubLike { status: string | null; environment: string | null }

/** Paid members = active/trialing LIVE subscriptions + founder seats. */
export function countPaidMembers(subs: PaidSubLike[], founderSeats: number) {
  let real = 0;
  let test = 0;
  for (const s of subs) {
    if (!["active", "trialing"].includes(String(s.status ?? ""))) continue;
    if (isRealMoneyEnvironment(s.environment)) real += 1; else test += 1;
  }
  return { real: real + Math.max(0, founderSeats), test };
}

/** Same source rule as the Sources tab: utm_source, else referrer host, else direct. */
export function trafficSource(utmSource: string | null | undefined, referrer: string | null | undefined): string {
  const utm = String(utmSource ?? "").trim().toLowerCase();
  if (utm) return utm;
  if (referrer) {
    try { return new URL(referrer).hostname.replace(/^www\./, "").toLowerCase(); } catch { /* ignore */ }
  }
  return "direct";
}

export function deviceFromUserAgent(ua: string | null | undefined): string {
  const s = String(ua ?? "");
  if (!s) return "Unknown";
  if (/bot|crawl|spider|slurp|preview|headless/i.test(s)) return "Bot / crawler";
  if (/iPad/i.test(s)) return "iPad";
  if (/iPhone|iPod/i.test(s)) return "iPhone";
  if (/Android/i.test(s)) return "Android";
  if (/Windows/i.test(s)) return "Windows computer";
  if (/Macintosh|Mac OS X/i.test(s)) return "Mac";
  if (/Linux|CrOS/i.test(s)) return "Linux / Chromebook";
  return "Other";
}

export function planLabel(priceId: string | null | undefined): string {
  const p = String(priceId ?? "").toLowerCase();
  if (!p) return "Unknown plan";
  const tier = p.includes("pro") ? "Pro" : p.includes("plus") ? "Plus" : priceId!;
  const interval = p.includes("year") ? "yearly" : p.includes("month") ? "monthly" : "";
  return interval ? `${tier} ${interval}` : String(tier);
}
