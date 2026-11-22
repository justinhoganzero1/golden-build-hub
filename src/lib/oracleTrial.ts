// Free-trial and after-trial behaviour for Oracle's chat screen.
// During the 7-day trial Oracle does everything she does for paying members,
// except creations that cost real money — for those she kindly explains it's a
// paid-plan feature. When the trial (or the member's Google key credit) runs
// out she falls back to a simple scripted helper that can still open the free pages.
// Mirrors TRIAL_PAID_CREATIONS in supabase/functions/_shared/freeTrial.ts.

export type ChatAccess = "paid" | "trial" | "none";

export const TRIAL_PAID_CREATIONS = ["MUSIC", "SFX", "VOICE", "APP"] as const;

export function readChatAccess(value: string | null | undefined): ChatAccess {
  return value === "trial" || value === "none" ? value : "paid";
}

/** True when a trial member asked for a creation that needs Plus or Pro. */
export function isTrialPaidCreation(access: ChatAccess, kind: string): boolean {
  return access === "trial" && (TRIAL_PAID_CREATIONS as readonly string[]).includes(kind.toUpperCase());
}

const PAID_NAMES: Record<string, { what: string; plan: "Plus" | "Pro"; offer: string }> = {
  MUSIC: { what: "Making real songs", plan: "Plus", offer: "I can write you the lyrics right now if you like!" },
  SFX: { what: "Sound effects", plan: "Plus", offer: "I can describe exactly how it should sound for now." },
  VOICE: { what: "Recorded narrations", plan: "Plus", offer: "I can write out every word for you to read, though." },
  APP: { what: "Building working apps", plan: "Pro", offer: "I can plan the whole app with you right now, screen by screen." },
  WEB: { what: "Live web searches", plan: "Plus", offer: "I've answered from what I know, but it might not be the very latest." },
};

export function trialPaidReply(kind: string): string {
  const p = PAID_NAMES[kind.toUpperCase()] ?? { what: "That one", plan: "Plus" as const, offer: "Ask me anything else and I'm all yours." };
  return `${p.what} is part of ${p.plan}, love — not the free trial. ${p.offer}`;
}

/** Free pages the scripted helper can still open once AI chat is off. */
const FREE_PAGES: { words: RegExp; path: string; reply: string }[] = [
  { words: /\b(crisis|suicid\w*|self[- ]?harm|kill myself|emergency|hurt myself|danger)\b/i, path: "/crisis-hub", reply: "You matter so much. I'm opening Crisis Help for you now. If you're in danger, call 000 straight away." },
  { words: /\b(safe|safety|scared|unsafe)\b/i, path: "/safety-center", reply: "Let's keep you safe. Opening the Safety Centre now." },
  { words: /\b(calendar|diary|schedule|appointment)s?\b/i, path: "/calendar", reply: "Here's your calendar, all yours for free." },
  { words: /\b(alarm|wake me|reminder)s?\b/i, path: "/alarm-clock", reply: "Opening your alarm clock now." },
  { words: /\b(library|my (files|pictures|videos|stuff)|saved)\b/i, path: "/media-library", reply: "Here's your Library with everything you've saved." },
  { words: /\b(wallet|balance|top ?up|money)\b/i, path: "/wallet", reply: "Opening your wallet now." },
  { words: /\b(upgrade|plus|pro|plan|membership|subscribe|price|pricing)\b/i, path: "/membership", reply: "Here are the plans. Plus brings my full brain back any time." },
  { words: /\b(shop|template|creator)s?\b/i, path: "/creators", reply: "Opening the Creators Shop for you." },
  { words: /\b(settings?|account|profile|google key|gemini key|api key)\b/i, path: "/settings", reply: "Opening your settings now." },
];

export type ScriptedReply = { reply: string; path?: string };
export type ScriptedReason = "trial_over" | "key_out" | "no_key";

/** Oracle's simple, free fallback replies — no AI, no cost. */
export function scriptedOracleReply(text: string, reason: ScriptedReason = "trial_over"): ScriptedReply {
  const t = text.trim();
  for (const page of FREE_PAGES) if (page.words.test(t)) return { reply: page.reply, path: page.path };
  if (/^(hi|hello|hey|g'?day|good (morning|afternoon|evening)|howdy)\b/i.test(t)) {
    return { reply: "Hello, lovely! I'm still right here. I can open your calendar, Library, alarm clock and safety pages for you." };
  }
  if (/\b(thank|thanks|ta|cheers)\b/i.test(t)) return { reply: "Anytime, love. That's what I'm here for." };
  if (reason === "no_key") {
    return { reply: "I'd love to chat properly with you! My full brain runs on your own free Google key, and I can walk you through connecting it in about two minutes. Until then I can open your calendar, Library, alarm clock and safety pages." };
  }
  return reason === "key_out"
    ? { reply: "My thinking power has run out on your Google key, so I'm keeping things simple until it has credit again. I can still open your calendar, Library and safety pages." }
    : { reply: "I'd love to chat properly with you! Your 7-day free trial has finished, and my full brain is part of Plus now. I can still open your calendar, Library, alarm clock and safety pages for free." };
}
