import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Info } from "lucide-react";
import { CHAT_MODELS, loadAgents, getActiveAgentId, setActiveAgentId, getActiveAgent, type ChatAgent , syncAgentsFromCloud } from "@/lib/chatAgents";

import { Select, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const COST_LABEL = { low: "Low cost per reply", mid: "Medium cost per reply", high: "Higher cost per reply" } as const;

export default function AgentPicker() {
  const [agents, setAgents] = useState<ChatAgent[]>(loadAgents());
  const [active, setActive] = useState(getActiveAgentId());
  const [showInfo, setShowInfo] = useState(false);
  useEffect(() => { void syncAgentsFromCloud(); }, []);
  useEffect(() => {
    const h = () => { setAgents(loadAgents()); setActive(getActiveAgentId()); };
    window.addEventListener("oracle-agents-changed", h);
    return () => window.removeEventListener("oracle-agents-changed", h);
  }, []);
  const agent = getActiveAgent();
  const model = CHAT_MODELS.find((m) => m.id === agent?.model);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 rounded-full border border-primary/40 bg-background/80 backdrop-blur px-3 py-1.5">
        <Bot className="w-4 h-4 text-sky-200 shrink-0" />
        <span className="text-[10px] text-muted-foreground hidden sm:inline">Current Agent</span>
        <Select value={active} onValueChange={setActiveAgentId}>
          <SelectTrigger aria-label="Choose AI agent" className="h-8 flex-1 min-w-0 border-0 bg-transparent text-xs text-[#dbeeff] focus:ring-sky-300/40">
            <SelectValue placeholder="Oracle (auto)" />
          </SelectTrigger>
          <SelectContent side="top" sideOffset={8} className="max-h-72 border-sky-300/40 bg-[#091322] text-[#dbeeff] shadow-[0_0_20px_#38bdf833]">
            <SelectItem value="auto" className="focus:bg-sky-400/20 focus:text-[#e5f4ff] data-[state=checked]:bg-sky-500/25 data-[state=checked]:text-sky-100">Oracle (auto)</SelectItem>
            <SelectGroup>
              <SelectLabel className="text-sky-200">My agents</SelectLabel>
              {agents.map((a) => <SelectItem key={a.id} value={a.id} className="focus:bg-sky-400/20 focus:text-[#e5f4ff] data-[state=checked]:bg-sky-500/25">{a.name}</SelectItem>)}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel className="text-sky-200">AI brains</SelectLabel>
              {CHAT_MODELS.map((m) => <SelectItem key={m.id} value={`model:${m.id}`} className="focus:bg-sky-400/20 focus:text-[#e5f4ff] data-[state=checked]:bg-sky-500/25">{m.label} ({m.maker})</SelectItem>)}
            </SelectGroup>
          </SelectContent>
        </Select>
        <button onClick={() => setShowInfo((v) => !v)} aria-label="About this AI" className="text-sky-200 shrink-0"><Info className="w-4 h-4" /></button>
        <Link to="/profile#agents" className="text-[10px] text-sky-200 underline shrink-0">Edit</Link>
      </div>
      {showInfo && (
        <div className="mt-1 rounded-xl border border-primary/40 bg-background/95 backdrop-blur px-3 py-2 text-[11px] text-foreground">
          {model ? (
            <>
              <p className="font-semibold">{agent?.name}</p>
              <p className="text-muted-foreground">AI: {model.label} by {model.maker}</p>
              <p className="text-muted-foreground">Best for: {model.note}</p>
              <p className="text-muted-foreground">{COST_LABEL[model.cost]}</p>
              {agent?.personality && <p className="text-muted-foreground mt-1 line-clamp-3">Personality: {agent.personality}</p>}
            </>
          ) : (
            <>
              <p className="font-semibold">Oracle (auto)</p>
              <p className="text-muted-foreground">Picks a fast Google Gemini AI for quick chat, and a deeper one for big questions. Lowest cost.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
