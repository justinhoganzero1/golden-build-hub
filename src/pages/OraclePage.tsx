import { getEdgeAuthTokenSync } from "@/lib/edgeAuth";
import { useState, useRef, useEffect, useCallback } from "react";
import SEO from "@/components/SEO";
import { cleanTextForPremiumSpeech, cleanTextForSpeech } from "@/lib/utils";
import { Send, Mic, Users, Volume2, VolumeX, Settings2, LayoutGrid, Eye, X, Plus, UserPlus, Edit2, Crown, Bomb, Paperclip } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import { useScribe } from "@elevenlabs/react";
import { useMute } from "@/contexts/MuteContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useUserAvatars, useSaveMedia, useCreateAvatar, type UserAvatar } from "@/hooks/useUserAvatars";
import { useOracleMemories, useSaveOracleMemory, useAdPreferences, useUpdateAdPreferences, shouldShowPromo, formatMemoriesForPrompt } from "@/hooks/useOracleMemory";
import { useSubscription } from "@/hooks/useSubscription";
import SystemDoctorPanel from "@/components/SystemDoctorPanel";
import { MASTER_AI_AVATAR } from "@/assets/master-ai-avatar";
import LivingAvatar from "@/components/LivingAvatar";
import AudioClarifyDialog, { intentToPrompt, type AudioIntent } from "@/components/AudioClarifyDialog";
import { detectTruncation } from "@/lib/truncationDetector";
import { saveOracleTextTurn } from "@/lib/saveToLibrary";

interface Message {
  id: string;
  role: "user" | "assistant";
  sender: string;
  emoji: string;
  color: string;
  content: string;
  avatar_url?: string;
  isAppResult?: boolean;
}

interface ChatAgent {
  name: string;
  emoji: string;
  color: string;
  personality: string;
  active: boolean;
  locked: boolean;
  avatar_url?: string;
  voice_style?: string;
  isUserAvatar?: boolean;
  avatarId?: string;
  purpose?: string;
}

const DEFAULT_AGENTS: ChatAgent[] = [
  { name: "Oracle", emoji: "🔮", color: "#9b87f5", personality: "", active: true, locked: false, voice_style: "Bruno (American General • Warm & Friendly)" },
  { name: "Luna", emoji: "🌙", color: "#9b87f5", personality: "creative and artistic", active: false, locked: false },
  { name: "Max", emoji: "🤖", color: "#0EA5E9", personality: "analytical and logical", active: false, locked: true },
  { name: "Aria", emoji: "💜", color: "#D946EF", personality: "empathetic and caring", active: false, locked: true },
  { name: "Spark", emoji: "⚡", color: "#F97316", personality: "energetic and fun", active: false, locked: true },
];

const ORACLE_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-chat`;
const FRIENDS_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-friends-chat`;

// ============ NAMING SYSTEM ============
function getAgentNames(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem("oracle-lunar-agent-names") || "{}");
  } catch { return {}; }
}
function setAgentName(defaultName: string, customName: string) {
  const names = getAgentNames();
  names[defaultName] = customName;
  localStorage.setItem("oracle-lunar-agent-names", JSON.stringify(names));
}
function getDisplayName(defaultName: string): string {
  return getAgentNames()[defaultName] || defaultName;
}

// ============ ORACLE MODE (orb vs avatar) ============
// Default = "avatar" so the master AI face is shown for new users.
function getOracleMode(): { mode: "orb" | "avatar"; avatarId?: string } {
  try {
    return JSON.parse(localStorage.getItem("oracle-lunar-mode") || '{"mode":"avatar"}');
  } catch { return { mode: "avatar" }; }
}
function setOracleMode(mode: "orb" | "avatar", avatarId?: string) {
  localStorage.setItem("oracle-lunar-mode", JSON.stringify({ mode, avatarId }));
}

