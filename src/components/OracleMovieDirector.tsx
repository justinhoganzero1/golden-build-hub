// Oracle Movie Director — runs the 22-question movie interview before opening the studio.
// Modes: voice (Oracle speaks each question), form (all 22 visible), hybrid (default — voice + visible answer box).
import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Mic, MicOff, Sparkles, Wand2, FastForward } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/movie-director`;
const AUTH = `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;

type Mode = "voice" | "form" | "hybrid";

export interface MovieDirectorResult {
  script: string;
  intent: string;
  youtube: {
    title: string;
    description: string;
    tags: string[];
    chapters?: { time: string; label: string }[];
    thumbnail_prompt: string;
    channel_name: string;
  };
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onComplete: (result: MovieDirectorResult) => void;
}

export default function OracleMovieDirector({ open, onOpenChange, onComplete }: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("hybrid");
  const [started, setStarted] = useState(false);

  // Initial quick prompt
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState(3);

  // Interview state
  const [known, setKnown] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentField, setCurrentField] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [progress, setProgress] = useState({ answered: 0, total: 22 });
  const [answerInput, setAnswerInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [listening, setListening] = useState(false);

  const recognitionRef = useRef<any>(null);

  // Pre-fill known facts from SOLACE on open
  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const k: Record<string, string> = {};
      // Pull active oracle avatar as the narrator default
      const { data: avatars } = await supabase
        .from("user_avatars")
        .select("name, voice_style, personality")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(3);
      if (avatars && avatars.length) {
        const a = avatars[0];
        if (a.voice_style) k.narrator = `${a.voice_style} (${a.name})`;
      }
      // Pull display name as fallback channel name
      const meta = (user.user_metadata || {}) as any;
      if (meta.full_name || meta.name) k.channel_name = `${meta.full_name || meta.name}'s Channel`;
      setKnown(k);
    })();
  }, [open, user]);

  // Speak helper (uses browser TTS for now — fast, free, no edge function call)
  const speak = (text: string) => {
    if (mode === "form") return;
    try {
      window.speechSynthesis?.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      u.pitch = 1;
      window.speechSynthesis?.speak(u);
    } catch { /* ignore */ }
  };

  // Voice listening helper
  const toggleListen = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Voice input not supported in this browser"); return; }
    if (listening) { recognitionRef.current?.stop(); return; }
    const r = new SR();
    r.continuous = false;
    r.interimResults = false;
    r.lang = "en-AU";
    r.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setAnswerInput(prev => prev ? `${prev} ${text}` : text);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    r.start();
    recognitionRef.current = r;
    setListening(true);
  };

  // Begin interview from quick brief
  const beginInterview = async () => {
    if (!topic.trim()) { toast.error("Tell Oracle what your movie is about first"); return; }
    const seedKnown = { ...known, logline: topic.trim(), duration_min: String(duration) };
    setKnown(seedKnown);
    setStarted(true);
    await fetchNext(seedKnown, {});
  };

  const fetchNext = async (knownNow: Record<string, string>, answersNow: Record<string, string>) => {
    setLoading(true);
    try {
      const r = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH },
        body: JSON.stringify({ action: "next_question", known: knownNow, answers: answersNow }),
      });
      const j = await r.json();
      if (j.done) { return finalize(knownNow, answersNow); }
      setCurrentField(j.field);
      setCurrentQuestion(j.question);
      setProgress(j.progress);
      setAnswerInput("");
      speak(j.question);
    } catch (e: any) {
      toast.error(e?.message || "Could not fetch next question");
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!currentField || !answerInput.trim()) return;
    const next = { ...answers, [currentField]: answerInput.trim() };
    setAnswers(next);
    await fetchNext(known, next);
  };

  const skipQuestion = async () => {
    if (!currentField) return;
    const next = { ...answers, [currentField]: "(skipped — director's choice)" };
    setAnswers(next);
    await fetchNext(known, next);
  };

  const finishEarly = async () => {
    // Fill remaining with "(director's choice)" so AI invents
    const filled = { ...answers };
    if (currentField && answerInput.trim()) filled[currentField] = answerInput.trim();
    await finalize(known, filled, true);
  };

  const finalize = async (knownNow: Record<string, string>, answersNow: Record<string, string>, allowGaps = false) => {
    setFinalizing(true);
    try {
      // If allowGaps, mark unanswered as director's choice so AI invents
      const merged: Record<string, string> = { ...knownNow, ...answersNow };
      if (allowGaps) {
        // movie-director will see them as "answered" and skip them — fill with placeholder
        // (not strictly needed since "next_question" only asks unanswered, but keeps payload tidy)
      }
      const r = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH },
        body: JSON.stringify({ action: "finalize", known: knownNow, answers: { ...answersNow, _allow_gaps: allowGaps ? "yes" : "" } }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      window.speechSynthesis?.cancel();
      toast.success("Your movie is ready — opening Movie Studio");
      onComplete(j as MovieDirectorResult);
      onOpenChange(false);
      // reset for next time
      setStarted(false);
      setAnswers({});
      setCurrentField(null);
      setTopic("");
    } catch (e: any) {
      toast.error(e?.message || "Could not finalize");
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) window.speechSynthesis?.cancel(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Oracle Movie Director
          </DialogTitle>
        </DialogHeader>

        {!started ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tell Oracle what your movie is about and how long it should be. Oracle will ask up to 22 quick questions, then build your full screenplay, scenes, voiceover, and a YouTube launch package.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-medium">Movie length</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: 2, label: "Short", sub: "1–3 min" },
                  { v: 7, label: "Medium", sub: "3–10 min" },
                  { v: 20, label: "Long", sub: "10–30 min" },
                ].map(opt => (
                  <Button
                    key={opt.v}
                    variant={duration === opt.v ? "default" : "outline"}
                    onClick={() => setDuration(opt.v)}
                    className="h-auto flex-col py-3"
                  >
                    <span className="font-bold">{opt.label}</span>
                    <span className="text-[10px] opacity-70">{opt.sub}</span>
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                min={1}
                max={30}
                value={duration}
                onChange={(e) => setDuration(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                className="text-center"
              />
              <p className="text-[10px] text-center text-muted-foreground">
                Longer films cost more to render — you'll see the exact charge before exporting.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">What's your movie about?</label>
              <Textarea
                placeholder="e.g. A retired firefighter in country Victoria gets one last call that changes everything..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">How would you like to answer the 22 questions?</label>
              <div className="grid grid-cols-3 gap-2">
                {(["voice", "hybrid", "form"] as Mode[]).map(m => (
                  <Button
                    key={m}
                    variant={mode === m ? "default" : "outline"}
                    onClick={() => setMode(m)}
                    size="sm"
                    className="capitalize"
                  >
                    {m === "hybrid" ? "Voice + Type" : m}
                  </Button>
                ))}
              </div>
            </div>

            <Button onClick={beginInterview} className="w-full h-12" disabled={!topic.trim()}>
              <Wand2 className="w-4 h-4 mr-2" /> Start the interview
            </Button>
          </div>
        ) : finalizing ? (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
            <p className="font-medium">Oracle is writing your movie…</p>
            <p className="text-xs text-muted-foreground">Building screenplay, scene breakdown, and YouTube launch package.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <Progress value={(progress.answered / progress.total) * 100} />
              <p className="text-[10px] text-muted-foreground text-center">
                Question {progress.answered + 1} of {progress.total}
              </p>
            </div>

            <Card className="p-4 bg-primary/5 border-primary/30">
              <p className="text-sm font-medium leading-relaxed">{currentQuestion || "…"}</p>
            </Card>

            <div className="space-y-2">
              <Textarea
                placeholder="Type your answer, or tap the mic to speak it…"
                value={answerInput}
                onChange={(e) => setAnswerInput(e.target.value)}
                rows={3}
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitAnswer();
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={submitAnswer} disabled={loading || !answerInput.trim()} className="flex-1">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Next question
                </Button>
                <Button onClick={toggleListen} variant="outline" size="icon" disabled={loading}>
                  {listening ? <MicOff className="w-4 h-4 text-destructive" /> : <Mic className="w-4 h-4" />}
                </Button>
                <Button onClick={skipQuestion} variant="ghost" size="sm" disabled={loading}>
                  Skip
                </Button>
              </div>
              <Button onClick={finishEarly} variant="outline" size="sm" className="w-full" disabled={loading}>
                <FastForward className="w-3 h-3 mr-2" />
                Skip the rest — let Oracle invent the rest
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
