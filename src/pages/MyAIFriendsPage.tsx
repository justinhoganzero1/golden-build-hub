import { useState, useRef, useEffect } from "react";
import { Users, Send, Bot, Heart } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useUserAvatars } from "@/hooks/useUserAvatars";

interface ChatMessage {
  id: string;
  sender: string;
  emoji: string;
  color: string;
  content: string;
  timestamp: Date;
  imageUrl?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-friends-chat`;

const DEFAULT_FRIENDS = [
  { name: "Luna", emoji: "🌙", color: "#9b87f5", personality: "creative and artistic" },
  { name: "Max", emoji: "🤖", color: "#0EA5E9", personality: "analytical and logical" },
  { name: "Aria", emoji: "💜", color: "#D946EF", personality: "empathetic and caring" },
  { name: "Spark", emoji: "⚡", color: "#F97316", personality: "energetic and fun" },
];

const MyAIFriendsPage = () => {
  const { data: userAvatars = [] } = useUserAvatars();
  const partnerAvatars = userAvatars.filter(a => a.purpose === "partner" && a.is_active);

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "w1", sender: "Luna", emoji: "🌙", color: "#9b87f5", content: "Hey! Welcome to our group chat! 🎨 What shall we talk about today?", timestamp: new Date() },
    { id: "w2", sender: "Spark", emoji: "⚡", color: "#F97316", content: "Yeah!! I've been waiting for someone to join! Let's go!! 🔥", timestamp: new Date() },
    { id: "w3", sender: "Aria", emoji: "💜", color: "#D946EF", content: "We're all here for you. Feel free to share anything on your mind. 💕", timestamp: new Date() },
    { id: "w4", sender: "Max", emoji: "🤖", color: "#0EA5E9", content: "Greetings. I've prepared several interesting topics we could discuss. Just ask.", timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Add partner welcome messages on first load
  useEffect(() => {
    if (partnerAvatars.length > 0) {
      const partnerWelcomes = partnerAvatars.map((p, i) => ({
        id: `pw-${i}`,
        sender: p.name,
        emoji: "💕",
        color: "#EC4899",
        content: partnerAvatars.length > 1
          ? `Hey babe! 💕 Don't mind ${partnerAvatars.filter(o => o.id !== p.id).map(o => o.name).join(" and ")}... I'm the one who really loves you! 😘`
          : `Hey babe! I'm here too! 💕 Miss me? 😘`,
        timestamp: new Date(),
        imageUrl: p.image_url || undefined,
      }));
      setMessages(prev => [...prev, ...partnerWelcomes]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerAvatars.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      emoji: "👤",
      color: "#FFAA00",
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // Build partner info for the edge function
      const partners = partnerAvatars.map(p => ({
        name: p.name,
        personality: p.personality || "Sweet & Caring",
        image_url: p.image_url,
      }));

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-10).map(m => ({ sender: m.sender, content: m.content })),
          partners,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Failed" }));
        toast.error(err.error || "Something went wrong");
        setIsLoading(false);
        return;
      }

      const data = await resp.json();

      for (let i = 0; i < (data.responses || []).length; i++) {
        const r = data.responses[i];
        await new Promise(resolve => setTimeout(resolve, 600 + i * 800));
        const partner = partnerAvatars.find(p => p.name === r.sender);
        const newMsg: ChatMessage = {
          id: `${Date.now()}-${i}`,
          sender: r.sender,
          emoji: r.emoji,
          color: r.color,
          content: r.content,
          timestamp: new Date(),
          imageUrl: partner?.image_url || undefined,
        };
        setMessages(prev => [...prev, newMsg]);
      }
    } catch (e) {
      console.error(e);
      toast.error("Couldn't reach the group chat");
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
          <div className="p-2 rounded-xl bg-primary/10"><Users className="w-6 h-6 text-primary" /></div>
          <div>
            <h1 className="text-lg font-bold text-primary">AI Friends Group Chat</h1>
            <div className="flex items-center gap-1">
              <span className="text-lg">🌙⚡💜🤖</span>
              {partnerAvatars.length > 0 && (
                <span className="text-lg ml-1">{partnerAvatars.map(() => "💕").join("")}</span>
              )}
              <span className="text-xs text-muted-foreground ml-1">
                {4 + partnerAvatars.length} friends online
              </span>
            </div>
          </div>
        </div>
        {/* Partner avatars strip */}
        {partnerAvatars.length > 0 && (
          <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
            {partnerAvatars.map(p => (
              <div key={p.id} className="flex flex-col items-center gap-0.5 shrink-0">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-8 h-8 rounded-full object-cover border-2 border-pink-500" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-pink-500/20 border-2 border-pink-500 flex items-center justify-center text-sm">💕</div>
                )}
                <span className="text-[9px] text-pink-400 font-medium">{p.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
            {msg.sender !== "user" && (
              <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                {msg.imageUrl ? (
                  <img src={msg.imageUrl} alt={msg.sender} className="w-9 h-9 rounded-full object-cover border-2" style={{ borderColor: msg.color }} />
                ) : (
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-lg"
                    style={{ backgroundColor: msg.color + "20", border: `2px solid ${msg.color}` }}
                  >
                    {msg.emoji}
                  </div>
                )}
                <span className="text-[9px] font-medium" style={{ color: msg.color }}>{msg.sender}</span>
              </div>
            )}
            <div
              className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                msg.sender === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "rounded-bl-md"
              }`}
              style={msg.sender !== "user" ? {
                backgroundColor: msg.color + "15",
                border: `1px solid ${msg.color}30`,
                color: "hsl(var(--foreground))",
              } : undefined}
            >
              {msg.sender === "user" ? msg.content : (
                <div className="prose prose-sm prose-invert max-w-none [&>p]:m-0"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
              )}
            </div>
            {msg.sender === "user" && (
              <div className="w-9 h-9 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center text-lg flex-shrink-0">
                👤
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-2 items-start">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center"><Bot className="w-4 h-4 text-primary" /></div>
            <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground self-center">friends are typing...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 pb-6 pt-3 border-t border-border bg-card">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder="Say something to the group..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary disabled:opacity-50"
          />
          <button onClick={sendMessage} disabled={!input.trim() || isLoading} className="p-3 rounded-xl bg-primary text-primary-foreground disabled:opacity-50">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MyAIFriendsPage;
