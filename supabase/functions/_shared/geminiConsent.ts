// Member's own Google Gemini key: the exact words Oracle shows during setup.
// One copy only — the setup page imports this file and the server stores these
// exact words with every consent, so the legal record always matches the screen.
// Change CONSENT_VERSION whenever any wording changes, so members agree again.

export const CONSENT_VERSION = "gemini-2026-11-16";
export const GEMINI_KEY_PAGE = "https://aistudio.google.com/apikey";
export const GEMINI_TERMS_PAGE = "https://ai.google.dev/gemini-api/terms";

export type ConsentStep = {
  id: string;
  /** What Oracle says before asking. */
  oracleSays: string;
  /** The exact statement the member agrees to (stored word for word). */
  notice: string;
};

export const CONSENT_STEPS: ConsentStep[] = [
  {
    id: "use_own_key",
    oracleSays:
      "Hi! Before we chat, let's connect your own Google Gemini key. Oracle Lunar's AI runs on your Google account, so Google handles your AI use directly.",
    notice:
      "I agree that Oracle Lunar will send my AI requests (my messages, pictures and files I share with Oracle) to Google using my own Google Gemini key.",
  },
  {
    id: "google_data_use",
    oracleSays:
      "This part is important. With a free Google key, Google may read and keep what you send and what comes back, and use it to improve its products. Please don't share anything private you wouldn't want Google to see.",
    notice:
      "I understand that with a free Google key, Google may use what I send and the replies to improve its products, and that Google's privacy policy applies to that data. If I live in Europe, the UK or Switzerland, I must use a paid Google key.",
  },
  {
    id: "age_and_google_terms",
    oracleSays:
      "Google only allows people 18 and over to use Gemini keys, and you'll need to accept Google's own Gemini terms when you make your key.",
    notice:
      "I confirm I am 18 or older and I agree to follow Google's Gemini API terms for my own key.",
  },
  {
    id: "costs_and_failures",
    oracleSays:
      "Last one. Your Google account covers any Google charges. Your Oracle Lunar plan is separate. If your key ever stops working, I'll pause and ask you to fix it. I'll never charge your wallet instead without asking.",
    notice:
      "I understand that any Google charges for my key are between me and Google, my Oracle Lunar plan is still needed for AI features, and if my key stops working AI will pause until I fix it.",
  },
];

export const REQUIRED_STEP_IDS = CONSENT_STEPS.map((s) => s.id);

export function consentStep(id: string): ConsentStep | undefined {
  return CONSENT_STEPS.find((s) => s.id === id);
}

/** A spoken answer counts as agreement only when it clearly says yes and doesn't say no. */
export function isVoiceYes(words: string): boolean {
  const t = ` ${String(words || "").toLowerCase().replace(/[^a-z' ]+/g, " ").replace(/\s+/g, " ")} `;
  if (/ (no|nope|nah|don't|dont|do not|not|never|disagree|stop|cancel) /.test(t)) return false;
  return / (yes|yeah|yep|yup|i agree|agree|agreed|i do|i understand|i confirm|confirm|okay|ok|sure|correct) /.test(t);
}

/** Google AI Studio keys start with "AIza" followed by about 35 letters, digits, - or _. */
export function looksLikeGeminiKey(key: string): boolean {
  return /^AIza[0-9A-Za-z_-]{30,60}$/.test(String(key || "").trim());
}

export type GeminiKeyProblem = "invalid" | "quota" | "region" | "unavailable";

/** Turns a Google error reply into a plain reason the member can act on. */
export function geminiProblemFrom(status: number, body: string): GeminiKeyProblem {
  const b = String(body || "").toLowerCase();
  if (b.includes("location is not supported") || b.includes("user location") || b.includes("failed_precondition")) return "region";
  if (status === 429 || b.includes("resource_exhausted") || b.includes("quota")) return "quota";
  if (status === 400 && (b.includes("api key not valid") || b.includes("valid api key") || b.includes("api_key_invalid") || b.includes("api key expired"))) return "invalid";
  if (status === 401 || status === 403) return "invalid";
  return "unavailable";
}

export const GEMINI_PROBLEM_MESSAGES: Record<GeminiKeyProblem, string> = {
  invalid: "Google says your Gemini key isn't valid any more. Let's add a new one.",
  quota: "Your Google key has used up its free allowance for now. Wait a little, or turn on billing in your Google account, then try again.",
  region: "Google's free keys don't work where you are. You'll need a paid Google key.",
  unavailable: "Google's AI isn't answering right now. Please try again in a minute.",
};
