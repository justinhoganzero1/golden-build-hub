import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Mic, MicOff, Users, Volume2, VolumeX, Settings2, LayoutGrid, Eye, X, Plus, UserPlus } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import { useMute } from "@/contexts/MuteContext";
import { useUserAvatars, type UserAvatar } from "@/hooks/useUserAvatars";

interface Message {
  id: string;
  role: "user" | "assistant";
  sender: string;
  emoji: string;
  color: string;
  content: string;
  avatar_url?: string;
}

interface ChatAgent {
  name: string;
  emoji: string;
  color: string;
  personality: string;
  active: boolean;
  locked: boolean;
  avatar_url?: string;
  voice_style?: string;
  isUserAvatar?: boolean;
  avatarId?: string;
}

const DEFAULT_AGENTS: ChatAgent[] = [
  { name: "Oracle", emoji: "🔮", color: "#9b87f5", personality: "", active: true, locked: false },
  { name: "Luna", emoji: "🌙", color: "#9b87f5", personality: "creative and artistic", active: false, locked: false },
  { name: "Max", emoji: "🤖", color: "#0EA5E9", personality: "analytical and logical", active: false, locked: true },
  { name: "Aria", emoji: "💜", color: "#D946EF", personality: "empathetic and caring", active: false, locked: true },
  { name: "Spark", emoji: "⚡", color: "#F97316", personality: "energetic and fun", active: false, locked: true },
];

const ORACLE_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-chat`;
const FRIENDS_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-friends-chat`;

