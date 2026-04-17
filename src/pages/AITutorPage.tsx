import { useState } from "react";
import { GraduationCap, BookOpen, Play, Trophy, Star, Clock, ChevronRight, Loader2, FileText, Send } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-chat`;

const EDUCATION_LEVELS = [
  { label: "Grade 1-6 (Primary)", value: "primary" },
  { label: "Grade 7-9 (Middle School)", value: "middle" },
  { label: "Grade 10-12 (High School)", value: "highschool" },
  { label: "Technical / TAFE", value: "technical" },
  { label: "University (Undergraduate)", value: "undergraduate" },
  { label: "University (Postgraduate)", value: "postgraduate" },
  { label: "PhD / Doctoral", value: "doctoral" },
];

const TOPICS: Record<string, string[]> = {
  Sciences: ["Biology", "Chemistry", "Physics", "Environmental Science", "Earth Science", "Astronomy"],
  Mathematics: ["Algebra", "Calculus", "Statistics", "Geometry", "Linear Algebra", "Discrete Math"],
  Humanities: ["History", "Philosophy", "Sociology", "Psychology", "Political Science", "Anthropology"],
  Languages: ["English Literature", "Creative Writing", "Linguistics", "ESL", "French", "Spanish"],
  Technology: ["Computer Science", "Data Science", "AI & Machine Learning", "Cybersecurity", "Web Development", "Networking"],
  Business: ["Accounting", "Marketing", "Economics", "Finance", "Management", "Entrepreneurship"],
  Health: ["Nursing", "Anatomy", "Public Health", "Nutrition", "Pharmacology", "Mental Health"],
  Arts: ["Music Theory", "Art History", "Film Studies", "Graphic Design", "Photography", "Theatre"],
  Law: ["Constitutional Law", "Criminal Law", "Contract Law", "International Law", "Legal Studies"],
  Engineering: ["Civil", "Mechanical", "Electrical", "Software", "Chemical", "Aerospace"],
};

const AITutorPage = () => {
  const [mode, setMode] = useState<"home" | "topic" | "subtopic" | "generate" | "result">("home");
  const [level, setLevel] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedSubtopic, setSelectedSubtopic] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{role:string;content:string}[]>([]);

  const generateThesis = async () => {
    const topic = selectedSubtopic || customTopic;
    if (!topic || !level) { toast.error("Select a level and topic"); return; }
    const mod = (await import("@/lib/contentSafety")).moderatePrompt(topic);
    if (!mod.ok) { toast.error(mod.reason || "Topic blocked by content filter"); return; }
    setGenerating(true);
    setResult("");
    setMode("result");
    try {
      const levelLabel = EDUCATION_LEVELS.find(l => l.value === level)?.label || level;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          messages: [
            { role: "system", content: `You are an expert academic tutor and thesis writer. Generate comprehensive, well-structured academic content appropriate for ${levelLabel} level. Include proper academic formatting, citations suggestions, and detailed analysis. For university level, include abstract, introduction, literature review outline, methodology suggestions, and conclusion framework.` },
            { role: "user", content: `Generate a complete thesis/assignment outline and initial content for the topic: "${topic}" at ${levelLabel} level. Include: 1) Title 2) Abstract/Summary 3) Key arguments/sections 4) Detailed content for each section 5) Suggested references 6) Conclusion` }
          ]
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
      setResult(content || "Failed to generate content.");
      setChatHistory([{ role: "assistant", content }]);
    } catch {
      setResult("Failed to generate. Please try again.");
    } finally { setGenerating(false); }
  };

  const askFollowUp = async () => {
    if (!chatInput.trim()) return;
    const mod = (await import("@/lib/contentSafety")).moderatePrompt(chatInput);
    if (!mod.ok) { toast.error(mod.reason || "Message blocked by content filter"); return; }
    const newHistory = [...chatHistory, { role: "user" as const, content: chatInput }];
    setChatHistory(newHistory);
    setChatInput("");
    setGenerating(true);
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You are an expert academic tutor. Help the student refine their thesis, explain concepts, or generate additional content. Be thorough and educational." },
            ...newHistory
          ]
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
      setResult(prev => prev + "\n\n---\n\n" + content);
    } catch {
      toast.error("Failed to get response");
    } finally { setGenerating(false); }
  };

  // Result view
  if (mode === "result") {
    return (
      <div className="min-h-screen bg-background pb-20">
        <UniversalBackButton />
        <div className="px-4 pt-14 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-primary/10"><FileText className="w-7 h-7 text-primary" /></div>
            <div>
              <h1 className="text-xl font-bold text-primary">Generated Content</h1>
              <p className="text-muted-foreground text-xs">{selectedSubtopic || customTopic}</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 mb-4 max-h-[50vh] overflow-y-auto">
            {generating && !result ? (
              <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Generating thesis...</div>
            ) : (
              <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">{result}</pre>
            )}
          </div>
          {/* Chat follow-up */}
          <div className="bg-card border border-border rounded-xl p-4 mb-4">
            <h3 className="text-xs font-semibold text-foreground mb-2">Ask the AI Tutor</h3>
            <div className="flex gap-2">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && askFollowUp()}
                placeholder="Ask to expand, explain, or refine..."
                className="flex-1 px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm outline-none focus:border-primary" />
              <button onClick={askFollowUp} disabled={generating || !chatInput.trim()} className="p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button onClick={() => setMode("home")} className="w-full py-3 bg-secondary text-foreground rounded-xl text-sm font-medium">Start New Topic</button>
        </div>
      </div>
    );
  }

  // Topic/Subtopic selection
  if (mode === "topic" || mode === "subtopic" || mode === "generate") {
    return (
      <div className="min-h-screen bg-background pb-20">
        <UniversalBackButton />
        <div className="px-4 pt-14 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-primary/10"><GraduationCap className="w-7 h-7 text-primary" /></div>
            <div><h1 className="text-xl font-bold text-primary">Choose Your Topic</h1><p className="text-muted-foreground text-xs">{EDUCATION_LEVELS.find(l => l.value === level)?.label}</p></div>
          </div>

          {mode === "topic" && (
            <div className="space-y-2">
              {Object.keys(TOPICS).map(t => (
                <button key={t} onClick={() => { setSelectedTopic(t); setMode("subtopic"); }}
                  className="w-full bg-card border border-border rounded-xl p-4 flex items-center justify-between hover:border-primary transition-colors">
                  <span className="text-sm font-semibold text-foreground">{t}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
              <div className="mt-4">
                <input value={customTopic} onChange={e => setCustomTopic(e.target.value)} placeholder="Or type a custom topic..."
                  className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:border-primary mb-2" />
                {customTopic.trim() && (
                  <button onClick={generateThesis} className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium">
                    Generate for "{customTopic}"
                  </button>
                )}
              </div>
            </div>
          )}

          {mode === "subtopic" && (
            <div className="space-y-2">
              <button onClick={() => setMode("topic")} className="text-xs text-primary mb-2">← Back to topics</button>
              <h2 className="text-sm font-semibold text-foreground mb-2">{selectedTopic}</h2>
              {TOPICS[selectedTopic]?.map(sub => (
                <button key={sub} onClick={() => { setSelectedSubtopic(sub); setMode("generate"); }}
                  className="w-full bg-card border border-border rounded-xl p-4 flex items-center justify-between hover:border-primary transition-colors">
                  <span className="text-sm text-foreground">{sub}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}

          {mode === "generate" && (
            <div>
              <button onClick={() => setMode("subtopic")} className="text-xs text-primary mb-4">← Back</button>
              <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-2xl p-6 text-center">
                <GraduationCap className="w-12 h-12 text-primary mx-auto mb-3" />
                <h2 className="text-lg font-bold text-foreground mb-1">{selectedSubtopic}</h2>
                <p className="text-xs text-muted-foreground mb-4">{EDUCATION_LEVELS.find(l => l.value === level)?.label} • {selectedTopic}</p>
                <button onClick={generateThesis} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium flex items-center justify-center gap-2">
                  <Loader2 className={`w-4 h-4 ${generating ? "animate-spin" : "hidden"}`} />
                  Generate Thesis / Assignment
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Home
  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><GraduationCap className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">AI Tutor</h1><p className="text-muted-foreground text-xs">Learn anything with AI guidance</p></div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="text-center p-3 bg-card border border-border rounded-xl"><Trophy className="w-5 h-5 text-primary mx-auto mb-1" /><p className="text-sm font-bold text-foreground">12</p><p className="text-[10px] text-muted-foreground">Achievements</p></div>
          <div className="text-center p-3 bg-card border border-border rounded-xl"><Star className="w-5 h-5 text-primary mx-auto mb-1" /><p className="text-sm font-bold text-foreground">450</p><p className="text-[10px] text-muted-foreground">XP Points</p></div>
          <div className="text-center p-3 bg-card border border-border rounded-xl"><Clock className="w-5 h-5 text-primary mx-auto mb-1" /><p className="text-sm font-bold text-foreground">18h</p><p className="text-[10px] text-muted-foreground">Study Time</p></div>
        </div>

        <h2 className="text-sm font-semibold text-foreground mb-3">Select Education Level</h2>
        <div className="space-y-2 mb-6">
          {EDUCATION_LEVELS.map(l => (
            <button key={l.value} onClick={() => { setLevel(l.value); setMode("topic"); }}
              className={`w-full bg-card border rounded-xl p-4 flex items-center justify-between transition-colors text-left ${level === l.value ? "border-primary bg-primary/5" : "border-border hover:border-primary"}`}>
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-foreground">{l.label}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AITutorPage;
