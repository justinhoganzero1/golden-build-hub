import { useState, useRef, useEffect } from "react";
import { Send, Mic, MicOff, Bot, User, Sparkles } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const ChatOraclePage = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "assistant", content: "Hi! I'm Chat Oracle — your voice-powered AI. Tap the mic to speak, or type your message below." },
  ]);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  const toggleMic = () => {
    setIsListening(prev => !prev);
    if (!isListening) {
      setTimeout(() => {
        setIsListening(false);
        sendMessage("What's the weather like today?");
      }, 2000);
    }
  };

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", content: text }]);
    setInput("");
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'd love to help with that! Let me look into it for you. In the meantime, is there anything else on your mind?",
      }]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <div className="h-screen bg-background flex flex-col">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10"><Mic className="w-6 h-6 text-primary" /></div>
          <div>
            <h1 className="text-lg font-bold text-primary">Chat Oracle</h1>
            <span className="text-xs text-muted-foreground">Voice-powered AI chat</span>
          </div>
          <Sparkles className="w-5 h-5 text-primary ml-auto" />
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1"><Bot className="w-4 h-4 text-primary" /></div>}
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card border border-border text-foreground rounded-bl-md"}`}>{msg.content}</div>
            {msg.role === "user" && <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-1"><User className="w-4 h-4 text-primary" /></div>}
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-2"><div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center"><Bot className="w-4 h-4 text-primary" /></div>
            <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3 flex gap-1">
              <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" /><div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "150ms" }} /><div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pb-6 pt-3 border-t border-border bg-card">
        <div className="flex items-center gap-2">
          <button onClick={toggleMic} className={`p-3 rounded-xl transition-colors ${isListening ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-secondary text-primary"}`}>
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage(input)}
            placeholder="Type or tap mic..." className="flex-1 px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary" />
          <button onClick={() => sendMessage(input)} disabled={!input.trim()} className="p-3 rounded-xl bg-primary text-primary-foreground disabled:opacity-50"><Send className="w-5 h-5" /></button>
        </div>
      </div>
    </div>
  );
};

export default ChatOraclePage;
