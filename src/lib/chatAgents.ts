import { supabase } from "@/integrations/supabase/client";
// Member-made AI agents. Saved in this browser; each picks one AI brain.
// The model list must match ALLOWED_MODELS in supabase/functions/oracle-chat.
export type ChatModel = { id: string; label: string; maker: string; note: string; cost: "low" | "mid" | "high" };

export const CHAT_MODELS: ChatModel[] = [
  { id: "openai/gpt-6-astra", label: "GPT-6 Astra", maker: "OpenAI", note: "Smartest — deep thinking, writing, research", cost: "high" },
  { id: "openai/gpt-6-luna", label: "GPT-6 Luna", maker: "OpenAI", note: "Fast and cheap GPT-6", cost: "mid" },
  { id: "openai/gpt-5.6-sol", label: "GPT-5.6 Sol", maker: "OpenAI", note: "Hard problems and coding", cost: "high" },
  { id: "openai/gpt-5.6-terra", label: "GPT-5.6 Terra", maker: "OpenAI", note: "Balanced everyday helper", cost: "mid" },
  { id: "openai/chat-latest", label: "ChatGPT", maker: "OpenAI", note: "The same chat style as ChatGPT", cost: "mid" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", maker: "Google", note: "Google's deepest thinker", cost: "high" },
  { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash", maker: "Google", note: "Newest fast Gemini", cost: "low" },
  { id: "google/gemini-3.1-flash-lite", label: "Gemini Flash Lite", maker: "Google", note: "Cheapest, quick replies", cost: "low" },
];

export type ChatAgent = { id: string; name: string; model: string; personality: string };

const KEY = "oracle.agents.v1";
const ACTIVE_KEY = "oracle.agents.active";

// Built-in agents every member gets (can't be deleted).
export const BUILTIN_AGENTS: ChatAgent[] = [
  {
    id: "builtin:juzzy-author",
    name: "Juzzy Author AI",
    model: "openai/gpt-6-astra",
    personality:
      "Professional fiction writer, editor, publisher and book marketing strategist. Strong hooks, realistic dialogue, emotional storytelling, fast pacing. Tracks characters, timelines, locations and plot points to prevent continuity errors; flags weak scenes and suggests improvements. Modes on request: Story Generator, Character Builder, Plot Builder, Chapter Writer (end every chapter on a hook), Editor, KDP Publisher (title, subtitle, description, keywords, categories, bio, back cover), Series Bible, and Commercial Potential scores out of 10. Output suitable for Amazon KDP.",
  },
];

// ── Cloud sync (so agents, stats and chats follow the member between devices)

async function uid(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Pull this member's agents + stats from the cloud into the local cache. */
export async function syncAgentsFromCloud(): Promise<void> {
  const id = await uid();
  if (!id) return;
  const [{ data: rows }, { data: stats }] = await Promise.all([
    supabase.from("user_agents").select("id,name,model,personality").order("created_at"),
    supabase.from("agent_stats").select("agent_key,replies,words,cents_est"),
  ]);
  if (rows) {
    const mine: ChatAgent[] = rows.map((r) => ({
      id: r.id, name: r.name, model: r.model, personality: r.personality ?? "",
    }));
    localStorage.setItem(KEY, JSON.stringify(mine));
  }
  if (stats) {
    const map: Record<string, AgentStat> = {};
    for (const s of stats) map[s.agent_key] = { replies: s.replies, words: s.words, centsEst: Number(s.cents_est) };
    localStorage.setItem(STATS_KEY, JSON.stringify(map));
  }
  window.dispatchEvent(new Event("oracle-agents-changed"));
}

async function pushAgents(list: ChatAgent[]) {
  const id = await uid();
  if (!id) return;
  const mine = list.filter((a) => !a.id.startsWith("builtin:"));
  const ids = mine.map((a) => a.id);
  await supabase.from("user_agents").upsert(
    mine.map((a) => ({ id: a.id, user_id: id, name: a.name, model: a.model, personality: a.personality, updated_at: new Date().toISOString() })),
  );
  let del = supabase.from("user_agents").delete().eq("user_id", id);
  if (ids.length) del = del.not("id", "in", `(${ids.join(",")})`);
  await del;
}

export function loadAgents(): ChatAgent[] {
  if (typeof window === "undefined") return BUILTIN_AGENTS;
  let mine: ChatAgent[] = [];
  try { mine = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { /* ignore */ }
  return [...BUILTIN_AGENTS, ...mine.filter((a) => !a.id.startsWith("builtin:"))];
}
export function saveAgents(list: ChatAgent[]) {
  localStorage.setItem(KEY, JSON.stringify(list.filter((a) => !a.id.startsWith("builtin:"))));
  window.dispatchEvent(new Event("oracle-agents-changed"));
  void pushAgents(list);
}
export function getActiveAgentId(): string {
  return (typeof window !== "undefined" && localStorage.getItem(ACTIVE_KEY)) || "auto";
}
export function setActiveAgentId(id: string) {
  localStorage.setItem(ACTIVE_KEY, id);
  window.dispatchEvent(new Event("oracle-agents-changed"));
}
export function getActiveAgent(): ChatAgent | null {
  const id = getActiveAgentId();
  if (id === "auto") return null;
  if (id.startsWith("model:")) {
    const m = CHAT_MODELS.find((x) => x.id === id.slice(6));
    return m ? { id, name: m.label, model: m.id, personality: "" } : null;
  }
  return loadAgents().find((a) => a.id === id) ?? null;
}

// ── Per-agent stats (this device). Cost is an estimate of what a member pays:
// provider cost per reply for the AI's tier + the 20% margin, in AUD cents.
const STATS_KEY = "oracle.agents.stats.v1";
const TIER_CENTS: Record<ChatModel["cost"], number> = { low: 1, mid: 3, high: 5 };
export type AgentStat = { replies: number; words: number; centsEst: number };

export function loadAgentStats(): Record<string, AgentStat> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(STATS_KEY) || "{}"); } catch { return {}; }
}
export function recordAgentReply(agent: ChatAgent | null, text: string) {
  const key = agent?.id ?? "auto";
  const tier = CHAT_MODELS.find((m) => m.id === agent?.model)?.cost ?? "low";
  const stats = loadAgentStats();
  const s = stats[key] ?? { replies: 0, words: 0, centsEst: 0 };
  s.replies += 1;
  s.words += text.trim().split(/\s+/).length;
  s.centsEst += TIER_CENTS[tier] * 1.2;
  stats[key] = s;
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  void (async () => {
    const id = await uid();
    if (id) await supabase.from("agent_stats").upsert({ user_id: id, agent_key: key, replies: s.replies, words: s.words, cents_est: s.centsEst, updated_at: new Date().toISOString() });
  })();
  window.dispatchEvent(new Event("oracle-agents-changed"));
}

// ── Chat history that follows the member between devices.
export function loadLocalChat<T>(scope: string): T[] {
  try { return JSON.parse(localStorage.getItem(`oracle.chat.${scope}`) || "[]"); } catch { return []; }
}
export async function loadCloudChat<T>(scope: string): Promise<T[] | null> {
  if (!(await uid())) return null;
  const { data } = await supabase.from("agent_chats").select("messages").eq("scope", scope).maybeSingle();
  if (!data) return null;
  const msgs = (data.messages as unknown as T[]) ?? [];
  localStorage.setItem(`oracle.chat.${scope}`, JSON.stringify(msgs));
  return msgs;
}
export async function saveChat<T>(scope: string, msgs: T[]): Promise<void> {
  const trimmed = msgs.slice(-50);
  localStorage.setItem(`oracle.chat.${scope}`, JSON.stringify(trimmed));
  const id = await uid();
  if (!id) return;
  await supabase.from("agent_chats").upsert({ user_id: id, scope, messages: trimmed as never, updated_at: new Date().toISOString() });
}
export async function clearChat(scope: string): Promise<void> {
  localStorage.removeItem(`oracle.chat.${scope}`);
  const id = await uid();
  if (id) await supabase.from("agent_chats").delete().eq("user_id", id).eq("scope", scope);
}
