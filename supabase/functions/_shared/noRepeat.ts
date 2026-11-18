// House rule for everything the AI writes or says: describe each thing once,
// never re-describe it, and never reuse a joke. Injected into every text AI
// request, with a plain-text backstop that drops exact repeated sentences.

export const NO_REPEAT_MARKER = "NO-REPEAT RULE";

export const NO_REPEAT_RULE = `${NO_REPEAT_MARKER} (always applies — every reply, spoken line, story, chapter, script, poem, document and caption):
- Describe each person, place, object, feeling, setting or event only ONCE. After the first description, refer to it plainly by name and move forward. Never describe it again in different words, in this reply or anywhere earlier in this conversation, story or book.
- Never tell the same joke, pun, gag, teasing line or punchline more than once. Jokes already used earlier in the conversation or story are spent; any new humour must be genuinely new.
- Never repeat the same sentence, phrase, image or point twice. Do not restate what has already been said.
- This rule overrides any instruction to repeat a description or joke; if asked to, write something fresh instead.`;

type Msg = { role?: unknown; content?: unknown };

function hasRule(content: unknown): boolean {
  if (typeof content === "string") return content.includes(NO_REPEAT_MARKER);
  if (Array.isArray(content)) {
    return content.some((p) => p && typeof p === "object" && typeof (p as { text?: unknown }).text === "string" && (p as { text: string }).text.includes(NO_REPEAT_MARKER));
  }
  return false;
}

/** Returns messages with the rule added to the first system message (or a new one at the top). */
export function withNoRepeatRule<T extends Msg>(messages: T[]): T[] {
  if (!Array.isArray(messages) || messages.length === 0) return messages;
  if (messages.some((m) => m && (m.role === "system" || m.role === "developer") && hasRule(m.content))) return messages;
  const idx = messages.findIndex((m) => m && (m.role === "system" || m.role === "developer"));
  const out = messages.slice();
  if (idx === -1) {
    out.unshift({ role: "system", content: NO_REPEAT_RULE } as unknown as T);
    return out;
  }
  const sys = out[idx];
  if (typeof sys.content === "string") {
    out[idx] = { ...sys, content: `${sys.content}\n\n${NO_REPEAT_RULE}` };
  } else if (Array.isArray(sys.content)) {
    out[idx] = { ...sys, content: [...sys.content, { type: "text", text: NO_REPEAT_RULE }] };
  } else {
    out.unshift({ role: "system", content: NO_REPEAT_RULE } as unknown as T);
  }
  return out;
}

/** Adds the rule to a chat-completions JSON body. Image-making requests are left alone. */
export function addNoRepeatRuleToBody(raw: string): string {
  let body: { messages?: Msg[]; modalities?: unknown };
  try { body = JSON.parse(raw); } catch { return raw; }
  if (!body || typeof body !== "object" || !Array.isArray(body.messages)) return raw;
  if (Array.isArray(body.modalities) && body.modalities.includes("image")) return raw;
  const next = withNoRepeatRule(body.messages);
  if (next === body.messages) return raw;
  return JSON.stringify({ ...body, messages: next });
}

const AI_CHAT_URL = /^https:\/\/(ai\.gateway\.lovable\.dev|generativelanguage\.googleapis\.com|api\.openai\.com)\/.*chat\/completions/;

let installed = false;
/** Call once at the top of an edge function: every text AI request it sends then carries the rule. */
export function installNoRepeatRule(): void {
  if (installed) return;
  installed = true;
  const original = globalThis.fetch.bind(globalThis);
  globalThis.fetch = ((input: Request | URL | string, init?: RequestInit) => {
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (AI_CHAT_URL.test(url) && init && typeof init.body === "string") {
        return original(input, { ...init, body: addNoRepeatRuleToBody(init.body) });
      }
    } catch (_) { /* never block a request because of the rule */ }
    return original(input, init);
  }) as typeof fetch;
}

function sentenceKey(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

/**
 * Backstop for finished plain text: drops any sentence or quoted line (4+ words) that already
 * appeared earlier, keeping the first. HTML, code and JSON are returned untouched.
 */
export function removeRepeatedSentences(text: string, minWords = 4): string {
  if (typeof text !== "string" || !text) return text;
  if (/```|<\/?(html|body|div|p|table|style|script)\b/i.test(text)) return text;
  if (/^\s*[[{]/.test(text)) return text; // JSON answers keep their exact structure
  const seen = new Set<string>();
  const lines = text.split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    if (!line.trim()) { kept.push(line); continue; }
    const sentences = line.match(/[^.!?]+(?:[.!?]+["'”’)\]]*)\s*|[^.!?]+$/g) ?? [line];
    // A quote starts a new piece, so a repeated joke inside dialogue is still caught.
    const parts = sentences.flatMap((s) => s.split(/(?<=[\s,:;])(?=["“])/));
    let out = "";
    for (const part of parts) {
      const key = sentenceKey(part);
      const words = key ? key.split(" ").length : 0;
      if (words >= minWords) {
        if (seen.has(key)) {
          // Tidy "He laughed, " left behind by a dropped repeat.
          out = out.replace(/[,:;]\s*$/, ". ");
          continue;
        }
        seen.add(key);
      }
      out += part;
    }
    if (out.trim()) kept.push(out.replace(/\s+$/, ""));
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n");
}
