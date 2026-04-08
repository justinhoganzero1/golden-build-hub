import { useState, useRef, useEffect } from "react";
import { Send, MessageCircle, Sparkles, Bot, User, Mic, MicOff, Users, Plus, X } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  sender: string;
  emoji: string;
  color: string;
  content: string;
}

interface AIFriend {
  name: string;
  emoji: string;
  color: string;
  personality: string;
  active: boolean;
  locked: boolean;
}

const DEFAULT_FRIENDS: AIFriend[] = [
  { name: "Oracle", emoji: "🔮", color: "#9b87f5", personality: "", active: true, locked: false },
  { name: "Luna", emoji: "🌙", color: "#9b87f5", personality: "creative and artistic", active: false, locked: false },
  { name: "Max", emoji: "🤖", color: "#0EA5E9", personality: "analytical and logical", active: false, locked: true },
  { name: "Aria", emoji: "💜", color: "#D946EF", personality: "empathetic and caring", active: false, locked: true },
  { name: "Spark", emoji: "⚡", color: "#F97316", personality: "energetic and fun", active: false, locked: true },
  { name: "Nova", emoji: "🌟", color: "#EAB308", personality: "wise and philosophical", active: false, locked: true },
  { name: "Byte", emoji: "💻", color: "#22C55E", personality: "tech-savvy and nerdy", active: false, locked: true },
  { name: "Sage", emoji: "🌿", color: "#14B8A6", personality: "calm and mindful", active: false, locked: true },
  { name: "Blaze", emoji: "🔥", color: "#EF4444", personality: "bold and motivational", active: false, locked: true },
  { name: "Echo", emoji: "🎵", color: "#8B5CF6", personality: "musical and rhythmic", active: false, locked: true },
];

const ORACLE_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-chat`;
const FRIENDS_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-friends-chat`;

const suggestions = [
  "Tell me about mindfulness techniques",
  "Help me plan my week",
  "What's a good morning routine?",
  "Give me a motivational quote",
];