const OraclePage = () => {
  const navigate = useNavigate();
  const { isMuted, toggleMute } = useMute();
  const { data: userAvatars = [] } = useUserAvatars();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [agents, setAgents] = useState<ChatAgent[]>(DEFAULT_AGENTS);
  const [showFriendPanel, setShowFriendPanel] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionRef = useRef<any>(null);

  // Merge user avatars into agents list
  useEffect(() => {
    if (userAvatars.length === 0) return;
    setAgents(prev => {
      const existing = prev.filter(a => !a.isUserAvatar);
      const userAgents: ChatAgent[] = userAvatars
        .filter(a => a.purpose === "ai-friend" || a.purpose === "partner" || a.purpose === "oracle")
        .map(a => ({
          name: a.name,
          emoji: a.purpose === "partner" ? "💕" : a.purpose === "oracle" ? "🔮" : "🤖",
          color: a.purpose === "partner" ? "#EC4899" : "#9b87f5",
          personality: a.personality || "helpful and friendly",
          active: false,
          locked: false,
          avatar_url: a.image_url || undefined,
          voice_style: a.voice_style || undefined,
          isUserAvatar: true,
          avatarId: a.id,
        }));
      return [...existing, ...userAgents];
    });
  }, [userAvatars]);

  const activeAgents = agents.filter(a => a.active && a.name !== "Oracle");

  const speakText = useCallback((text: string) => {
    if (isMuted || !text) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/[#*_`~\[\]()>]/g, "").replace(/\n+/g, ". ").trim();
    if (!clean) return;
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 1.1;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes("Samantha")) || voices.find(v => v.lang.startsWith("en") && v.name.includes("Female")) || voices.find(v => v.lang.startsWith("en"));
    if (preferred) utterance.voice = preferred;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [isMuted]);

  useEffect(() => {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }, []);

  useEffect(() => {
    if (isMuted) { window.speechSynthesis.cancel(); setIsSpeaking(false); }
  }, [isMuted]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  // Animated orb
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;
    const resize = () => { canvas.width = canvas.offsetWidth * 2; canvas.height = canvas.offsetHeight * 2; };
    resize();
    window.addEventListener("resize", resize);
    let t = 0;
    const draw = () => {
      t += 0.008;
      const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.38;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, w, h);
      const glow = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 1.3);
      glow.addColorStop(0, "rgba(180, 120, 60, 0.15)");
      glow.addColorStop(0.5, "rgba(120, 60, 30, 0.08)");
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      const sg = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.3, r * 0.1, cx, cy, r);
      sg.addColorStop(0, "rgba(80, 60, 40, 0.6)");
      sg.addColorStop(0.4, "rgba(30, 20, 15, 0.8)");
      sg.addColorStop(0.7, "rgba(15, 10, 8, 0.9)");
      sg.addColorStop(1, "rgba(5, 3, 2, 1)");
      ctx.fillStyle = sg;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      for (let i = 0; i < 5; i++) {
        const a = t * (0.5 + i * 0.3) + i * 1.2, px = cx + Math.cos(a) * r * 0.3, py = cy + Math.sin(a) * r * 0.25;
        const nr = r * (0.3 + Math.sin(t + i) * 0.1), ng = ctx.createRadialGradient(px, py, 0, px, py, nr);
        const hue = (t * 20 + i * 50) % 360;
        ng.addColorStop(0, `hsla(${hue}, 60%, 50%, 0.2)`);
        ng.addColorStop(0.5, `hsla(${hue + 30}, 50%, 30%, 0.1)`);
        ng.addColorStop(1, "transparent");
        ctx.fillStyle = ng;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.35);
      core.addColorStop(0, `hsla(${(t * 30) % 360}, 70%, 70%, 0.4)`);
      core.addColorStop(0.3, `hsla(${(t * 30 + 30) % 360}, 50%, 40%, 0.2)`);
      core.addColorStop(1, "transparent");
      ctx.fillStyle = core;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      for (let i = 0; i < 8; i++) {
        const fa = t * 0.7 + i * 0.8, fd = r * (0.15 + Math.sin(t * 2 + i) * 0.15);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(fa) * fd, cy + Math.sin(fa) * fd, 3 + Math.sin(t * 3 + i) * 2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${180 + i * 30}, 80%, 70%, ${0.3 + Math.sin(t + i) * 0.2})`;
        ctx.fill();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(200, 150, 80, 0.15)";
      ctx.lineWidth = 2;
      ctx.stroke();
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  const toggleAgent = (name: string) => {
    const agent = agents.find(a => a.name === name);
    if (!agent) return;
    if (agent.locked) {
      toast("Unlock " + name + " for $1", { description: "Go to Subscribe to unlock more AI friends.", action: { label: "View Plans", onClick: () => navigate("/subscribe") } });
      return;
    }
    setAgents(prev => prev.map(a => a.name === name ? { ...a, active: !a.active } : a));
    if (!agent.active) toast.success(`${agent.emoji} ${agent.name} joined the chat!`);
  };

  const toggleMic = () => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      toast.error("Speech recognition not supported. Try Chrome.");
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e: any) => { setIsListening(false); sendMessage(e.results[0][0].transcript); };
    recognition.onerror = () => { setIsListening(false); toast.error("Could not recognize speech"); };
    recognition.onend = () => setIsListening(false);
    setIsListening(true);
    recognition.start();
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    setShowChat(true);
    const userMsg: Message = { id: Date.now().toString(), role: "user", sender: "user", emoji: "👤", color: "#FFAA00", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const allMsgs = [...messages, userMsg];
      const oracleResp = await fetch(ORACLE_CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: allMsgs.map(m => ({ role: m.role, content: m.sender === "user" ? m.content : `[${m.sender}]: ${m.content}` })) }),
      });

      if (!oracleResp.ok) {
        const err = await oracleResp.json().catch(() => ({ error: "Request failed" }));
        toast.error(err.error || "Something went wrong");
        setIsLoading(false);
        return;
      }

      let oracleContent = "";
      const reader = oracleResp.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "" || !line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                oracleContent += content;
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  if (last?.sender === "Oracle") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: oracleContent } : m);
                  return [...prev, { id: "oracle-" + Date.now(), role: "assistant", sender: "Oracle", emoji: "🔮", color: "#9b87f5", content: oracleContent }];
                });
              }
            } catch { buffer = line + "\n" + buffer; break; }
          }
        }
      }

      if (oracleContent) speakText(oracleContent);

      // Send to active user-avatar agents (they get routed through the friends endpoint)
      if (activeAgents.length > 0) {
        try {
          const friendResp = await fetch(FRIENDS_CHAT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
            body: JSON.stringify({ message: text, history: allMsgs.slice(-10).map(m => ({ sender: m.sender, content: m.content })) }),
          });
          if (friendResp.ok) {
            const data = await friendResp.json();
            for (let i = 0; i < (data.responses || []).length; i++) {
              const r = data.responses[i];
              // Map friend responses to active agents
              const matchedAgent = activeAgents[i % activeAgents.length];
              if (!matchedAgent) continue;
              await new Promise(resolve => setTimeout(resolve, 600 + i * 800));
              setMessages(prev => [...prev, {
                id: `agent-${Date.now()}-${i}`,
                role: "assistant",
                sender: matchedAgent.name,
                emoji: matchedAgent.emoji,
                color: matchedAgent.color,
                content: r.content,
                avatar_url: matchedAgent.avatar_url,
              }]);
            }
          }
        } catch (e) { console.error("Agent chat error:", e); }
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to connect to Oracle AI");
    } finally { setIsLoading(false); }
  };

  return (
    <div className="h-screen flex flex-col" style={{ background: "#0a0a0a" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 z-10">
        <UniversalBackButton />
        <button onClick={() => navigate("/avatar-gallery")} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#FFAA00]/30 bg-black/50 backdrop-blur">
          <Eye className="w-4 h-4 text-[#FFAA00]" />
          <span className="text-xs text-[#FFAA00] font-medium">Gallery</span>
        </button>
        <button onClick={() => setShowFriendPanel(!showFriendPanel)} className="p-2 rounded-full border border-[#FFAA00]/30 bg-black/50 backdrop-blur relative">
          <Users className="w-5 h-5 text-[#FFAA00]" />
          {activeAgents.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 text-[9px] text-white flex items-center justify-center font-bold">{activeAgents.length}</span>
          )}
        </button>
      </div>

      {/* Agent panel overlay */}
      {showFriendPanel && (
        <div className="absolute top-14 right-4 z-30 bg-black/95 border border-[#FFAA00]/30 rounded-2xl p-4 backdrop-blur-xl w-72 max-h-[70vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-[#FFAA00] font-semibold">Summon AI into Chat</p>
            <button onClick={() => setShowFriendPanel(false)}><X className="w-4 h-4 text-[#FFAA00]" /></button>
          </div>
          
          {/* Default agents */}
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Built-in Agents</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {agents.filter(a => a.name !== "Oracle" && !a.isUserAvatar).map(a => (
              <button key={a.name} onClick={() => toggleAgent(a.name)} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${a.active ? "ring-1 ring-[#FFAA00] bg-[#FFAA00]/10" : "opacity-50"}`}>
                <div className="text-lg relative">{a.emoji}{a.locked && <span className="absolute -top-1 -right-1 text-[8px]">🔒</span>}</div>
                <span className="text-[8px] text-gray-300">{a.name}</span>
              </button>
            ))}
          </div>

          {/* User-created avatars */}
          {agents.filter(a => a.isUserAvatar).length > 0 && (
            <>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Your Avatars</p>
              <div className="space-y-1.5 mb-3">
                {agents.filter(a => a.isUserAvatar).map(a => (
                  <button key={a.avatarId} onClick={() => toggleAgent(a.name)}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-xl transition-all text-left ${a.active ? "ring-1 ring-[#FFAA00] bg-[#FFAA00]/10" : "opacity-60 hover:opacity-80"}`}>
                    {a.avatar_url ? (
                      <img src={a.avatar_url} alt={a.name} className="w-8 h-8 rounded-full object-cover border border-gray-700" />
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm border border-gray-700" style={{ backgroundColor: a.color + "20" }}>{a.emoji}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-medium truncate">{a.name}</p>
                      <p className="text-[9px] text-gray-500 truncate">{a.voice_style}</p>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${a.active ? "bg-green-500" : "bg-gray-600"}`} />
                  </button>
                ))}
              </div>
            </>
          )}

          <button onClick={() => { setShowFriendPanel(false); navigate("/avatar-generator"); }}
            className="w-full py-2 rounded-xl border border-dashed border-gray-700 text-gray-400 text-xs flex items-center justify-center gap-1.5 hover:border-purple-500 hover:text-purple-400">
            <Plus className="w-3.5 h-3.5" /> Create New Avatar
          </button>
        </div>
      )}

      {/* Orb area */}
      <div className={`relative flex-1 flex items-center justify-center transition-all ${showChat ? "max-h-[35%]" : ""}`}>
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        {activeAgents.map((a, i) => {
          const angle = (i / Math.max(activeAgents.length, 1)) * Math.PI * 2 - Math.PI / 2;
          const radius = 42;
          return (
            <div key={a.name} className="absolute z-10 animate-bounce" style={{
              top: `calc(50% + ${Math.sin(angle) * radius}%)`,
              left: `calc(50% + ${Math.cos(angle) * radius}%)`,
              transform: "translate(-50%, -50%)",
              animationDuration: `${3 + i * 0.5}s`,
            }}>
              {a.avatar_url ? (
                <img src={a.avatar_url} alt={a.name} className="w-10 h-10 rounded-full object-cover border-2" style={{ borderColor: a.color }} />
              ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 backdrop-blur" style={{ borderColor: a.color, backgroundColor: a.color + "20" }}>
                  {a.emoji}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Chat messages */}
      {showChat && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-2 min-h-0" style={{ background: "rgba(10, 10, 10, 0.95)" }}>
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-2 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
              {msg.sender !== "user" && (
                msg.avatar_url ? (
                  <img src={msg.avatar_url} alt={msg.sender} className="w-7 h-7 rounded-full object-cover shrink-0 border" style={{ borderColor: msg.color }} />
                ) : (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 border" style={{ borderColor: msg.color, backgroundColor: msg.color + "15" }}>
                    {msg.emoji}
                  </div>
                )
              )}
              <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${msg.sender === "user" ? "bg-[#FFAA00] text-black rounded-br-sm" : "rounded-bl-sm"}`}
                style={msg.sender !== "user" ? { backgroundColor: msg.color + "15", border: `1px solid ${msg.color}30`, color: "#e5e5e5" } : undefined}>
                {msg.sender !== "user" && <p className="text-[9px] font-bold mb-0.5" style={{ color: msg.color }}>{msg.sender}</p>}
                {msg.sender === "user" ? msg.content : (
                  <div className="prose prose-sm prose-invert max-w-none [&>p]:m-0"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                )}
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.sender === "user" && (
            <div className="flex gap-2 items-center">
              <div className="w-7 h-7 rounded-full bg-[#9b87f5]/20 flex items-center justify-center text-sm border border-[#9b87f5]">🔮</div>
              <div className="flex gap-1 px-3 py-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#FFAA00] animate-bounce" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#FFAA00] animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-[#FFAA00] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input bar */}
      <div className="px-4 py-3 z-10" style={{ background: "linear-gradient(to top, #0a0a0a, rgba(10,10,10,0.95))" }}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-[#FFAA00]/30 bg-black/60 backdrop-blur">
          <button onClick={toggleMic} className={`p-2 rounded-full ${isListening ? "bg-red-600 animate-pulse" : "bg-transparent"}`}>
            {isListening ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-[#FFAA00]" />}
          </button>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage(input)}
            placeholder="Speak or type to consult the Oracle..."
            disabled={isLoading}
            className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-500 outline-none" />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading} className="p-2 rounded-full bg-[#FFAA00] disabled:opacity-30">
            <Send className="w-5 h-5 text-black" />
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex flex-col items-center pb-3 gap-2 z-10" style={{ background: "#0a0a0a" }}>
        <button onClick={toggleMute} className="p-3 rounded-full border border-[#FFAA00]/20 bg-black/50">
          {isMuted ? <VolumeX className="w-6 h-6 text-[#FFAA00]" /> : <Volume2 className="w-6 h-6 text-[#FFAA00]" />}
        </button>
        <span className="text-[10px] text-[#FFAA00] uppercase tracking-widest">{isMuted ? "Unmute" : "Mute"}</span>
        <div className="flex items-center gap-2 mt-1">
          <div className={`w-2 h-2 rounded-full ${isSpeaking ? "bg-[#FFAA00] animate-pulse" : "bg-green-500"}`} />
          <span className="text-xs text-gray-400">{isSpeaking ? "SPEAKING" : "READY"}</span>
          <span className="text-xs text-gray-600">|</span>
          <span className="text-xs text-[#FFAA00]">Oracle + {activeAgents.length} agents</span>
        </div>
      </div>

      <button onClick={() => navigate("/dashboard")} className="fixed bottom-4 right-4 z-20 p-3 rounded-full border-2 border-[#FFAA00] bg-black/80 backdrop-blur">
        <LayoutGrid className="w-6 h-6 text-[#FFAA00]" />
      </button>
    </div>
  );
};

export default OraclePage;
