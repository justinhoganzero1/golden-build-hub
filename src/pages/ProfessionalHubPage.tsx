import { getEdgeAuthTokenSync } from "@/lib/edgeAuth";
import SEO from "@/components/SEO";
import { useState, useRef, useEffect } from "react";
import { BarChart3, Briefcase, FileText, TrendingUp, Users, Calendar, Loader2, Send, Star, Target, Award, ChevronRight, Mic, MicOff } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-chat`;

type Tool = "resume" | "cover" | "interview" | "career" | "salary" | "linkedin" | null;

const tools = [
  { id: "resume" as const, icon: <Briefcase className="w-5 h-5" />, title: "Resume Builder", desc: "AI-powered resume creation" },
  { id: "cover" as const, icon: <FileText className="w-5 h-5" />, title: "Cover Letter", desc: "Generate tailored cover letters" },
  { id: "interview" as const, icon: <Users className="w-5 h-5" />, title: "Interview Prep", desc: "Practice with AI interviewer" },
  { id: "career" as const, icon: <Target className="w-5 h-5" />, title: "Career Planner", desc: "Map your career trajectory" },
  { id: "salary" as const, icon: <TrendingUp className="w-5 h-5" />, title: "Salary Insights", desc: "Market salary data and trends" },
  { id: "linkedin" as const, icon: <Award className="w-5 h-5" />, title: "LinkedIn Optimizer", desc: "Optimize your professional profile" },
];

const SYSTEM_PROMPTS: Record<string, string> = {
  resume: "You are an expert resume writer. Help the user create a professional, ATS-optimized resume. Ask for their experience, skills, and target role. Format the output cleanly.",
  cover: "You are an expert cover letter writer. Help create compelling, personalized cover letters. Ask for the job description and their relevant experience.",
  interview: "You are 'Oracle', a professional AI interviewer conducting a realistic live job interview. You must stay in character as a real interviewer at all times. Ask ONE question at a time. Wait for the candidate's response before asking the next question. After each answer, give brief constructive feedback (strengths and areas to improve), then ask the next question. Cover behavioral, technical, and situational questions relevant to the role. After 5-8 questions, provide a comprehensive performance summary with a score out of 100, key strengths, areas for improvement, and specific tips. Start by warmly greeting the candidate and asking what role they're interviewing for today.",
  career: "You are a career counselor. Help the user map their career trajectory with actionable steps, skill gaps to fill, and timeline suggestions.",
  salary: "You are a salary negotiation expert with market data knowledge. Provide salary insights, negotiation strategies, and market trends for any role/industry.",
  linkedin: "You are a LinkedIn profile optimization expert. Help the user craft a compelling headline, summary, and optimize each section for maximum visibility.",
};

const ProfessionalHubPage = () => {
  const [activeTool, setActiveTool] = useState<Tool>(null);
  const [input, setInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, loading]);

  const toggleMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Speech recognition not supported"); return; }
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e: any) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      setInput(transcript);
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = () => { setIsListening(false); toast.error("Mic error"); };
    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  };

  const sendMessage = async (msg?: string) => {
    const message = msg || input;
    if (!message.trim() || !activeTool) return;
    setInput("");
    setLoading(true);
    const newHistory = [...chatHistory, { role: "user", content: message }];
    setChatHistory(newHistory);

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getEdgeAuthTokenSync()}` },
        body: JSON.stringify({
          messages: [{ role: "system", content: SYSTEM_PROMPTS[activeTool] }, ...newHistory]
        }),
      });
      if (!resp.ok) throw new Error();
      const text = await resp.text();
      let content = "";
      for (const line of text.split("\n")) {
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try { const j = JSON.parse(line.slice(6)); content += j.choices?.[0]?.delta?.content || ""; } catch {}
        }
      }
      setChatHistory([...newHistory, { role: "assistant", content }]);
      setResult(content);
    } catch { toast.error("AI unavailable"); }
    finally { setLoading(false); }
  };

  if (activeTool) {
    const tool = tools.find(t => t.id === activeTool)!;
    return (
      <div className="min-h-screen bg-background pb-20">
      <SEO title="Professional Hub — AI for Work | Oracle Lunar" description="AI tools for professionals: writing, decks, branding and productivity." path="/professional-hub" />
        <UniversalBackButton />
        <div className="px-4 pt-14 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-primary/10">{tool.icon}</div>
            <div><h1 className="text-xl font-bold text-primary">{tool.title}</h1><p className="text-muted-foreground text-xs">{tool.desc}</p></div>
          </div>

          {/* Chat */}
          <div className="space-y-3 mb-4 max-h-[50vh] overflow-y-auto">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`rounded-xl p-3 text-sm ${msg.role === "user" ? "bg-primary/10 text-foreground ml-8" : "bg-card border border-border text-foreground mr-4"}`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                ) : (
                  <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                )}
              </div>
            ))}
            {loading && <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin" /> {activeTool === "interview" ? "Interviewer is thinking..." : "Thinking..."}</div>}
            <div ref={chatEndRef} />
          </div>

          {/* Quick prompts */}
          {chatHistory.length === 0 && (
            <div className="grid grid-cols-1 gap-2 mb-4">
              {activeTool === "resume" && ["Help me build a resume for a software engineer", "I'm changing careers to marketing", "Update my resume for a senior role"].map(q => (
                <button key={q} onClick={() => sendMessage(q)} className="bg-card border border-border rounded-lg p-3 text-xs text-muted-foreground hover:border-primary transition-colors text-left">{q}</button>
              ))}
              {activeTool === "interview" && [
                "Interview me for a software developer role",
                "I want to practice for a product manager interview",
                "Conduct a behavioral interview for a team lead position",
                "Practice a technical interview for a data scientist role"
              ].map(q => (
                <button key={q} onClick={() => sendMessage(q)} className="bg-card border border-border rounded-lg p-3 text-xs text-muted-foreground hover:border-primary transition-colors text-left">{q}</button>
              ))}
              {activeTool === "salary" && ["What's the average salary for UX designers?", "How to negotiate a raise", "Compare salaries in tech vs finance"].map(q => (
                <button key={q} onClick={() => sendMessage(q)} className="bg-card border border-border rounded-lg p-3 text-xs text-muted-foreground hover:border-primary transition-colors text-left">{q}</button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()}
              placeholder={activeTool === "interview" ? "Answer the interviewer..." : `Ask about ${tool.title.toLowerCase()}...`}
              className="flex-1 px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:border-primary" />
            {activeTool === "interview" && (
              <button onClick={toggleMic} className={`p-3 rounded-xl border ${isListening ? "bg-red-500/20 border-red-500 text-red-500" : "bg-secondary border-border text-muted-foreground"}`}>
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
            <button onClick={() => sendMessage()} disabled={loading || !input.trim()} className="p-3 rounded-xl bg-primary text-primary-foreground disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>

          <button onClick={() => { setActiveTool(null); setChatHistory([]); setResult(""); }}
            className="w-full mt-4 py-3 bg-secondary text-foreground rounded-xl text-sm font-medium">Back to Hub</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><BarChart3 className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">Professional Hub</h1><p className="text-muted-foreground text-xs">Career & business tools powered by AI</p></div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="text-center p-3 bg-card border border-border rounded-xl"><Star className="w-5 h-5 text-primary mx-auto mb-1" /><p className="text-sm font-bold text-foreground">3</p><p className="text-[10px] text-muted-foreground">Resumes</p></div>
          <div className="text-center p-3 bg-card border border-border rounded-xl"><Users className="w-5 h-5 text-primary mx-auto mb-1" /><p className="text-sm font-bold text-foreground">7</p><p className="text-[10px] text-muted-foreground">Interviews</p></div>
          <div className="text-center p-3 bg-card border border-border rounded-xl"><TrendingUp className="w-5 h-5 text-primary mx-auto mb-1" /><p className="text-sm font-bold text-foreground">85%</p><p className="text-[10px] text-muted-foreground">Score</p></div>
        </div>

        <div className="space-y-3">
          {tools.map(t => (
            <button key={t.id} onClick={() => setActiveTool(t.id)}
              className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary transition-colors text-left">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">{t.icon}</div>
              <div className="flex-1"><h3 className="text-sm font-semibold text-foreground">{t.title}</h3><p className="text-xs text-muted-foreground">{t.desc}</p></div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfessionalHubPage;
