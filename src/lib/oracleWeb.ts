export type WebSource = { url: string; title?: string; description?: string; image?: string };

/** Turns a research answer into picture-rich markdown with numbered, clickable sources. */
export function formatWebAnswer(answer: string, sources: WebSource[]) {
  const safe = sources.filter(s => /^https:\/\//.test(s.url || ""));
  const hero = safe.find(s => s.image && /^https:\/\//.test(s.image));
  const parts: string[] = [];
  if (hero) parts.push(`![${(hero.title || "Web picture").replace(/[[\]]/g, "")}](${hero.image})`);
  parts.push(answer.trim());
  if (safe.length) {
    parts.push("**Sources**\n" + safe.map((s, i) => `${i + 1}. [${(s.title || new URL(s.url).hostname).replace(/[[\]]/g, "")}](${s.url})`).join("\n"));
  } else {
    parts.push("_No live sources came back — treat this answer as unverified._");
  }
  return parts.join("\n\n");
}
