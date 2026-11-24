// Reads ChatGPT and Google Gemini history exports into plain conversations that
// Oracle can search. Pure functions (no browser APIs) so they can be tested.

export type ImportSource = "chatgpt" | "gemini";
export type ImportedMessage = { role: "user" | "assistant"; content: string; sentAt: string | null };
export type ImportedConversation = { id: string; title: string | null; messages: ImportedMessage[] };
export type ImportRow = {
  user_id: string; source: ImportSource; conversation_id: string; conversation_title: string | null;
  msg_index: number; role: "user" | "assistant"; content: string; sent_at: string | null;
};

export const MAX_MESSAGE_CHARS = 12000;
export const MAX_MESSAGES_PER_IMPORT = 100_000;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

/** HTML → readable plain text (line breaks kept, tags removed). */
export function htmlToText(html: string): string {
  return String(html ?? "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|pre|blockquote)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+\d*);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const toIso = (secondsOrText: unknown): string | null => {
  if (typeof secondsOrText === "number" && Number.isFinite(secondsOrText) && secondsOrText > 0) {
    return new Date(secondsOrText * 1000).toISOString();
  }
  if (typeof secondsOrText === "string" && secondsOrText.trim()) {
    const cleaned = secondsOrText.replace(/[\u00a0\u202f]/g, " ").replace(/\s+[A-Z]{2,5}$/, "").trim();
    const t = Date.parse(cleaned);
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
  }
  return null;
};

// deno-lint-ignore no-explicit-any
type Any = any;

function chatgptText(message: Any): string {
  const content = message?.content;
  if (!content) return "";
  const kind = content.content_type;
  if (kind && kind !== "text" && kind !== "multimodal_text") return "";
  const parts: unknown[] = Array.isArray(content.parts) ? content.parts : [];
  return parts
    .map((p) => (typeof p === "string" ? p : p && typeof (p as Any).text === "string" ? (p as Any).text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

/** ChatGPT "Export data" → conversations.json (follows the branch the user last saw). */
export function parseChatGPTExport(data: unknown): ImportedConversation[] {
  const list: Any[] = Array.isArray(data) ? data : Array.isArray((data as Any)?.conversations) ? (data as Any).conversations : [];
  const out: ImportedConversation[] = [];
  list.forEach((conv, i) => {
    const mapping: Record<string, Any> = conv?.mapping && typeof conv.mapping === "object" ? conv.mapping : {};
    let nodeIds: string[] = [];
    if (conv?.current_node && mapping[conv.current_node]) {
      const seen = new Set<string>();
      let node: string | null = conv.current_node;
      while (node && mapping[node] && !seen.has(node)) { seen.add(node); nodeIds.push(node); node = mapping[node].parent ?? null; }
      nodeIds.reverse();
    } else {
      nodeIds = Object.keys(mapping).sort((a, b) => (mapping[a]?.message?.create_time ?? 0) - (mapping[b]?.message?.create_time ?? 0));
    }
    const messages: ImportedMessage[] = [];
    for (const id of nodeIds) {
      const m = mapping[id]?.message;
      const role = m?.author?.role;
      if (role !== "user" && role !== "assistant") continue;
      if (m?.metadata?.is_visually_hidden_from_conversation) continue;
      const text = chatgptText(m);
      if (!text) continue;
      messages.push({ role, content: text.slice(0, MAX_MESSAGE_CHARS), sentAt: toIso(m?.create_time ?? conv?.create_time) });
    }
    if (!messages.length) return;
    const id = String(conv?.conversation_id ?? conv?.id ?? `chatgpt-${i}-${conv?.create_time ?? ""}`);
    out.push({ id, title: typeof conv?.title === "string" ? conv.title.slice(0, 200) : null, messages });
  });
  return out;
}

type GeminiTurn = { prompt: string; reply: string; sentAt: string | null };

/** One "conversation" per day, because Google's export lists each prompt separately. */
function groupGeminiTurns(turns: GeminiTurn[]): ImportedConversation[] {
  const byDay = new Map<string, GeminiTurn[]>();
  for (const t of turns) {
    const day = t.sentAt ? t.sentAt.slice(0, 10) : "undated";
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(t);
  }
  return [...byDay.entries()].map(([day, list]) => {
    list.sort((a, b) => (a.sentAt ?? "").localeCompare(b.sentAt ?? ""));
    const messages: ImportedMessage[] = [];
    for (const t of list) {
      if (t.prompt) messages.push({ role: "user", content: t.prompt.slice(0, MAX_MESSAGE_CHARS), sentAt: t.sentAt });
      if (t.reply) messages.push({ role: "assistant", content: t.reply.slice(0, MAX_MESSAGE_CHARS), sentAt: t.sentAt });
    }
    return { id: `gemini-${day}`, title: day === "undated" ? "Gemini chats (no date)" : `Gemini chats ${day}`, messages };
  }).filter((c) => c.messages.length);
}

const PROMPTED = /^\s*Prompted[\s\u00a0]+/i;

/** Google Takeout → My Activity → Gemini Apps → MyActivity.json */
export function parseGeminiActivityJson(data: unknown): ImportedConversation[] {
  const list: Any[] = Array.isArray(data) ? data : [];
  const turns: GeminiTurn[] = [];
  for (const e of list) {
    const title = typeof e?.title === "string" ? e.title : "";
    if (!PROMPTED.test(title)) continue;
    const header = String(e?.header ?? "");
    if (header && !/gemini|bard/i.test(header)) continue;
    const prompt = title.replace(PROMPTED, "").trim();
    const reply = Array.isArray(e?.safeHtmlItem) ? e.safeHtmlItem.map((x: Any) => htmlToText(x?.html ?? "")).filter(Boolean).join("\n\n") : "";
    if (!prompt && !reply) continue;
    turns.push({ prompt, reply, sentAt: toIso(e?.time) });
  }
  return groupGeminiTurns(turns);
}

/** Google Takeout default HTML version of the same file (MyActivity.html). */
export function parseGeminiActivityHtml(html: string): ImportedConversation[] {
  const cells = String(html ?? "").split(/<div class="outer-cell/i).slice(1);
  const turns: GeminiTurn[] = [];
  for (const cell of cells) {
    const start = cell.search(/<div class="content-cell/i);
    if (start < 0) continue;
    const afterOpen = cell.indexOf(">", start) + 1;
    const next = cell.slice(afterOpen).search(/<div class="content-cell/i);
    const inner = next < 0 ? cell.slice(afterOpen) : cell.slice(afterOpen, afterOpen + next);
    const parts = inner.split(/<br\s*\/?>/i);
    const first = htmlToText(parts[0] ?? "");
    if (!PROMPTED.test(first)) continue;
    const prompt = first.replace(PROMPTED, "").trim();
    const dateText = htmlToText(parts[1] ?? "");
    const reply = htmlToText(parts.slice(2).join("<br>"));
    turns.push({ prompt, reply, sentAt: toIso(dateText) });
  }
  return groupGeminiTurns(turns);
}

/** Which files inside an export ZIP we need. */
export function wantedZipEntry(path: string): ImportSource | null {
  const p = path.replace(/\\/g, "/");
  if (/(^|\/)conversations(-\d+)?\.json$/i.test(p)) return "chatgpt";
  if (/(gemini|bard)[^/]*\/MyActivity\.(json|html)$/i.test(p)) return "gemini";
  return null;
}

/** Parses one file's text according to its source and name. */
export function parseExportFile(source: ImportSource, name: string, text: string): ImportedConversation[] {
  if (source === "chatgpt") return parseChatGPTExport(JSON.parse(text));
  if (/\.html?$/i.test(name)) return parseGeminiActivityHtml(text);
  return parseGeminiActivityJson(JSON.parse(text));
}

/** Guesses the source of a single picked (non-ZIP) file from its contents. */
export function guessSource(name: string, text: string): ImportSource | null {
  if (/\.html?$/i.test(name)) return /Prompted/i.test(text) ? "gemini" : null;
  const head = text.slice(0, 4000);
  if (/"mapping"\s*:/.test(head) || /"current_node"/.test(head)) return "chatgpt";
  if (/"Prompted /.test(head) || /"header"\s*:\s*"(Gemini|Bard)/i.test(head)) return "gemini";
  return null;
}

/** Flattens conversations into database rows (capped so a huge export can't run away). */
export function toImportRows(userId: string, source: ImportSource, convs: ImportedConversation[], cap = MAX_MESSAGES_PER_IMPORT): ImportRow[] {
  const rows: ImportRow[] = [];
  for (const c of convs) {
    for (let i = 0; i < c.messages.length; i++) {
      if (rows.length >= cap) return rows;
      const m = c.messages[i];
      rows.push({
        user_id: userId, source, conversation_id: c.id.slice(0, 200), conversation_title: c.title,
        msg_index: i, role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS), sent_at: m.sentAt,
      });
    }
  }
  return rows;
}
