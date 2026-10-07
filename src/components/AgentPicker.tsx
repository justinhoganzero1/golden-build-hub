import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Info, GripVertical } from "lucide-react";
import { CHAT_MODELS, loadAgents, getActiveAgentId, setActiveAgentId, getActiveAgent, type ChatAgent , syncAgentsFromCloud } from "@/lib/chatAgents";

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

  // Draggable position (persisted)
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
    try { const raw = localStorage.getItem("oracle.agentPicker.pos"); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const drag = useRef({ on: false, x: 0, y: 0, px: 0, py: 0 });

  const clamp = (x: number, y: number) => {
    const el = boxRef.current;
    const w = el?.offsetWidth ?? 320;
    const h = el?.offsetHeight ?? 40;
    return {
      x: Math.max(8, Math.min(window.innerWidth - w - 8, x)),
      y: Math.max(8, Math.min(window.innerHeight - h - 8, y)),
    };
  };

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    drag.current = { on: true, x: e.clientX, y: e.clientY, px: r.left, py: r.top };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current.on) return;
    setPos(clamp(drag.current.px + (e.clientX - drag.current.x), drag.current.py + (e.clientY - drag.current.y)));
  }, []);
  const onPointerUp = useCallback(() => {
    if (!drag.current.on) return;
    drag.current.on = false;
    setPos((p) => { if (p) { try { localStorage.setItem("oracle.agentPicker.pos", JSON.stringify(p)); } catch {} } return p; });
  }, []);

  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clamp(p.x, p.y) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div
      ref={boxRef}
      style={pos ? { left: pos.x, top: pos.y, transform: "none" } : undefined}
      className="fixed top-3 left-1/2 -translate-x-1/2 z-40 w-[min(92vw,360px)]"
    >
      <div className="flex items-center gap-2 rounded-full border border-primary/40 bg-background/80 backdrop-blur px-3 py-1.5">
        <button
          type="button"
          aria-label="Move agent bar"
          title="Drag to move"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ touchAction: "none", cursor: "grab" }}
          className="text-muted-foreground shrink-0"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <Bot className="w-4 h-4 text-primary shrink-0" />
        <span className="text-[10px] text-muted-foreground hidden sm:inline">Current Agent</span>
        <select
          aria-label="Choose AI agent"
          value={active}
          onChange={(e) => setActiveAgentId(e.target.value)}
          className="bg-transparent text-xs text-foreground outline-none flex-1 min-w-0"
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
        <button onClick={() => setShowInfo((v) => !v)} aria-label="About this AI" className="text-primary shrink-0"><Info className="w-4 h-4" /></button>
        <Link to="/profile#agents" className="text-[10px] text-primary underline shrink-0">Edit</Link>
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
