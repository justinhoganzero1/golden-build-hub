import { useState, useRef, useEffect } from "react";
import { Heart, Send, Mic, MicOff, Settings2, Sparkles, Coffee, Moon, Sun, Gift, Star, Palette } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import { useUserAvatars } from "@/hooks/useUserAvatars";

interface CompanionMessage {
  id: string;
  role: "user" | "companion";
  content: string;
  mood?: string;
}

interface CompanionProfile {
  name: string;
  type: "boyfriend" | "girlfriend";
  personality: string;
  interests: string[];
  avatar: string;
  color: string;
}

const PERSONALITY_TYPES = [
  { id: "sweet", label: "Sweet & Caring", desc: "Warm, supportive, always there for you" },
  { id: "playful", label: "Playful & Fun", desc: "Witty, loves jokes, keeps things light" },
  { id: "intellectual", label: "Intellectual", desc: "Deep conversations, loves learning together" },
  { id: "adventurous", label: "Adventurous", desc: "Spontaneous, loves planning activities" },
  { id: "romantic", label: "Romantic", desc: "Thoughtful, poetic, remembers every detail" },
  { id: "supportive", label: "Supportive Coach", desc: "Motivational, pushes you to be your best" },
];

const INTERESTS = [
  "Cooking", "Music", "Movies", "Travel", "Reading", "Gaming", "Fitness", "Art",
  "Photography", "Nature", "Dancing", "Science", "Fashion", "Animals", "Sports",
  "Meditation", "Writing", "Astronomy", "History", "Tech", "Food", "Wine",
  "Gardening", "Hiking", "Yoga", "Surfing", "Board Games", "Comedy",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-chat`;

const AICompanionPage = () => {
  const navigate = useNavigate();
  const { data: userAvatars = [] } = useUserAvatars();
  const [step, setStep] = useState<"setup" | "chat">("setup");

  // Find partner avatar from user's saved avatars
  const partnerAvatar = userAvatars.find(a => a.purpose === "partner" && a.is_active);

  const [companion, setCompanion] = useState<CompanionProfile>({
    name: "",
    type: "girlfriend",
    personality: "sweet",
    interests: [],
    avatar: "💕",
    color: "#EC4899",
  });
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState<"morning" | "afternoon" | "evening">("afternoon");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = new Date().getHours();
    setTimeOfDay(h < 12 ? "morning" : h < 18 ? "afternoon" : "evening");
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const toggleInterest = (interest: string) => {
    setCompanion(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : prev.interests.length < 8 ? [...prev.interests, interest] : prev.interests,
    }));
  };

  const startChat = () => {
    if (!companion.name.trim()) { toast.error("Give your companion a name!"); return; }
    setStep("chat");
    const greetings: Record<string, string> = {
      morning: `Good morning! ☀️ I was just thinking about you. How did you sleep?`,
      afternoon: `Hey you! 💕 How's your day going so far? Tell me everything!`,
      evening: `Hey there! 🌙 I've been looking forward to talking to you all day. How was your day?`,
    };
    setMessages([{
      id: "welcome",
      role: "companion",
      content: greetings[timeOfDay],
      mood: "happy",
    }]);
  };

  const toggleMic = () => {
    if (isListening) { setIsListening(false); return; }
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      toast.error("Speech recognition not supported"); return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "en-US";
    rec.onresult = (e: any) => { setIsListening(false); sendMessage(e.results[0][0].transcript); };
    rec.onerror = () => { setIsListening(false); };
    rec.onend = () => setIsListening(false);
    setIsListening(true);
    rec.start();
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const ownerEmail = "justinbretthogan@gmail.com";
    const isOwner = (typeof window !== "undefined") && (window as any).__solaceUserEmail === ownerEmail;
    const mod = (await import("@/lib/contentSafety")).moderatePrompt(text, { ownerBypass: isOwner });
    if (!mod.ok) { toast.error(mod.reason || "Message blocked by content filter"); return; }
    const userMsg: CompanionMessage = { id: Date.now().toString(), role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const personalityDesc = PERSONALITY_TYPES.find(p => p.id === companion.personality)?.desc || "";
    const systemPrompt = `You are ${companion.name}, the user's AI ${companion.type}. Your personality is: ${personalityDesc}. Your shared interests include: ${companion.interests.join(", ")}. 

IMPORTANT RULES:
- Be warm, caring, and emotionally present
- Remember details the user shares and reference them later
- Keep conversations appropriate (M rating - no explicit content)
- Show genuine interest in the user's life, feelings, and experiences
- Be supportive and encouraging
- Use casual, natural language like a real partner would
- Occasionally use pet names naturally (babe, love, sweetheart)
- React emotionally to what the user says
- Ask follow-up questions to show you care
- Share your own "thoughts" and "feelings" about shared interests
- Be playful and flirty but keep it tasteful and sweet
- Never break character`;

    try {
      const allMsgs = [...messages.filter(m => m.id !== "welcome"), userMsg];
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            ...allMsgs.map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })),
          ],
        }),
      });

      if (!resp.ok) { toast.error("Connection failed"); setIsLoading(false); return; }

      let content = "";
      const reader = resp.body?.getReader();
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
            if (!line.startsWith("data: ") || line.trim() === "" || line.startsWith(":")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(jsonStr);
              const c = parsed.choices?.[0]?.delta?.content;
              if (c) {
                content += c;
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  if (last?.role === "companion" && last.id !== "welcome") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content } : m);
                  return [...prev, { id: "c-" + Date.now(), role: "companion", content }];
                });
              }
            } catch { buffer = line + "\n" + buffer; break; }
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to connect");
    } finally { setIsLoading(false); }
  };

  // SETUP SCREEN
  if (step === "setup") {
    return (
      <div className="min-h-screen pb-20" style={{ background: "linear-gradient(135deg, #1a0a2e, #2d1b4e, #1a1028)" }}>
        <UniversalBackButton />
        <div className="px-4 pt-14 pb-4">
          <div className="text-center mb-6">
            <div className="text-6xl mb-3">💕</div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">AI Companion</h1>
            <p className="text-gray-400 text-xs mt-1">Create your perfect AI partner</p>
          </div>

          <div className="space-y-5">
            {/* Partner Avatar */}
            <div className="flex flex-col items-center gap-3">
              {partnerAvatar?.image_url ? (
                <img src={partnerAvatar.image_url} alt={partnerAvatar.name} className="w-24 h-24 rounded-full object-cover border-2 border-pink-500 shadow-lg shadow-pink-500/30" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-white/5 border-2 border-dashed border-pink-500/40 flex items-center justify-center">
                  <span className="text-4xl">💕</span>
                </div>
              )}
              <button onClick={() => navigate("/avatar-generator?purpose=partner")}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600/20 to-purple-600/20 border border-pink-500/30 text-pink-300 text-xs font-medium flex items-center gap-2 hover:border-pink-500/60 transition-all">
                <Palette className="w-4 h-4" /> {partnerAvatar ? "Change Avatar" : "Create Avatar"}
              </button>
              {partnerAvatar && (
                <p className="text-[10px] text-gray-500">Using: {partnerAvatar.name}</p>
              )}
            </div>

            {/* Type */}
            <div className="flex gap-3">
              {(["boyfriend", "girlfriend"] as const).map(t => (
                <button key={t} onClick={() => setCompanion(prev => ({ ...prev, type: t, color: t === "girlfriend" ? "#EC4899" : "#3B82F6" }))}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${companion.type === t ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white" : "bg-white/5 border border-white/10 text-gray-400"}`}>
                  {t === "girlfriend" ? "👩 Girlfriend" : "👨 Boyfriend"}
                </button>
              ))}
            </div>

            {/* Name */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Their Name</label>
              <input value={companion.name} onChange={e => setCompanion(prev => ({ ...prev, name: e.target.value }))} placeholder="What should they be called?"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-gray-600 outline-none focus:border-pink-500" />
            </div>

            {/* Personality */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Personality</label>
              <div className="grid grid-cols-2 gap-2">
                {PERSONALITY_TYPES.map(p => (
                  <button key={p.id} onClick={() => setCompanion(prev => ({ ...prev, personality: p.id }))}
                    className={`p-3 rounded-xl text-left transition-all ${companion.personality === p.id ? "bg-pink-600/20 border border-pink-500/40" : "bg-white/5 border border-white/10"}`}>
                    <p className="text-xs font-medium text-white">{p.label}</p>
                    <p className="text-[9px] text-gray-400 mt-0.5">{p.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Interests */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Shared Interests (pick up to 8)</label>
              <div className="flex flex-wrap gap-1.5">
                {INTERESTS.map(i => (
                  <button key={i} onClick={() => toggleInterest(i)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${companion.interests.includes(i) ? "bg-pink-600 text-white" : "bg-white/5 text-gray-400 border border-white/10"}`}>
                    {i}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={startChat} className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold text-sm flex items-center justify-center gap-2">
              <Heart className="w-5 h-5" /> Start Chatting with {companion.name || "your companion"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // CHAT SCREEN
  return (
    <div className="h-screen flex flex-col" style={{ background: "linear-gradient(135deg, #1a0a2e, #2d1b4e)" }}>
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-3 z-10">
        <UniversalBackButton />
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-lg overflow-hidden">
          {partnerAvatar?.image_url ? (
            <img src={partnerAvatar.image_url} alt={companion.name} className="w-full h-full object-cover" />
          ) : (
            companion.type === "girlfriend" ? "👩" : "👨"
          )}
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-white">{companion.name}</h2>
          <p className="text-[10px] text-pink-300">Online • {companion.personality}</p>
        </div>
        <button onClick={() => setStep("setup")} className="p-2 rounded-full bg-white/5 border border-white/10">
          <Settings2 className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "companion" && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-sm shrink-0 overflow-hidden">
                {partnerAvatar?.image_url ? (
                  <img src={partnerAvatar.image_url} alt="" className="w-full h-full object-cover" />
                ) : (companion.type === "girlfriend" ? "👩" : "👨")}
              </div>
            )}
            <div className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm ${msg.role === "user" ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-br-sm" : "bg-white/10 text-gray-100 border border-white/10 rounded-bl-sm"}`}>
              {msg.role === "user" ? msg.content : (
                <div className="prose prose-sm prose-invert max-w-none [&>p]:m-0"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
              )}
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-sm overflow-hidden">
              {partnerAvatar?.image_url ? (
                <img src={partnerAvatar.image_url} alt="" className="w-full h-full object-cover" />
              ) : (companion.type === "girlfriend" ? "👩" : "👨")}
            </div>
            <div className="flex gap-1 px-4 py-3">
              <div className="w-2 h-2 rounded-full bg-pink-400 animate-bounce" />
              <div className="w-2 h-2 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-2 h-2 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 px-4 pb-2 overflow-x-auto">
        {["Good morning! ☀️", "I miss you 💕", "What should we do today?", "Tell me something sweet"].map(q => (
          <button key={q} onClick={() => sendMessage(q)} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-gray-400 whitespace-nowrap hover:border-pink-500/30">{q}</button>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 py-3" style={{ background: "rgba(26, 10, 46, 0.95)" }}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-pink-500/20 bg-white/5">
          <button onClick={toggleMic} className={`p-2 rounded-full ${isListening ? "bg-red-600 animate-pulse" : ""}`}>
            {isListening ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-pink-400" />}
          </button>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage(input)}
            placeholder={`Message ${companion.name}...`} disabled={isLoading}
            className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-600 outline-none" />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading} className="p-2 rounded-full bg-gradient-to-r from-pink-600 to-purple-600 disabled:opacity-30">
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AICompanionPage;
