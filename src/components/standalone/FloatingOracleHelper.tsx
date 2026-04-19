import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2, Volume2, VolumeX, Image as ImageIcon, Mic, MicOff } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { isDemoMode, DEMO_REPLY } from "@/lib/demoMode";
import { useAuth } from "@/contexts/AuthContext";
import { useSaveMedia } from "@/hooks/useUserAvatars";
import { useMute } from "@/contexts/MuteContext";
import { cleanTextForSpeech } from "@/lib/utils";
import { useDraggable } from "@/hooks/useDraggable";
import { toast } from "sonner";

/**
 * Floating Master Oracle for standalone apps.
 *
 * Same brain & abilities as the full /oracle page:
 *  - oracle-chat streaming brain (paywall + jailbreak guards already enforced server-side)
 *  - ElevenLabs TTS for voice responses (gated by subscription server-side)
 *  - Inline image generation via image-gen (paywalled server-side, identical to in-app)
 *  - Auto-saves every generated image to the user's library (user_media)
 *  - Voice input via Web Speech API
 *
 * The Oracle is *the* Master Oracle — every paywall, every charge, every
 * library save behaves exactly as if the user were in the main app.
 */
type Msg = { role: "user" | "assistant"; content: string; imageUrl?: string };

const ORACLE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-chat`;
const IMAGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-gen`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;

const IMAGE_INTENT = /\b(generate|create|make|draw|paint|design|render)\b.*\b(image|picture|photo|art|illustration|logo|poster|wallpaper|scene)\b/i;

export const FloatingOracleHelper = ({ appName }: { appName: string }) => {
  const { user } = useAuth();
  const { isMuted } = useMute();
  const saveMedia = useSaveMedia();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const speak = async (raw: string) => {
    if (!voiceOn || isMuted) return;
    const text = cleanTextForSpeech(raw);
    if (!text || text.length < 2) return;
    try {
      audioRef.current?.pause();
      const resp = await fetch(TTS_URL, {
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
        }),
      });
      if (!resp.ok) throw new Error("tts");
      const ct = resp.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        // Premium TTS gated — fall back silently to browser voice
        const u = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
        return;
      }
      const blob = await resp.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audioRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(audio.src);
      await audio.play().catch(() => {});
    } catch {
      // silent — voice is non-critical
    }
  };

  const generateImage = async (prompt: string): Promise<string | null> => {
    try {
      // Force 8K-quality output via prompt directive — the backend already uses
      // the highest-quality Nano Banana Pro model.
      const enhancedPrompt =
        `${prompt}\n\nRender at 8K resolution (7680x4320), ultra-high detail, ` +
        `photorealistic sharpness, professional studio lighting, maximum fidelity, ` +
        `crisp textures, no compression artifacts.`;
      const resp = await fetch(IMAGE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ prompt: enhancedPrompt }),
      });
      const j = await resp.json();
      if (resp.status === 402) {
        toast.error("This unlocks with a SOLACE membership upgrade.");
        return null;
      }
      if (!resp.ok) throw new Error(j.error || "Image gen failed");
      // image-gen returns { text, images: [{ image_url: { url } }] }
      const url: string | null =
        j.images?.[0]?.image_url?.url || j.imageUrl || j.url || null;
      if (url && user) {
        // Auto-save to library — exactly like the full Oracle does
        saveMedia.mutate({
          url,
          media_type: "image",
          title: prompt.slice(0, 80),
          source_page: `Standalone: ${appName}`,
          metadata: { prompt, oracle: "master", standalone_app: appName, quality: "8k" },
        });
      }
      return url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Image generation failed");
      return null;
    }
  };

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");

    if (isDemoMode()) {
      setMessages((p) => [...p, { role: "assistant", content: DEMO_REPLY }]);
      return;
    }

    setLoading(true);

    // Detect image-generation intent → route through paywalled image-gen and auto-save
    if (IMAGE_INTENT.test(text)) {
      const placeholder: Msg = { role: "assistant", content: "Painting that for you…" };
      setMessages((p) => [...p, placeholder]);
      const imageUrl = await generateImage(text);
      setMessages((p) =>
        p.map((m, i) =>
          i === p.length - 1
            ? imageUrl
              ? { role: "assistant", content: "Done — saved to your library.", imageUrl }
              : { role: "assistant", content: "I couldn't generate that. Try again or rephrase." }
            : m,
        ),
      );
      if (imageUrl) speak("Done. I've saved it to your library.");
      setLoading(false);
      return;
    }

    try {
      const resp = await fetch(ORACLE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: next,
          oracleName: "Eric",
          adContext: { publicSite: false, standaloneApp: appName },
        }),
      });

      if (resp.status === 429) {
        setMessages((p) => [...p, { role: "assistant", content: "You've hit today's free limit. Upgrade to keep chatting." }]);
        return;
      }
      if (resp.status === 402) {
        setMessages((p) => [...p, { role: "assistant", content: "This unlocks with a SOLACE membership upgrade." }]);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error("stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      setMessages((p) => [...p, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") break;
          try {
            const p = JSON.parse(j);
            const c = p.choices?.[0]?.delta?.content;
            if (c) {
              acc += c;
              setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: acc } : m)));
            }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
      if (acc) speak(acc);
    } catch {
      setMessages((p) => [...p, { role: "assistant", content: "I'm having trouble connecting right now. Try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  };

  const toggleMic = async () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Voice input isn't supported in this browser.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Microphone access is needed.");
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
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      const t = finalText.trim();
      if (t) send(t);
      setInput("");
    };
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  const { ref: dragRef, style: dragStyle, dragHandlers, justDragged } = useDraggable("floating-oracle-helper-pos");

  return (
    <>
      <button
        ref={dragRef}
        {...dragHandlers}
        onClick={() => { if (!justDragged) setOpen((o) => !o); }}
        style={dragStyle}
        className="fixed z-50 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-amber-500 text-primary-foreground shadow-2xl shadow-primary/40 flex items-center justify-center hover:scale-105 transition-transform cursor-grab active:cursor-grabbing select-none touch-none"
        aria-label="Open Master Oracle (drag to move)"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[min(380px,calc(100vw-2.5rem))] h-[min(560px,75vh)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-primary/10 to-amber-500/10 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">Eric — Master Oracle</div>
              <div className="text-xs text-muted-foreground truncate">Full power. Auto-saves to your library.</div>
            </div>
            <button
              onClick={() => setVoiceOn((v) => !v)}
              aria-label={voiceOn ? "Mute Oracle voice" : "Unmute Oracle voice"}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary"
            >
              {voiceOn && !isMuted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8 px-4">
                Hi — I'm Eric, your Master Oracle. Ask me anything about <span className="text-foreground font-medium">{appName}</span>, or tell me to <em>"generate an image of…"</em> and I'll save it to your library.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {m.role === "assistant" ? (
                    <>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                      </div>
                      {m.imageUrl && (
                        <div className="mt-2">
                          <img src={m.imageUrl} alt="Generated" className="rounded-lg w-full" />
                          <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" /> Saved to your library
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            {loading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            )}
          </div>
          <div className="p-2 border-t border-border flex gap-2">
            <button
              onClick={toggleMic}
              aria-label={listening ? "Stop listening" : "Talk to Oracle"}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                listening
                  ? "bg-primary text-primary-foreground animate-pulse shadow-[0_0_15px_hsl(var(--primary)/0.6)]"
                  : "bg-muted text-muted-foreground hover:text-primary"
              }`}
            >
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={listening ? "Listening…" : "Ask anything, or 'generate image of…'"}
              className="flex-1 bg-muted rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default FloatingOracleHelper;
