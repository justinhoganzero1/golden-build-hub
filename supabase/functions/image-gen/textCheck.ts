// Pure helpers for making sure words drawn inside generated pictures are
// spelled and written correctly. No imports so the app's tests can load it.

/** True when the request clearly wants written words inside the picture. */
export function wantsTextInImage(prompt: string): boolean {
  if (/\b(no text|no words|no letters|without (any )?(text|words|writing))\b/i.test(prompt)) return false;
  if (/["“”][^"“”]{1,120}["“”]/.test(prompt)) return true;
  return /\b(saying|says|that reads|reading|with the (words?|text|title|name|caption|slogan|tagline|heading)|caption(ed)?|headline|slogan|tagline|lettering|typography|title text|written on|writing on|words on|text on|sign that|banner that|label that|logo (with|for|that says)|book cover|poster (with|for|that says)|birthday card|greeting card|menu|flyer|meme)\b/i.test(prompt);
}

/** Pulls the first JSON object out of a model reply. */
export function parseJsonLoose<T = any>(raw: string): T | null {
  const m = String(raw || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]) as T; } catch { return null; }
}

/** Cleans the model's list of exact words to draw. */
export function cleanTexts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter((t) => t.length > 0 && t.length <= 200)
    .slice(0, 6);
}

/** Prompt instruction that pins the exact, corrected wording. */
export function exactTextInstruction(texts: string[]): string {
  const list = texts.map((t) => `"${t}"`).join(", ");
  return ` — TEXT IN IMAGE: the only words shown must be exactly ${list}, spelled correctly letter for letter with correct grammar and punctuation, in clear, sharp, legible lettering. Do not add, drop, swap or invent any letters or extra words.`;
}

const norm = (s: string) => s.toLowerCase().replace(/[“”"'‘’`]/g, "").replace(/[^a-z0-9]+/gi, " ").trim();

/** Every expected phrase appears in what was read back from the picture. */
export function textsMatch(expected: string[], found: string[]): boolean {
  if (!expected.length) return true;
  const seen = norm(found.join(" "));
  return expected.every((t) => seen.includes(norm(t)));
}
