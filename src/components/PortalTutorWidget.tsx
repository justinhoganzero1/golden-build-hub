import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Send, X, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { MASTER_AI_AVATAR, MASTER_AI_AVATAR_ALT } from "@/assets/master-ai-avatar";
import { useMute } from "@/contexts/MuteContext";
import { useAuth } from "@/contexts/AuthContext";

// Strip markdown, emojis, URLs, and code so TTS sounds natural
const sanitizeForTTS = (raw: string): string =>
  raw
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_~#>]/g, "")
    .replace(/[\p{Extended_Pictographic}\u200d]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTED = [
  "How do I install ORACLE LUNAR on my phone?",
  "What can the Oracle do?",
  "Walk me through the Crisis Hub",
  "How much does it cost?",
];

const PortalTutorWidget = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [gated, setGated] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi — I'm your **ORACLE LUNAR Concierge**. Tap the mic to talk to me, or type below. I can walk you through every feature and help you install the app.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const { isMuted } = useMute();
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const sendRef = useRef<(t: string) => void>();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Browser TTS fallback so the Concierge ALWAYS speaks even if ElevenLabs fails
  const speakBrowser = useCallback((text: string) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.0;
      utter.pitch = 1.05;
      const voices = synth.getVoices();
      const preferred = voices.find((v) => /female|samantha|sarah|google.*english/i.test(v.name))
        || voices.find((v) => v.lang?.startsWith("en"));
      if (preferred) utter.voice = preferred;
      synth.speak(utter);
    } catch { /* ignore */ }
  }, []);

  const speak = useCallback(async (raw: string) => {
    if (!voiceOn || isMuted) return;
    const text = sanitizeForTTS(raw);
    if (!text || text.length < 2) return;
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          text,
          // MASTER VOICE: Sarah (EXAVITQu4vr4xnSDxMaL) — same default as the Oracle Lunar app
          voiceId: "EXAVITQu4vr4xnSDxMaL",
          modelId: "eleven_flash_v2_5",
          fast: true,
          settings: {
            stability: 0.45,
            similarity_boost: 0.9,
            style: 0.55,
            use_speaker_boost: true,
            speed: 1.0,
          },
        }),
      });
      if (!resp.ok) throw new Error(`tts ${resp.status}`);
      // Edge function returns JSON `{ fallback: true }` on failure instead of audio
      const ct = resp.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        speakBrowser(text);
        return;
      }
      const blob = await resp.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audioRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(audio.src);
      await audio.play().catch(() => {
        // Autoplay blocked — fall back to browser TTS which is allowed after user gesture
        speakBrowser(text);
      });
    } catch (err) {
      console.warn("Concierge TTS failed, using browser voice:", err);
      speakBrowser(text);
    }
  }, [voiceOn, isMuted, speakBrowser]);

  useEffect(() => {
    if ((isMuted || !voiceOn) && audioRef.current) {
      audioRef.current.pause();
    }
  }, [isMuted, voiceOn]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    // Membership gate: unauthenticated visitors get the pitch on their FIRST message.
    if (!user) {
      const userMsg: Msg = { role: "user", content: trimmed };
      const pitch =
        "Lovely to meet you. Before we go any further, I need you to **become a ORACLE LUNAR member** — it's free to start, and it unlocks me, the Crisis Hub, the Safety Center, and every other tool on the site. Tap **Become a Member** below and I'll be right here waiting for you.";
      setMessages((p) => [...p, userMsg, { role: "assistant", content: pitch }]);
      setInput("");
      setGated(true);
      speak(pitch);
      return;
    }

    const userMsg: Msg = { role: "user", content: trimmed };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-tutor`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });

      if (resp.status === 429) {
        setMessages((p) => [...p, { role: "assistant", content: "I'm getting a lot of questions right now — please try again in a moment." }]);
        return;
      }
      if (resp.status === 402) {
        setMessages((p) => [...p, { role: "assistant", content: "The tutor is temporarily unavailable. Please try again later." }]);
        return;
      }
      if (!resp.ok) throw new Error("concierge failed");

      const data = await resp.json();
      const reply: string = (data?.reply || "").trim()
        || "Thanks — let me get back to you on that. Could you share your name and email so the team can follow up?";
      setMessages((p) => [...p, { role: "assistant", content: reply }]);
      speak(reply);
    } catch (err) {
      console.error("tutor error:", err);
      const fallback = "Sorry — I lost connection. Try asking again?";
      setMessages((p) => [...p, { role: "assistant", content: fallback }]);
      speak(fallback);
    } finally {
      setLoading(false);
    }
  };

  // ===== Speech recognition (mic) =====
  useEffect(() => { sendRef.current = send; });

  const toggleMic = async () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setMessages((p) => [...p, { role: "assistant", content: "Voice input isn't supported in this browser. Try Chrome, Edge, or Safari." }]);
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    try {
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      probe.getTracks().forEach((t) => t.stop());
    } catch (err: any) {
      const name = err?.name || "";
      const blocked = name === "NotAllowedError" || name === "SecurityError";
      const missing = name === "NotFoundError" || name === "OverconstrainedError";
      const msg = blocked
        ? "Microphone is blocked for this site. Click the 🔒 lock icon in your browser's address bar → Site settings → set Microphone to Allow → reload the page."
        : missing
        ? "No microphone detected. Check your laptop's input device in system settings, then try again."
        : "Microphone access failed. Please click Allow when your browser asks.";
      setMessages((p) => [...p, { role: "assistant", content: msg }]);
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      setInput(finalText + interim);
    };
    rec.onerror = () => { setListening(false); };
    rec.onend = () => {
      setListening(false);
      const text = finalText.trim();
      if (text) sendRef.current?.(text);
      setInput("");
    };
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open ORACLE LUNAR Concierge"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary pl-2 pr-5 py-2 text-primary-foreground shadow-[0_0_30px_hsl(var(--primary)/0.4)] hover:scale-105 transition-transform"
        >
          <img
            src={MASTER_AI_AVATAR}
            alt={MASTER_AI_AVATAR_ALT}
            className="h-9 w-9 rounded-full object-cover border-2 border-primary-foreground/40"
          />
          <span className="font-semibold hidden sm:inline">Ask the Concierge</span>
          <MessageCircle className="h-5 w-5 sm:hidden" />
        </button>
      )}

      {open && (
        <div className="fixed inset-x-2 bottom-2 sm:bottom-6 sm:right-6 sm:left-auto sm:w-[400px] z-50 flex flex-col rounded-2xl border border-border bg-card shadow-2xl max-h-[85vh]">
          <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <img
                src={MASTER_AI_AVATAR}
                alt={MASTER_AI_AVATAR_ALT}
                className="h-10 w-10 rounded-full object-cover border-2 border-primary shadow-[0_0_15px_hsl(var(--primary)/0.5)]"
              />
              <div>
                <div className="font-semibold text-foreground">ORACLE LUNAR Concierge</div>
                <div className="text-xs text-muted-foreground">Your guide to every feature</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setVoiceOn((v) => !v)}
                aria-label={voiceOn ? "Mute Concierge voice" : "Unmute Concierge voice"}
                title={voiceOn ? "Voice on — click to mute" : "Voice off — click to enable"}
                className="rounded-md p-1.5 hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"
              >
                {voiceOn && !isMuted ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 hover:bg-secondary text-muted-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-xl px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-auto max-w-[85%] bg-primary text-primary-foreground"
                    : "mr-auto max-w-[90%] bg-secondary text-secondary-foreground"
                }`}
              >
                <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            {loading && (
              <div className="mr-auto rounded-xl bg-secondary px-3 py-2 text-sm text-muted-foreground">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
                </span>
              </div>
            )}
          </div>

          {gated && (
            <div className="px-4 pb-3 pt-1 flex flex-col gap-2 border-t border-border bg-primary/5">
              <Button
                onClick={() => navigate("/sign-in")}
                className="w-full bg-gradient-to-r from-primary to-amber-500 text-primary-foreground font-semibold shadow-[0_0_20px_hsl(var(--primary)/0.5)]"
              >
                Become a Member — it's free
              </Button>
              <p className="text-[11px] text-center text-muted-foreground">
                Membership unlocks the Concierge, Crisis Hub, Safety Center & every tool.
              </p>
            </div>
          )}

          {!gated && messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs rounded-full border border-border bg-background px-3 py-1.5 text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-border p-3"
          >
            <button
              type="button"
              onClick={toggleMic}
              aria-label={listening ? "Stop listening" : "Talk to the Concierge"}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-all ${
                listening
                  ? "border-primary bg-primary text-primary-foreground animate-pulse shadow-[0_0_15px_hsl(var(--primary)/0.6)]"
                  : "border-border bg-background text-muted-foreground hover:text-primary hover:border-primary"
              }`}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <input
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Notify the home logo to pulse while the user is typing
                window.dispatchEvent(new CustomEvent("oracle-lunar-chat-typing"));
              }}
              placeholder={listening ? "Listening…" : "Ask anything about ORACLE LUNAR…"}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
};

export default PortalTutorWidget;
