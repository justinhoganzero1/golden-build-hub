import { useState, useRef, useEffect } from "react";
import { Send, MessageCircle, Sparkles, Bot, User } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const suggestions = [
  "Tell me about mindfulness techniques",
  "Help me plan my week",
  "What's a good morning routine?",
  "Give me a motivational quote",
];

const OraclePage = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", content: "Hello! I'm **Oracle AI**, your personal companion. I'm here to help with anything — from planning your day, to mental wellness tips, to creative brainstorming. What's on your mind?", timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        "That's a great question! Let me think about this carefully. Based on what you've shared, I'd recommend starting with small, manageable steps. Break your goal into daily actions and track your progress.",
        "I understand how you feel. Remember, every expert was once a beginner. The key is consistency, not perfection. Would you like me to help you create an actionable plan?",
        "Here's what I suggest: Start your morning with 5 minutes of deep breathing, followed by writing down 3 things you're grateful for. This sets a positive tone for the entire day.",
        "Absolutely! I can help with that. Let's approach this step by step. First, let's identify your main priorities, then we'll build a strategy around them.",
      ];
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div className="h-screen bg-background flex flex-col">
      <UniversalBackButton />
      {/* Header */}
      <div className="px-4 pt-14 pb-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <MessageCircle className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-primary">Oracle AI</h1>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[hsl(var(--status-active))]" />
              <span className="text-xs text-muted-foreground">Online • Ready to help</span>
            </div>
          </div>
          <Sparkles className="w-5 h-5 text-primary ml-auto animate-pulse" />
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-4 h-4 text-primary" />
              </div>
            )}
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card border border-border text-foreground rounded-bl-md"}`}>
              {msg.content}
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-4 h-4 text-primary" />
              </div>
            )}
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-2 items-start">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        {messages.length === 1 && (
          <div className="space-y-2 mt-4">
            <p className="text-xs text-muted-foreground text-center mb-2">Try asking:</p>
            {suggestions.map(s => (
              <button key={s} onClick={() => sendMessage(s)}
                className="w-full text-left px-4 py-3 rounded-xl bg-card border border-border text-sm text-foreground hover:border-primary transition-colors">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 pb-6 pt-3 border-t border-border bg-card">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage(input)}
            placeholder="Ask Oracle anything..."
            className="flex-1 px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary"
          />
          <button onClick={() => sendMessage(input)} disabled={!input.trim()}
            className="p-3 rounded-xl bg-primary text-primary-foreground disabled:opacity-50">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OraclePage;
