import { useState } from "react";
import { Bot, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { CHAT_MODELS, loadAgents, saveAgents, setActiveAgentId, type ChatAgent } from "@/lib/chatAgents";

export default function MyAgentsSection() {
  const [agents, setAgents] = useState<ChatAgent[]>(loadAgents());
  const [name, setName] = useState("");
  const [model, setModel] = useState(CHAT_MODELS[0].id);
  const [personality, setPersonality] = useState("");

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
