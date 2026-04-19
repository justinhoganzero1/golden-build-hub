import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Send, X, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { MASTER_AI_AVATAR, MASTER_AI_AVATAR_ALT } from "@/assets/master-ai-avatar";
import { useMute } from "@/contexts/MuteContext";
import { useAuth } from "@/contexts/AuthContext";

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
type MicPermissionState = "unknown" | "granted" | "denied" | "unsupported";

const SUGGESTED = [
  "How do I install ORACLE LUNAR on my phone?",
  "What can the Oracle do?",
  "Walk me through the Crisis Hub",
  "How much does it cost?",
];

const SPEECH_ONLY_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
  sampleRate: 16000,
  sampleSize: 16,
};

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
  const [micPermission, setMicPermission] = useState<MicPermissionState>("unknown");
  const [inputLevel, setInputLevel] = useState(0);
  const [speechLevel, setSpeechLevel] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const { isMuted } = useMute();
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const sendRef = useRef<(t: string) => void>();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const meterStreamRef = useRef<MediaStream | null>(null);
  const meterCtxRef = useRef<AudioContext | null>(null);
  const meterAnalyserRef = useRef<AnalyserNode | null>(null);
  const meterDataRef = useRef<Uint8Array | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const speechCtxRef = useRef<AudioContext | null>(null);
  const speechAnalyserRef = useRef<AnalyserNode | null>(null);
  const speechDataRef = useRef<Uint8Array | null>(null);
  const speechRafRef = useRef<number | null>(null);
  const speechSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const speechSrcAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopSpeechMeter = useCallback(() => {
    if (speechRafRef.current) cancelAnimationFrame(speechRafRef.current);
    speechRafRef.current = null;
    try { speechSourceRef.current?.disconnect(); } catch {}
    try { speechCtxRef.current?.close(); } catch {}
    speechSourceRef.current = null;
    speechCtxRef.current = null;
    speechAnalyserRef.current = null;
    speechDataRef.current = null;
    speechSrcAudioRef.current = null;
    setSpeechLevel(0);
    setSpeaking(false);
  }, []);

  const attachSpeechMeter = useCallback((audio: HTMLAudioElement) => {
    // Tear down any prior graph BEFORE we create a new MediaElementSource —
    // each <audio> element can only be attached to one source node.
    stopSpeechMeter();
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    try {
      const ctx = new Ctx();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.78;
      const data = new Uint8Array(analyser.fftSize);
      // Keep audio audible via the speakers AND tap it for the meter.
      source.connect(analyser);
      source.connect(ctx.destination);

      speechCtxRef.current = ctx;
      speechAnalyserRef.current = analyser;
      speechDataRef.current = data;
      speechSourceRef.current = source;
      speechSrcAudioRef.current = audio;
      setSpeaking(true);

      const tick = () => {
        const a = speechAnalyserRef.current;
        const d = speechDataRef.current;
        if (!a || !d) return;
        a.getByteTimeDomainData(d as any);
        let sum = 0;
        for (let i = 0; i < d.length; i++) {
          const s = (d[i] - 128) / 128;
          sum += s * s;
        }
        const rms = Math.sqrt(sum / d.length);
        // Boost low-amplitude TTS so the glow reads even on quiet syllables.
        const level = Math.max(0, Math.min(1, (rms - 0.008) / 0.16));
        setSpeechLevel((prev) => prev * 0.55 + level * 0.45);
        speechRafRef.current = requestAnimationFrame(tick);
      };
      speechRafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      // CORS or already-attached element — fail silently, just no glow.
      console.warn("speech meter attach failed:", err);
    }
  }, [stopSpeechMeter]);

  const stopMeter = useCallback(() => {
    if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current);
    meterRafRef.current = null;
    try { meterStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    try { meterCtxRef.current?.close(); } catch {}
    meterStreamRef.current = null;
    meterCtxRef.current = null;
    meterAnalyserRef.current = null;
    meterDataRef.current = null;
    setInputLevel(0);
  }, []);

  const startLevelMeter = useCallback((stream: MediaStream) => {
    stopMeter();
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.82;
    const data = new Uint8Array(analyser.fftSize);
    source.connect(analyser);

    meterStreamRef.current = stream;
    meterCtxRef.current = ctx;
    meterAnalyserRef.current = analyser;
    meterDataRef.current = data;

    const tick = () => {
      const activeAnalyser = meterAnalyserRef.current;
      const activeData = meterDataRef.current;
      if (!activeAnalyser || !activeData) return;
      activeAnalyser.getByteTimeDomainData(activeData as any);
      let sum = 0;
      for (let i = 0; i < activeData.length; i++) {
        const sample = (activeData[i] - 128) / 128;
        sum += sample * sample;
      }
      const rms = Math.sqrt(sum / activeData.length);
      const level = Math.max(0, Math.min(1, (rms - 0.012) / 0.11));
      setInputLevel((prev) => prev * 0.45 + level * 0.55);
      meterRafRef.current = requestAnimationFrame(tick);
    };

    meterRafRef.current = requestAnimationFrame(tick);
  }, [stopMeter]);

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
      // Browser TTS can't be tapped by Web Audio, so fake a soft pulsing glow
      // so the avatar still feels alive.
      let pulseRaf: number | null = null;
      const startedAt = performance.now();
      const pulse = () => {
        const t = (performance.now() - startedAt) / 1000;
        const v = 0.45 + Math.sin(t * 6) * 0.25 + Math.sin(t * 13) * 0.12;
        setSpeechLevel(Math.max(0.2, Math.min(1, v)));
        pulseRaf = requestAnimationFrame(pulse);
      };
      utter.onstart = () => { setSpeaking(true); pulse(); };
      const stop = () => {
        if (pulseRaf) cancelAnimationFrame(pulseRaf);
        pulseRaf = null;
        setSpeechLevel(0);
        setSpeaking(false);
      };
      utter.onend = stop;
      utter.onerror = stop;
      synth.speak(utter);
    } catch {}
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
      stopSpeechMeter();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          text,
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
      const ct = resp.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        speakBrowser(text);
        return;
      }
      const blob = await resp.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audio.crossOrigin = "anonymous";
      audioRef.current = audio;
      const cleanup = () => {
        URL.revokeObjectURL(audio.src);
        stopSpeechMeter();
      };
      audio.onended = cleanup;
      audio.onerror = cleanup;
      attachSpeechMeter(audio);
      await audio.play().catch(() => {
        stopSpeechMeter();
        speakBrowser(text);
      });
    } catch (err) {
      console.warn("Concierge TTS failed, using browser voice:", err);
      speakBrowser(text);
    }
  }, [voiceOn, isMuted, speakBrowser, attachSpeechMeter, stopSpeechMeter]);

  const requestMicAccess = useCallback(async (announceFailure = true) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicPermission("unsupported");
      if (announceFailure) {
        setMessages((p) => [...p, { role: "assistant", content: "Microphone access isn't available in this browser. Try Chrome, Edge, or Safari on HTTPS." }]);
      }
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: SPEECH_ONLY_AUDIO_CONSTRAINTS,
      });
      setMicPermission("granted");
      startLevelMeter(stream);
      return true;
    } catch (err: any) {
      const name = err?.name || "";
      const blocked = name === "NotAllowedError" || name === "SecurityError";
      const missing = name === "NotFoundError" || name === "OverconstrainedError";
      setMicPermission(blocked ? "denied" : missing ? "unsupported" : "unknown");
      if (announceFailure) {
        const msg = blocked
          ? "Microphone is blocked for this site. Click the 🔒 lock icon in your browser address bar → Site settings → set Microphone to Allow → reload the page."
          : missing
          ? "No microphone was detected. Check your laptop input device, then try again."
          : "Microphone access failed. Please click Allow when your browser asks.";
        setMessages((p) => [...p, { role: "assistant", content: msg }]);
      }
      return false;
    }
  }, [startLevelMeter]);

  useEffect(() => {
    if ((isMuted || !voiceOn) && audioRef.current) {
      audioRef.current.pause();
      stopSpeechMeter();
    }
  }, [isMuted, voiceOn, stopSpeechMeter]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => { sendRef.current = send; });

  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop?.(); } catch {}
      stopMeter();
      stopSpeechMeter();
    };
  }, [stopMeter, stopSpeechMeter]);

  useEffect(() => {
    if (open) return;
    try { recognitionRef.current?.stop?.(); } catch {}
    setListening(false);
    stopMeter();
  }, [open, stopMeter]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

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

  const toggleMic = async () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setMessages((p) => [...p, { role: "assistant", content: "Voice input isn't supported in this browser. Try Chrome, Edge, or Safari." }]);
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      setInputLevel(0);
      return;
    }

    const granted = await requestMicAccess(true);
    if (!granted) return;

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
    rec.onerror = (e: any) => {
      setListening(false);
      setInputLevel(0);
      if (e?.error === "not-allowed") setMicPermission("denied");
    };
    rec.onend = () => {
      setListening(false);
      setInputLevel(0);
      const text = finalText.trim();
      if (text) sendRef.current?.(text);
      setInput("");
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
      setMessages((p) => [...p, { role: "assistant", content: "I couldn't start listening. Please try the mic button again." }]);
    }
  };

  const handleOpen = async () => {
    setOpen(true);
    await requestMicAccess(false);
  };

  const glowLevel = listening ? Math.max(0.18, Math.min(1, inputLevel)) : 0;
  const pinkLevel = speaking ? Math.max(0.25, Math.min(1, speechLevel)) : 0;

  return (
    <>
      {!open && (
        <button
          onClick={handleOpen}
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
              <div
                className="oracle-listening-shell"
                style={{ ["--oracle-listening-level" as string]: glowLevel.toString() }}
              >
                <img
                  src={MASTER_AI_AVATAR}
                  alt={MASTER_AI_AVATAR_ALT}
                  className="h-10 w-10 rounded-full object-cover border-2 border-primary shadow-[0_0_15px_hsl(var(--primary)/0.5)] transition-transform duration-100"
                />
              </div>
              <div>
                <div className="font-semibold text-foreground">ORACLE LUNAR Concierge</div>
                <div className="text-xs text-muted-foreground">
                  {listening ? "Listening now — speak naturally" : "Your guide to every feature"}
                </div>
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

          {micPermission === "denied" && (
            <div className="px-4 pt-2 text-[11px] text-destructive">
              Microphone is blocked for this site — click the 🔒 icon in your browser address bar, allow microphone access, then reload.
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
                window.dispatchEvent(new CustomEvent("oracle-lunar-chat-typing"));
              }}
              placeholder={listening ? "Listening… speak now" : "Ask anything about ORACLE LUNAR…"}
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
