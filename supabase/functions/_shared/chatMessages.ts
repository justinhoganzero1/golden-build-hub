// Normalizes caller-supplied chat history before it reaches a model.
// Only "user" and "assistant" turns are accepted; system instructions stay server-owned.
type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export type SafeMessage = { role: "user" | "assistant"; content: string | Part[] };

export function sanitizeMessages(raw: unknown, maxMessages = 40, maxChars = 12000): SafeMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: SafeMessage[] = [];
  for (const m of raw.slice(-maxMessages)) {
    if (!m || typeof m !== "object") continue;
    const role = (m as { role?: unknown }).role;
    if (role !== "user" && role !== "assistant") continue;
    const content = (m as { content?: unknown }).content;
    if (typeof content === "string") {
      if (content.trim()) out.push({ role, content: content.slice(0, maxChars) });
    } else if (Array.isArray(content) && role === "user") {
      const parts: Part[] = [];
      for (const p of content.slice(0, 8)) {
        if (p?.type === "text" && typeof p.text === "string") parts.push({ type: "text", text: p.text.slice(0, maxChars) });
        else if (p?.type === "image_url" && typeof p.image_url?.url === "string" && /^(https:|data:image\/)/.test(p.image_url.url)) parts.push({ type: "image_url", image_url: { url: p.image_url.url } });
      }
      if (parts.length) out.push({ role, content: parts });
    }
  }
  return out;
}

/** Plain, single-line text safe to quote inside a prompt as data. */
export function promptData(value: unknown, max = 300): string {
  return String(value ?? "").replace(/[\r\n\t]+/g, " ").replace(/["`]/g, "'").slice(0, max).trim();
}
