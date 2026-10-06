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

export function loadAgents(): ChatAgent[] {
  if (typeof window === "undefined") return BUILTIN_AGENTS;
  let mine: ChatAgent[] = [];
  try { mine = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { /* ignore */ }
  return [...BUILTIN_AGENTS, ...mine.filter((a) => !a.id.startsWith("builtin:"))];
}
export function saveAgents(list: ChatAgent[]) {
  localStorage.setItem(KEY, JSON.stringify(list.filter((a) => !a.id.startsWith("builtin:"))));
  window.dispatchEvent(new Event("oracle-agents-changed"));
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
