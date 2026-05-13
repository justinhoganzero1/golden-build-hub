import { getEdgeAuthTokenSync } from "@/lib/edgeAuth";
import SEO from "@/components/SEO";
import { useState } from "react";
import { Sparkles, Bot, MessageCircle, Heart, Send, Loader2, CheckCircle, ListTodo, Calendar } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const TOOLS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tools`;

interface Task {
  id: string;
  text: string;
  done: boolean;
}

const PersonalAssistantPage = () => {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([
    { id: "1", text: "Review morning emails", done: true },
    { id: "2", text: "Prepare presentation slides", done: false },
    { id: "3", text: "Schedule team meeting", done: false },
  ]);

  const askAssistant = async () => {
    if (!input.trim()) return;
    const mod = (await import("@/lib/contentSafety")).moderatePrompt(input);
    if (!mod.ok) { toast.error(mod.reason || "Prompt blocked by content filter"); return; }
    setIsLoading(true);
    setResponse(null);
    try {
      const resp = await fetch(TOOLS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getEdgeAuthTokenSync()}`,
        },
        body: JSON.stringify({ type: "assistant", prompt: input.trim() }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Failed" }));
        toast.error(err.error || "Request failed");
        return;
      }
      const data = await resp.json();
      setResponse(typeof data.result === "string" ? data.result : JSON.stringify(data.result));
    } catch (e) {
      console.error(e);
      toast.error("Failed to reach assistant");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const addTask = () => {
    const text = prompt("Add a new task:");
    if (text?.trim()) {
      setTasks(prev => [...prev, { id: Date.now().toString(), text: text.trim(), done: false }]);
    }
  };

  const completedCount = tasks.filter(t => t.done).length;

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEO title="AI Personal Assistant — Oracle Lunar" description="Your daily AI personal assistant for tasks, reminders and life admin." path="/personal-assistant" />
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Sparkles className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">Personal Assistant</h1><p className="text-muted-foreground text-xs">Your AI-powered life manager</p></div>
        </div>

        {/* Summary */}
        <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-2xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">Today's Summary</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card/50 rounded-lg p-3"><p className="text-lg font-bold text-primary">{tasks.filter(t => !t.done).length}</p><p className="text-[10px] text-muted-foreground">Tasks pending</p></div>
            <div className="bg-card/50 rounded-lg p-3"><p className="text-lg font-bold text-[hsl(var(--status-active))]">{completedCount}</p><p className="text-[10px] text-muted-foreground">Completed</p></div>
          </div>
        </div>

        {/* Ask AI */}
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><Bot className="w-4 h-4 text-primary" /> Ask Your Assistant</h3>
          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && askAssistant()}
              placeholder="Plan my day, write an email, brainstorm ideas..."
              className="flex-1 px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary" />
            <button onClick={askAssistant} disabled={isLoading || !input.trim()} className="p-3 rounded-xl bg-primary text-primary-foreground disabled:opacity-50">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
          {response && (
            <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-xl text-sm text-foreground/80 max-h-48 overflow-auto">
              <div className="prose prose-sm prose-invert max-w-none"><ReactMarkdown>{response}</ReactMarkdown></div>
            </div>
          )}
        </div>

        {/* Task list */}
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><ListTodo className="w-4 h-4 text-primary" /> Tasks</h3>
            <button onClick={addTask} className="text-xs text-primary">+ Add</button>
          </div>
          <div className="space-y-2">
            {tasks.map(t => (
              <button key={t.id} onClick={() => toggleTask(t.id)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors text-left">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${t.done ? "bg-[hsl(var(--status-active))] border-[hsl(var(--status-active))]" : "border-border"}`}>
                  {t.done && <CheckCircle className="w-3 h-3 text-primary-foreground" />}
                </div>
                <span className={`text-sm ${t.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.text}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: <MessageCircle className="w-5 h-5" />, label: "Smart Chat", action: () => { setInput("Let's chat about my day"); askAssistant(); } },
            { icon: <Heart className="w-5 h-5" />, label: "Wellness Check", action: () => { setInput("Give me a quick wellness check-in with breathing exercise"); askAssistant(); } },
            { icon: <Calendar className="w-5 h-5" />, label: "Plan My Week", action: () => { setInput("Help me plan an efficient and balanced week"); askAssistant(); } },
            { icon: <Sparkles className="w-5 h-5" />, label: "Motivate Me", action: () => { setInput("Give me a powerful motivational message for today"); askAssistant(); } },
          ].map(a => (
            <button key={a.label} onClick={a.action} disabled={isLoading}
              className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-2 hover:border-primary transition-colors disabled:opacity-50">
              <div className="text-primary">{a.icon}</div>
              <span className="text-xs font-medium text-foreground">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PersonalAssistantPage;
