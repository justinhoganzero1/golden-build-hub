import { useEffect, useState } from "react";
import { Bot, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { CHAT_MODELS, loadAgents, saveAgents, setActiveAgentId, loadAgentStats, type ChatAgent , syncAgentsFromCloud } from "@/lib/chatAgents";

export default function MyAgentsSection() {
  const [agents, setAgents] = useState<ChatAgent[]>(loadAgents());
  const [name, setName] = useState("");
  const [model, setModel] = useState(CHAT_MODELS[0].id);
  const [personality, setPersonality] = useState("");

  const [stats, setStats] = useState(loadAgentStats());
  useEffect(() => { void syncAgentsFromCloud(); }, []);
  useEffect(() => {
    const h = () => { setStats(loadAgentStats()); setAgents(loadAgents()); };
    window.addEventListener("oracle-agents-changed", h);
    return () => window.removeEventListener("oracle-agents-changed", h);
  }, []);
  const statName = (key: string) =>
    key === "auto" ? "Oracle (auto)"
      : key.startsWith("model:") ? (CHAT_MODELS.find((m) => m.id === key.slice(6))?.label ?? key)
      : (agents.find((a) => a.id === key)?.name ?? "Deleted agent");
  const statRows = Object.entries(stats).sort((a, b) => b[1].replies - a[1].replies);

  const update = (list: ChatAgent[]) => { setAgents(list); saveAgents(list); };
  const add = () => {
    if (!name.trim()) return toast.error("Give your agent a name");
    const a: ChatAgent = { id: crypto.randomUUID(), name: name.trim().slice(0, 40), model, personality: personality.trim().slice(0, 600) };
    update([...agents, a]);
    setName(""); setPersonality("");
    toast.success(`${a.name} added — pick it in the Oracle chat`);
  };

  return (
    <section id="agents" className="mb-5 rounded-2xl border border-primary/40 bg-primary/5 p-4">
      <div className="flex items-center gap-2 mb-1">
        <Bot className="w-5 h-5 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">My AI Agents</h2>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        Make your own helpers, each with its own AI brain and personality. Choose them at the top of the Oracle chat. Each reply uses coins from your wallet — smarter brains cost more.
      </p>

      {agents.map((a) => {
        const m = CHAT_MODELS.find((x) => x.id === a.model);
        return (
          <div key={a.id} className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2 mb-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground truncate">{a.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{m?.label ?? a.model}{a.personality ? ` · ${a.personality}` : ""}</p>
            </div>
            <button onClick={() => { setActiveAgentId(a.id); toast.success(`${a.name} is now active in chat`); }} className="text-[11px] text-primary underline">Use</button>
            {!a.id.startsWith("builtin:") && <button aria-label={`Delete ${a.name}`} onClick={() => update(agents.filter((x) => x.id !== a.id))} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="w-4 h-4" />
            </button>}
          </div>
        );
      })}

      <div className="mt-3 mb-3 rounded-xl border border-border bg-background/60 p-3">
        <p className="text-xs font-semibold text-foreground mb-2">Agent stats (this device)</p>
        {statRows.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No replies yet — chat with an agent in the Oracle chat.</p>
        ) : (
          <table className="w-full text-[11px]">
            <thead><tr className="text-muted-foreground text-left"><th className="font-normal">Agent</th><th className="font-normal text-right">Replies</th><th className="font-normal text-right">Avg words</th><th className="font-normal text-right">Est. cost</th></tr></thead>
            <tbody>
              {statRows.map(([k, s]) => (
                <tr key={k} className="text-foreground">
                  <td className="truncate max-w-[120px] py-0.5">{statName(k)}</td>
                  <td className="text-right">{s.replies}</td>
                  <td className="text-right">{Math.round(s.words / Math.max(1, s.replies))}</td>
                  <td className="text-right">A${(s.centsEst / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-[10px] text-muted-foreground mt-2">Cost is an estimate of what a member pays (AI cost + 20%). Your owner account isn't charged.</p>
      </div>

      <div className="grid gap-2 mt-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Agent name (e.g. Coach Max)" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <select value={model} onChange={(e) => setModel(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
          {CHAT_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label} ({m.maker}) — {m.note} · {m.cost} cost</option>)}
        </select>
        <textarea value={personality} onChange={(e) => setPersonality(e.target.value)} placeholder="Personality (e.g. tough-love fitness coach, short answers)" rows={2} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button onClick={add} className="flex items-center justify-center gap-1 rounded-lg bg-primary text-primary-foreground py-2 text-sm font-semibold">
          <Plus className="w-4 h-4" /> Add agent
        </button>
      </div>
    </section>
  );
}