const OraclePage = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", sender: "Oracle", emoji: "🔮", color: "#9b87f5", content: "Hello! I'm **Oracle AI**, your personal companion. I'm here to help with anything. Tap the 👥 button to invite AI friends into our chat!" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [friends, setFriends] = useState<AIFriend[]>(DEFAULT_FRIENDS);
  const [showFriendPanel, setShowFriendPanel] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeFriends = friends.filter(f => f.active && f.name !== "Oracle");

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  const toggleFriend = (name: string) => {
    const friend = friends.find(f => f.name === name);
    if (!friend) return;
    if (friend.locked) {
      toast("Unlock " + name + " for $1", { description: "Go to Subscribe to unlock more AI friends.", action: { label: "View Plans", onClick: () => window.location.href = "/subscribe" } });
      return;
    }
    setFriends(prev => prev.map(f => f.name === name ? { ...f, active: !f.active } : f));
    const wasActive = friend.active;
    if (!wasActive) {
      toast.success(`${friend.emoji} ${friend.name} joined the chat!`);
    }
  };

  const toggleMic = () => {
    if (isListening) { setIsListening(false); return; }
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      toast.error("Speech recognition not supported");
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.onresult = (event: any) => {
      setIsListening(false);
      sendMessage(event.results[0][0].transcript);
    };
    recognition.onerror = () => { setIsListening(false); toast.error("Could not recognize speech"); };
    recognition.onend = () => setIsListening(false);
    setIsListening(true);
    recognition.start();
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", sender: "user", emoji: "👤", color: "#FFAA00", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // Always get Oracle's response (streaming)
      const allMsgs = [...messages.filter(m => m.id !== "welcome"), userMsg];
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

      // Stream Oracle response
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
                  if (last?.sender === "Oracle" && last.id !== "welcome") {
                    return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: oracleContent } : m);
                  }
                  return [...prev, { id: "oracle-" + Date.now(), role: "assistant", sender: "Oracle", emoji: "🔮", color: "#9b87f5", content: oracleContent }];
                });
              }
            } catch { buffer = line + "\n" + buffer; break; }
          }
        }
      }

      // If friends are active, get their responses too
      if (activeFriends.length > 0) {
        try {
          const friendResp = await fetch(FRIENDS_CHAT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
            body: JSON.stringify({
              message: text,
              history: allMsgs.slice(-10).map(m => ({ sender: m.sender, content: m.content })),
            }),
          });

          if (friendResp.ok) {
            const data = await friendResp.json();
            for (let i = 0; i < (data.responses || []).length; i++) {
              const r = data.responses[i];
              // Only show if this friend is active
              if (!activeFriends.find(f => f.name === r.sender)) continue;
              await new Promise(resolve => setTimeout(resolve, 600 + i * 800));
              setMessages(prev => [...prev, {
                id: `friend-${Date.now()}-${i}`,
                role: "assistant",
                sender: r.sender,
                emoji: r.emoji,
                color: r.color,
                content: r.content,
              }]);
            }
          }
        } catch (e) {
          console.error("Friend chat error:", e);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to connect to Oracle AI");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col">
      <UniversalBackButton />
      {/* Header */}
      <div className="px-4 pt-14 pb-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10"><MessageCircle className="w-6 h-6 text-primary" /></div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-primary">Oracle AI</h1>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[hsl(var(--status-active))]" />
              <span className="text-xs text-muted-foreground">
                Online{activeFriends.length > 0 ? ` • +${activeFriends.length} friend${activeFriends.length > 1 ? "s" : ""}` : ""}
              </span>
            </div>
          </div>
          <button onClick={() => setShowFriendPanel(!showFriendPanel)} className={`p-2 rounded-xl transition-colors ${showFriendPanel ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"}`}>
            <Users className="w-5 h-5" />
          </button>
          <Sparkles className="w-5 h-5 text-primary animate-pulse" />
        </div>

        {/* Active friends strip */}
        {activeFriends.length > 0 && (
          <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
            {activeFriends.map(f => (
              <button key={f.name} onClick={() => toggleFriend(f.name)} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium shrink-0" style={{ backgroundColor: f.color + "20", border: `1px solid ${f.color}40`, color: f.color }}>
                {f.emoji} {f.name} <X className="w-3 h-3" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Friend panel */}
      {showFriendPanel && (
        <div className="px-4 py-3 border-b border-border bg-card/80 backdrop-blur">
          <p className="text-xs text-muted-foreground mb-2">Invite friends to chat (1 free, $1 each to unlock)</p>
          <div className="grid grid-cols-5 gap-2">
            {friends.filter(f => f.name !== "Oracle").map(f => (
              <button key={f.name} onClick={() => toggleFriend(f.name)} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${f.active ? "ring-2 ring-primary" : "opacity-60"}`} style={f.active ? { backgroundColor: f.color + "15" } : {}}>
                <div className="text-xl relative">
                  {f.emoji}
                  {f.locked && <span className="absolute -top-1 -right-1 text-[10px]">🔒</span>}
                </div>
                <span className="text-[9px] font-medium text-foreground">{f.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
            {msg.sender !== "user" && (
              <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-base" style={{ backgroundColor: msg.color + "20", border: `2px solid ${msg.color}` }}>
                  {msg.emoji}
                </div>
                <span className="text-[9px] font-medium" style={{ color: msg.color }}>{msg.sender}</span>
              </div>
            )}
            <div
              className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${msg.sender === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "rounded-bl-md"}`}
              style={msg.sender !== "user" ? { backgroundColor: msg.color + "15", border: `1px solid ${msg.color}30`, color: "hsl(var(--foreground))" } : undefined}
            >
              {msg.sender === "user" ? msg.content : (
                <div className="prose prose-sm prose-invert max-w-none [&>p]:m-0"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
              )}
            </div>
            {msg.sender === "user" && (
              <div className="w-8 h-8 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center text-base flex-shrink-0">👤</div>
            )}
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.sender === "user" && (
          <div className="flex gap-2 items-start">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-base">🔮</div>
            <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground self-center">
              {activeFriends.length > 0 ? "Oracle & friends typing..." : "Oracle is typing..."}
            </span>
          </div>
        )}
        {messages.length === 1 && (
          <div className="space-y-2 mt-4">
            <p className="text-xs text-muted-foreground text-center mb-2">Try asking:</p>
            {suggestions.map(s => (
              <button key={s} onClick={() => sendMessage(s)} className="w-full text-left px-4 py-3 rounded-xl bg-card border border-border text-sm text-foreground hover:border-primary transition-colors">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 pb-6 pt-3 border-t border-border bg-card">
        <div className="flex items-center gap-2">
          <button onClick={toggleMic} className={`p-3 rounded-xl transition-colors ${isListening ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-secondary text-primary"}`}>
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage(input)}
            placeholder="Ask Oracle anything..." disabled={isLoading}
            className="flex-1 px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary disabled:opacity-50" />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading} className="p-3 rounded-xl bg-primary text-primary-foreground disabled:opacity-50">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OraclePage;
