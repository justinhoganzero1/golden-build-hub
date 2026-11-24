// Owner's Oracle chat brain order: his own OpenAI key first, then his own Google
// Gemini key, and the platform AI credits only after both keys have failed.
// Members never use this chain (their chat stays on their own Gemini key).

export type ChatProvider = "openai" | "gemini" | "lovable";
export type ChainStep = { provider: ChatProvider; url: string; key: string; model: string };

export const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
export const GEMINI_OPENAI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
export const LOVABLE_CHAT_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
/** Widely available, picture-capable OpenAI models (everyday / deeper questions). */
export const OWNER_OPENAI_MODELS = { fast: "gpt-4o-mini", smart: "gpt-4.1-mini" } as const;
/** Google's always-current aliases. */
export const OWNER_GEMINI_MODELS = { fast: "gemini-flash-lite-latest", smart: "gemini-flash-latest" } as const;

const usable = (k: unknown): k is string => typeof k === "string" && k.trim().length > 10;

/** Builds the try-in-order list, skipping keys that aren't saved. Platform credits are always last. */
export function ownerChatChain(
  keys: { openai?: string | null; gemini?: string | null; lovable?: string | null },
  opts: { deep: boolean; lovableModel: string },
): ChainStep[] {
  const steps: ChainStep[] = [];
  if (usable(keys.openai)) steps.push({ provider: "openai", url: OPENAI_CHAT_URL, key: keys.openai.trim(), model: opts.deep ? OWNER_OPENAI_MODELS.smart : OWNER_OPENAI_MODELS.fast });
  if (usable(keys.gemini)) steps.push({ provider: "gemini", url: GEMINI_OPENAI_URL, key: keys.gemini.trim(), model: opts.deep ? OWNER_GEMINI_MODELS.smart : OWNER_GEMINI_MODELS.fast });
  if (usable(keys.lovable)) steps.push({ provider: "lovable", url: LOVABLE_CHAT_URL, key: keys.lovable.trim(), model: opts.lovableModel });
  return steps;
}

export type ChainResult =
  | { ok: true; provider: ChatProvider; response: Response; failures: { provider: ChatProvider; status: number }[] }
  | { ok: false; lastResponse: Response | null; failures: { provider: ChatProvider; status: number }[] };

/**
 * Tries each step until one answers. A step "fails" on a network error, a timeout
 * before the reply starts, or any non-OK status (no credit, bad key, rate limit, outage).
 */
export async function runChatChain(
  steps: ChainStep[],
  bodyFor: (step: ChainStep) => Record<string, unknown>,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<ChainResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  const failures: { provider: ChatProvider; status: number }[] = [];
  let lastResponse: Response | null = null;
  for (const step of steps) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 20_000);
    try {
      const resp = await doFetch(step.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${step.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(bodyFor(step)),
        signal: ctl.signal,
      });
      clearTimeout(timer);
      if (resp.ok) return { ok: true, provider: step.provider, response: resp, failures };
      failures.push({ provider: step.provider, status: resp.status });
      if (step === steps[steps.length - 1]) lastResponse = resp;
      else await resp.body?.cancel().catch(() => {});
    } catch (_) {
      clearTimeout(timer);
      failures.push({ provider: step.provider, status: 0 });
    }
  }
  return { ok: false, lastResponse, failures };
}
