import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bot } from "lucide-react";
import { CHAT_MODELS, loadAgents, getActiveAgentId, setActiveAgentId, type ChatAgent } from "@/lib/chatAgents";

export default function AgentPicker() {
  const [agents, setAgents] = useState<ChatAgent[]>(loadAgents());
  const [active, setActive] = useState(getActiveAgentId());
  useEffect(() => {
    const h = () => { setAgents(loadAgents()); setActive(getActiveAgentId()); };
    window.addEventListener("oracle-agents-changed", h);
    return () => window.removeEventListener("oracle-agents-changed", h);
  }, []);
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full border border-primary/40 bg-background/80 backdrop-blur px-3 py-1.5">
      <Bot className="w-4 h-4 text-primary shrink-0" />
      <select
        aria-label="Choose AI agent"
        value={active}
        onChange={(e) => setActiveAgentId(e.target.value)}
        className="bg-transparent text-xs text-foreground outline-none max-w-[180px]"
      >
        <option value="auto">Oracle (auto)</option>
        {agents.length > 0 && (
          <optgroup label="My agents">
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </optgroup>
        )}
        <optgroup label="AI brains">
          {CHAT_MODELS.map((m) => <option key={m.id} value={`model:${m.id}`}>{m.label} ({m.maker})</option>)}
        </optgroup>
      </select>
      <Link to="/profile#agents" className="text-[10px] text-primary underline">Edit</Link>
    </div>
  );
}