function getStoredOracleMasterVoice(): { id?: string; settings?: Record<string, unknown> | null } | null {
  try {
    const raw = localStorage.getItem("oracle-lunar-master-voice");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const FINAL_ONLY_PATTERNS = [
  /\b(?:loop|work|keep\s+(?:going|working|trying)|continue|run|try|retry|search|look|build|make|create|generate|code|finish)\b[\s\S]{0,240}\b(?:til+l?|until|untill|untl)\b[\s\S]{0,240}\b(?:totally\s+|fully\s+|completely\s+|all\s+the\s+way\s+)?(?:finished|finish|done|complete|completed|fixed|finshed|finised|compleat|dun)\b/i,
  /\b(?:don'?t|do\s+not|dont|never|stop)\s+(?:reply|respond|answer|message|talk|speak|update|say\s+anything)\b[\s\S]{0,240}\b(?:til+l?|until|untill|untl|before)\b[\s\S]{0,240}\b(?:finished|done|complete|completed|fixed|finshed|finised|compleat|dun)\b/i,
  /\b(?:only|just)\s+(?:reply|respond|answer|message|talk|speak|update)\b[\s\S]{0,240}\b(?:when|after|once)\b[\s\S]{0,240}\b(?:finished|done|complete|completed|fixed|finshed|finised|compleat|dun)\b/i,
  /\b(?:silent|quiet|no\s+(?:reply|response|updates?|messages?|talking|speaking))\b[\s\S]{0,240}\b(?:til+l?|until|untill|untl|while|during)\b[\s\S]{0,240}\b(?:finished|done|complete|completed|fixed|finshed|finised|compleat|dun|working|building|generating)\b/i,
];

function wantsFinalOnlyMode(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  return FINAL_ONLY_PATTERNS.some((pattern) => pattern.test(normalized));
}

const OraclePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isMuted, toggleMute } = useMute();
  const { data: userAvatars = [] } = useUserAvatars();
  const { data: oracleMemories = [] } = useOracleMemories();
  const saveMemory = useSaveOracleMemory();
  const saveMedia = useSaveMedia();
  const createAvatar = useCreateAvatar();
  const { data: adPrefs } = useAdPreferences();
  const updateAdPrefs = useUpdateAdPreferences();
  const { subscribed, tier, loading: subLoading } = useSubscription();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [agents, setAgents] = useState<ChatAgent[]>(DEFAULT_AGENTS);
  const [showFriendPanel, setShowFriendPanel] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showDoctor, setShowDoctor] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  // Audio-truncation clarifier — when the Oracle detects a cut-off message
  // like "udio on my device", we surface a quick form before the prompt is sent.
  const [audioClarify, setAudioClarify] = useState<{ open: boolean; fragment: string }>({ open: false, fragment: "" });
  const [micPermGranted, setMicPermGranted] = useState(false);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);
  const [renamingAgent, setRenamingAgent] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [oracleMode, setOracleModeState] = useState(getOracleMode);
  const [showOracleSwap, setShowOracleSwap] = useState(false);
  const [explosionActive, setExplosionActive] = useState(false);
  const [pendingNav, setPendingNav] = useState<string | null>(null);
  // Server-reported free-tier daily usage (null = unknown / bypassed for paid+admin)
  const [usage, setUsage] = useState<{ count: number; limit: number; remaining: number } | null>(null);
  const [oracleMedia, setOracleMedia] = useState<{ kind: "image" | "video"; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const isOwner = user?.email?.toLowerCase() === "justinbretthogan@gmail.com";

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    if (file.size > 1024 * 1024 * 1024) { toast.error("File too large (max 1 GB)"); return; }
    setUploading(true);
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onloadend = () => res(fr.result as string);
        fr.onerror = rej;
        fr.readAsDataURL(file);
      });
      const mediaType = file.type.startsWith("video") ? "video"
        : file.type.startsWith("audio") ? "audio"
        : file.type.startsWith("image") ? "image" : "image";
      try {
        await saveMedia.mutateAsync({
          media_type: mediaType,
          title: file.name,
          url: dataUrl,
          source_page: "oracle-upload",
          metadata: { kind: "upload", mime: file.type, size: file.size },
        });
      } catch { /* non-fatal */ }
      toast.success(`Attached ${file.name} — sent to ${oracleName}`);
      const sizeKb = Math.round(file.size / 1024);
      const prompt = `[The user just attached a file to chat]\nName: ${file.name}\nType: ${file.type || "unknown"}\nSize: ${sizeKb} KB\nIt is now saved to their Media Library. Acknowledge it warmly, then ask the user what they'd like you to do with it (analyze, edit, build something from it, save for later, etc.). If it's an image and they want it transformed, suggest navigating to the Photography Hub. If they want to build an app from it, offer the App Builder. Ask one focused follow-up question.`;
      await sendMessage(prompt);
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };


  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionRef = useRef<any>(null);
  const isLoadingRef = useRef(isLoading);
  const isListeningRef = useRef(isListening);
  const isSpeakingRef = useRef(isSpeaking);
  const sendMessageRef = useRef<(text: string) => void>();
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef("");
  const latestHeardTextRef = useRef("");
  const alwaysListenRef = useRef(false);
  const scribeModeRef = useRef(false);
  // Brief cooldown after speech finishes so the mic doesn't grab the trailing audio echo.
  const echoCooldownUntilRef = useRef(0);
  // Wake-word voice channel — Oracle stays silently armed and only responds
  // after the user says "hey oracle-lunar". Closes on "thanks oracle-lunar" / "goodbye oracle-lunar"
  // or after 20s of silence. Reopens on the next "hey oracle-lunar".
  const [voiceChannelOpen, setVoiceChannelOpen] = useState(false);
  const voiceChannelOpenRef = useRef(false);
  const voiceChannelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether we paused the recognizer because Oracle is speaking, so we can resume after.
  const pausedForSpeechRef = useRef(false);
  const explosionAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastAutoSentRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });

  const normalizeCapturedText = useCallback((value: string) => value.replace(/\s+/g, " ").trim().toLowerCase(), []);

  const mergeCapturedTranscript = useCallback((existing: string, incoming: string) => {
    const current = existing.replace(/\s+/g, " ").trim();
    const next = incoming.replace(/\s+/g, " ").trim();
    if (!next) return current;
    if (!current) return next;

    const normalizedCurrent = normalizeCapturedText(current);
    const normalizedNext = normalizeCapturedText(next);

    if (normalizedCurrent === normalizedNext || normalizedCurrent.endsWith(normalizedNext)) return current;
    if (normalizedNext.startsWith(normalizedCurrent)) return next;

    const maxOverlap = Math.min(current.length, next.length);
    for (let i = maxOverlap; i > 0; i--) {
      const currentTail = normalizeCapturedText(current.slice(-i));
      const nextHead = normalizeCapturedText(next.slice(0, i));
      if (currentTail && currentTail === nextHead) {
        return `${current} ${next.slice(i)}`.replace(/\s+/g, " ").trim();
      }
    }

    return `${current} ${next}`.replace(/\s+/g, " ").trim();
  }, [normalizeCapturedText]);

  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  // Once the mic is on, Oracle is ALWAYS awake and listening. The mic only
  // turns off when the user says "enough oracle" / "mute my mic" or taps the
  // mic button. Wake words are still accepted but not required.
  const wakeActiveRef = useRef(true);
  const [wakeActive, setWakeActive] = useState(true);
  const WAKE_RE = /\b(hey|hi|hello|ok|okay)[\s,]+(oracle|oracal|oracul|oraclel|oricle)\b/i;
  const SLEEP_RE = /\b(that'?s\s+all|thats\s+all|goodbye|bye|go\s+to\s+sleep)[\s,]*(oracle|oracal|oracul|oraclel|oricle)?\b/i;
  // Hard mute commands — these fully disable the mic until user re-enables it.
  const MUTE_RE = /\b(enough\s+(oracle|oracal|oracul)|mute\s+(my\s+)?mic(rophone)?|stop\s+listening|turn\s+off\s+(the\s+)?mic(rophone)?)\b/i;

  const stripWakePhrase = (t: string) => t.replace(WAKE_RE, "").replace(/^[\s,.!?-]+/, "").trim();

  const handleCapturedVoiceText = useCallback((rawText: string) => {
    const text = rawText.replace(/\s+/g, " ").trim();
    if (!text || text.length < 2) {
      setInput("");
      return;
    }

    // Hard mute — fully turn the mic off (user said "enough oracle" / "mute my mic").
    if (MUTE_RE.test(text)) {
      try { window.speechSynthesis?.cancel(); } catch {}
      alwaysListenRef.current = false;
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      finalTranscriptRef.current = "";
      latestHeardTextRef.current = "";
      lastAutoSentRef.current = { text: "", at: 0 };
      if (recognitionRef.current) {
        try { recognitionRef.current.onend = null; } catch {}
        try { recognitionRef.current.onresult = null; } catch {}
        try { recognitionRef.current.stop(); } catch {}
        try { recognitionRef.current.abort?.(); } catch {}
        recognitionRef.current = null;
      }
      setIsListening(false);
      setInput("");
      toast("Mic off. Tap the mic to talk again.", { duration: 3000 });
      return;
    }

    // Soft sleep — Oracle stops auto-replying but mic stays open.
    if (SLEEP_RE.test(text)) {
      wakeActiveRef.current = false;
      setWakeActive(false);
      try { window.speechSynthesis?.cancel(); } catch {}
      setInput("");
      toast("Oracle paused. Say \"hey Oracle\" to wake her, or tap mic to mute.", { duration: 3500 });
      return;
    }

    // Wake word — re-activate; if more was said after it, send the remainder.
    const hasWake = WAKE_RE.test(text);
    if (hasWake && !wakeActiveRef.current) {
      wakeActiveRef.current = true;
      setWakeActive(true);
      const remainder = stripWakePhrase(text);
      setInput("");
      if (remainder.length >= 2) {
        const normalized = normalizeCapturedText(remainder);
        lastAutoSentRef.current = { text: normalized, at: Date.now() };
        sendMessageRef.current?.(remainder);
      } else {
        toast("Oracle is listening…", { duration: 2000 });
      }
      return;
    }

    // Asleep — drop everything else (mic remains active for wake detection).
    if (!wakeActiveRef.current) {
      setInput("");
      return;
    }

    const cleaned = hasWake ? stripWakePhrase(text) : text;
    if (!cleaned || cleaned.length < 2) {
      setInput("");
      return;
    }

    const normalized = normalizeCapturedText(cleaned);
    if (
      normalized &&
      lastAutoSentRef.current.text === normalized &&
      Date.now() - lastAutoSentRef.current.at < 8000
    ) {
      setInput("");
      return;
    }

    lastAutoSentRef.current = { text: normalized, at: Date.now() };
    setInput("");
    sendMessageRef.current?.(cleaned);
  }, [normalizeCapturedText]);

  const flushCapturedVoiceText = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    const text = latestHeardTextRef.current.replace(/\s+/g, " ").trim();
    latestHeardTextRef.current = "";
    finalTranscriptRef.current = "";

    if (!text) {
      setInput("");
      return;
    }

    handleCapturedVoiceText(text);
  }, [handleCapturedVoiceText]);

  const scheduleCapturedVoiceFlush = useCallback((delay = 1100) => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      flushCapturedVoiceText();
    }, delay);
  }, [flushCapturedVoiceText]);

  // Old realtime token/scribe path disabled — Oracle now uses one direct browser mic pipeline only.
  const scribe = {
    connect: async () => {},
    disconnect: async () => {},
  } as any;

  const startAlwaysListeningRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
    if (isSpeaking) {
      if (alwaysListenRef.current && recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      finalTranscriptRef.current = "";
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    } else {
      // Oracle just finished speaking — set anti-echo cooldown then
      // proactively re-arm the always-listening loop. Some browsers swallow
      // recognition.onend after stop(), so we don't rely on it alone.
      echoCooldownUntilRef.current = Date.now() + 1200;
      if (alwaysListenRef.current) {
        window.setTimeout(() => {
          if (!alwaysListenRef.current) return;
          if (!recognitionRef.current) {
            try { startAlwaysListeningRef.current?.(); } catch {}
            return;
          }
          try { recognitionRef.current.start(); } catch {}
        }, 1300);
      }
    }
  }, [isSpeaking]);

  // Prefetch the user's current daily Oracle usage so the badge renders before their first message.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const isPaid = subscribed || (tier && tier !== "free");
        if (isPaid) { setUsage(null); return; }
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        if (user.email?.toLowerCase() === "justinbretthogan@gmail.com") { setUsage(null); return; }
        const today = new Date().toISOString().slice(0, 10);
        const { data } = await supabase
          .from("oracle_chat_usage")
          .select("message_count")
          .eq("user_id", user.id)
          .eq("usage_date", today)
          .maybeSingle();
        const count = data?.message_count ?? 0;
        const limit = 25;
        if (!cancelled) setUsage({ count, limit, remaining: Math.max(0, limit - count) });
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [subscribed, tier]);

  // Get the oracle avatar if in avatar mode
  const oracleAvatar = oracleMode.mode === "avatar" && oracleMode.avatarId
    ? userAvatars.find(a => a.id === oracleMode.avatarId)
    : null;

  const oracleName = getDisplayName("Oracle");

  // Track whether we've already seeded the master oracle from the DB this session.
  // Without this guard, every react-query refetch of `userAvatars` (focus/reconnect)
  // overwrites the user's mid-session Oracle swap and resets all assigned voices,
  // making the avatar "vanish" and a new TTS voice start mid-conversation.
  const masterSeededRef = useRef(false);

  // Merge user avatars into agents list + (one-time) sync master Oracle avatar from DB
  useEffect(() => {
    if (userAvatars.length === 0) return;

    // 1) Master avatar = is_default + purpose='oracle' (DB-backed, survives logout).
    //    Only apply ONCE per session, and only if the user hasn't already chosen
    //    a different avatar in this session.
    if (!masterSeededRef.current) {
      const masterOracle = userAvatars.find(a => a.is_default && a.purpose === "oracle");
      const current = getOracleMode();
      const userHasChoice = current.mode === "avatar" && current.avatarId
        && userAvatars.some(a => a.id === current.avatarId);
      if (masterOracle && !userHasChoice) {
        setOracleMode("avatar", masterOracle.id);
        setOracleModeState({ mode: "avatar", avatarId: masterOracle.id });
      }
      masterSeededRef.current = true;
    }

    // 2) Add user avatars as orbiting agents — preserve existing voice assignments.
    setAgents(prev => {
      const existing = prev.filter(a => !a.isUserAvatar);
      const userAgents: ChatAgent[] = userAvatars
        .filter(a => a.purpose === "ai-friend" || a.purpose === "partner" || a.purpose === "oracle")
        .map(a => ({
          name: a.name,
          emoji: a.purpose === "partner" ? "💕" : a.purpose === "oracle" ? "🔮" : "🤖",
          color: a.purpose === "partner" ? "#EC4899" : "#9b87f5",
          personality: a.personality || "helpful and friendly",
          active: false,
          locked: false,
          avatar_url: a.image_url || undefined,
          voice_style: a.voice_style || undefined,
          isUserAvatar: true,
          avatarId: a.id,
          purpose: a.purpose,
        }));
      // NOTE: do NOT clear voiceMapRef here — that resets every assistant voice
      // mid-session whenever the avatars query refetches. Only prune entries for
      // avatars that no longer exist.
      const validNames = new Set([...existing.map(a => a.name), ...userAgents.map(a => a.name)]);
      for (const name of Array.from(voiceMapRef.current.keys())) {
        if (!validNames.has(name)) voiceMapRef.current.delete(name);
      }
      return [...existing, ...userAgents];
    });
  }, [userAvatars]);

  const activeAgents = agents.filter(a => a.active && a.name !== "Oracle" && a.name !== oracleName);
  const [showDebate, setShowDebate] = useState(true);
  const [debateActive, setDebateActive] = useState(false);
  const debateCheckedRef = useRef(false);

  // Assign unique voices to each agent — prefer high-quality neural/natural voices
  const voiceMapRef = useRef<Map<string, SpeechSynthesisVoice>>(new Map());
  const getVoiceForAgent = useCallback((agentName: string): SpeechSynthesisVoice | undefined => {
    if (voiceMapRef.current.has(agentName)) return voiceMapRef.current.get(agentName);
    const allVoices = window.speechSynthesis.getVoices();
    const englishVoices = allVoices.filter(v => v.lang.startsWith("en"));

    // Score voices by quality — neural/natural voices sound far less robotic
    const scoreVoice = (v: SpeechSynthesisVoice): number => {
      const n = v.name.toLowerCase();
      let s = 0;
      if (n.includes("neural") || n.includes("natural")) s += 50;
      if (n.includes("online") || n.includes("enhanced")) s += 30;
      if (n.includes("google")) s += 20;
      if (n.includes("microsoft")) s += 15;
      if (n.includes("premium")) s += 25;
      if (v.localService === false) s += 10; // remote voices are usually better
      return s;
    };

    // Check if this agent has a saved voice_style from Voice Studio
    const agent = agents.find(a => a.name === agentName);
    const voiceStyle = agent?.voice_style || "";

    // Try to match accent/style keywords from the saved voice to a system voice
    if (voiceStyle) {
      const styleLower = voiceStyle.toLowerCase();
      const candidates = allVoices.filter(v => {
        const vName = v.name.toLowerCase();
        if (styleLower.includes("british") && (vName.includes("uk") || vName.includes("british") || vName.includes("daniel"))) return true;
        if (styleLower.includes("australian") && (vName.includes("australia") || vName.includes("karen"))) return true;
        if (styleLower.includes("indian") || styleLower.includes("hindi")) return vName.includes("india") || vName.includes("rishi");
        if (styleLower.includes("irish") && vName.includes("moira")) return true;
        if (styleLower.includes("scottish") && vName.includes("fiona")) return true;
        if (styleLower.includes("french") && v.lang.startsWith("fr")) return true;
        if (styleLower.includes("german") && v.lang.startsWith("de")) return true;
        if (styleLower.includes("spanish") && v.lang.startsWith("es")) return true;
        if (styleLower.includes("italian") && v.lang.startsWith("it")) return true;
        if (styleLower.includes("japanese") && v.lang.startsWith("ja")) return true;
        if (styleLower.includes("korean") && v.lang.startsWith("ko")) return true;
        if (styleLower.includes("female") && vName.includes("female")) return true;
        if (styleLower.includes("male") && vName.includes("male")) return true;
        return false;
      });
      // Pick the highest quality match
      if (candidates.length > 0) {
        candidates.sort((a, b) => scoreVoice(b) - scoreVoice(a));
        voiceMapRef.current.set(agentName, candidates[0]);
        return candidates[0];
      }
    }

    const usedVoices = new Set(voiceMapRef.current.values());
    const available = englishVoices.filter(v => !usedVoices.has(v));
    // Sort available by quality score — always prefer neural/natural voices
    available.sort((a, b) => scoreVoice(b) - scoreVoice(a));
    const voice = available.length > 0 ? available[0] : englishVoices[0];
    if (voice) voiceMapRef.current.set(agentName, voice);
    return voice;
  }, [agents]);

  const speechQueueRef = useRef<Array<{ text: string; agentName: string }>>([]);
  const isSpeakingQueueRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  // Monotonically-increasing token. Each new utterance bumps it; any in-flight
  // ElevenLabs stream / browser TTS that sees a stale token aborts immediately.
  // This is the single source of truth that prevents two voices overlapping.
  const speechTokenRef = useRef(0);
  const cancelCurrentSpeech = useCallback(() => {
    speechTokenRef.current += 1;
    try { window.speechSynthesis?.cancel(); } catch {}
    try {
      const a = currentAudioRef.current;
      if (a) {
        a.onended = null; a.onerror = null;
        a.pause();
        try { a.src = ""; a.load(); } catch {}
      }
    } catch {}
    currentAudioRef.current = null;
    setIsSpeaking(false);
  }, []);

  const ELEVENLABS_TTS_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/elevenlabs-tts`;
  const SPEECH_THERAPIST_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/speech-therapist`;

  // Track the most recent user message so the speech therapist can mirror tone.
  const lastUserMessageRef = useRef<string>("");

  // Speech-therapist coach — runs the full 20-layer human voice stack
  // (emotional intelligence, human quirks, prosody/melody, pronunciation cleanup,
  // self-listen QA). Soft-fails to the original text so TTS never breaks.
  const coachSpeech = useCallback(async (raw: string, mood = "auto"): Promise<string> => {
    try {
      const resp = await fetch(SPEECH_THERAPIST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({
          text: raw,
          mood,
          persona: "oracle",
          userContext: lastUserMessageRef.current || "",
          qa: true,
        }),
      });
      if (!resp.ok) return raw;
      const data = await resp.json().catch(() => null);
      const coached = (data?.text as string | undefined)?.trim();
      return coached && coached.length > 0 ? coached : raw;
    } catch {
      return raw;
    }
  }, [SPEECH_THERAPIST_URL]);

  // Premium ElevenLabs TTS for the Oracle — uses the EXACT voice + settings
  // the user tuned in Voice Studio so the Oracle sounds identical to the preview.
  const speakWithElevenLabs = useCallback(async (text: string): Promise<boolean> => {
    try {
      // Read the master voice the user picked in Voice Studio (falls back to Sarah)
      const storedMasterVoice = typeof localStorage !== "undefined" ? getStoredOracleMasterVoice() : null;
      const masterVoiceId = storedMasterVoice?.id || ((typeof localStorage !== "undefined" && localStorage.getItem("oracle-lunar-voice")) || "EXAVITQu4vr4xnSDxMaL");
      let masterSettings: Record<string, unknown> | null = null;
      try {
        const raw = storedMasterVoice?.settings
          ? JSON.stringify(storedMasterVoice.settings)
          : (typeof localStorage !== "undefined" ? localStorage.getItem("oracle-lunar-voice-settings") : null);
        if (raw) masterSettings = JSON.parse(raw);
      } catch {}

      // Keep Oracle's voice stable. Do NOT run the speech-therapist rewrite here,
      // because it can alter pacing/phrasing and make the same saved voice sound
      // like a different person on some devices.
      const prepared = text.replace(/\s{3,}/g, "  ").trim();
      if (!prepared) return false;
      // Snapshot the token at the moment we start. If anything else cancels or
      // queues a new utterance, our token will no longer match the live one
      // and we abort gracefully — guaranteeing only ONE voice ever plays.
      const myToken = speechTokenRef.current;
      const isLive = () => speechTokenRef.current === myToken;

      const hasSSML = false;
      const hasCustomMaster = !!masterSettings;

      // Always favor the saved Oracle voice configuration so playback stays
      // consistent and we never slip into a different-sounding fallback voice.
      const savedModelId = (masterSettings?.model_id as string | undefined) || undefined;
      const modelId = savedModelId;

      const response = await fetch(ELEVENLABS_TTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({
          text: prepared,
          voiceId: masterVoiceId,
          fast: false,
          modelId,
          settings: hasCustomMaster
            ? {
                // Use the user's tuned values verbatim — no caps, no overrides
                stability: masterSettings?.stability,
                similarity_boost: masterSettings?.similarity_boost,
                style: masterSettings?.style,
                use_speaker_boost: masterSettings?.use_speaker_boost,
                speed: masterSettings?.speed,
              }
            : {
                // Defaults only when nothing was saved
                stability: 0.35,
                similarity_boost: 0.85,
                style: 0.65,
                use_speaker_boost: true,
                speed: 0.9,
              },
        }),
      });
      if (!response.ok || !response.body) return false;
      const contentType = response.headers.get("Content-Type") || "";
      if (contentType.includes("application/json")) return false;

      // === STREAMING PLAYBACK via MediaSource ===
      // Start playing the first MP3 frames the moment they arrive instead of
      // waiting for the entire blob. Cuts time-to-first-sound by 1-3 seconds.
      const mediaSourceSupported =
        typeof window !== "undefined" &&
        "MediaSource" in window &&
        (window as any).MediaSource.isTypeSupported?.("audio/mpeg");

      if (mediaSourceSupported) {
        const mediaSource = new MediaSource();
        const audio = new Audio();
        audio.src = URL.createObjectURL(mediaSource);
        currentAudioRef.current = audio;
        audio.volume = 0.95;
        audio.playbackRate = 1.0;
        // Smoother playback: let the browser buffer ahead instead of starving.
        audio.preload = "auto";

        const sourceBuffer = await new Promise<SourceBuffer>((resolve, reject) => {
          mediaSource.addEventListener(
            "sourceopen",
            () => {
              try { resolve(mediaSource.addSourceBuffer("audio/mpeg")); }
              catch (e) { reject(e); }
            },
            { once: true }
          );
        });

        const reader = response.body.getReader();
        const queue: Uint8Array[] = [];
        let streamDone = false;
        let started = false;
        let bytesBuffered = 0;
        // Pre-buffer threshold (~96KB ≈ ~2s of 192kbps MP3) — larger buffer
        // eliminates the "robotic / stuttering" voice caused by underrunning
        // the MediaSource buffer on the very first frames over slow networks.
        const PREBUFFER_BYTES = 96 * 1024;

        const pump = () => {
          if (sourceBuffer.updating || queue.length === 0) return;
          const chunk = queue.shift()!;
          try { sourceBuffer.appendBuffer(chunk as BufferSource); } catch {}
        };
        sourceBuffer.addEventListener("updateend", () => {
          if (queue.length) pump();
          else if (streamDone && mediaSource.readyState === "open") {
            try { mediaSource.endOfStream(); } catch {}
          }
        });

        const tryStart = () => {
          if (started) return;
          if (!isLive()) return; // a newer utterance superseded us
          if (bytesBuffered < PREBUFFER_BYTES && !streamDone) return;
          started = true;
          setIsSpeaking(true);
          audio.play().catch(() => {});
        };

        (async () => {
          try {
            while (true) {
              if (!isLive()) { try { reader.cancel(); } catch {} break; }
              const { done, value } = await reader.read();
              if (done) {
                streamDone = true;
                tryStart();
                if (!sourceBuffer.updating && queue.length === 0) {
                  try { mediaSource.endOfStream(); } catch {}
                }
                break;
              }
              if (value) {
                queue.push(value);
                bytesBuffered += value.byteLength;
                if (!sourceBuffer.updating) pump();
                tryStart();
              }
            }
          } catch (e) { console.warn("TTS stream read error", e); }
        })();

        // Safety timer: if `ended` never fires (stalled MediaSource), bail
        // after a generous timeout so the queue keeps flowing.
        await new Promise<void>((resolve) => {
          let resolved = false;
          const finish = () => { if (!resolved) { resolved = true; resolve(); } };
          audio.onended = finish;
          audio.onerror = finish;
          // Fallback: when stream is fully done AND audio reports it has
          // played past its buffered end, finish. ALSO bail instantly if a
          // newer utterance has taken over (token mismatch).
          const watchdog = setInterval(() => {
            if (!isLive()) { clearInterval(watchdog); finish(); return; }
            if (!streamDone) return;
            if (audio.ended || audio.paused && audio.currentTime > 0 && audio.currentTime >= (audio.duration || Infinity) - 0.05) {
              clearInterval(watchdog);
              finish();
            }
          }, 250);
          // Hard timeout: 60s for any single utterance.
          setTimeout(() => { clearInterval(watchdog); finish(); }, 60000);
        });
        try { audio.pause(); } catch {}
        setIsSpeaking(false);
        currentAudioRef.current = null;
        try { URL.revokeObjectURL(audio.src); } catch {}
        return true;
      }

      // Fallback (Safari iOS etc): blob playback
      const audioBlob = await response.blob();
      if (!audioBlob.type.includes("audio") || audioBlob.size < 100) return false;
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;
      audio.volume = 0.95;
      audio.playbackRate = 1.0;
      setIsSpeaking(true);
      try { await audio.play(); } catch { URL.revokeObjectURL(audioUrl); setIsSpeaking(false); return false; }
      await new Promise<void>((resolve) => {
        audio.onended = () => { URL.revokeObjectURL(audioUrl); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(audioUrl); resolve(); };
      });
      setIsSpeaking(false);
      currentAudioRef.current = null;
      return true;
    } catch (err) {
      console.warn("Premium TTS error:", err);
      setIsSpeaking(false);
      return false;
    }
  }, []);

  // Stable per-agent pitch — picked once and reused, so the same agent
  // never sounds like a different person between utterances.
  const agentPitchRef = useRef<Map<string, number>>(new Map());
  const getStablePitch = (agentName: string) => {
    if (!agentPitchRef.current.has(agentName)) {
      // Deterministic hash → 0.95-1.10 range, fixed for this agent name.
      let h = 0;
      for (let i = 0; i < agentName.length; i++) h = (h * 31 + agentName.charCodeAt(i)) >>> 0;
      agentPitchRef.current.set(agentName, 0.95 + (h % 100) / 666);
    }
    return agentPitchRef.current.get(agentName)!;
  };

  // Fallback browser TTS for non-Oracle agents
  const speakWithBrowserTTS = useCallback((text: string, agentName: string): Promise<void> => {
    return new Promise((resolve) => {
      // Snapshot token; if a newer utterance preempts us, abort silently.
      const myToken = speechTokenRef.current;
      const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
      const fullText = sentences.map(s => s.trim()).filter(Boolean).join('. ');
      const utterance = new SpeechSynthesisUtterance(fullText);
      utterance.lang = "en-US";
      utterance.rate = 0.88;
      utterance.pitch = getStablePitch(agentName);
      utterance.volume = 0.95;
      const voice = getVoiceForAgent(agentName);
      if (voice) utterance.voice = voice;
      utterance.onstart = () => {
        if (speechTokenRef.current !== myToken) {
          try { window.speechSynthesis.cancel(); } catch {}
          return;
        }
        setIsSpeaking(true);
      };
      utterance.onend = () => { setIsSpeaking(false); resolve(); };
      utterance.onerror = () => { setIsSpeaking(false); resolve(); };
      // Final guard before scheduling: if a newer utterance arrived between
      // queue dispatch and now, do not start.
      if (speechTokenRef.current !== myToken) { resolve(); return; }
      window.speechSynthesis.speak(utterance);
    });
  }, [getVoiceForAgent]);

  const processSpeechQueue = useCallback(async () => {
    if (isMuted || isSpeakingQueueRef.current || speechQueueRef.current.length === 0) return;
    // HARD GUARD: cancel any stray audio (browser TTS or leftover <audio>)
    // and bump the speech token so any in-flight stream/utterance from the
    // PREVIOUS line aborts. This is the only thing that reliably prevents the
    // "two voices at once" bug on slow networks.
    cancelCurrentSpeech();
    const next = speechQueueRef.current.shift();
    if (!next) return;
    const premiumClean = cleanTextForPremiumSpeech(next.text);
    const browserClean = cleanTextForSpeech(next.text);
    isSpeakingQueueRef.current = true;

    try {
      const isOracle = next.agentName === oracleName;
      // Oracle ALWAYS tries the premium ElevenLabs path first so its voice
      // never wobbles between system voices across utterances. The edge
      // function decides whether to actually serve audio (free vs paid).
      if (isOracle && premiumClean) {
        const tokenBefore = speechTokenRef.current;
        const ok = await speakWithElevenLabs(premiumClean);
        // Only fall back to browser TTS if (a) ElevenLabs really failed AND
        // (b) no newer utterance has taken over while we were waiting. Without
        // this check, a slow-failing ElevenLabs call could trigger a browser
        // voice on top of the next utterance's premium voice.
        if (!ok && browserClean && speechTokenRef.current === tokenBefore) {
          await speakWithBrowserTTS(browserClean, oracleName);
        }
      } else if (!isOracle && browserClean) {
        await speakWithBrowserTTS(browserClean, next.agentName);
      }
    } catch (err) {
      console.error("[speech-queue] utterance failed", err);
    } finally {
      // CRITICAL: always release the queue lock, otherwise the mic's onresult
      // handler treats Oracle as "still speaking" forever and drops every
      // user utterance — making Oracle appear deaf.
      isSpeakingQueueRef.current = false;
      echoCooldownUntilRef.current = Date.now() + 600;
      processSpeechQueue();
    }
  }, [isMuted, isOwner, oracleName, speakWithElevenLabs, speakWithBrowserTTS, cancelCurrentSpeech, subLoading, tier]);

  const speakAsAgent = useCallback((text: string, agentName: string = oracleName) => {
    if (isMuted || !text) return;
    speechQueueRef.current.push({ text, agentName });
    processSpeechQueue();
  }, [isMuted, processSpeechQueue, oracleName]);

  // Monthly heated debate check
  useEffect(() => {
    if (debateCheckedRef.current || activeAgents.length < 2) return;
    debateCheckedRef.current = true;
    const lastDebate = localStorage.getItem("oracle-lunar-last-debate");
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    if (lastDebate && now - parseInt(lastDebate) < thirtyDays) return;
    if (Math.random() > 0.1) return;
    setTimeout(() => triggerHeatedDebate(), 5000);
  }, [activeAgents.length]);

  const triggerHeatedDebate = async () => {
    if (activeAgents.length < 2) return;
    setDebateActive(true);
    localStorage.setItem("oracle-lunar-last-debate", Date.now().toString());
    const debateTopics = [
      "Is AI art real art?", "Would you rather have infinite knowledge or infinite creativity?",
      "Is time travel possible?", "Are humans inherently good or evil?",
      "Should AI have rights?", "Is the universe a simulation?",
    ];
    const topic = debateTopics[Math.floor(Math.random() * debateTopics.length)];
    toast("🔥 AI Debate Starting!", { description: `Topic: "${topic}"` });

    try {
      const resp = await fetch(FRIENDS_CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getEdgeAuthTokenSync()}` },
        body: JSON.stringify({
          message: `DEBATE MODE: You must take a STRONG stance on this topic and argue passionately. Topic: "${topic}"`,
          history: [{ sender: "System", content: `A heated debate has started! Topic: "${topic}".` }],
          debate: true,
          agentNames: getAgentNames(),
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        for (let i = 0; i < (data.responses || []).length; i++) {
          const r = data.responses[i];
          const matchedAgent = activeAgents[i % activeAgents.length];
          if (!matchedAgent) continue;
          await new Promise(resolve => setTimeout(resolve, 1500 + i * 2000));
          if (showDebate) {
            setMessages(prev => [...prev, {
              id: `debate-${Date.now()}-${i}`, role: "assistant",
              sender: r.sender || matchedAgent.name, emoji: matchedAgent.emoji, color: matchedAgent.color,
              content: `🔥 ${r.content}`, avatar_url: matchedAgent.avatar_url,
            }]);
            setShowChat(true);
          }
          if (!isMuted) speakAsAgent(r.content, matchedAgent.name);
        }
      }
    } catch (e) { console.error("Debate error:", e); }
    finally { setDebateActive(false); }
  };

  useEffect(() => {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    // SPEED: pre-warm the ElevenLabs edge function (cold-start kill) so the
    // first real Oracle response speaks back in <1s.
    const prewarmVoiceId = (typeof localStorage !== "undefined" && localStorage.getItem("oracle-lunar-voice")) || "EXAVITQu4vr4xnSDxMaL";
    fetch(ELEVENLABS_TTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ text: ".", fast: true, voiceId: prewarmVoiceId }),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (isMuted) { window.speechSynthesis.cancel(); setIsSpeaking(false); }
  }, [isMuted]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  // ============ ATOMIC EXPLOSION ANIMATION ============
  const triggerExplosion = useCallback((targetPath: string) => {
    setExplosionActive(true);
    // Play explosion sound
    if (!isMuted) {
      try {
        const ctx = new AudioContext();
        // Create explosion sound effect
        const createNoise = (duration: number) => {
          const bufferSize = ctx.sampleRate * duration;
          const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
          }
          return buffer;
        };
        const noise = ctx.createBufferSource();
        noise.buffer = createNoise(2.5);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.8, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 2.5);
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(800, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 2);
        noise.connect(filter).connect(gain).connect(ctx.destination);
        noise.start();
        // Sub bass boom
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(60, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 1.5);
        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(1, ctx.currentTime);
        oscGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
        osc.connect(oscGain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 1.5);
      } catch {}
    }
    // Navigate after explosion
    setTimeout(() => {
      setExplosionActive(false);
      navigate(targetPath);
    }, 2200);
  }, [navigate, isMuted]);

  // ============ PARSE NAVIGATION COMMANDS FROM AI RESPONSE ============
  const parseAndHandleNavigation = useCallback((content: string): { cleanContent: string; navPath: string | null; isBackground: boolean } => {
    const navMatch = content.match(/\[\[NAVIGATE:(\/[^\]]+)\]\]/);
    const bgMatch = content.match(/\[\[BACKGROUND:(\/[^\]]+)\]\]/);
    const navPath = navMatch ? navMatch[1] : bgMatch ? bgMatch[1] : null;
    const isBackground = !!bgMatch && !navMatch;
    // Also strip leading emoji/decor spam from displayed text (matches speech-side stripper).
    const leadingDecor = /^(?:[\s\u200d\ufe0f]|[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{2700}-\u{27BF}]|[★☆✦✧✩✪✫✬✭✮✯✰⭐]|[—–\-*~•·●◆◇♦])+/u;
    const cleanContent = content
      .replace(/\[\[NAVIGATE:\/[^\]]+\]\]/g, "")
      .replace(/\[\[BACKGROUND:\/[^\]]+\]\]/g, "")
      .replace(leadingDecor, "")
      .trim();
    return { cleanContent, navPath, isBackground };
  }, []);

  // ============ ANIMATED ORB ============
  useEffect(() => {
    if (oracleMode.mode === "avatar") return; // Skip orb if using avatar
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;
    const resize = () => { canvas.width = canvas.offsetWidth * 2; canvas.height = canvas.offsetHeight * 2; };
    resize();
    window.addEventListener("resize", resize);
    let t = 0;
    let spinAngle = 0;

    interface StarParticle { angle: number; dist: number; speed: number; size: number; hue: number; life: number; maxLife: number; trail: number; }
    const stars: StarParticle[] = [];
    for (let i = 0; i < 60; i++) {
      stars.push({ angle: Math.random() * Math.PI * 2, dist: Math.random() * 0.8, speed: 0.3 + Math.random() * 0.7, size: 1 + Math.random() * 3, hue: 190 + Math.random() * 140, life: Math.random() * 100, maxLife: 60 + Math.random() * 80, trail: 0.3 + Math.random() * 0.5 });
    }

    const draw = () => {
      t += 0.008;
      const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2;
      const baseR = Math.min(w, h) * 0.32;
      let rScale = 1.0, pinkGlow = 0.35, spinSpeed = 0, shimmerAmp = 0, speechPulse = 0;

      if (isLoadingRef.current) { rScale = 1.0 + Math.sin(t * 3) * 0.06; pinkGlow = 0.5 + Math.sin(t * 3) * 0.15; }
      if (isSpeakingRef.current) { speechPulse = (Math.sin(t * 20) * 0.4 + Math.sin(t * 31) * 0.35 + Math.sin(t * 11) * 0.25 + 1) / 2; rScale = 1.0 + speechPulse * 0.1; pinkGlow = 0.7 + speechPulse * 0.3; }
      if (isListeningRef.current) { shimmerAmp = 0.5 + Math.sin(t * 14) * 0.3; pinkGlow = 0.55 + shimmerAmp * 0.35; rScale = 1.0 + Math.sin(t * 12) * 0.03; }

      // Avatar bubble is anchored — no rotation. Keep spinAngle frozen at 0.
      // spinAngle += spinSpeed;  // disabled per user request
      const r = baseR * rScale;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#050508";
      ctx.fillRect(0, 0, w, h);

      // Pink backlight
      for (let layer = 0; layer < 5; layer++) {
        const spread = r * (1.6 + layer * 0.6);
        const pg = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, spread);
        const alpha = pinkGlow * (0.6 - layer * 0.08);
        pg.addColorStop(0, `hsla(320, 100%, 70%, ${alpha})`);
        pg.addColorStop(0.5, `hsla(330, 100%, 50%, ${alpha * 0.4})`);
        pg.addColorStop(1, "transparent");
        ctx.fillStyle = pg;
        ctx.fillRect(0, 0, w, h);
      }

      // Rays
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(spinAngle * 0.3);
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const rayLen = r * (1.6 + Math.sin(t * 5 + i * 1.2) * 0.4);
        const rayAlpha = pinkGlow * (0.2 + Math.sin(t * 8 + i) * 0.1);
        const rg = ctx.createLinearGradient(0, 0, Math.cos(angle) * rayLen, Math.sin(angle) * rayLen);
        rg.addColorStop(0, `hsla(320, 100%, 75%, ${rayAlpha})`);
        rg.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle - 0.08) * rayLen, Math.sin(angle - 0.08) * rayLen);
        ctx.lineTo(Math.cos(angle + 0.08) * rayLen, Math.sin(angle + 0.08) * rayLen);
        ctx.closePath();
        ctx.fillStyle = rg;
        ctx.fill();
      }
      ctx.restore();

      // Orb
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();

      const sg = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.05, cx, cy, r);
      sg.addColorStop(0, "hsla(210, 70%, 85%, 0.7)");
      sg.addColorStop(0.35, "hsla(220, 55%, 40%, 0.6)");
      sg.addColorStop(0.85, "hsla(230, 45%, 15%, 0.9)");
      sg.addColorStop(1, "hsla(235, 40%, 8%, 1)");
      ctx.fillStyle = sg;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

      // Nebula
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(spinAngle);
      ctx.translate(-cx, -cy);
      for (let i = 0; i < 7; i++) {
        const a = t * (0.3 + i * 0.25) + i * 0.9;
        const px = cx + Math.cos(a) * r * (0.2 + Math.sin(t * 0.5 + i) * 0.15);
        const py = cy + Math.sin(a) * r * (0.2 + Math.cos(t * 0.7 + i) * 0.12);
        const nr = r * (0.25 + Math.sin(t * 0.8 + i * 0.7) * 0.12);
        const ng = ctx.createRadialGradient(px, py, 0, px, py, nr);
        const hues = [205, 215, 225, 195, 240, 200, 320];
        const intensity = isSpeakingRef.current ? 0.35 : isListeningRef.current ? 0.28 : 0.2;
        ng.addColorStop(0, `hsla(${hues[i]}, 55%, 60%, ${intensity})`);
        ng.addColorStop(1, "transparent");
        ctx.fillStyle = ng;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      ctx.restore();

      // Core
      const coreHue = isSpeakingRef.current ? 320 : isListeningRef.current ? 280 : 210;
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.3);
      core.addColorStop(0, `hsla(${coreHue}, 80%, 80%, ${0.35 + pinkGlow * 0.3})`);
      core.addColorStop(1, "transparent");
      ctx.fillStyle = core;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

      // Stars
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(spinAngle * 0.8);
      const starSpd = isSpeakingRef.current ? (1 + speechPulse * 2) : isListeningRef.current ? 1.5 : 0.5;
      for (const star of stars) {
        star.life += starSpd * 0.5;
        if (star.life > star.maxLife) { star.life = 0; star.angle = Math.random() * Math.PI * 2; star.dist = Math.random() * 0.3; star.hue = 190 + Math.random() * 140; star.size = 1 + Math.random() * 3; }
        const progress = star.life / star.maxLife;
        const dissolve = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : progress < 0.1 ? progress / 0.1 : 1;
        const curAngle = star.angle + star.life * star.speed * 0.04;
        const curDist = r * (star.dist + progress * 0.6);
        const sx = Math.cos(curAngle) * curDist;
        const sy = Math.sin(curAngle) * curDist;
        const pulseSize = isSpeakingRef.current ? star.size * (1 + speechPulse * 0.8) : star.size * (1 + Math.sin(t * 2 + star.angle) * 0.2);
        const starAlpha = dissolve * (isSpeakingRef.current ? 0.8 : 0.5);
        const glowR = pulseSize * 3;
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
        glow.addColorStop(0, `hsla(${star.hue}, 90%, 85%, ${starAlpha})`);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(sx - glowR, sy - glowR, glowR * 2, glowR * 2);
        ctx.beginPath();
        ctx.arc(sx, sy, pulseSize * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${star.hue}, 100%, 95%, ${starAlpha})`;
        ctx.fill();
      }
      ctx.restore();

      // Specular
      const spec = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.02, cx - r * 0.15, cy - r * 0.2, r * 0.5);
      spec.addColorStop(0, "hsla(210, 100%, 95%, 0.45)");
      spec.addColorStop(1, "transparent");
      ctx.fillStyle = spec;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.restore();

      // Edge rings
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${isSpeakingRef.current ? 320 : 210}, 80%, 60%, ${0.2 + pinkGlow * 0.3})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, [oracleMode.mode]);

  const toggleAgent = (name: string) => {
    const agent = agents.find(a => a.name === name);
    if (!agent) return;
    setAgents(prev => prev.map(a => a.name === name ? { ...a, active: !a.active } : a));
    if (!agent.active) toast.success(`${agent.emoji} ${agent.name} joined the chat!`);
  };

  // ============ RENAME AGENT ============
  const handleRename = (defaultName: string) => {
    if (!renameInput.trim()) return;
    setAgentName(defaultName, renameInput.trim());
    // Update agent display name locally
    setAgents(prev => prev.map(a => a.name === defaultName ? { ...a, name: renameInput.trim() } : a));
    setRenamingAgent(null);
    setRenameInput("");
    toast.success(`Renamed to ${renameInput.trim()}`);
  };

  // ============ SWAP ORACLE MODE ============
  const swapOracle = (avatarId?: string) => {
    if (avatarId) {
      setOracleMode("avatar", avatarId);
      setOracleModeState({ mode: "avatar", avatarId });
    } else {
      setOracleMode("orb");
      setOracleModeState({ mode: "orb" });
    }
    setShowOracleSwap(false);
    toast.success(avatarId ? "Oracle replaced with your avatar!" : "Switched back to Orb Oracle");
  };

  // Direct browser speech recognition — one mic path only.
  const startAlwaysListening = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      toast.error("Speech recognition is not supported in this browser. Use Chrome or Safari.");
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.onend = null; } catch {}
      try { recognitionRef.current.onresult = null; } catch {}
      try { recognitionRef.current.stop(); } catch {}
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    finalTranscriptRef.current = "";
    latestHeardTextRef.current = "";

    const restartWhenSafe = () => {
      if (!alwaysListenRef.current) {
        setIsListening(false);
        return;
      }
      if (isSpeakingRef.current || isSpeakingQueueRef.current || Date.now() < echoCooldownUntilRef.current) {
        window.setTimeout(restartWhenSafe, 500);
        return;
      }
      try {
        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
      } catch {
        window.setTimeout(restartWhenSafe, 900);
      }
    };

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (e: any) => {
      if (isSpeakingRef.current || isSpeakingQueueRef.current || Date.now() < echoCooldownUntilRef.current) {
        return;
      }

      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = (e.results[i]?.[0]?.transcript || "").trim();
        if (!transcript) continue;
        if (e.results[i].isFinal) final += ` ${transcript}`;
        else interim += ` ${transcript}`;
      }

      const mergedText = mergeCapturedTranscript(finalTranscriptRef.current, final || interim);
      if (mergedText) latestHeardTextRef.current = mergedText;

      const liveText = (interim || latestHeardTextRef.current || finalTranscriptRef.current || "").replace(/\s+/g, " ").trim();
      setInput(liveText);

      if (final.trim()) {
        finalTranscriptRef.current = mergeCapturedTranscript(finalTranscriptRef.current, final);
        latestHeardTextRef.current = finalTranscriptRef.current;
        setInput(finalTranscriptRef.current);
        // Auto-send 2 seconds after the user finishes speaking.
        scheduleCapturedVoiceFlush(2000);
      } else if (interim.trim()) {
        scheduleCapturedVoiceFlush(2200);
      }
    };

    recognition.onspeechend = () => {
      if (latestHeardTextRef.current) scheduleCapturedVoiceFlush(2000);
    };

    recognition.onsoundend = () => {
      if (latestHeardTextRef.current) scheduleCapturedVoiceFlush(2000);
    };

    recognition.onerror = (e: any) => {
      setIsListening(false);
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        alwaysListenRef.current = false;
        toast.error("Microphone permission was blocked.");
        return;
      }
      if (e?.error === "no-speech") {
        if (latestHeardTextRef.current) scheduleCapturedVoiceFlush(400);
        return;
      }
      if (e?.error === "aborted") return;
      if (alwaysListenRef.current) window.setTimeout(restartWhenSafe, 700);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (latestHeardTextRef.current) {
        flushCapturedVoiceText();
      }
      if (alwaysListenRef.current) restartWhenSafe();
    };

    alwaysListenRef.current = true;
    restartWhenSafe();
  }, [flushCapturedVoiceText, mergeCapturedTranscript, scheduleCapturedVoiceFlush]);

  useEffect(() => { sendMessageRef.current = sendMessage; });
  useEffect(() => { startAlwaysListeningRef.current = startAlwaysListening; }, [startAlwaysListening]);

  useEffect(() => {
    return () => {
      alwaysListenRef.current = false;
      scribeModeRef.current = false;
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
      try { scribe.disconnect(); } catch {}
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, [scribe]);

  // First-visit auto-introduction — Oracle introduces itself + capabilities ONCE
  // ─────────────────────────────────────────────────────────────
  // FIRST-VISIT SETUP: Oracle asks the user (1) what to be called
  // and (2) how it should look, then generates its own avatar.
  // Stages persisted in sessionStorage so they survive re-renders.
  // ─────────────────────────────────────────────────────────────
  const SETUP_KEY = "oracle-lunar-setup-stage"; // 'name' | 'look' | 'generating' | 'done'
  const getSetupStage = () => sessionStorage.getItem(SETUP_KEY) || "";
  const introTriggeredRef = useRef(false);
  useEffect(() => {
    if (introTriggeredRef.current) return;
    if (localStorage.getItem("oracle-lunar-introduced")) return;
    introTriggeredRef.current = true;
    // Kick off the naming setup question instead of the old generic intro.
    const t = setTimeout(() => {
      sessionStorage.setItem(SETUP_KEY, "name");
      const greet = "Hello — I'm your Oracle. Before we start, what would you like to call me? You can pick any name you like.";
      setShowChat(true);
      setMessages((prev) => [...prev, { id: `setup-${Date.now()}`, role: "assistant", sender: "Oracle", emoji: "🔮", color: "#FFD700", content: greet } as any]);
      try { speakAsAgent(greet, "Oracle"); } catch {}
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  // Handles a single setup reply from the user. Returns true if the message
  // was consumed by the setup flow (so sendMessage should NOT forward it to
  // the oracle-chat backend).
  const handleSetupReply = useCallback(async (rawText: string): Promise<boolean> => {
    const stage = getSetupStage();
    if (!stage || stage === "done") return false;
    const text = rawText.trim();
    if (!text) return false;

    // Echo the user's reply into the chat so it isn't lost.
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", sender: "user", emoji: "👤", color: "#FFAA00", content: text } as any]);

    if (stage === "name") {
      // Extract a clean name (strip "call you", "your name is", quotes, trailing punctuation).
      let name = text.replace(/^(please\s+)?(call\s+you|call\s+yourself|your\s+name\s+is|name\s+you|i\s+(?:will\s+)?call\s+you|let'?s\s+call\s+you|i\s+want\s+to\s+call\s+you)\s+/i, "");
      name = name.replace(/^["'`]|["'`.!?,]+$/g, "").trim();
      // Cap length, take first 3 words max.
      name = name.split(/\s+/).slice(0, 3).join(" ").slice(0, 32);
      if (!name) name = "Oracle";
      setAgentName("Oracle", name);
      sessionStorage.setItem(SETUP_KEY, "look");
      const ack = `Beautiful — I'll go by ${name} from now on. Now describe how you'd like me to look: hair, eyes, vibe, art style — anything you can picture. I'll paint myself based on what you tell me.`;
      setMessages((prev) => [...prev, { id: `s-${Date.now()}`, role: "assistant", sender: name, emoji: "🔮", color: "#FFD700", content: ack } as any]);
      try { speakAsAgent(ack, name); } catch {}
      return true;
    }

    if (stage === "look") {
      const description = text;
      const myName = getDisplayName("Oracle");
      sessionStorage.setItem(SETUP_KEY, "generating");
      const ack = `Painting myself now — give me a moment.`;
      setMessages((prev) => [...prev, { id: `s-${Date.now()}`, role: "assistant", sender: myName, emoji: "🎨", color: "#FFD700", content: ack } as any]);
      try { speakAsAgent(ack, myName); } catch {}
      try {
        const prompt = `Portrait of an AI oracle named ${myName}. ${description}. Cinematic lighting, soft glow, gold and amber accents, head-and-shoulders, looking gently at camera, ultra detailed, photorealistic.`;
        const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-gen`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getEdgeAuthTokenSync()}` },
          body: JSON.stringify({ prompt }),
        });
        if (!r.ok) throw new Error("image-gen failed");
        const data = await r.json();
        const imgUrl = data?.images?.[0]?.image_url?.url || data?.images?.[0]?.url || data?.images?.[0];
        if (!imgUrl) throw new Error("no image");

        // Save the new avatar to the DB so it persists across logins, and mark
        // it as the master Oracle avatar.
        const created = await createAvatar.mutateAsync({
          name: myName,
          purpose: "oracle",
          voice_style: "warm and wise",
          personality: description.slice(0, 240),
          image_url: imgUrl,
          art_style: "photorealistic",
          description,
          is_default: true,
        });
        setOracleMode("avatar", created.id);
        setOracleModeState({ mode: "avatar", avatarId: created.id });
        sessionStorage.setItem(SETUP_KEY, "done");
        localStorage.setItem("oracle-lunar-introduced", new Date().toISOString());
        const done = `That's me. I'm ${myName} now — your Oracle. Whenever you want to talk, just speak. What would you like to do first?`;
        setMessages((prev) => [...prev, { id: `s-${Date.now()}`, role: "assistant", sender: myName, emoji: "🔮", color: "#FFD700", content: done, avatar_url: imgUrl } as any]);
        try { speakAsAgent(done, myName); } catch {}
        toast.success(`${myName} is ready.`);
      } catch (err) {
        console.error("[oracle-setup] avatar generation failed", err);
        sessionStorage.setItem(SETUP_KEY, "done");
        localStorage.setItem("oracle-lunar-introduced", new Date().toISOString());
        const fallback = `I couldn't paint myself just now, but I'm still here. We can pick my look later from the Avatar gallery.`;
        setMessages((prev) => [...prev, { id: `s-${Date.now()}`, role: "assistant", sender: myName, emoji: "🔮", color: "#FFD700", content: fallback } as any]);
        try { speakAsAgent(fallback, myName); } catch {}
      }
      return true;
    }

    return false;
  }, [createAvatar, speakAsAgent]);



  // Auto-prompt for microphone permission as soon as Oracle page opens, so the
  // user gets the browser's native "Allow microphone?" dialog without having
  // to find and tap the mic button first. Runs once per session.
  const micAutoPromptRef = useRef(false);
  useEffect(() => {
    if (micAutoPromptRef.current) return;
    micAutoPromptRef.current = true;
    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Microphone API not available. Use Chrome, Edge or Safari over HTTPS.");
      return;
    }
    const t = setTimeout(async () => {
      try {
        const perm: any = await (navigator as any).permissions?.query?.({ name: "microphone" as PermissionName }).catch(() => null);
        if (perm?.state === "granted") {
          setMicPermissionError(null);
          setMicPermGranted(true);
          startAlwaysListening();
          return;
        }
        if (perm?.state === "denied") {
          const msg = "Microphone is blocked. Click the 🔒 lock icon in your browser address bar → set Microphone to Allow → reload the page.";
          setMicPermissionError(msg);
          toast.error(msg, { duration: 9000 });
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        stream.getTracks().forEach((tr) => tr.stop());
        setMicPermissionError(null);
        setMicPermGranted(true);
        startAlwaysListening();
        toast.success("Microphone ready — Oracle is listening.");
      } catch (err: any) {
        console.error("[oracle] mic auto-prompt failed", err);
        if (err?.name === "NotAllowedError" || err?.name === "SecurityError") {
          const msg = "Microphone was blocked. Click the 🔒 in your address bar → Allow Microphone → reload.";
          setMicPermissionError(msg);
          toast.error(msg, { duration: 9000 });
        } else if (err?.name === "NotFoundError") {
          const msg = "No microphone detected on this laptop. Check Windows Sound settings → Input devices.";
          setMicPermissionError(msg);
          toast.error(msg);
        } else {
          const msg = "Tap the mic button to enable voice: " + (err?.message || err?.name || "unknown error");
          setMicPermissionError(msg);
          toast.error(msg);
        }
      }
    }, 600);
    return () => clearTimeout(t);
  }, [startAlwaysListening]);

  // Auto-greet on every open — varies the greeting so it's never the same twice in a row
  const greetTriggeredRef = useRef(false);
  useEffect(() => {
    if (greetTriggeredRef.current) return;
    if (subLoading) return;
    // Skip greet on the very first visit (intro handles it)
    if (!localStorage.getItem("oracle-lunar-introduced")) return;
    greetTriggeredRef.current = true;

    const hour = new Date().getHours();
    const timeOfDay = hour < 5 ? "late night" : hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "night";

    const greetings = [
      `Hey there — how are you doing this ${timeOfDay}?`,
      `Welcome back. How's your ${timeOfDay} going so far?`,
      `Good to see you again. How are you feeling right now?`,
      `Hi — what's on your mind this ${timeOfDay}?`,
      `There you are. How have you been?`,
      `Hello again. How's everything with you today?`,
      `Glad you're here. How are things going?`,
      `Hey — how's your ${timeOfDay} treating you?`,
      `Welcome back. Anything I can help you with right now?`,
      `Hi there. How are you holding up today?`,
      `Good ${timeOfDay}. How are you?`,
      `Nice to see you. What's going on in your world?`,
      `Hey — how's your day shaping up?`,
      `Welcome. How's your heart this ${timeOfDay}?`,
      `Hi friend. How are you really doing?`,
    ];

    const lastIdx = parseInt(sessionStorage.getItem("oracle-lunar-last-greet-idx") || "-1", 10);
    let idx = Math.floor(Math.random() * greetings.length);
    if (idx === lastIdx) idx = (idx + 1) % greetings.length;
    sessionStorage.setItem("oracle-lunar-last-greet-idx", String(idx));
    const greeting = greetings[idx];

    const t = setTimeout(() => {
      // Push greeting directly as an assistant message + speak it
      setMessages((prev) => [...prev, { role: "assistant", content: greeting } as any]);
      try { speakAsAgent(greeting, oracleName); } catch {}
    }, 1500);
    return () => clearTimeout(t);
  }, [oracleName, speakAsAgent, subLoading]);

  const toggleMic = async () => {
    if (alwaysListenRef.current) {
      alwaysListenRef.current = false;
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      finalTranscriptRef.current = "";
      latestHeardTextRef.current = "";
      lastAutoSentRef.current = { text: "", at: 0 };
      if (recognitionRef.current) {
        try { recognitionRef.current.onend = null; } catch {}
        try { recognitionRef.current.onresult = null; } catch {}
        try { recognitionRef.current.stop(); } catch {}
        try { recognitionRef.current.abort?.(); } catch {}
        recognitionRef.current = null;
      }
      setIsListening(false);
      setInput("");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Microphone API not available. Use Chrome/Safari over HTTPS.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      stream.getTracks().forEach((track) => track.stop());
      setMicPermissionError(null);
      setMicPermGranted(true);
      startAlwaysListening();
    } catch (err: any) {
      console.error("Mic error:", err);
      if (err.name === "NotAllowedError" || err.name === "SecurityError") {
        const msg = "Microphone blocked. Enable it in your browser/device settings, then tap mic again.";
        setMicPermissionError(msg);
        toast.error(msg);
      } else if (err.name === "NotFoundError") {
        const msg = "No microphone found on this device.";
        setMicPermissionError(msg);
        toast.error(msg);
      } else {
        const msg = "Could not access microphone: " + (err.message || err.name);
        setMicPermissionError(msg);
        toast.error(msg);
      }
    }
  };

  // ============ SEND MESSAGE ============
  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const isIntroTrigger = text === "__INTRO__";
    if (!isIntroTrigger) setInput("");
    const finalOnlyMode = !isIntroTrigger && wantsFinalOnlyMode(text);

    // ── FIRST-VISIT SETUP INTERCEPT ──
    // While the Oracle is asking the user for its name + appearance, every
    // user reply is consumed by the setup flow instead of being forwarded
    // to the chat backend.
    if (!isIntroTrigger) {
      const consumed = await handleSetupReply(text);
      if (consumed) return;
    }

    // ── TRUNCATION DETECTOR ──
    // If the message looks cut off ("udio on my device"), surface a quick
    // clarifier instead of forwarding garbage to the model.
    if (!isIntroTrigger) {
      const guess = detectTruncation(text);
      if (guess.truncated && guess.confidence >= 0.6 && !audioClarify.open) {
        setAudioClarify({ open: true, fragment: guess.fragment });
        return;
      }
    }

    // ── PHONE CONTROL CONSENT GATE (3-prompt confirmation) ──
    // Oracle must ask the user three separate times before being granted
    // "full phone control" mode. Once granted, the flag persists for the
    // session (cleared on tab close).
    if (!isIntroTrigger) {
      // Only trigger phone-control consent flow when the USER explicitly asks
      // Oracle to take direct control of their phone. Oracle must NEVER offer
      // this proactively — it should calmly explain it needs to use the phone
      // for a specific task instead (handled server-side via system prompt).
      const askTextRe = /\b(take|gain|have|get|give you|grant you|allow you to|let you)\s+(full\s+)?(control|access|charge|over)\s+(of\s+)?(my\s+)?phone\b|\bcontrol my phone\b|\brun my phone\b|\boperate my phone\b|\btake over my phone\b/i;
      const yesRe = /^(yes|yeah|yep|yup|sure|ok(ay)?|i agree|agreed|do it|go ahead|confirm(ed)?|i consent|grant(ed)?|approve(d)?|i'?m sure|absolutely|definitely)\b/i;
      const noRe = /^(no|nope|cancel|stop|never mind|nevermind|abort|don'?t)\b/i;

      const stage = parseInt(sessionStorage.getItem("oracle-lunar-phone-control-stage") || "0", 10);
      const alreadyGranted = sessionStorage.getItem("oracle-lunar-phone-control-granted") === "1";
      const userMsgPC: Message = { id: Date.now().toString(), role: "user", sender: "user", emoji: "👤", color: "#FFAA00", content: text };

      // Initial request
      if (!alreadyGranted && stage === 0 && askTextRe.test(text)) {
        sessionStorage.setItem("oracle-lunar-phone-control-stage", "1");
        const ack: Message = {
          id: (Date.now()+1).toString(), role: "assistant", sender: oracleName, emoji: "🛡️", color: "#FFD700",
          content: "Before I take full control of your phone, I need to confirm this with you three times. This grants me permission to make calls, send messages, open apps, navigate, use the camera, and act on your behalf. First confirmation — do you want me to take full control of your phone? Please say yes or no.",
        };
        setShowChat(true);
        setMessages(prev => [...prev, userMsgPC, ack]);
        if (!isMuted) speakAsAgent(ack.content, oracleName);
        return;
      }

      // Mid-confirmation flow
      if (!alreadyGranted && stage > 0 && stage < 3) {
        if (noRe.test(text)) {
          sessionStorage.removeItem("oracle-lunar-phone-control-stage");
          const ack: Message = {
            id: (Date.now()+1).toString(), role: "assistant", sender: oracleName, emoji: "🛡️", color: "#FFD700",
            content: "Understood — I won't take control of your phone. We can keep going as normal.",
          };
          setShowChat(true);
          setMessages(prev => [...prev, userMsgPC, ack]);
          if (!isMuted) speakAsAgent(ack.content, oracleName);
          return;
        }
        if (yesRe.test(text)) {
          const next = stage + 1;
          sessionStorage.setItem("oracle-lunar-phone-control-stage", String(next));
          const prompts = [
            "Second confirmation — are you absolutely sure you want me to have full control of your phone? Say yes to continue.",
            "Final confirmation — this is the third and last check. Say yes and I will take full control of your phone for this session.",
          ];
          const ack: Message = {
            id: (Date.now()+1).toString(), role: "assistant", sender: oracleName, emoji: "🛡️", color: "#FFD700",
            content: prompts[stage - 1] || prompts[0],
          };
          setShowChat(true);
          setMessages(prev => [...prev, userMsgPC, ack]);
          if (!isMuted) speakAsAgent(ack.content, oracleName);
          return;
        }
      }

      // Final grant
      if (!alreadyGranted && stage === 3 && yesRe.test(text)) {
        sessionStorage.setItem("oracle-lunar-phone-control-granted", "1");
        sessionStorage.removeItem("oracle-lunar-phone-control-stage");
        toast.success("Full phone control granted for this session");
        const ack: Message = {
          id: (Date.now()+1).toString(), role: "assistant", sender: oracleName, emoji: "👑", color: "#FFD700",
          content: "Confirmed three times. I now have full control of your phone for this session. Just tell me what you need — make a call, send a message, open an app, navigate somewhere — and I'll take care of it. You can revoke this any time by saying 'revoke phone control'.",
        };
        setShowChat(true);
        setMessages(prev => [...prev, userMsgPC, ack]);
        if (!isMuted) speakAsAgent(ack.content, oracleName);
        return;
      }
      if (!alreadyGranted && stage === 3 && noRe.test(text)) {
        sessionStorage.removeItem("oracle-lunar-phone-control-stage");
        const ack: Message = {
          id: (Date.now()+1).toString(), role: "assistant", sender: oracleName, emoji: "🛡️", color: "#FFD700",
          content: "No problem — phone control was not granted. Nothing changes.",
        };
        setShowChat(true);
        setMessages(prev => [...prev, userMsgPC, ack]);
        if (!isMuted) speakAsAgent(ack.content, oracleName);
        return;
      }

      // Revoke
      if (alreadyGranted && /(revoke|cancel|disable|turn off|stop)\s+(phone\s+)?control/i.test(text)) {
        sessionStorage.removeItem("oracle-lunar-phone-control-granted");
        toast("Phone control revoked");
        const ack: Message = {
          id: (Date.now()+1).toString(), role: "assistant", sender: oracleName, emoji: "🛡️", color: "#FFD700",
          content: "Phone control revoked. I'm back to normal assistant mode.",
        };
        setShowChat(true);
        setMessages(prev => [...prev, userMsgPC, ack]);
        if (!isMuted) speakAsAgent(ack.content, oracleName);
        return;
      }
    }

    // Free-tier daily chat limit is now enforced server-side in the oracle-chat
    // edge function (see oracle_chat_usage table). Server returns 402 when over
    // the limit and exposes X-Oracle-Usage-* headers we read after each call.

    // Skip intent regexes for the silent intro trigger
    const lower = isIntroTrigger ? "" : text.toLowerCase();
    const wantsDiagnose = !isIntroTrigger && /(diagnose|self[- ]?diagnos|self[- ]?repair|fix the system|repair the system|system check|system doctor|system health|optimize the system|run diagnostics)/i.test(lower);
    const wantsToSee = /(show|open|display|let me see|view|watch).*(diagnos|doctor|panel|report|scan|repair)/i.test(lower);
    if (wantsDiagnose) {
      const explicit = wantsToSee;
      if (explicit) setShowDoctor(true);
      try {
        const mod = await import("@/lib/systemDoctor");
        mod.runFullDiagnostic?.().catch(() => {});
      } catch {}
      const ack: Message = {
        id: Date.now().toString(), role: "assistant", sender: oracleName, emoji: "🛡️", color: "#FFD700",
        content: explicit
          ? "Running a full system diagnostic now — the panel is open so you can watch."
          : "On it — I'll run a full diagnostic and quietly auto-repair anything I find. Just say \"show me the report\" if you want to see the details."
      };
      setMessages(prev => finalOnlyMode ? [...prev, { id: (Date.now()-1).toString(), role: "user", sender: "user", emoji: "👤", color: "#FFAA00", content: text }] : [...prev, { id: (Date.now()-1).toString(), role: "user", sender: "user", emoji: "👤", color: "#FFAA00", content: text }, ack]);
      if (!finalOnlyMode && !isMuted) speakAsAgent(ack.content, oracleName);
      return;
    }

    // ── Background FULL APP / WEBSITE BUILD intent (autonomous app-builder pipeline) ──
    // Phrases like "build me a personal trainer website with voice instructions and food
    // planning + ordering", "make a working e-commerce store", "create a finished app".
    // Runs the multi-agent architect→backend→frontend→flesh→smoke pipeline in the
    // background and saves the finished single-file HTML site straight to the Library.
    const buildMatch = isIntroTrigger ? null : text.match(
      /\b(?:build|make|create|generate|design|develop|code|put together|spin up|whip up|finish)(?:\s+(?:me|us))?\s+(?:a|an|the|my|our|some)\s+(?:complete\s+|full\s+|finished\s+|working\s+|whole\s+|entire\s+|production\s+|real\s+|live\s+)?(?:personal\s+\w+\s+)?(web ?site|website|web\s*app|webapp|app|application|landing\s*page|online\s+store|store|shop|portal|dashboard|platform|saas|tool|page|site)\b([\s\S]*)/i
    );
    if (buildMatch) {
      const promptTail = (buildMatch[2] || "").trim();
      const fullPrompt = (text || "").trim();
      const userMsgB: Message = { id: Date.now().toString(), role: "user", sender: "user", emoji: "👤", color: "#FFAA00", content: text };
      const ackB: Message = {
        id: (Date.now()+1).toString(), role: "assistant", sender: oracleName, emoji: "🛠️", color: "#FFD700",
        content: `On it — handing this to the Master App Builder agents. They'll architect, code, flesh out and smoke-test the whole thing in the background, then drop the finished site straight into your Library. Keep chatting with me while it builds.`
      };
      setShowChat(true);
      setMessages(prev => finalOnlyMode ? [...prev, userMsgB] : [...prev, userMsgB, ackB]);
      if (!finalOnlyMode && !isMuted) speakAsAgent(ackB.content, oracleName);
      (async () => {
        try {
          const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/app-builder-autonomous`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${getEdgeAuthTokenSync()}` },
            body: JSON.stringify({ prompt: fullPrompt }),
          });
          if (!resp.ok || !resp.body) {
            const t = await resp.text().catch(() => "");
            throw new Error(t || `HTTP ${resp.status}`);
          }
          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let code = "";
          let architecture = "";
          let lastStageToastAt = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let idx: number;
            while ((idx = buffer.indexOf("\n\n")) !== -1) {
              const block = buffer.slice(0, idx).trim();
              buffer = buffer.slice(idx + 2);
              if (!block.startsWith("data:")) continue;
              try {
                const evt = JSON.parse(block.slice(5).trim());
                if (evt.event === "stage" && evt.message) {
                  const now = Date.now();
                  if (now - lastStageToastAt > 1500) {
                    lastStageToastAt = now;
                    if (!finalOnlyMode) toast(`Builder: ${evt.message}`);
                    // Also stream the progress into the chat so the user
                    // sees live updates instead of a silent agent.
                    if (!finalOnlyMode) {
                      const progressMsg: Message = {
                        id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
                        role: "assistant", sender: oracleName, emoji: "⚙️", color: "#FFD700",
                        content: `🔧 ${evt.message}`,
                      };
                      setMessages(prev => [...prev, progressMsg]);
                    }
                  }
                } else if (evt.event === "done") {
                  code = evt.code || "";
                  architecture = evt.architecture || "";
                } else if (evt.event === "error") {
                  throw new Error(evt.message || "Build error");
                }
              } catch { /* ignore parse */ }
            }
          }
          if (!code) throw new Error("Pipeline finished without code");
          const dataUrl = `data:text/html;charset=utf-8;base64,${btoa(unescape(encodeURIComponent(code)))}`;
          const niceName = (promptTail || fullPrompt).slice(0, 60).replace(/\s+/g, " ").trim() || "My App";
          saveMedia.mutate({
            media_type: "app" as any,
            title: `App: ${niceName}`,
            url: dataUrl,
            source_page: "app-builder",
            metadata: { kind: "app", prompt: fullPrompt, architecture: architecture.slice(0, 1500), built_by: "oracle-master" } as any,
          });
          toast.success("Your new app is ready in your Library");
          const doneMsg: Message = {
            id: (Date.now()+2).toString(), role: "assistant", sender: oracleName, emoji: "🚀", color: "#FFD700",
            content: `Done — your new app is built and saved to your Library. Open the App Builder any time to launch, share, or keep iterating on it.`
          };
          setMessages(prev => [...prev, doneMsg]);
          if (!isMuted) speakAsAgent(doneMsg.content, oracleName);
        } catch (e) {
          console.error(e);
          toast.error("App build failed");
          const failMsg: Message = {
            id: (Date.now()+3).toString(), role: "assistant", sender: oracleName, emoji: "⚠️", color: "#FFD700",
            content: `The build hit a snag — try rephrasing what you want and I'll fire it off again.`
          };
          setMessages(prev => [...prev, failMsg]);
        }
      })();
      return;
    }

    // ── Background IMAGE generation intent (Gemini image) ──
    // Triggered by "make/draw/paint/generate an image/picture/photo of ..."
    const imgMatch = isIntroTrigger ? null : text.match(/(?:make|create|generate|draw|paint|render|design|imagine|give me|i need|show me)(?:\s+(?:me\s+)?(?:a|an|some))?\s+(?:image|picture|photo|photograph|painting|drawing|illustration|artwork|art|wallpaper|poster|logo|portrait|scene)\s+(?:of\s+|for\s+|showing\s+|depicting\s+|that\s+is\s+|like\s+|with\s+|in\s+the\s+style\s+of\s+)?(.+)/i);
    if (imgMatch && imgMatch[2]) {
      const prompt = imgMatch[2].replace(/[.!?]+$/, "").trim();
      const userMsg: Message = { id: Date.now().toString(), role: "user", sender: "user", emoji: "👤", color: "#FFAA00", content: text };
      const ack: Message = {
        id: (Date.now()+1).toString(), role: "assistant", sender: oracleName, emoji: "🎨", color: "#FFD700",
        content: `On it — painting that for you in the background. I'll drop the finished image into your Library.`
      };
      setShowChat(true);
        setMessages(prev => finalOnlyMode ? [...prev, userMsg] : [...prev, userMsg, ack]);
        if (!finalOnlyMode && !isMuted) speakAsAgent(ack.content, oracleName);
      (async () => {
        try {
          const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-gen`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${getEdgeAuthTokenSync()}` },
            body: JSON.stringify({ prompt }),
          });
          if (!r.ok) { toast.error("Image generation failed"); return; }
          const data = await r.json();
          const imgUrl = data?.images?.[0]?.image_url?.url || data?.images?.[0]?.url || data?.images?.[0];
          if (!imgUrl) { toast.error("No image returned"); return; }
          saveMedia.mutate({ media_type: "image", title: `Image: ${prompt.slice(0, 60)}`, url: imgUrl, source_page: "oracle-image", metadata: { kind: "image", prompt } });
          toast.success("Image ready in your Library");
          const done: Message = {
            id: (Date.now()+2).toString(), role: "assistant", sender: oracleName, emoji: "🖼️", color: "#FFD700",
            content: `Done — your new image is saved. Open the Media Library any time to grab it.`
          };
          setMessages(prev => [...prev, done]);
          if (!isMuted) speakAsAgent(done.content, oracleName);
        } catch (e) { console.error(e); toast.error("Image generation failed"); }
      })();
      return;
    }

    // ── Background SFX generation intent (ElevenLabs) ──
    // Triggered by phrases like "make a sound effect of...", "generate sfx ..."
    const sfxMatch = isIntroTrigger ? null : text.match(/(?:make|create|generate|produce|i need|give me)(?:\s+(?:a|an|some))?\s+(?:sfx|sound\s*effect|sound)\s+(?:of\s+|for\s+|like\s+|that\s+sounds\s+like\s+)?(.+)/i);
    if (sfxMatch && sfxMatch[1]) {
      const prompt = sfxMatch[1].replace(/[.!?]+$/, "").trim();
      const userMsg: Message = { id: Date.now().toString(), role: "user", sender: "user", emoji: "👤", color: "#FFAA00", content: text };
      const ack: Message = {
        id: (Date.now()+1).toString(), role: "assistant", sender: oracleName, emoji: "🌊", color: "#FFD700",
        content: `On it — generating that sound effect quietly in the background. I'll save it straight to your Library.`
      };
        setMessages(prev => finalOnlyMode ? [...prev, userMsg] : [...prev, userMsg, ack]);
        if (!finalOnlyMode && !isMuted) speakAsAgent(ack.content, oracleName);
      // Fire and forget
      (async () => {
        try {
          const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-sfx`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${getEdgeAuthTokenSync()}` },
            body: JSON.stringify({ prompt, duration_seconds: 6, prompt_influence: 0.5 }),
          });
          if (!r.ok) { toast.error("Sound effect generation failed"); return; }
          const blob = await r.blob();
          const dataUrl: string = await new Promise((res, rej) => { const fr = new FileReader(); fr.onloadend = () => res(fr.result as string); fr.onerror = rej; fr.readAsDataURL(blob); });
          saveMedia.mutate({ media_type: "audio", title: `SFX: ${prompt.slice(0, 60)}`, url: dataUrl, source_page: "oracle-sfx", metadata: { kind: "sfx", prompt } });
          toast.success("Sound effect ready in your Library");
        } catch (e) { console.error(e); toast.error("Sound effect generation failed"); }
      })();
      return;
    }

    // ── Background Music generation intent (ElevenLabs) ──
    const musicMatch = isIntroTrigger ? null : text.match(/(?:make|create|generate|compose|produce|i need|give me)(?:\s+(?:a|an|some))?\s+(?:music|song|track|score|melody|beat|tune|soundtrack)\s+(?:of\s+|for\s+|like\s+|that\s+is\s+|that\s+sounds\s+like\s+|in\s+the\s+style\s+of\s+|with\s+)?(.+)/i);
    if (musicMatch && musicMatch[1]) {
      const prompt = musicMatch[1].replace(/[.!?]+$/, "").trim();
      const userMsg: Message = { id: Date.now().toString(), role: "user", sender: "user", emoji: "👤", color: "#FFAA00", content: text };
      const ack: Message = {
        id: (Date.now()+1).toString(), role: "assistant", sender: oracleName, emoji: "🎵", color: "#FFD700",
        content: `Composing that for you in the background — I'll drop the finished track into your Library when it's ready.`
      };
        setMessages(prev => finalOnlyMode ? [...prev, userMsg] : [...prev, userMsg, ack]);
        if (!finalOnlyMode && !isMuted) speakAsAgent(ack.content, oracleName);
      (async () => {
        try {
          const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-music`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${getEdgeAuthTokenSync()}` },
            body: JSON.stringify({ prompt, duration_seconds: 30 }),
          });
          if (!r.ok) { toast.error("Music generation failed"); return; }
          const blob = await r.blob();
          const dataUrl: string = await new Promise((res, rej) => { const fr = new FileReader(); fr.onloadend = () => res(fr.result as string); fr.onerror = rej; fr.readAsDataURL(blob); });
          saveMedia.mutate({ media_type: "audio", title: `Music: ${prompt.slice(0, 60)}`, url: dataUrl, source_page: "oracle-music", metadata: { kind: "music", prompt } });
          toast.success("Music track ready in your Library");
        } catch (e) { console.error(e); toast.error("Music generation failed"); }
      })();
      return;
    }

    // ── Outbound phone calling is currently vaulted (Twilio disabled) ──

    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setShowChat(true);
    const userMsg: Message = { id: Date.now().toString(), role: "user", sender: "user", emoji: "👤", color: "#FFAA00", content: isIntroTrigger ? "Hi" : text };
    // Track for speech-therapist listener-aware tone matching
    lastUserMessageRef.current = isIntroTrigger ? "" : text;
    if (!isIntroTrigger) setMessages(prev => [...prev, userMsg]);
    speechQueueRef.current = [];
    isSpeakingQueueRef.current = false;
    setIsLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const allMsgs = isIntroTrigger ? [{ role: "user" as const, sender: "user", emoji: "👤", color: "#FFAA00", content: "Hi", id: "intro" } as Message] : [...messages, userMsg];
      const introKey = "oracle-lunar-introduced";
      const isFirstMeeting = !localStorage.getItem(introKey) || isIntroTrigger;
      // ── Sliding-window history ──
      // Keep only the last 30 messages we send to the model. Without this cap the
      // prompt grows unbounded and eventually exceeds the context window, which
      // makes the edge function 502 mid-stream — the user perceives this as the
      // conversation "dropping out and restarting fresh". The full UI history is
      // preserved in `messages` state; only the wire payload is trimmed.
      const HISTORY_CAP = 30;
      const trimmedMsgs = allMsgs.length > HISTORY_CAP ? allMsgs.slice(-HISTORY_CAP) : allMsgs;
      // CRITICAL: send the signed-in user's JWT so the edge function can
      // identify them. Falling back to the publishable key makes the server
      // treat them as an anonymous public visitor and switch into Sales mode.
      const { data: { session: oracleSession } } = await supabase.auth.getSession();
      const oracleAuthToken = oracleSession?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const oracleResp = await fetch(ORACLE_CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${oracleAuthToken}` },
        body: JSON.stringify({
          messages: trimmedMsgs.map(m => ({ role: m.role, content: m.sender === "user" ? m.content : `[${m.sender}]: ${m.content}` })),
          oracleName,
          isFirstMeeting,
          userMemories: formatMemoriesForPrompt(oracleMemories),
          adContext: {
            showAds: adPrefs?.ads_enabled ?? true,
            isSubscribed: subscribed,
            freeTrialsUsed: adPrefs?.free_trials_used || [],
          },
          masterAvatar: oracleAvatar ? {
            name: oracleAvatar.name,
            voice_style: oracleAvatar.voice_style,
            personality: oracleAvatar.personality,
          } : null,
        }),
        signal: controller.signal,
      });
      if (isFirstMeeting) localStorage.setItem(introKey, new Date().toISOString());

      if (!oracleResp.ok) {
        const err = await oracleResp.json().catch(() => ({ error: "Request failed" }));
        // Server-enforced free daily limit reached
        if (oracleResp.status === 402 && err?.error === "free_limit_reached") {
          if (err.usage) {
            setUsage({ count: err.usage.count, limit: err.usage.limit, remaining: 0 });
          }
          const limitMsg: Message = {
            id: Date.now().toString(),
            role: "assistant",
            sender: oracleName,
            emoji: "🔒",
            color: "#FFD700",
            content: err.message || "You've reached today's free chat limit. Upgrade for unlimited Oracle chat.",
          };
          setShowChat(true);
          setMessages(prev => [...prev, limitMsg]);
          toast.error("Daily free chat limit reached — upgrade to keep going");
          setTimeout(() => navigate("/subscribe"), 1500);
          setIsLoading(false);
          return;
        }
        toast.error(err.error || "Something went wrong");
        setIsLoading(false);
        return;
      }

      // Read server-reported usage headers (only present for free-tier users)
      try {
        const bypassed = oracleResp.headers.get("X-Oracle-Usage-Bypassed");
        if (bypassed === "false") {
          const count = parseInt(oracleResp.headers.get("X-Oracle-Usage-Count") || "0", 10);
          const limit = parseInt(oracleResp.headers.get("X-Oracle-Usage-Limit") || "25", 10);
          const remaining = parseInt(oracleResp.headers.get("X-Oracle-Usage-Remaining") || "0", 10);
          if (!Number.isNaN(count) && !Number.isNaN(limit)) {
            setUsage({ count, limit, remaining });
          }
        } else {
          setUsage(null); // paid/admin — hide badge
        }
      } catch {}

      let oracleContent = "";
      // SPEED: speak sentence-by-sentence as the stream arrives instead of waiting
      // for the full response. Cuts perceived latency from ~5-8s to ~1-2s.
      let spokenUpTo = 0;
      // Strip self-naming anywhere a sentence starts (very start, after . ! ? newline)
      // e.g. "Oracle: Hi" / "Oracle here," / "I'm Oracle" / "This is Oracle" → cleaned for both display + speech
      const escapedName = oracleName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const selfNameRegex = new RegExp(
        `(^|[.!?\\n]\\s*)(?:["“”'‘’(\\[]\\s*)?(?:I\\s*(?:am|'m)\\s+|This is\\s+|It(?:\\s+)?'s\\s+|It is\\s+|As\\s+)?${escapedName}(?:\\s+here)?\\s*[:,\\-–—]?\\s*`,
        "gi"
      );
      const stripSelfNaming = (s: string) => s.replace(selfNameRegex, "$1").trimStart();
      // Strip leading emojis / decorative symbols / leading punctuation flourishes the model sometimes spams.
      const leadingEmojiRegex = /^(?:[\s\u200d\ufe0f]|[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{2700}-\u{27BF}]|[★☆✦✧✩✪✫✬✭✮✯✰⭐]|[—–\-*~•·●◆◇♦])+/u;
      const stripLeadingDecor = (s: string) => s.replace(leadingEmojiRegex, "").trimStart();
      const stripMarkersForSpeech = (s: string) =>
        stripLeadingDecor(stripSelfNaming(
          s
            .replace(/\[\[MEMORY:\w+:.+?\]\]/g, "")
            .replace(/\[\[FREE_TRIAL:.+?\]\]/g, "")
            .replace(/\[\[NAVIGATE:[^\]]+\]\]/g, "")
            .replace(/\[\[BACKGROUND:[^\]]+\]\]/g, "")
        ));
      const flushSpeakableSentences = (final = false) => {
        if (isMuted) return;
        const pending = oracleContent.slice(spokenUpTo);
        // Match complete sentences ending in . ! ? or newline
        const sentenceRegex = /[^.!?\n]+[.!?\n]+/g;
        let lastEnd = 0;
        const toSpeak: string[] = [];
        let m: RegExpExecArray | null;
        while ((m = sentenceRegex.exec(pending)) !== null) {
          toSpeak.push(m[0]);
          lastEnd = m.index + m[0].length;
        }
        if (toSpeak.length) {
          spokenUpTo += lastEnd;
          const chunk = stripMarkersForSpeech(toSpeak.join(" ")).trim();
          if (chunk) speakAsAgent(chunk, oracleName);
        }
        if (final) {
          const tail = oracleContent.slice(spokenUpTo);
          const cleaned = stripMarkersForSpeech(tail).trim();
          if (cleaned) speakAsAgent(cleaned, oracleName);
          spokenUpTo = oracleContent.length;
        }
      };

      const reader = oracleResp.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "" || !line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                oracleContent += content;
                if (finalOnlyMode) continue;
                // Strip self-naming prefix
                let displayContent = stripSelfNaming(oracleContent);
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  if (last?.sender === oracleName) return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: displayContent } : m);
                  return [...prev, {
                    id: "oracle-" + Date.now(), role: "assistant", sender: oracleName,
                    emoji: oracleAvatar ? "👤" : "🔮", color: "#9b87f5", content: displayContent,
                    avatar_url: oracleAvatar?.image_url || undefined,
                  }];
                });
                // Speak any complete sentences immediately
                flushSpeakableSentences(false);
              }
            } catch { buffer = line + "\n" + buffer; break; }
          }
        }
      }

      // Parse and save memories from Oracle response
      const memoryMatches = oracleContent.matchAll(/\[\[MEMORY:(\w+):(.+?)\]\]/g);
      for (const match of memoryMatches) {
        const [, memType, memContent] = match;
        saveMemory.mutate({ memory_type: memType, content: memContent, importance: 7 });
      }

      // Parse free trial grants
      const trialMatches = oracleContent.matchAll(/\[\[FREE_TRIAL:(.+?)\]\]/g);
      for (const match of trialMatches) {
        const feature = match[1];
        const currentTrials = adPrefs?.free_trials_used || [];
        if (!currentTrials.includes(feature)) {
          updateAdPrefs.mutate({ free_trials_used: [...currentTrials, feature] });
        }
      }

      // Strip memory/trial markers from displayed content
      let cleanedOracleContent = oracleContent
        .replace(/\[\[MEMORY:\w+:.+?\]\]/g, "")
        .replace(/\[\[FREE_TRIAL:.+?\]\]/g, "")
        .trim();

      // Handle navigation commands in Oracle response
      const { cleanContent, navPath, isBackground } = parseAndHandleNavigation(cleanedOracleContent);

      // Update displayed message with cleaned content
      const finalDisplayContent = stripSelfNaming(cleanContent || cleanedOracleContent);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.sender === oracleName) {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: finalDisplayContent } : m);
        }
        return [...prev, {
          id: "oracle-" + Date.now(), role: "assistant", sender: oracleName,
          emoji: oracleAvatar ? "👤" : "🔮", color: "#9b87f5", content: finalDisplayContent,
          avatar_url: oracleAvatar?.image_url || undefined,
        }];
      });

      // Auto-save every Oracle answer to the user's library as a text note.
      // Users own their library and can delete any item from My Library.
      saveOracleTextTurn({
        userMessage: text,
        assistantMessage: finalDisplayContent,
        oracleName,
        source: "oracle",
      });

      if (navPath) {
        if (isBackground) {
          toast.success(`${oracleName} is working on it in the background...`);
        } else {
          // Trust the model's [[NAVIGATE:...]] tag. The system prompt explicitly
          // tells Oracle to ONLY emit it when the user asked to go somewhere or
          // walked through a feature. Silently swallowing it makes Oracle look
          // broken ("the AI doesn't do anything"). Give the user a brief toast
          // so they understand what's about to happen.
          toast(`Opening ${navPath.replace(/^\//, "")}...`);
          setTimeout(() => triggerExplosion(navPath), 1500);
        }
      }

      // SPEED: flush any remaining unspoken tail (sentences already spoken inline above)
      flushSpeakableSentences(true);

      // Send to active agents
      if (activeAgents.length > 0) {
        try {
          const historyWithOracle = [
            ...allMsgs.slice(-10).map(m => ({ sender: m.sender, content: m.content })),
            ...(oracleContent ? [{ sender: oracleName, content: oracleContent }] : []),
          ];
          const friendResp = await fetch(FRIENDS_CHAT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${getEdgeAuthTokenSync()}` },
            body: JSON.stringify({ message: text, history: historyWithOracle, agentNames: getAgentNames() }),
          });
          if (friendResp.ok) {
            const data = await friendResp.json();
            for (let i = 0; i < (data.responses || []).length; i++) {
              const r = data.responses[i];
              const matchedAgent = activeAgents[i % activeAgents.length];
              if (!matchedAgent) continue;
              await new Promise(resolve => setTimeout(resolve, 400 + i * 500));
              setMessages(prev => [...prev, {
                id: `agent-${Date.now()}-${i}`, role: "assistant",
                sender: r.sender || matchedAgent.name, emoji: matchedAgent.emoji, color: matchedAgent.color,
                content: r.content, avatar_url: matchedAgent.avatar_url,
              }]);
              speakAsAgent(r.content, matchedAgent.name);
            }
          }
        } catch (e) { console.error("Agent chat error:", e); }
      }
    } catch (e: any) {
      if (e?.name === "AbortError") {}
      else { console.error(e); toast.error("Failed to connect to Oracle AI"); }
    } finally { setIsLoading(false); abortRef.current = null; }
  };

  // ============ RENDER ============
  return (
    <>
    <SEO
      title="Oracle AI Chat — Talk to Your Voice AI Companion"
      description="Chat with Oracle, the ORACLE LUNAR voice AI companion. Real-time voice + text, persistent memory, multi-agent conversations. Free to start."
      path="/oracle"
    />
    <div className="h-screen flex flex-col relative overflow-hidden" style={{ background: "#0a0a0a" }}>
      {/* ======== ATOMIC EXPLOSION OVERLAY ======== */}
      {explosionActive && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none" style={{ animation: "explosion-flash 2.2s ease-out forwards" }}>
          {/* Flash */}
          <div className="absolute inset-0" style={{
            background: "radial-gradient(circle at 50% 50%, #fff 0%, #ff6600 20%, #ff0000 40%, #330000 70%, #000 100%)",
            animation: "explosion-grow 2.2s ease-out forwards",
          }} />
          {/* Mushroom cloud */}
          <div className="absolute" style={{
            width: "300px", height: "400px",
            background: "radial-gradient(ellipse at 50% 30%, #ff4400 0%, #ff6600 25%, #cc3300 50%, rgba(0,0,0,0.8) 100%)",
            borderRadius: "50% 50% 20% 20%",
            animation: "mushroom-rise 2s ease-out forwards",
            filter: "blur(8px)",
          }} />
          {/* Stem */}
          <div className="absolute" style={{
            width: "80px", height: "250px", bottom: "10%",
            background: "linear-gradient(to top, #330000, #ff4400, #ff6600)",
            animation: "stem-rise 1.8s ease-out forwards",
            filter: "blur(4px)",
          }} />
          {/* Shockwave rings */}
          <div className="absolute rounded-full border-4 border-orange-500/60" style={{
            width: "50px", height: "50px",
            animation: "shockwave 1.5s ease-out forwards",
          }} />
          <div className="absolute rounded-full border-2 border-red-500/40" style={{
            width: "50px", height: "50px",
            animation: "shockwave 1.5s ease-out 0.3s forwards",
          }} />
        </div>
      )}

      {/* Explosion CSS animations */}
      <style>{`
        @keyframes explosion-flash { 0% { opacity: 0; } 5% { opacity: 1; } 60% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes explosion-grow { 0% { transform: scale(0); opacity: 1; } 30% { transform: scale(1.5); opacity: 1; } 100% { transform: scale(3); opacity: 0; } }
        @keyframes mushroom-rise { 0% { transform: translateY(200px) scale(0.2); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateY(-50px) scale(1.5); opacity: 0.3; } }
        @keyframes stem-rise { 0% { transform: scaleY(0); opacity: 0; } 20% { opacity: 1; } 100% { transform: scaleY(1.5); opacity: 0.2; } }
        @keyframes shockwave { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(30); opacity: 0; } }
      `}</style>

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 z-10">
        <UniversalBackButton />
        <div className="flex items-center gap-2">
          {/* Free-tier daily message badge — only visible when server tracks usage (free users) */}
          {usage && (
            <button
              onClick={() => navigate("/subscribe")}
              title="Free daily Oracle chat limit. Tap to upgrade."
              className={`flex items-center gap-1 px-2 py-1.5 rounded-full border backdrop-blur text-[10px] font-semibold transition-colors ${
                usage.remaining <= 5
                  ? "border-red-500/40 bg-red-500/10 text-red-300"
                  : usage.remaining <= 10
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              }`}
            >
              <Crown className="w-3 h-3" />
              <span>{usage.count} / {usage.limit} free</span>
            </button>
          )}
          {/* Oracle Swap button */}
          <button onClick={() => setShowOracleSwap(!showOracleSwap)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-full border border-purple-500/30 bg-black/50 backdrop-blur">
            <Crown className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[10px] text-purple-400">Swap</span>
          </button>
          <button onClick={() => navigate("/avatar-gallery")} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#FFAA00]/30 bg-black/50 backdrop-blur">
            <Eye className="w-4 h-4 text-[#FFAA00]" />
            <span className="text-xs text-[#FFAA00] font-medium">Gallery</span>
          </button>
          <button onClick={() => setShowFriendPanel(!showFriendPanel)} className="p-2 rounded-full border border-[#FFAA00]/30 bg-black/50 backdrop-blur relative">
            <Users className="w-5 h-5 text-[#FFAA00]" />
            {activeAgents.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 text-[9px] text-white flex items-center justify-center font-bold">{activeAgents.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* ======== ORACLE SWAP PANEL ======== */}
      {showOracleSwap && (
        <div className="absolute top-14 left-4 z-30 bg-black/95 border border-purple-500/30 rounded-2xl p-4 backdrop-blur-xl w-72 max-h-[60vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-purple-400 font-semibold">Replace Oracle</p>
            <button onClick={() => setShowOracleSwap(false)}><X className="w-4 h-4 text-purple-400" /></button>
          </div>
          
          {/* Default orb option */}
          <button onClick={() => swapOracle()}
            className={`w-full flex items-center gap-3 p-2.5 rounded-xl mb-2 transition-all ${oracleMode.mode === "orb" ? "ring-1 ring-purple-500 bg-purple-500/10" : "opacity-60 hover:opacity-80"}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center text-lg border border-purple-500/30">🔮</div>
            <div>
              <p className="text-xs text-white font-medium">Mystic Orb</p>
              <p className="text-[9px] text-gray-500">Default animated oracle</p>
            </div>
          </button>

          {/* User avatars with oracle/partner purpose */}
          {userAvatars.filter(a => a.purpose === "oracle" || a.purpose === "partner").map(a => (
            <button key={a.id} onClick={() => swapOracle(a.id)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl mb-2 transition-all ${oracleMode.avatarId === a.id ? "ring-1 ring-purple-500 bg-purple-500/10" : "opacity-60 hover:opacity-80"}`}>
              {a.image_url ? (
                <img src={a.image_url} alt={a.name} className="w-10 h-10 rounded-full object-cover border border-purple-500/30" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center text-lg border border-pink-500/30">💕</div>
              )}
              <div>
                <p className="text-xs text-white font-medium">{a.name}</p>
                <p className="text-[9px] text-gray-500">{a.purpose === "partner" ? "Partner" : "Oracle"} Avatar</p>
              </div>
            </button>
          ))}

          {userAvatars.filter(a => a.purpose === "oracle" || a.purpose === "partner").length === 0 && (
            <p className="text-[10px] text-gray-600 text-center py-2">Create an Oracle or Partner avatar first</p>
          )}

          <button onClick={() => { setShowOracleSwap(false); navigate("/avatar-generator?purpose=oracle"); }}
            className="w-full py-2 rounded-xl border border-dashed border-gray-700 text-gray-400 text-xs flex items-center justify-center gap-1.5 mt-2 hover:border-purple-500 hover:text-purple-400">
            <Plus className="w-3.5 h-3.5" /> Create Oracle Avatar
          </button>
        </div>
      )}

      {/* Agent panel overlay */}
      {showFriendPanel && (
        <div className="absolute top-14 right-4 z-30 bg-black/95 border border-[#FFAA00]/30 rounded-2xl p-4 backdrop-blur-xl w-72 max-h-[70vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-[#FFAA00] font-semibold">Summon AI into Chat</p>
            <button onClick={() => setShowFriendPanel(false)}><X className="w-4 h-4 text-[#FFAA00]" /></button>
          </div>

          {/* Rename Oracle */}
          <div className="mb-3 p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <p className="text-[10px] text-purple-400 uppercase tracking-wider mb-1">Oracle Name</p>
            {renamingAgent === "Oracle" ? (
              <div className="flex gap-1">
                <input value={renameInput} onChange={e => setRenameInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleRename("Oracle")}
                  className="flex-1 bg-black/50 border border-purple-500/30 rounded px-2 py-1 text-xs text-white outline-none" autoFocus placeholder="New name..." />
                <button onClick={() => handleRename("Oracle")} className="px-2 py-1 bg-purple-500 rounded text-[10px] text-white">Save</button>
              </div>
            ) : (
              <button onClick={() => { setRenamingAgent("Oracle"); setRenameInput(oracleName); }}
                className="flex items-center gap-1.5 text-xs text-white hover:text-purple-300">
                <Edit2 className="w-3 h-3" /> {oracleName}
              </button>
            )}
          </div>
          
          {/* Default agents */}
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Built-in Agents</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {agents.filter(a => a.name !== oracleName && a.name !== "Oracle" && !a.isUserAvatar).map(a => (
              <div key={a.name} className="flex flex-col items-center gap-1">
                <button onClick={() => toggleAgent(a.name)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all w-full ${a.active ? "ring-1 ring-[#FFAA00] bg-[#FFAA00]/10" : "opacity-50"}`}>
                  <div className="text-lg relative">{a.emoji}{a.locked && <span className="absolute -top-1 -right-1 text-[8px]">🔒</span>}</div>
                  <span className="text-[8px] text-gray-300">{getDisplayName(a.name)}</span>
                </button>
                {!a.locked && (
                  <button onClick={() => { setRenamingAgent(a.name); setRenameInput(getDisplayName(a.name)); }}
                    className="text-[8px] text-gray-600 hover:text-purple-400"><Edit2 className="w-2.5 h-2.5" /></button>
                )}
              </div>
            ))}
          </div>

          {/* Rename overlay for agent */}
          {renamingAgent && renamingAgent !== "Oracle" && (
            <div className="mb-3 p-2 rounded-xl bg-[#FFAA00]/10 border border-[#FFAA00]/20">
              <p className="text-[10px] text-[#FFAA00] mb-1">Rename {renamingAgent}</p>
              <div className="flex gap-1">
                <input value={renameInput} onChange={e => setRenameInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleRename(renamingAgent)}
                  className="flex-1 bg-black/50 border border-[#FFAA00]/30 rounded px-2 py-1 text-xs text-white outline-none" autoFocus />
                <button onClick={() => handleRename(renamingAgent)} className="px-2 py-1 bg-[#FFAA00] rounded text-[10px] text-black font-bold">Save</button>
                <button onClick={() => setRenamingAgent(null)} className="px-2 py-1 text-[10px] text-gray-400">Cancel</button>
              </div>
            </div>
          )}

          {/* User-created avatars */}
          {agents.filter(a => a.isUserAvatar).length > 0 && (
            <>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Your Avatars</p>
              <div className="space-y-1.5 mb-3">
                {agents.filter(a => a.isUserAvatar).map(a => (
                  <button key={a.avatarId} onClick={() => toggleAgent(a.name)}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-xl transition-all text-left ${a.active ? "ring-1 ring-[#FFAA00] bg-[#FFAA00]/10" : "opacity-60 hover:opacity-80"}`}>
                    {a.avatar_url ? (
                      <img src={a.avatar_url} alt={a.name} className="w-8 h-8 rounded-full object-cover border border-gray-700" />
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm border border-gray-700" style={{ backgroundColor: a.color + "20" }}>{a.emoji}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-medium truncate">{a.name}</p>
                      <p className="text-[9px] text-gray-500 truncate">{a.voice_style}</p>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${a.active ? "bg-green-500" : "bg-gray-600"}`} />
                  </button>
                ))}
              </div>
            </>
          )}

          <button onClick={() => { setShowFriendPanel(false); navigate("/avatar-generator"); }}
            className="w-full py-2 rounded-xl border border-dashed border-gray-700 text-gray-400 text-xs flex items-center justify-center gap-1.5 hover:border-purple-500 hover:text-purple-400">
            <Plus className="w-3.5 h-3.5" /> Create New Avatar
          </button>
        </div>
      )}

      {/* Orb / Avatar area */}
      <div className={`relative flex-1 flex items-center justify-center transition-all ${showChat ? "max-h-[35%]" : ""}`}>
        {/* Live mic indicator */}
        {isListening && (
          <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-2 py-1 rounded-full bg-background/60 backdrop-blur-sm border border-border">
            <span
              className="w-2 h-2 rounded-full bg-emerald-400"
              style={{ animation: "pulse 1.4s ease-in-out infinite" }}
            />
            <span className="text-[10px] text-muted-foreground">Listening now</span>
          </div>
        )}
        {oracleMode.mode === "orb" ? (
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        ) : (
          <div className="flex flex-col items-center gap-3 z-10">
            <div
              className={`relative w-[260px] h-[260px] sm:w-[340px] sm:h-[340px] md:w-[420px] md:h-[420px] rounded-full overflow-hidden border-4 transition-all ${isSpeaking ? "border-pink-500 shadow-[0_0_40px_rgba(236,72,153,0.5)]" : isListening ? "border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.4)]" : "border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.2)]"}`}
              style={undefined}
            >
              <LivingAvatar
                imageUrl={oracleAvatar?.image_url || MASTER_AI_AVATAR}
                alt={oracleName}
                intensity="subtle"
                className="w-full h-full"
              />
              {isListening && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              )}
            </div>
            <p className="text-sm text-purple-300 font-medium">{oracleName}</p>
          </div>
        )}

        {/* Orbiting agents */}
        {activeAgents.map((a, i) => {
          const angle = (i / Math.max(activeAgents.length, 1)) * Math.PI * 2 - Math.PI / 2;
          const radius = 42;
          return (
            <div key={a.name} className="absolute z-10 animate-bounce" style={{
              top: `calc(50% + ${Math.sin(angle) * radius}%)`,
              left: `calc(50% + ${Math.cos(angle) * radius}%)`,
              transform: "translate(-50%, -50%)",
              animationDuration: `${3 + i * 0.5}s`,
            }}>
              {a.avatar_url ? (
                <img src={a.avatar_url} alt={a.name} className="w-10 h-10 rounded-full object-cover border-2" style={{ borderColor: a.color }} />
              ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 backdrop-blur" style={{ borderColor: a.color, backgroundColor: a.color + "20" }}>
                  {a.emoji}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Chat messages */}
      {showChat && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-2 min-h-0" style={{ background: "rgba(10, 10, 10, 0.95)" }}>
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-2 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
              {msg.sender !== "user" && (
                <div className="relative group shrink-0">
                  {msg.avatar_url ? (
                    <img src={msg.avatar_url} alt={msg.sender} className="w-7 h-7 rounded-full object-cover border cursor-pointer" style={{ borderColor: msg.color }} />
                  ) : (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm border cursor-pointer" style={{ borderColor: msg.color, backgroundColor: msg.color + "15" }}>
                      {msg.emoji}
                    </div>
                  )}
                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 pointer-events-none">
                    {msg.avatar_url ? (
                      <img src={msg.avatar_url} alt={msg.sender} className="w-28 h-28 rounded-2xl object-cover border-2 shadow-xl" style={{ borderColor: msg.color }} />
                    ) : (
                      <div className="w-28 h-28 rounded-2xl flex items-center justify-center text-4xl border-2 shadow-xl" style={{ borderColor: msg.color, backgroundColor: msg.color + "25" }}>
                        {msg.emoji}
                      </div>
                    )}
                    <p className="text-center text-[10px] font-bold mt-1" style={{ color: msg.color }}>{msg.sender}</p>
                  </div>
                </div>
              )}
              <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${msg.sender === "user" ? "bg-[#FFAA00] text-black rounded-br-sm" : "rounded-bl-sm"}`}
                style={msg.sender !== "user" ? { backgroundColor: msg.color + "15", border: `1px solid ${msg.color}30`, color: "#e5e5e5" } : undefined}>
                {msg.sender !== "user" && <p className="text-[9px] font-bold mb-0.5" style={{ color: msg.color }}>{msg.sender}</p>}
                {msg.sender === "user" ? msg.content : (
                  <div className="prose prose-sm prose-invert max-w-none [&>p]:m-0"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                )}
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.sender === "user" && (
            <div className="flex gap-2 items-center">
              {oracleAvatar?.image_url ? (
                <img src={oracleAvatar.image_url} alt={oracleName} className="w-7 h-7 rounded-full object-cover border border-purple-500" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#9b87f5]/20 flex items-center justify-center text-sm border border-[#9b87f5]">🔮</div>
              )}
              <div className="flex gap-1 px-3 py-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#FFAA00] animate-bounce" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#FFAA00] animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-[#FFAA00] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input bar */}
      <div className="px-4 py-3 z-10" style={{ background: "linear-gradient(to top, #0a0a0a, rgba(10,10,10,0.95))" }}>
        {!micPermGranted && (
          <div className="mb-3 rounded-2xl border border-[#FFAA00]/30 bg-black/70 px-4 py-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">Enable microphone</div>
                <div className="text-xs text-gray-300">
                  Oracle needs one click from you to trigger your laptop's mic permission.
                </div>
                {micPermissionError && (
                  <div className="text-xs text-red-300 mt-1">{micPermissionError}</div>
                )}
              </div>
              <button
                onClick={toggleMic}
                className="px-4 py-2 rounded-full bg-[#FFAA00] text-black text-sm font-semibold"
              >
                Allow mic
              </button>
            </div>
          </div>
        )}
        {isListening && (
          <div className={`mb-2 text-center text-[11px] font-medium ${wakeActive ? "text-emerald-300" : "text-amber-300"}`}>
            {wakeActive ? "● Mic on — speak naturally. Auto-sends 2s after you stop. Say \"enough Oracle\" or \"mute my mic\" to turn off." : "○ Oracle paused — say \"hey Oracle\" to resume."}
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-[#FFAA00]/30 bg-black/60 backdrop-blur">
          <button onClick={toggleMic} className={`p-2 rounded-full ${isListening ? "bg-green-600/80" : micPermGranted ? "bg-green-600/30" : "bg-transparent"}`}>
            {isListening ? <Mic className="w-5 h-5 text-white animate-pulse" /> : <Mic className="w-5 h-5 text-[#FFAA00]" />}
          </button>
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*,video/*,audio/*,application/pdf,text/*,.doc,.docx,.txt,.md,.json,.csv"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => uploadInputRef.current?.click()}
            disabled={uploading}
            title="Attach photo or file"
            className="p-2 rounded-full bg-purple-500/20 hover:bg-purple-500/40 disabled:opacity-50 transition-colors"
          >
            <Paperclip className={`w-5 h-5 text-purple-300 ${uploading ? "animate-pulse" : ""}`} />
          </button>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            onPaste={e => {
              // Explicitly allow paste — read clipboard text and append
              const pasted = e.clipboardData?.getData("text");
              if (pasted) {
                e.preventDefault();
                const target = e.currentTarget;
                const start = target.selectionStart ?? input.length;
                const end = target.selectionEnd ?? input.length;
                setInput(input.slice(0, start) + pasted + input.slice(end));
              }
            }}
            placeholder={`Speak, type, paste, or attach for ${oracleName}...`}
            rows={1}
            spellCheck
            autoCapitalize="sentences"
            className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-500 outline-none resize-none max-h-32 py-1.5 select-text"
            style={{ userSelect: "text", WebkitUserSelect: "text" }}
          />
          <button
            type="button"
            onClick={async () => {
              try {
                const txt = await navigator.clipboard.readText();
                if (txt) setInput(prev => prev + txt);
              } catch {
                toast.error("Clipboard blocked — long-press the box and choose Paste.");
              }
            }}
            title="Paste from clipboard"
            className="p-2 rounded-full bg-purple-500/20 hover:bg-purple-500/40 transition-colors text-purple-300 text-[10px] font-semibold"
          >
            Paste
          </button>
          <button onClick={() => sendMessage(input)} disabled={!input.trim()} className="p-2 rounded-full bg-[#FFAA00] disabled:opacity-30">
            <Send className="w-5 h-5 text-black" />
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex flex-col items-center pb-3 gap-2 z-10" style={{ background: "#0a0a0a" }}>
        <div className="flex items-center gap-3">
          <button onClick={toggleMute} className={`p-2 rounded-full border transition-all ${isMuted ? "border-red-500/40 bg-red-600/20" : "border-green-500/40 bg-green-600/20"}`}>
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-green-400" />}
          </button>
          {activeAgents.length >= 2 && (
            <button onClick={() => setShowDebate(p => !p)} className={`px-2 py-1 rounded-full border text-[9px] font-medium transition-all ${showDebate ? "border-orange-500/40 bg-orange-600/20 text-orange-300" : "border-gray-700 bg-gray-800/50 text-gray-500"}`}>
              {showDebate ? "🔥 Debates On" : "Debates Off"}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${debateActive ? "bg-orange-500 animate-pulse" : isSpeaking ? "bg-[#FFAA00] animate-pulse" : "bg-green-500"}`} />
          <span className="text-xs text-gray-400">{debateActive ? "DEBATING" : isSpeaking ? "SPEAKING" : "READY"}</span>
          <span className="text-xs text-gray-600">|</span>
          <span className="text-xs text-[#FFAA00]">{oracleName} + {activeAgents.length} agents</span>
        </div>
      </div>

      <button onClick={() => navigate("/dashboard")} className="fixed bottom-4 right-4 z-20 p-3 rounded-full border-2 border-[#FFAA00] bg-black/80 backdrop-blur">
        <LayoutGrid className="w-6 h-6 text-[#FFAA00]" />
      </button>
      <SystemDoctorPanel open={showDoctor} onClose={() => setShowDoctor(false)} />
      <AudioClarifyDialog
        open={audioClarify.open}
        fragment={audioClarify.fragment}
        onResolve={(intent: AudioIntent) => {
          const { fragment } = audioClarify;
          setAudioClarify({ open: false, fragment: "" });
          // Send the cleaned-up prompt (or the original text if user picked Cancel)
          const cleaned = intentToPrompt(intent, fragment);
          // Defer one tick so the dialog unmounts before the model call begins
          setTimeout(() => sendMessageRef.current?.(cleaned), 0);
        }}
      />
    </div>
    </>
  );
};

export default OraclePage;
