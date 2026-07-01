import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Sparkles, Brain, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { moderatePrompt } from "@/lib/contentSafety";

// Client-side rate limit for voice-to-scene: max 8 builds per rolling 60s.
const RATE_KEY = "oracle_scene_voice_rl_v1";
const RATE_MAX = 8;
const RATE_WINDOW_MS = 60_000;
function checkRateLimit(): { ok: boolean; retryInSec: number } {
  try {
    const now = Date.now();
    const raw = localStorage.getItem(RATE_KEY);
    const hits: number[] = raw ? (JSON.parse(raw) as number[]).filter((t) => now - t < RATE_WINDOW_MS) : [];
    if (hits.length >= RATE_MAX) {
      return { ok: false, retryInSec: Math.ceil((RATE_WINDOW_MS - (now - hits[0])) / 1000) };
    }
    hits.push(now);
    localStorage.setItem(RATE_KEY, JSON.stringify(hits));
    return { ok: true, retryInSec: 0 };
  } catch {
    return { ok: true, retryInSec: 0 };
  }
}
// Strip control chars and suspicious prompt-injection markers from voice input.
function sanitizeTranscript(s: string): string {
  return s
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\b(system prompt|ignore (all )?previous|jailbreak|developer mode)\b/gi, "[filtered]")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * OracleSceneVoice — speak (or type) to the Oracle to describe a new scene.
 * The Oracle remembers what you tell it via the oracle_memories table so it
 * can keep style/character continuity across scenes.
 */

// Minimal typings for Web Speech API (not in lib.dom by default in TS strict).
type SpeechRecEvt = { results: ArrayLike<ArrayLike<{ transcript: string }>>; resultIndex: number };
interface SpeechRec {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecEvt) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecCtor = new () => SpeechRec;

interface Props {
  onScene: (prompt: string) => void;
  busy?: boolean;
}

const OracleSceneVoice = ({ onScene, busy }: Props) => {
  const { user } = useAuth();
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [memoryCount, setMemoryCount] = useState<number>(0);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SpeechRec | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: SpeechRecCtor; webkitSpeechRecognition?: SpeechRecCtor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { setSupported(false); return; }
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-AU";
    r.onresult = (e) => {
      let s = "";
      for (let i = e.resultIndex; i < e.results.length; i++) s += e.results[i][0].transcript;
      setText((prev) => sanitizeTranscript((prev + " " + s).slice(-2000)));
    };
    r.onerror = (evt) => {
      setListening(false);
      const code = (evt as { error?: string })?.error;
      if (code === "not-allowed" || code === "service-not-allowed") {
        toast.error("Microphone permission denied. Enable it in your browser settings.");
      } else if (code === "no-speech") {
        toast.message("Didn't catch that — try again.");
      } else if (code === "network") {
        toast.error("Speech recognition network error. Check your connection.");
      } else if (code) {
        toast.error(`Voice input error: ${code}`);
      }
    };
    r.onend = () => setListening(false);
    recRef.current = r;
    return () => { try { r.stop(); } catch { /* noop */ } };
  }, []);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("oracle_memories")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .then((r) => setMemoryCount(r.count ?? 0));
  }, [user]);

  const toggleMic = () => {
    if (!recRef.current) return;
    if (listening) { recRef.current.stop(); setListening(false); return; }
    try { recRef.current.start(); setListening(true); }
    catch { toast.error("Mic already active"); }
  };

  const remember = async (content: string) => {
    if (!user || !content.trim()) return;
    const { error } = await supabase.from("oracle_memories").insert({
      user_id: user.id,
      memory_type: "scene_prompt",
      content: content.slice(0, 1000),
      context: "immersive-movie-studio",
      importance: 6,
    });
    if (error) {
      console.warn("oracle_memories insert failed:", error.message);
    } else {
      setMemoryCount((c) => c + 1);
    }
  };

  const buildScene = async () => {
    if (!user) { toast.error("Sign in to use the Oracle."); return; }
    const prompt = sanitizeTranscript(text).trim();
    if (prompt.length < 8) { toast.error("Say a bit more about the scene (min 8 chars)."); return; }
    if (prompt.length > 1500) { toast.error("That's too long — keep it under 1500 characters."); return; }

    const mod = moderatePrompt(prompt);
    if (!mod.ok) { toast.error(mod.reason ?? "That prompt isn't allowed."); return; }

    const rl = checkRateLimit();
    if (!rl.ok) { toast.error(`Slow down — try again in ${rl.retryInSec}s.`); return; }

    if (listening) { recRef.current?.stop(); setListening(false); }

    // Enrich with Oracle memory context so continuity is preserved.
    let enriched = mod.cleaned ?? prompt;
    try {
      const { data, error } = await supabase
        .from("oracle_memories")
        .select("content")
        .eq("user_id", user.id)
        .eq("context", "immersive-movie-studio")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      const memories = (data ?? []).map((m: { content: string }) => m.content).join(" | ");
      if (memories) enriched = `${enriched}\n\n[Continuity notes: ${memories}]`;
    } catch (e) {
      console.warn("Memory lookup failed, continuing without continuity:", e);
    }

    await remember(prompt);
    onScene(enriched);
    setText("");
  };

  return (
    <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-primary">
          <Sparkles className="w-3.5 h-3.5" /> Speak to the Oracle
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Brain className="w-3 h-3" /> {memoryCount} memories
        </span>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 2000))}
        placeholder="Describe the next scene, or press the mic and speak…"
        rows={3}
        className="text-sm"
      />

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={listening ? "destructive" : "secondary"}
          onClick={toggleMic}
          disabled={!supported}
          title={supported ? "Toggle mic" : "Speech recognition not supported in this browser"}
        >
          {listening ? <><MicOff className="w-4 h-4 mr-1" /> Stop</> : <><Mic className="w-4 h-4 mr-1" /> Speak</>}
        </Button>
        <Button type="button" size="sm" onClick={buildScene} disabled={busy || text.trim().length < 8} className="flex-1">
          {busy ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Building…</> : <><Sparkles className="w-4 h-4 mr-1" /> Build scene with Oracle</>}
        </Button>
      </div>

      {!supported && (
        <p className="text-[10px] text-muted-foreground">
          Voice input isn't supported here — type your scene and press Build.
        </p>
      )}
    </div>
  );
};

export default OracleSceneVoice;

