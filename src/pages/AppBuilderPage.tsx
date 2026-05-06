import { getEdgeAuthTokenSync } from "@/lib/edgeAuth";
import { useState, useRef, useEffect, useCallback } from "react";
import SEO from "@/components/SEO";
import { Wrench, Code, Smartphone, X, Loader2, Download, Send, Bot, User, Globe, Rocket, CreditCard, DollarSign, Mic, MicOff, Volume2, VolumeX, Paperclip, Image as ImageIcon, ClipboardPaste, Play, ExternalLink } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
import { useUserMedia } from "@/hooks/useUserAvatars";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const TOOLS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tools`;
const AUTONOMOUS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/app-builder-autonomous`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;
// Male voice — George (per ElevenLabs voice pool)
const BUILDER_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

interface Attachment { id: string; name: string; type: string; dataUrl: string; size: number; }
interface AppProject { id: string; name: string; type: string; description: string; code: string; created: string; mediaId?: string; isPaid?: boolean; pricePoint?: string; }
interface ChatMessage { role: "user" | "assistant"; content: string; code?: string; attachments?: Attachment[]; }

// Strip emojis/markdown/urls for clean TTS
const cleanForSpeech = (text: string) =>
  text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/```[\s\S]*?```/g, " code block ")
    .replace(/`[^`]*`/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#>~`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);

const AppBuilderPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: userMedia } = useUserMedia();
  const [projects, setProjects] = useState<AppProject[]>([]);
  const [previewProject, setPreviewProject] = useState<AppProject | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "I'm your Master App Builder Oracle — full coding brain, voice, ears, and eyes.\n\nYou can:\n• Type, paste, or speak\n• Attach screenshots, images, or files\n• Paste a screen-print directly (Ctrl/Cmd+V)\n• I'll talk back through your speaker\n\nTry: \"Build me a paid meditation app for $4.99/mo\" or paste a screenshot and say \"clone this\"." }
  ]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const [buildStages, setBuildStages] = useState<{ stage: string; message: string; ok?: boolean }[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [loadedFromLibrary, setLoadedFromLibrary] = useState(false);

  // Voice I/O state
  const [voiceOutEnabled, setVoiceOutEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load saved apps
  useEffect(() => {
    if (loadedFromLibrary || !userMedia) return;
    const appMedia = userMedia.filter((m: any) => m.source_page === "app-builder" && m.media_type === "app");
    if (appMedia.length > 0) {
      const loaded: AppProject[] = appMedia.map((m: any) => {
        const meta = (m.metadata && typeof m.metadata === "object") ? m.metadata as Record<string, any> : {};
        return {
          id: m.id, name: m.title || "My App", type: "custom",
          description: meta.description || "", code: m.url || "",
          created: new Date(m.created_at).toLocaleDateString(), mediaId: m.id,
        };
      });
      setProjects(loaded);
    }
    setLoadedFromLibrary(true);
  }, [userMedia, loadedFromLibrary]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ===== Voice OUTPUT (TTS — male voice) =====
  const speak = useCallback(async (text: string) => {
    if (!voiceOutEnabled) return;
    const clean = cleanForSpeech(text);
    if (!clean) return;
    try {
      setIsSpeaking(true);
      const resp = await fetch(TTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getEdgeAuthTokenSync()}` },
        body: JSON.stringify({ text: clean, voiceId: BUILDER_VOICE_ID }),
      });
      if (!resp.ok) throw new Error("tts failed");
      const data = await resp.json();
      const src = data.audioContent ? `data:audio/mpeg;base64,${data.audioContent}` : data.audioUrl;
      if (!src) throw new Error("no audio");
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      const audio = new Audio(src);
      audioRef.current = audio;
      audio.onended = () => setIsSpeaking(false);
      audio.onerror = () => setIsSpeaking(false);
      await audio.play();
    } catch (e) {
      console.warn("TTS error", e);
      setIsSpeaking(false);
      // Fallback to browser speech synthesis (male voice if available)
      try {
        const u = new SpeechSynthesisUtterance(clean);
        const voices = window.speechSynthesis.getVoices();
        const male = voices.find(v => /male|david|george|daniel|brian|mark/i.test(v.name)) || voices[0];
        if (male) u.voice = male;
        u.pitch = 0.9; u.rate = 1.0;
        window.speechSynthesis.speak(u);
      } catch { /* ignore */ }
    }
  }, [voiceOutEnabled]);

  const stopSpeaking = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setIsSpeaking(false);
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
  };

  // ===== Voice INPUT (browser STT) =====
  const toggleListen = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Voice input not supported on this browser"); return; }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    let finalText = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t; else interim += t;
      }
      setInput((prev) => (finalText ? (prev ? prev + " " : "") + finalText : prev) + (interim ? " " + interim : ""));
    };
    rec.onerror = () => { setIsListening(false); };
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  };

  // ===== Attachments =====
  const fileToAttachment = (file: File): Promise<Attachment> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name || `pasted-${Date.now()}`,
      type: file.type || "application/octet-stream",
      dataUrl: String(reader.result),
      size: file.size,
    });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).slice(0, 6);
    const big = arr.find(f => f.size > 8 * 1024 * 1024);
    if (big) { toast.error(`${big.name} is too big (max 8MB)`); return; }
    try {
      const next = await Promise.all(arr.map(fileToAttachment));
      setAttachments(prev => [...prev, ...next].slice(0, 6));
      toast.success(`${next.length} file${next.length > 1 ? "s" : ""} attached`);
    } catch { toast.error("Could not read file"); }
  };

  const onPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const fileItems: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f) fileItems.push(f);
      }
    }
    if (fileItems.length) {
      e.preventDefault();
      await handleFiles(fileItems);
      toast.success("Screenshot pasted");
    }
  };

  const pasteFromClipboard = async () => {
    try {
      // Try image clipboard first
      if ((navigator as any).clipboard?.read) {
        const items = await (navigator as any).clipboard.read();
        const files: File[] = [];
        for (const it of items) {
          for (const t of it.types) {
            if (t.startsWith("image/")) {
              const blob = await it.getType(t);
              files.push(new File([blob], `pasted-${Date.now()}.png`, { type: t }));
            }
          }
        }
        if (files.length) { await handleFiles(files); return; }
      }
      // Fallback: text
      const text = await navigator.clipboard.readText();
      if (text) {
        const ta = textareaRef.current;
        const start = ta?.selectionStart ?? input.length;
        const end = ta?.selectionEnd ?? input.length;
        setInput(input.slice(0, start) + text + input.slice(end));
        toast.success("Text pasted");
      }
    } catch { toast.error("Clipboard blocked — try Ctrl/Cmd+V"); }
  };

  const removeAttachment = (id: string) => setAttachments(prev => prev.filter(a => a.id !== id));

  // ===== Save app =====
  const saveAppToLibrary = useCallback(async (project: AppProject): Promise<string | undefined> => {
    if (!user) { toast.error("Sign in to save apps to your library"); return; }
    try {
      let savedId: string | undefined;
      if (project.mediaId) {
        await supabase.from("user_media").update({
          title: project.name, url: project.code,
          metadata: { description: project.description, type: project.type } as any,
        }).eq("id", project.mediaId);
        savedId = project.mediaId;
      } else {
        const { data, error } = await supabase.from("user_media").insert([{
          user_id: user.id, media_type: "app", title: project.name, url: project.code,
          source_page: "app-builder",
          metadata: { description: project.description, type: project.type } as any,
        }]).select("id").single();
        if (error) throw error;
        savedId = data?.id;
      }
      // Notify Library to refresh instantly
      try { window.dispatchEvent(new CustomEvent("library:updated", { detail: { id: savedId } })); } catch { /* noop */ }
      toast.success("App saved to your Library");
      return savedId;
    } catch (e) { console.error("Failed to save app", e); toast.error("Failed to save app to library"); }
  }, [user]);

  // ===== Send (autonomous multi-stage pipeline) =====
  const sendMessage = async () => {
    const trimmed = input.trim();
    if ((!trimmed && attachments.length === 0) || isBuilding) return;
    if (trimmed) {
      const mod = (await import("@/lib/contentSafety")).moderatePrompt(trimmed);
      if (!mod.ok) { toast.error(mod.reason || "Prompt blocked"); return; }
    }

    const userMsg: ChatMessage = { role: "user", content: trimmed || "(see attached)", attachments: attachments.length ? attachments : undefined };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    const sentAttachments = attachments;
    setAttachments([]);
    setIsBuilding(true);
    setBuildStages([{ stage: "init", message: "Spinning up autonomous build pipeline…" }]);

    let code = "";
    let architecture = "";
    let errorMsg = "";

    try {
      const resp = await fetch(AUTONOMOUS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getEdgeAuthTokenSync()}` },
        body: JSON.stringify({
          prompt: trimmed,
          images: sentAttachments.filter(a => a.type.startsWith("image/")).map(a => a.dataUrl),
          currentCode: currentCode || undefined,
        }),
      });
      if (!resp.ok || !resp.body) {
        const txt = await resp.text().catch(() => "");
        throw new Error(txt || `HTTP ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 2);
          if (!block.startsWith("data:")) continue;
          const json = block.slice(5).trim();
          try {
            const evt = JSON.parse(json);
            if (evt.event === "stage") {
              setBuildStages(prev => [...prev, { stage: evt.stage, message: evt.message }]);
            } else if (evt.event === "done") {
              code = evt.code || "";
              architecture = evt.architecture || "";
            } else if (evt.event === "error") {
              errorMsg = evt.message || "Build error";
            }
          } catch { /* ignore parse */ }
        }
      }
      if (errorMsg) throw new Error(errorMsg);
      if (!code) throw new Error("Pipeline finished without code");

      const chatText = `Done! Built end-to-end across architect → backend → frontend → flesh-out → smoke test. ${architecture ? "\n\nArchitecture summary:\n" + architecture.slice(0, 400) : ""}`;
      const assistantMsg: ChatMessage = { role: "assistant", content: chatText, code };
      setMessages(prev => [...prev, assistantMsg]);
      speak("Your app is ready. Launch it to take a look.");

      setCurrentCode(code);
      const appName = (trimmed || "My App").substring(0, 30).replace(/[^a-zA-Z0-9 ]/g, "").trim() || "My App";
      let isPaid = false;
      let pricePoint: string | undefined;
      const metaMatch = code.match(/<meta\s+name=["']oracle-lunar-app-config["']\s+content=["']([^"']+)["']/i);
      if (metaMatch) {
        try {
          const cfg = JSON.parse(metaMatch[1].replace(/&quot;/g, '"'));
          isPaid = !!cfg.paid; pricePoint = cfg.price;
        } catch { /* ignore */ }
      }
      if (!isPaid && /\$\d|subscribe|paywall|premium|paid/i.test(trimmed)) isPaid = true;

      const existingProject = projects.find(p => p.name === appName);
      const project: AppProject = {
        id: existingProject?.id || Date.now().toString(),
        name: appName, type: "custom", description: trimmed, code,
        created: new Date().toLocaleDateString(),
        mediaId: existingProject?.mediaId, isPaid, pricePoint,
      };
      const mediaId = await saveAppToLibrary(project);
      if (mediaId) {
        project.mediaId = mediaId;
        if (!project.id || project.id === Date.now().toString()) project.id = mediaId;
      }
      setProjects(prev => {
        const updated = [...prev];
        const existingIdx = updated.findIndex(p => p.name === appName);
        if (existingIdx >= 0) updated[existingIdx] = project; else updated.unshift(project);
        return updated;
      });
      setPreviewProject(project);
      toast.success("App built & saved to Library!");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Build failed";
      const errText = `Sorry, the autonomous build hit an error: ${msg}. Try again or simplify the request.`;
      setMessages(prev => [...prev, { role: "assistant", content: errText }]);
      speak("Build hit an error. Please try again.");
      toast.error("Build failed — try again");
    } finally {
      setIsBuilding(false);
      // Keep stages visible briefly so user can read final status
      setTimeout(() => setBuildStages([]), 4000);
    }
  };

  const downloadApp = (project: AppProject) => {
    const blob = new Blob([project.code], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.replace(/\s/g, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("App downloaded!");
  };

  const launchApp = (project: AppProject) => {
    if (!project.code) { toast.error("No app code to launch"); return; }
    const blob = new Blob([project.code], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) {
      toast.error("Pop-up blocked — allow pop-ups to launch the app");
      URL.revokeObjectURL(url);
      return;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    toast.success(`Launched "${project.name}"`);
  };

  return (
    <>
    <SEO title="AI App Builder — Build Web Apps By Chatting" description="ORACLE LUNAR App Builder: voice + screenshot + file input. Describe an app and the AI builds it." path="/app-builder" />
    <div className="min-h-screen bg-background flex flex-col">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-primary/10"><Wrench className="w-7 h-7 text-primary" /></div>
          <div>
            <h1 className="text-xl font-bold text-primary">App Builder Oracle</h1>
            <p className="text-muted-foreground text-xs">Voice • Screenshots • Files • Ultimate coding brain</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => { if (isSpeaking) stopSpeaking(); setVoiceOutEnabled(v => !v); }}
              className={`p-2 rounded-lg border transition-colors ${voiceOutEnabled ? "bg-primary/10 border-primary/40 text-primary" : "bg-card border-border text-muted-foreground"}`}
              title={voiceOutEnabled ? "Mute voice" : "Unmute voice"}
            >
              {voiceOutEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Preview */}
      {previewProject && (
        <div className="px-4 mb-2">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-semibold text-foreground">Live Preview: {previewProject.name}</h3>
            <div className="flex gap-2">
              <button onClick={() => launchApp(previewProject)} className="text-xs text-primary flex items-center gap-1 font-semibold"><Play className="w-3 h-3" /> Launch</button>
              <button onClick={() => downloadApp(previewProject)} className="text-xs text-primary flex items-center gap-1"><Download className="w-3 h-3" /> Download</button>
              <button onClick={() => setPreviewProject(null)} className="text-xs text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
          </div>
          <iframe srcDoc={previewProject.code} className="w-full h-64 rounded-xl border border-border bg-white" sandbox="allow-scripts" title="App Preview" />

          <div className="mt-3 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-amber-500/5 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Rocket className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-foreground">Publish & Sell</span>
                {previewProject.isPaid && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                    <DollarSign className="w-2.5 h-2.5" /> PAID {previewProject.pricePoint || ""}
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => launchApp(previewProject)} className="col-span-2 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90">
                <Play className="w-4 h-4" /> Launch App in New Tab
              </button>
              <button onClick={() => {
                  const slug = previewProject.name.replace(/\s+/g, "-").toLowerCase();
                  const placeholderUrl = `https://${slug}.lovable.app`;
                  navigate(`/web-wrapper?url=${encodeURIComponent(placeholderUrl)}&name=${encodeURIComponent(previewProject.name)}`);
                }}
                className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary/20 border border-primary/40 text-primary text-xs font-semibold hover:bg-primary/30">
                <Smartphone className="w-3.5 h-3.5" /> Wrap for Play Store
              </button>
              <button onClick={() => navigate("/subscribe")} className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-card border border-border text-foreground text-xs font-semibold hover:border-primary">
                <CreditCard className="w-3.5 h-3.5" /> Stripe Setup
              </button>
              <button onClick={() => window.open("https://play.google.com/console/u/0/developers", "_blank")} className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-card border border-border text-foreground text-xs hover:border-primary">
                <Globe className="w-3.5 h-3.5" /> Play Console
              </button>
              <button onClick={() => downloadApp(previewProject)} className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-card border border-border text-foreground text-xs hover:border-primary">
                <Download className="w-3.5 h-3.5" /> Download HTML
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4" style={{ maxHeight: previewProject ? "calc(100vh - 520px)" : "calc(100vh - 240px)" }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className={`w-4 h-4 text-primary ${isSpeaking && i === messages.length - 1 ? "animate-pulse" : ""}`} />
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card border border-border text-foreground rounded-bl-md"}`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {msg.attachments.map(a => (
                    a.type.startsWith("image/") ? (
                      <img key={a.id} src={a.dataUrl} alt={a.name} className="w-20 h-20 object-cover rounded-lg border border-border" />
                    ) : (
                      <span key={a.id} className="text-[10px] px-2 py-1 rounded bg-secondary text-secondary-foreground flex items-center gap-1">
                        <Paperclip className="w-3 h-3" /> {a.name}
                      </span>
                    )
                  ))}
                </div>
              )}
              {msg.code && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-1 rounded-full flex items-center gap-1">
                    <Code className="w-3 h-3" /> App generated ✓
                  </span>
                  {msg.role === "assistant" && (
                    <button onClick={() => speak(msg.content)} className="text-[10px] text-primary hover:underline flex items-center gap-1">
                      <Volume2 className="w-3 h-3" /> Replay
                    </button>
                  )}
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
        {isBuilding && (
          <div className="flex gap-2 justify-start">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-primary animate-pulse" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Building your app...
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Projects bar */}
      {projects.length > 0 && (
        <div className="px-4 py-2 border-t border-border bg-card/50">
          <div className="flex gap-2 overflow-x-auto">
            {projects.map(p => (
              <div key={p.id} className={`flex items-center gap-1 rounded-full text-xs whitespace-nowrap border transition-colors overflow-hidden ${
                  previewProject?.id === p.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary"
                }`}>
                <button onClick={() => { setPreviewProject(p); setCurrentCode(p.code); }}
                  className="flex items-center gap-1.5 pl-3 py-1.5">
                  <Code className="w-3 h-3" /> {p.name}
                </button>
                <button onClick={() => launchApp(p)} title="Launch app" className="px-2 py-1.5 hover:bg-primary/20 border-l border-border/50">
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attachment preview row */}
      {attachments.length > 0 && (
        <div className="px-4 py-2 border-t border-border bg-card/50 flex flex-wrap gap-2">
          {attachments.map(a => (
            <div key={a.id} className="relative group">
              {a.type.startsWith("image/") ? (
                <img src={a.dataUrl} alt={a.name} className="w-14 h-14 object-cover rounded-lg border border-border" />
              ) : (
                <div className="w-14 h-14 rounded-lg border border-border bg-card flex items-center justify-center text-[9px] text-muted-foreground p-1 text-center break-all">
                  <Paperclip className="w-3 h-3 mr-0.5" />{a.name.slice(0, 12)}
                </div>
              )}
              <button onClick={() => removeAttachment(a.id)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-card">
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.txt,.md,.json,.csv,.html,.css,.js,.ts,.tsx,.jsx,.py"
            className="hidden"
            onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80"
            title="Attach files or screenshots"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <button
            onClick={pasteFromClipboard}
            className="p-2.5 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80"
            title="Paste from clipboard (image or text)"
          >
            <ClipboardPaste className="w-4 h-4" />
          </button>
          <button
            onClick={toggleListen}
            className={`p-2.5 rounded-xl transition-colors ${isListening ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
            title={isListening ? "Stop listening" : "Speak"}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onPaste={onPaste}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Describe the app, paste a screenshot (Ctrl/Cmd+V), or hit the mic..."
            rows={1}
            style={{ userSelect: "text" }}
            className="flex-1 px-4 py-3 bg-input border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary resize-none max-h-32 select-text"
            disabled={isBuilding}
          />
          <button onClick={sendMessage} disabled={isBuilding || (!input.trim() && attachments.length === 0)}
            className="p-3 bg-primary text-primary-foreground rounded-xl disabled:opacity-50">
            <Send className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Paste screenshots</span>
          <span className="flex items-center gap-1"><Mic className="w-3 h-3" /> Voice in</span>
          <span className="flex items-center gap-1"><Volume2 className="w-3 h-3" /> Male voice out</span>
        </div>
      </div>
    </div>
    </>
  );
};
export default AppBuilderPage;
