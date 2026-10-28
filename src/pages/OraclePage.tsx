import { generateMemberVideo } from "@/lib/videoGeneration";
import { getEdgeAuthTokenSync, getEdgeAuthToken, requireEdgeAuthToken, EdgeSessionRequiredError } from "@/lib/edgeAuth";
import { VOICE_FINAL_PAUSE_MS, VOICE_INTERIM_PAUSE_MS, takeSpeakablePrefix } from "@/lib/oracleVoiceTiming";
import { playOracleAudio } from "@/lib/oracleAudioPlayback";
import { chooseOracleDeviceVoice, naturalDeviceSpeechText } from "@/lib/oracleDeviceVoice";
import { readDraft, writeDraft, recoveryFor } from "@/lib/recovery";
import { useState, useRef, useEffect, useCallback } from "react";
import SEO from "@/components/SEO";
import { cleanTextForPremiumSpeech, cleanTextForSpeech } from "@/lib/utils";
import { Send, Mic, Users, Volume2, VolumeX, Settings2, LayoutGrid, Eye, X, Plus, UserPlus, Edit2, Crown, Bomb, Paperclip, Gavel, Clapperboard } from "lucide-react";
import { notifyWalletInsufficient } from "@/lib/walletPaywall";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import { useScribe } from "@elevenlabs/react";
import { useMute } from "@/contexts/MuteContext";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useUserAvatars, useSaveMedia, useCreateAvatar, type UserAvatar } from "@/hooks/useUserAvatars";
import { useOracleMemories, useSaveOracleMemory, useAdPreferences, useUpdateAdPreferences, shouldShowPromo, formatMemoriesForPrompt } from "@/hooks/useOracleMemory";
import { useSubscription } from "@/hooks/useSubscription";
import SystemDoctorPanel from "@/components/SystemDoctorPanel";
import { MASTER_AI_AVATAR } from "@/assets/master-ai-avatar";
import LivingAvatar from "@/components/LivingAvatar";
import adPresenter from "@/assets/avatars/oracle-ad-presenter.png.asset.json";
import adPresenterPreview from "@/assets/avatars/oracle-ad-presenter-preview.jpg";
import OracleArtifactViewer from "@/components/oracle/OracleArtifactViewer";
import { artifactAnnouncement, finishedArtifact, resolveSpeechMode, routeOracleSpeech, type OracleArtifact, type OracleSpeechMode } from "@/lib/oraclePresenter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhoneOff, MessageSquare, Info } from "lucide-react";
import OraclePromptBox from "@/components/oracle/OraclePromptBox";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import OraclePresenterStage from "@/components/oracle/OraclePresenterStage";
import OracleAccountMenu from "@/components/oracle/OracleAccountMenu";
import OracleResponseFeedback from "@/components/oracle/OracleResponseFeedback";
import AudioClarifyDialog, { intentToPrompt, type AudioIntent } from "@/components/AudioClarifyDialog";
import { detectTruncation } from "@/lib/truncationDetector";
import { saveOracleTextTurn } from "@/lib/saveToLibrary";
import { generateImage, InsufficientCreditsError } from "@/lib/imageGen";
import { resolveOracleCommand, dispatchOracleCommand, stripOracleMarkers } from "@/lib/oracleControl";
import OracleImageComposer from "@/components/OracleImageComposer";
import OracleToolsMenu from "@/components/oracle/OracleToolsMenu";
import SwarmAgentsButton from "@/components/oracle/SwarmAgentsButton";

interface Message {
  id: string;
  role: "user" | "assistant";
  sender: string;
  emoji: string;
  color: string;
  content: string;
  avatar_url?: string;
  isAppResult?: boolean;
  artifact?: OracleArtifact;
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
import AgentPicker from "@/components/AgentPicker";
import ThinkingIndicator from "@/components/ThinkingIndicator";
import { getActiveAgent, recordAgentReply } from "@/lib/chatAgents";
import { formatWebAnswer } from "@/lib/oracleWeb";
const FRIENDS_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-friends-chat`;
const ORACLE_CODER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-coder`;

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

const DIRECT_TASK_RE = /\b(?:make|create|generate|genrate|genrste|genrarte|draw|paint|render|design|imagine|compose|produce|record|write|build|develop|code|open|launch|go to|take me to|show me|diagnose|fix|repair)\b/i;

function isDirectOracleTask(text: string): boolean {
  return DIRECT_TASK_RE.test(text);
}

function extractImagePrompt(text: string): string | null {
  const polish = (value: string) => value
    .replace(/\b8\s*k\b/gi, "4K")
    .replace(/\bmonk+ey\b/gi, "monkey")
    .replace(/\b(?:in|on)\s+thi?s\s+screen\b/gi, "")
    .replace(/\b(?:then\s+|and\s+)?(?:save|saved|drop|put|add)\s+(?:it|this|that)?\s*(?:to|in|into)?\s*(?:the|my|your)?\s*(?:media\s*)?library\b[\s\S]*$/i, "")
    .replace(/\b(?:then\s+|and\s+)?(?:show|open|display)\s+(?:it|this|that)?\s*(?:to\s+me\s+)?(?:here|in\s+thi?s\s+screen)?\b[\s\S]*$/i, "")
    .replace(/^[\s,.:;!?-]*(?:of|for|showing|depicting|that\s+is|like|with|a|an|the|some)\s+/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
  const patterns = [
    /\b(?:make|create|generate|genrate|genrste|genrarte|draw|paint|render|design|imagine|give me|i need|show me)(?:\s+(?:me|us))?(?:\s+\w+){0,5}?\s+(?:image|img|imge|picture|pic|photo|photograph|painting|drawing|illustration|artwork|art|wallpaper|poster|logo|portrait|scene|mockup|icon|sticker)\s*(?:of\s+|for\s+|showing\s+|depicting\s+|that\s+is\s+|like\s+|with\s+)?([\s\S]+)/i,
    /\b(?:make|create|generate|genrate|genrste|genrarte|render|design|give me|i need|show me)(?:\s+(?:me|us))?\s+(?:a|an|the|some)?\s*([\s\S]+?)\s+(?:image|img|imge|picture|pic|photo|photograph|painting|drawing|illustration|artwork|wallpaper|poster|portrait|scene)$/i,
    /\b(?:draw|paint|render|illustrate|sketch)(?:\s+(?:me|us))?\s+(?:a|an|the|some)?\s*([\s\S]+)/i,
    /\b(?:make|create|generate|genrate|genrste|genrarte)(?:\s+(?:me|us))?\s+(?:a|an|the|some)?\s*([\s\S]*\b8\s*k\b[\s\S]*)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const prompt = match?.[1] ? polish(match[1]) : "";
    if (prompt) return prompt;
  }
  return null;
}

const ORACLE_APP_ROUTES = [
  { label: "App Builder", path: "/app-builder", re: /\b(app\s*builder|coding\s*app|code\s*builder|app\s*maker|build\s+apps?|make\s+apps?)\b/i },
  { label: "Media Library", path: "/media-library", re: /\b(media\s*library|my\s*library|library|saved\s*(?:files|media|apps|images))\b/i },
  { label: "Live Vision", path: "/live-vision", re: /\b(live\s*vision|camera|see\s+through|look\s+at\s+this|scan\s+this)\b/i },
  { label: "Photography Hub", path: "/photography-hub", re: /\b(photo(?:graphy)?\s*hub|photo\s*studio|edit\s+(?:a\s+)?photo|picture\s*editor)\b/i },
  { label: "Voice Studio", path: "/voice-studio", re: /\b(voice\s*studio|voice\s*builder|change\s+(?:your\s+)?voice|clone\s+voice)\b/i },
  { label: "AI Studio", path: "/ai-studio", re: /\b(ai\s*studio|ai\s*team|agents?\s*studio)\b/i },
  { label: "Diagnostics", path: "/diagnostics", re: /\b(diagnostics?|system\s*doctor|system\s*check|health\s*check)\b/i },
  { label: "Dashboard", path: "/dashboard", re: /\b(dashboard|home\s*screen|main\s*menu)\b/i },
  { label: "Settings", path: "/settings", re: /\b(settings|account\s*settings|preferences)\b/i },
  { label: "Profile", path: "/profile", re: /\b(profile|my\s*account)\b/i },
  { label: "Wallet", path: "/wallet", re: /\b(wallet|payments?|bills?|payid|bpay)\b/i },
  { label: "Calendar", path: "/calendar", re: /\b(calendar|diary|schedule|appointments?)\b/i },
  { label: "Story Writer", path: "/story-writer", re: /\b(story\s*writer|write\s+(?:a\s+)?story|author\s*studio)\b/i },
  { label: "Avatar Generator", path: "/avatar-generator", re: /\b(avatar\s*generator|make\s+(?:an?\s+)?avatar|change\s+(?:your\s+)?face)\b/i },
  { label: "Owner Dashboard", path: "/owner-dashboard", re: /\b(owner\s*dashboard|admin\s*dashboard|admin\s*panel)\b/i },
];

function resolveDirectOracleRoute(text: string): { label: string; path: string; prefill?: string } | null {
  const navIntent = /\b(open|launch|start|use|run|go\s+to|take\s+me\s+to|show\s+me|bring\s+up|switch\s+to)\b/i.test(text);
  if (!navIntent) return null;
  const route = ORACLE_APP_ROUTES.find((item) => item.re.test(text));
  if (!route) return null;
  const prefill = route.path === "/app-builder" ? text.replace(/\b(open|launch|start|use|run|go\s+to|take\s+me\s+to|show\s+me|bring\s+up|switch\s+to)\b/gi, "").trim() : undefined;
  return { ...route, prefill };
}

function wantsComputerOperatorMode(text: string): boolean {
  return /\b(?:take|gain|have|get|give\s+you|grant\s+you|allow\s+you\s+to|let\s+you)\s+(?:full\s+)?(?:control|access|charge|over)\s+(?:of\s+)?(?:my\s+)?(?:entire\s+)?(?:computer|pc|desktop|laptop|machine|device|system)\b|\bcontrol\s+(?:my\s+)?(?:computer|pc|desktop|laptop|machine|device|system)\b|\brun\s+(?:my\s+)?(?:computer|pc|desktop|laptop|machine|device|system)\b/i.test(text);
}

const OraclePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isMuted, setMuted } = useMute();
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
  const [recoveryUser, setRecoveryUser] = useState<string | null>(null);
  const draftWarning = useRef(false);
  useEffect(() => {
    setMessages([]);
    setInput("");
    if (!user?.id) { setRecoveryUser(null); return; }
    const draft = readDraft<{ messages: Message[]; input: string }>(user.id, "oracle-main");
    if (draft && Array.isArray(draft.messages)) {
      setMessages(draft.messages);
      setInput(typeof draft.input === "string" ? draft.input : "");
    }
    setRecoveryUser(user.id);
  }, [user?.id]);
  useEffect(() => {
    if (!user?.id || recoveryUser !== user.id) return;
    if (!writeDraft(user.id, "oracle-main", { messages: messages.slice(-50), input }) && !draftWarning.current) {
      draftWarning.current = true;
      toast.error("Device storage is full. Keep this chat open until your work is saved.");
    }
  }, [user?.id, recoveryUser, messages, input]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [agents, setAgents] = useState<ChatAgent[]>(DEFAULT_AGENTS);
  const [showFriendPanel, setShowFriendPanel] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [conversationOpen, setConversationOpen] = useState(false);
  const [voiceOptionsOpen, setVoiceOptionsOpen] = useState(false);
  // ── COUNCIL MODE ──
  // Every AI agent (Nova, Lyra, Sage, Kai) answers here inside the one Oracle
  // chat, reads the others, debates, and the Oracle delivers one final answer.
  // Replaces the old separate Agents / Companion / Tutor tabs.
  const [councilMode, setCouncilMode] = useState<boolean>(() => {
    try {
      if (typeof window === "undefined") return false;
      if (new URLSearchParams(window.location.search).get("council") === "1") return true;
      return localStorage.getItem("oracle-council-mode") === "1";
    } catch { return false; }
  });
  const [councilBusy, setCouncilBusy] = useState(false);
  const [showDoctor, setShowDoctor] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  // One-shot lip-synced presenter clips ("greeting" hello, "done" reveal).
  const [presenterCue, setPresenterCue] = useState<"greeting" | "done" | null>(null);
  // Premium pay-per-use video replies: the presenter answers with a real
  // lip-synced generated video instead of device speech. Billed per second
  // from the member's wallet by the gemini-video function (owner exempt).
  const [premiumVideo, setPremiumVideo] = useState(false);
  const [replyVideoUrl, setReplyVideoUrl] = useState<string | null>(null);
  const [videoReplyPending, setVideoReplyPending] = useState(false);
  const premiumVideoRef = useRef(false);
  const portraitDataRef = useRef<string | null>(null);
  useEffect(() => { premiumVideoRef.current = premiumVideo; }, [premiumVideo]);
  useEffect(() => {
    if (!user?.id) return;
    try { setPremiumVideo(localStorage.getItem(`oracle-video-replies:${user.id}`) === "on"); } catch { /* ignore */ }
  }, [user?.id]);
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
  const [viewingArtifact, setViewingArtifact] = useState<OracleArtifact | null>(null);
  const [speechMode, setSpeechMode] = useState<OracleSpeechMode>("device");
  const speechModeRef = useRef<OracleSpeechMode>("device");
  const [deviceVoices, setDeviceVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [deviceVoice, setDeviceVoice] = useState("");
  useEffect(() => {
    if (!user?.id) return;
    const selected = resolveSpeechMode(localStorage.getItem(`oracle-speech-mode:${user.id}`), !!(getStoredOracleMasterVoice()?.id || localStorage.getItem("oracle-lunar-voice")));
    speechModeRef.current = selected;
    setSpeechMode(selected);
    setDeviceVoice(localStorage.getItem(`oracle-device-voice:${user.id}`) || "");
    setViewingArtifact(null);
  }, [user?.id]);
  useEffect(() => {
    if (!window.speechSynthesis) return;
    const load = () => setDeviceVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);
  const [uploading, setUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const isOwner = user?.email?.toLowerCase() === "justinbretthogan@gmail.com";

  // Oracle "step aside" — when she shows generated media she fades out, then fades back in
  // when the media ends (video) or after ~20s (image). Trigger via:
  //   window.dispatchEvent(new CustomEvent("oracle:show-media", { detail: { kind: "image"|"video", url } }))
  useEffect(() => {
    const onShow = (e: Event) => {
      const detail = (e as CustomEvent).detail as { kind: "image" | "video"; url: string } | undefined;
      if (!detail?.url) return;
      setOracleMedia({ kind: detail.kind === "video" ? "video" : "image", url: detail.url });
    };
    const onHide = () => setOracleMedia(null);
    window.addEventListener("oracle:show-media", onShow as EventListener);
    window.addEventListener("oracle:hide-media", onHide);
    return () => {
      window.removeEventListener("oracle:show-media", onShow as EventListener);
      window.removeEventListener("oracle:hide-media", onHide);
    };
  }, []);

  useEffect(() => {
    if (oracleMedia?.kind === "image") {
      const t = setTimeout(() => setOracleMedia(null), 20000);
      return () => clearTimeout(t);
    }
  }, [oracleMedia]);

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

  const scheduleCapturedVoiceFlush = useCallback((delay = VOICE_FINAL_PAUSE_MS) => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      flushCapturedVoiceText();
    }, delay);
  }, [flushCapturedVoiceText]);

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
      // Preserve explicit saved choices; a DB default must not replace the
      // consistent ad presenter later while the avatar list finishes loading.
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
    if (agentName === oracleName) {
      const voice = chooseOracleDeviceVoice(allVoices);
      if (voice) { voiceMapRef.current.set(agentName, voice); return voice; }
    }

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
  }, [agents, oracleName]);

  const speechQueueRef = useRef<Array<{ text: string; agentName: string }>>([]);
  const isSpeakingQueueRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const mutedRef = useRef(isMuted);
  mutedRef.current = isMuted;
  const enableVoiceOutput = () => {
    mutedRef.current = false;
    setMuted(false);
    // Unlock the same media element that will play replies, within the tap.
    const audio = playbackAudioRef.current ?? new Audio();
    playbackAudioRef.current = audio;
    audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
    void audio.play().catch(() => {});
  };
  const testSpeaker = () => {
    cancelCurrentSpeech();
    speechQueueRef.current = [];
    enableVoiceOutput();
    if (!window.speechSynthesis) {
      toast.error("This browser cannot play the voice check.");
      return;
    }
    const utterance = new SpeechSynthesisUtterance("Hi there! It’s lovely to hear from you. What shall we make today?");
    const voice = window.speechSynthesis.getVoices().find(v => v.voiceURI === deviceVoice) || chooseOracleDeviceVoice(window.speechSynthesis.getVoices());
    if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
    utterance.rate = 1; utterance.pitch = 1; utterance.volume = 1;
    utterance.onerror = () => toast.error("Sound could not start. Check your device volume and tap again.");
    window.speechSynthesis.speak(utterance);
  };
  // Monotonically-increasing token. Each new utterance bumps it; any in-flight
  // ElevenLabs stream / browser TTS that sees a stale token aborts immediately.
  // This is the single source of truth that prevents two voices overlapping.
  const speechTokenRef = useRef(0);
  const speechRequestRef = useRef<AbortController | null>(null);
  const cancelCurrentSpeech = useCallback(() => {
    speechTokenRef.current += 1;
    speechRequestRef.current?.abort();
    speechRequestRef.current = null;
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
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${await getEdgeAuthToken()}` },
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
    const controller = new AbortController();
    speechRequestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
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
      // Same saved voice, but always on the low-latency speech engine so
      // Oracle starts talking well inside the three-second target.
      const savedModelId = (masterSettings?.model_id as string | undefined) || undefined;
      const modelId = savedModelId && /flash|turbo/i.test(savedModelId) ? savedModelId : "eleven_flash_v2_5";

      const response = await fetch(ELEVENLABS_TTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${await requireEdgeAuthToken()}` },
        signal: controller.signal,
        body: JSON.stringify({
          text: prepared,
          voiceId: masterVoiceId,
          fast: true,
          outputFormat: "mp3_22050_32",
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
      window.clearTimeout(timeout);
      if (!response.ok || !response.body || !isLive() || mutedRef.current) return false;
      const contentType = response.headers.get("Content-Type") || "";
      if (contentType.includes("application/json")) return false;

      const audio = playbackAudioRef.current ?? new Audio();
      playbackAudioRef.current = audio;
      currentAudioRef.current = audio;
      audio.volume = 0.95;
      audio.playbackRate = 1.0;
      const played = await playOracleAudio(audio, response, () => isLive() && !mutedRef.current, setIsSpeaking);
      if (currentAudioRef.current === audio) currentAudioRef.current = null;
      return played;
    } catch (err) {
      console.warn("Premium TTS error:", err);
      setIsSpeaking(false);
      return false;
    } finally {
      window.clearTimeout(timeout);
      if (speechRequestRef.current === controller) speechRequestRef.current = null;
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
    return agentPitchRef.current.get(agentName) ?? 1;
  };

  // Fallback browser TTS for non-Oracle agents
  const speakWithBrowserTTS = useCallback((text: string, agentName: string): Promise<void> => {
    return new Promise((resolve) => {
      // Snapshot token; if a newer utterance preempts us, abort silently.
      const myToken = speechTokenRef.current;
      const fullText = naturalDeviceSpeechText(text);
      if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") {
        toast.error("Device speech is not available in this browser."); resolve(); return;
      }
      const utterance = new SpeechSynthesisUtterance(fullText);
      utterance.lang = "en-US";
      utterance.rate = 1;
      utterance.pitch = agentName === oracleName ? 1 : getStablePitch(agentName);
      utterance.volume = 0.95;
      const voice = (agentName === oracleName && deviceVoice
        ? window.speechSynthesis.getVoices().find(v => v.voiceURI === deviceVoice)
        : undefined) || getVoiceForAgent(agentName);
      if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
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
  }, [getVoiceForAgent, deviceVoice, oracleName]);

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
      if (isOracle) {
        await routeOracleSpeech(speechModeRef.current,
          () => speakWithBrowserTTS(browserClean, oracleName),
          async () => {
            const tokenBefore = speechTokenRef.current;
            const ok = premiumClean ? await speakWithElevenLabs(premiumClean) : false;
            if (!ok && browserClean && speechTokenRef.current === tokenBefore) await speakWithBrowserTTS(browserClean, oracleName);
          });
      } else if (browserClean) await speakWithBrowserTTS(browserClean, next.agentName);
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

  const offerArtifact = (opts: { kind: OracleArtifact["kind"]; url?: string; body?: string; deepPath: string; libraryId?: string; reused?: boolean; fallback?: boolean }) => {
    const libraryId = opts.libraryId;
    const artifact = finishedArtifact({ ...opts, libraryId, id: crypto.randomUUID(), state: "complete" });
    if (!artifact) return;
    const content = artifactAnnouncement(artifact);
    setShowChat(true);
    setMessages(prev => [...prev, { id: artifact.id, role: "assistant", sender: oracleName, emoji: "", color: "#FFD700", content, artifact }]);
    // Lip-synced "All done — would you like to see it?" clip instead of device speech.
    setPresenterCue("done");
  };

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
  }, []);

  useEffect(() => {
      if (isMuted) {
        speechQueueRef.current = [];
        cancelCurrentSpeech();
      }
  }, [isMuted, cancelCurrentSpeech]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  // Tool navigation stays inside the one Oracle workspace, without a flash or sound.
  const triggerExplosion = useCallback((targetPath: string) => {
    navigate(targetPath, { state: { oracleWorkspace: true } });
  }, [navigate]);

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
        // Debounce a confirmed transcript briefly; interim speech gets a longer pause.
        scheduleCapturedVoiceFlush(VOICE_FINAL_PAUSE_MS);
      } else if (interim.trim()) {
        scheduleCapturedVoiceFlush(VOICE_INTERIM_PAUSE_MS);
      }
    };

    recognition.onspeechend = () => {
      if (latestHeardTextRef.current) scheduleCapturedVoiceFlush(VOICE_FINAL_PAUSE_MS);
    };

    recognition.onsoundend = () => {
      if (latestHeardTextRef.current) scheduleCapturedVoiceFlush(VOICE_FINAL_PAUSE_MS);
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
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

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
      sessionStorage.setItem(SETUP_KEY, "done");
      const greet = "Hello — I'm your Oracle. What would you like to do today?";
      setShowChat(true);
      setMessages((prev) => [...prev, { id: `setup-${Date.now()}`, role: "assistant", sender: "Oracle", emoji: "🔮", color: "#FFD700", content: greet } as any]);
      // Lip-synced greeting clip speaks the hello with her real filmed voice.
      try { setPresenterCue("greeting"); } catch {}
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  // Handles a single setup reply from the user. Returns true if the message
  // was consumed by the setup flow (so sendMessage should NOT forward it to
  // the oracle-chat backend).
  const handleSetupReply = useCallback(async (_rawText: string): Promise<boolean> => {
    sessionStorage.setItem(SETUP_KEY, "done");
    return false;
  }, []);

  // Activate the microphone only after an explicit composer tap.


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
      // A delayed welcome must not cut into a reply already requested.
      if (alwaysListenRef.current || isLoadingRef.current || latestHeardTextRef.current.trim()) return;
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

    enableVoiceOutput();
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

  // ============ COUNCIL ROUND ============
  // Runs every agent on the same question inside this one chat: each answers,
  // each critiques the others, then the Oracle gives the single best answer.
  const runCouncil = async (text: string) => {
    const userMsg: Message = { id: Date.now().toString(), role: "user", sender: "user", emoji: "👤", color: "#FFAA00", content: text };
    const thinkingId = `council-thinking-${Date.now()}`;
    setShowChat(true);
    setCouncilBusy(true);
    setMessages(prev => [...prev, userMsg, {
      id: thinkingId, role: "assistant", sender: "The Council", emoji: "🜂", color: "#FFD700",
      content: "_Nova, Lyra, Sage and Kai are all thinking about this together..._",
    }]);

    const historyText = messages.slice(-6).map(m => `${m.sender}: ${m.content}`).join("\n").slice(0, 4000);

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-council`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getEdgeAuthTokenSync()}` },
        body: JSON.stringify({ question: text, history: historyText, oracleName, debate: true }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setMessages(prev => prev.filter(m => m.id !== thinkingId));
        if (resp.status === 402) {
          notifyWalletInsufficient({ service: "Oracle Council" });
          return;
        }
        toast.error(data?.message || "The council could not meet just now.");
        return;
      }

      const panel: Array<{ id: string; name: string; emoji: string; color: string; answer: string; rebuttal: string }> =
        Array.isArray(data.panel) ? data.panel : [];

      setMessages(prev => prev.filter(m => m.id !== thinkingId));

      for (const p of panel) {
        const body = p.rebuttal ? `${p.answer}\n\n${p.rebuttal}` : p.answer;
        setMessages(prev => [...prev, {
          id: `council-${p.id}-${Date.now()}`, role: "assistant",
          sender: p.name, emoji: p.emoji, color: p.color, content: body,
        }]);
        await new Promise(r => setTimeout(r, 180));
      }

      const finalText: string = (data.answer || "").trim();
      if (finalText) {
        setMessages(prev => [...prev, {
          id: `council-final-${Date.now()}`, role: "assistant", sender: oracleName,
          emoji: oracleAvatar ? "👤" : "🔮", color: "#9b87f5", content: finalText,
          avatar_url: oracleAvatar?.image_url || undefined,
        }]);
        if (!isMuted) speakAsAgent(finalText, oracleName);
      }
    } catch (e) {
      console.error("council error", e);
      setMessages(prev => prev.filter(m => m.id !== thinkingId));
      toast.error("The council could not be reached. Try again.");
    } finally {
      setCouncilBusy(false);
    }
  };

  // ============ SEND MESSAGE ============
  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const isIntroTrigger = text === "__INTRO__";
    if (!isIntroTrigger) setInput("");
    const finalOnlyMode = !isIntroTrigger && wantsFinalOnlyMode(text);

    const pending = [...messages].reverse().find(m => m.artifact)?.artifact;
    if (!isIntroTrigger && pending && /^(?:yes|yeah|yep|show me|show it|let me see|open it)(?: please)?[.!?]*$/i.test(text.trim())) {
      cancelCurrentSpeech(); setViewingArtifact(pending); return;
    }
    const preRoutedImagePrompt = isIntroTrigger ? null : extractImagePrompt(text);

    const searchRequest = text.match(/^(?:search (?:the )?(?:web|net)|look up online|research online)\s*[:,-]?\s+(.+)/i);
    if (!isIntroTrigger && searchRequest) {
      const query = searchRequest[1].trim().slice(0, 300);
      const id = crypto.randomUUID();
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "user", sender: "user", emoji: "", color: "#FFD700", content: text }, { id, role: "assistant", sender: oracleName, emoji: "", color: "#FFD700", content: "Searching live sources…" }]);
      setIsLoading(true);
      try {
        await requireEdgeAuthToken();
        const { data, error } = await supabase.functions.invoke("oracle-research", { body: { query } });
        if (error || !data?.answer) throw error || new Error("No research answer returned");
        const content = formatWebAnswer(data.answer, data.sources || []);
        setMessages(prev => prev.map(m => m.id === id ? { ...m, content } : m));
        speakAsAgent(data.answer, oracleName);
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Search unavailable";
        setMessages(prev => prev.map(m => m.id === id ? { ...m, content: /402|insufficient/i.test(detail) ? "Your wallet needs a top-up for web research." : "Live research did not finish. No verified answer is available." } : m));
      } finally { setIsLoading(false); }
      return;
    }

    const recallRequest = text.match(/^(?:find|search)\s+(?:in\s+)?my\s+(?:private\s+)?library\s*[:,-]?\s+(.+)/i);
    if (!isIntroTrigger && recallRequest && user?.id) {
      const words = recallRequest[1].replace(/[^\p{L}\p{N}\s]/gu, "").trim().slice(0, 100);
      if (!words) return;
      const { data, error } = await supabase.from("user_media").select("id,title,media_type,created_at").eq("user_id", user.id).ilike("title", `%${words}%`).order("created_at", { ascending: false }).limit(8);
      const content = error ? "Your saved Library could not be searched just now." : data?.length ? "**From your saved Library**\n\n" + data.map(item => `- [${item.title.replace(/[\[\]]/g, "")} ](/media-library?item=${item.id}) · ${item.media_type}`).join("\n") : "I did not find a saved Library title matching that request.";
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", sender: oracleName, emoji: "", color: "#FFD700", content }]);
      return;
    }

    // ── Universal command resolver — gives Oracle full operator control ──
    // Recognises any of the 70+ app routes plus click/fill/scroll/back markers.
    const oracleCmd = preRoutedImagePrompt || isIntroTrigger ? null : resolveOracleCommand(text);
    const directRoute = (oracleCmd && oracleCmd.kind === "nav")
      ? { label: oracleCmd.label, path: oracleCmd.path, prefill: oracleCmd.path === "/app-builder" ? text : undefined }
      : null;
    if (directRoute) {
      if (directRoute.prefill) sessionStorage.setItem("app-builder-prefill", directRoute.prefill);
      const userMsgNav: Message = { id: Date.now().toString(), role: "user", sender: "user", emoji: "👤", color: "#FFAA00", content: text };
      const ackNav: Message = {
        id: (Date.now() + 1).toString(), role: "assistant", sender: oracleName, emoji: "🚀", color: "#FFD700",
        content: `On it — opening ${directRoute.label} now.`,
      };
      setShowChat(true);
      setMessages(prev => finalOnlyMode ? [...prev, userMsgNav] : [...prev, userMsgNav, ackNav]);
      if (!finalOnlyMode && !isMuted) speakAsAgent(ackNav.content, oracleName);
      toast(`Opening ${directRoute.label}...`);
      triggerExplosion(directRoute.path);
      return;
    }
    // Non-nav direct commands (click/fill/scroll/back/open) — fire immediately.
    if (oracleCmd && oracleCmd.kind !== "nav") {
      dispatchOracleCommand(oracleCmd);
      return;
    }

    if (!isIntroTrigger && wantsComputerOperatorMode(text)) {
      sessionStorage.setItem("app-builder-prefill", text);
      sessionStorage.setItem("app-builder-autostart", "1");
      const userMsgComputer: Message = { id: Date.now().toString(), role: "user", sender: "user", emoji: "👤", color: "#FFAA00", content: text };
      const ackComputer: Message = {
        id: (Date.now() + 1).toString(), role: "assistant", sender: oracleName, emoji: "🛠️", color: "#FFD700",
        content: "I can run Oracle Lunar’s tools from here. Opening the coding app now, with your command loaded.",
      };
      setShowChat(true);
      setMessages(prev => finalOnlyMode ? [...prev, userMsgComputer] : [...prev, userMsgComputer, ackComputer]);
      if (!finalOnlyMode && !isMuted) speakAsAgent(ackComputer.content, oracleName);
      toast("Opening App Builder...");
      triggerExplosion("/app-builder");
      return;
    }

    // ── FIRST-VISIT SETUP INTERCEPT ──
    // While the Oracle is asking the user for its name + appearance, every
    // user reply is consumed by the setup flow instead of being forwarded
    // to the chat backend.
    if (!isIntroTrigger && !isDirectOracleTask(text)) {
      const consumed = await handleSetupReply(text);
      if (consumed) return;
    }

    // ── COUNCIL INTERCEPT ──
    // With council mode on, the whole agent panel answers here instead of the
    // Oracle answering alone.
    if (councilMode && !isIntroTrigger && !councilBusy) {
      await runCouncil(text);
      return;
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
          const savedApp = await saveMedia.mutateAsync({
            media_type: "app" as any,
            title: `App: ${niceName}`,
            url: dataUrl,
            source_page: "app-builder",
            metadata: { kind: "app", prompt: fullPrompt, architecture: architecture.slice(0, 1500), built_by: "oracle-master" } as any,
          });
          offerArtifact({ kind: "app", url: dataUrl, libraryId: savedApp || undefined, deepPath: savedApp ? `/media-library?item=${savedApp}` : "/media-library" });
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
    const directImagePrompt = preRoutedImagePrompt;
    if (directImagePrompt) {
      const prompt = directImagePrompt;
      const userMsg: Message = { id: Date.now().toString(), role: "user", sender: "user", emoji: "👤", color: "#FFAA00", content: text };
      const ack: Message = {
        id: (Date.now()+1).toString(), role: "assistant", sender: oracleName, emoji: "🎨", color: "#FFD700",
        content: `On it — generating it now.`
      };
      setShowChat(true);
        setMessages(prev => finalOnlyMode ? [...prev, userMsg] : [...prev, userMsg, ack]);
        if (!finalOnlyMode && !isMuted) speakAsAgent(ack.content, oracleName);
      (async () => {
        // Resilient pipeline: 100-deep server fallback chain × 4 client retries,
        // plus session/server cache and library-fallback if everything else fails.
        let imgUrl: string | null = null;
        let wasFallback = false;
              let wasCached = false;
        let savedId: string | undefined;
        try {
          const gen = await generateImage({ prompt });
          imgUrl = gen.url;
          wasFallback = gen.fallback;
                wasCached = gen.cached;
          savedId = gen.libraryId;
        } catch (e: any) {
          if (e instanceof InsufficientCreditsError) { toast.error("Out of AI credits."); return; }
          console.error("Image generation failed after retries:", e?.message);
          toast.error("Image generation failed — please try again");
          return;
        }
        if (!imgUrl) { toast.error("Image generation failed — please try again"); return; }
        if (!savedId && !wasFallback) {
          try {
            const saved: any = await saveMedia.mutateAsync({ media_type: "image", title: `Image: ${prompt.slice(0, 60)}`, url: imgUrl, source_page: "oracle-image", metadata: { kind: "image", prompt, fallback: wasFallback } });
            savedId = saved?.id || saved;
          } catch (err) { console.error("Oracle image library save failed", err); toast.error("Image made, but library save failed"); }
        }
        if (wasFallback) { toast.error("The image did not finish; the returned image is an older fallback."); return; }
        offerArtifact({ kind: "image", url: imgUrl, libraryId: savedId, reused: wasCached, deepPath: savedId ? `/media-library?item=${savedId}` : "/media-library" });
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
          let savedId: string | undefined;
          try { const saved = await saveMedia.mutateAsync({ media_type: "audio", title: `SFX: ${prompt.slice(0, 60)}`, url: dataUrl, source_page: "oracle-sfx", metadata: { kind: "sfx", prompt } }); savedId = saved || undefined; } catch { toast.error("Audio made, but Library save failed"); }
          offerArtifact({ kind: "audio", url: dataUrl, libraryId: savedId, deepPath: savedId ? `/media-library?item=${savedId}` : "/media-library" });
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
          let savedId: string | undefined;
          try { const saved = await saveMedia.mutateAsync({ media_type: "audio", title: `Music: ${prompt.slice(0, 60)}`, url: dataUrl, source_page: "oracle-music", metadata: { kind: "music", prompt } }); savedId = saved || undefined; } catch { toast.error("Audio made, but Library save failed"); }
          offerArtifact({ kind: "audio", url: dataUrl, libraryId: savedId, deepPath: savedId ? `/media-library?item=${savedId}` : "/media-library" });
        } catch (e) { console.error(e); toast.error("Music generation failed"); }
      })();
      return;
    }

    // ── Outbound phone calling is currently vaulted (Twilio disabled) ──

    cancelCurrentSpeech();
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
      const oracleAuthToken = await requireEdgeAuthToken();
      const oracleResp = await fetch(ORACLE_CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${oracleAuthToken}` },
        body: JSON.stringify({
          messages: trimmedMsgs.map(m => ({ role: m.role, content: m.sender === "user" ? m.content : `[${m.sender}]: ${m.content}` })),
          oracleName,
          isFirstMeeting,
          userMemories: formatMemoriesForPrompt(oracleMemories) + (() => {
            if (!user?.id) return "";
            try {
              const ratings = JSON.parse(localStorage.getItem(`oracle-response-feedback:${user.id}`) || "{}");
              const voted = trimmedMsgs.filter(m => m.role === "assistant" && ratings[m.id]).slice(-4);
              return voted.length ? "\nUser feedback on recent replies (preference only, not proof of factual accuracy):\n" + voted.map(m => `${ratings[m.id] > 0 ? "Helpful" : "Unhelpful"}: ${m.content.slice(0, 350)}`).join("\n") : "";
            } catch { return ""; }
          })(),
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
          agent: (() => { const a = getActiveAgent(); return a ? { model: a.model, name: a.name, personality: a.personality } : null; })(),
          voice: isListeningRef.current,
        }),
        signal: controller.signal,
      });
      if (isFirstMeeting) localStorage.setItem(introKey, new Date().toISOString());

      if (!oracleResp.ok) {
        const err = await oracleResp.json().catch(() => ({ error: "Request failed" }));
        if (oracleResp.status === 401) {
          setInput(text);
          toast.error("Please sign in again. Your message is still here.");
          return;
        }
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
        setInput(text);
        toast.error(recoveryFor(oracleResp.status).message);
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
            .replace(/\[\[GEN_(?:IMAGE|MUSIC|SFX|STORY|POEM|APP|VIDEO):[\s\S]+?\]\]/g, "")
        ));
      const flushSpeakableSentences = (final = false) => {
        if (isMuted) return;
        const pending = oracleContent.slice(spokenUpTo);
        // Start with a complete sentence or natural clause, not the full reply.
        // Strip complete markers first while leaving incomplete markers protected.
        const lastEnd = takeSpeakablePrefix(pending);
        if (lastEnd > 0) {
          spokenUpTo += lastEnd;
          const chunk = stripMarkersForSpeech(pending.slice(0, lastEnd)).trim();
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
              if (parsed.error) {
                controller.abort();
                toast.error("The reply stopped. Your partial answer is retained; no paid retry was made.");
                return;
              }
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

      // A short answer without punctuation should not wait for downstream tools.
      if (!finalOnlyMode) flushSpeakableSentences(true);
      if (oracleContent.trim()) recordAgentReply(getActiveAgent(), oracleContent);

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

      // Parse creation markers before cleaning the assistant text. The cleaned
      // display below removes those markers, but this raw string is what tells
      // the client to run the real generator.
      const creationMarkers = [...oracleContent.matchAll(/\[\[GEN_(IMAGE|MUSIC|SFX|STORY|POEM|APP|VIDEO):([\s\S]+?)\]\]/gi)];
      const recodeMarkers = [...oracleContent.matchAll(/\[\[RECODE:([\s\S]+?)\]\]/gi)];

      // ── Operator control markers in Oracle's reply (NAV/CLICK/FILL/SCROLL/BACK/OPEN) ──
      const controlMarkers = [
        ...oracleContent.matchAll(/\[\[\s*(?:nav|click|fill|scroll|back|open)[^\]]*\]\]/gi),
      ];
      for (const cm of controlMarkers) {
        const cmd = resolveOracleCommand(cm[0]);
        if (cmd) {
          // Slight stagger so multiple commands land cleanly.
          setTimeout(() => dispatchOracleCommand(cmd), 200);
        }
      }

      // ── Live web research: [[WEB: query]] → cited answer with pictures ──
      const webMatch = oracleContent.match(/\[\[WEB:([\s\S]+?)\]\]/i);
      if (webMatch) {
        const query = webMatch[1].trim().slice(0, 300);
        const webId = `web-${Date.now()}`;
        setMessages(prev => [...prev, { id: webId, role: "assistant", sender: oracleName, emoji: "🌐", color: "#38bdf8", content: `🌐 *Searching the web for “${query}”…*` }]);
        (async () => {
          try {
            const { data, error } = await supabase.functions.invoke("oracle-research", { body: { query } });
            if (error || !data?.answer) throw error || new Error("no answer");
            const content = formatWebAnswer(data.answer, data.sources || []);
            setMessages(prev => prev.map(m => m.id === webId ? { ...m, content } : m));
            speakAsAgent(data.answer, oracleName);
          } catch (e: any) {
            const msg = /402|insufficient/i.test(String(e?.message || e?.context?.status)) ? "Your wallet needs a top-up for web searches." : "The web search didn't come back. Tap send again to retry.";
            setMessages(prev => prev.map(m => m.id === webId ? { ...m, content: `🌐 ${msg}` } : m));
          }
        })();
      }

      // Strip memory/trial/creation/control markers from displayed content
      let cleanedOracleContent = oracleContent
        .replace(/\[\[MEMORY:\w+:.+?\]\]/g, "")
        .replace(/\[\[FREE_TRIAL:.+?\]\]/g, "")
        .replace(/\[\[GEN_(?:IMAGE|MUSIC|SFX|STORY|POEM|APP|VIDEO):[\s\S]+?\]\]/g, "")
        .replace(/\[\[WEB:[\s\S]+?\]\]/gi, "")
        .replace(/\[\[RECODE:[\s\S]+?\]\]/g, "")
        .replace(/\[\[\s*(?:nav|click|fill|scroll|back|open)[^\]]*\]\]/gi, "")
        .trim();


      // ─── FAIL-PROOF CREATION MARKERS ───
      // Oracle emits [[GEN_*: prompt]] markers whenever the user asks to create
      // anything. Fire the real generation pipelines here so Oracle never just
      // "talks about" creating — it actually creates.
      // After every creation, offer the user a CHOICE: view inline (here in
      // the chat / Oracle media overlay) OR open the actual creation in its
      // proper screen — never just dump it into the library list.
      const askOpenChoice = offerArtifact;

      try {
        const fired = new Set<string>();
        for (const gm of creationMarkers) {
          const kind = gm[1].toUpperCase();
          const prompt = gm[2].trim().replace(/^["']|["']$/g, "");
          const key = kind + "::" + prompt;
          if (fired.has(key) || !prompt) continue;
          fired.add(key);

          if (kind === "IMAGE") {
            toast.success("Painting that for you…");
            (async () => {
              let imgUrl: string | null = null;
              let wasFallback = false;
              let wasCached = false;
              let savedId: string | undefined;
              try {
                const gen = await generateImage({ prompt });
                imgUrl = gen.url;
                wasFallback = gen.fallback;
                wasCached = gen.cached;
                savedId = gen.libraryId;
              } catch (e: any) {
                if (e instanceof InsufficientCreditsError) { toast.error("Out of AI credits."); return; }
                console.error("GEN_IMAGE failed after retries:", e?.message);
                toast.error("Image generation failed — please try again");
                return;
              }
              if (!imgUrl) { toast.error("Image generation failed — please try again"); return; }
              if (!savedId && !wasFallback) {
                try { const saved: any = await saveMedia.mutateAsync({ media_type: "image", title: `Image: ${prompt.slice(0, 60)}`, url: imgUrl, source_page: "oracle-image", metadata: { kind: "image", prompt, fallback: wasFallback } }); savedId = saved?.id || saved; } catch (err) { console.error("Oracle image marker library save failed", err); toast.error("Image made, but library save failed"); }
              }
              if (wasFallback) { toast.error("The new image did not finish; an older fallback was returned."); return; }
              askOpenChoice({ kind: "image", url: imgUrl, libraryId: savedId, reused: wasCached, deepPath: savedId ? `/media-library?item=${savedId}` : "/media-library" });
            })();
          } else if (kind === "MUSIC") {
            toast.success("Composing that track…");
            (async () => {
              try {
                const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-music`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${getEdgeAuthTokenSync()}` },
                  body: JSON.stringify({ prompt, duration_seconds: 30 }),
                });
                if (!r.ok) throw new Error("music failed");
                const blob = await r.blob();
                const dataUrl: string = await new Promise((res, rej) => { const fr = new FileReader(); fr.onloadend = () => res(fr.result as string); fr.onerror = rej; fr.readAsDataURL(blob); });
                let savedId: string | undefined;
                try { const saved: any = await saveMedia.mutateAsync({ media_type: "audio", title: `Music: ${prompt.slice(0, 60)}`, url: dataUrl, source_page: "oracle-music", metadata: { kind: "music", prompt } }); savedId = saved?.id || saved; } catch {}
                askOpenChoice({ kind: "audio", url: dataUrl, libraryId: savedId, deepPath: savedId ? `/media-library?item=${savedId}` : "/media-library" });
              } catch (e) { console.error(e); toast.error("Music generation failed"); }
            })();
          } else if (kind === "SFX") {
            toast.success("Generating sound effect…");
            (async () => {
              try {
                const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-sfx`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${getEdgeAuthTokenSync()}` },
                  body: JSON.stringify({ prompt, duration_seconds: 6, prompt_influence: 0.5 }),
                });
                if (!r.ok) throw new Error("sfx failed");
                const blob = await r.blob();
                const dataUrl: string = await new Promise((res, rej) => { const fr = new FileReader(); fr.onloadend = () => res(fr.result as string); fr.onerror = rej; fr.readAsDataURL(blob); });
                let savedId: string | undefined;
                try { const saved: any = await saveMedia.mutateAsync({ media_type: "audio", title: `SFX: ${prompt.slice(0, 60)}`, url: dataUrl, source_page: "oracle-sfx", metadata: { kind: "sfx", prompt } }); savedId = saved?.id || saved; } catch {}
                askOpenChoice({ kind: "audio", url: dataUrl, libraryId: savedId, deepPath: savedId ? `/media-library?item=${savedId}` : "/media-library" });
              } catch (e) { console.error(e); toast.error("SFX generation failed"); }
            })();
          } else if (kind === "STORY" || kind === "POEM") {
            // Actually WRITE it here in the chat and save it to the Library —
            // pre-filling Story Writer and navigating away used to lose the
            // work entirely if the user never opened that page.
            const label = kind === "POEM" ? "poem" : "story";
            toast.success(`Writing your ${label} now…`);
            (async () => {
              let draft = "";
              try {
                const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-chat`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${getEdgeAuthTokenSync()}` },
                  body: JSON.stringify({
                    agent: "lyra",
                    messages: [{
                      role: "user",
                      content: kind === "POEM"
                        ? `Write a complete, polished poem. Output only the poem, with a title on the first line.\n\nBrief: ${prompt}`
                        : `Write a complete, publishable short story with a title, a clear beginning, middle and end. Output only the story text in markdown.\n\nBrief: ${prompt}`,
                    }],
                  }),
                });
                if (!r.ok) throw new Error(await r.text().catch(() => `HTTP ${r.status}`));
                const raw = r.body ? await new Response(r.body).text() : await r.text();
                draft = raw.split("\n").map((line) => {
                  if (!line.startsWith("data: ")) return "";
                  const d = line.slice(6).trim();
                  if (!d || d === "[DONE]") return "";
                  try { return JSON.parse(d).choices?.[0]?.delta?.content || ""; } catch { return ""; }
                }).join("").trim();
              } catch (e) {
                console.error(`GEN_${kind} failed`, e);
              }
              if (!draft) {
                toast.error(`I couldn't finish that ${label} — opening Story Writer with your brief instead`);
                try { sessionStorage.setItem("story-writer-prefill", prompt); } catch {}
                toast("Open Story Writer to try your brief", { action: { label: "Story Writer", onClick: () => navigate(`/story-writer?prompt=${encodeURIComponent(prompt)}`) } });
                return;
              }
              // Hand the finished draft to Story Writer AND persist it now.
              try { sessionStorage.setItem("story-writer-prefill", prompt); } catch {}
              try { sessionStorage.setItem("story-writer-draft", draft); } catch {}
              let savedId: string | undefined;
              try {
                const dataUrl = `data:text/markdown;charset=utf-8;base64,${btoa(unescape(encodeURIComponent(draft)))}`;
                const saved: any = await saveMedia.mutateAsync({
                  media_type: "text",
                  title: `${kind === "POEM" ? "Poem" : "Story"}: ${prompt.slice(0, 60)}`,
                  url: dataUrl,
                  source_page: "oracle-story",
                  metadata: { kind: label, prompt, body: draft.slice(0, 20000) } as any,
                });
                savedId = saved?.id || saved;
              } catch (err) {
                console.error("Oracle story library save failed", err);
                toast.error(`${label} written, but the library save failed`);
              }
              askOpenChoice({ kind: "story", body: draft, libraryId: savedId, deepPath: savedId ? `/media-library?item=${savedId}` : `/story-writer?prompt=${encodeURIComponent(prompt)}` });
            })();
          } else if (kind === "APP") {
            // Build it for real in the background and save the finished
            // single-file app to the Library — no page change required.
            toast.success("Master App Builder is building that now…");
            (async () => {
              try {
                const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/app-builder-autonomous`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${getEdgeAuthTokenSync()}` },
                  body: JSON.stringify({ prompt }),
                });
                if (!resp.ok || !resp.body) throw new Error(await resp.text().catch(() => `HTTP ${resp.status}`));
                const reader = resp.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";
                let code = "";
                let architecture = "";
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
                      if (evt.event === "done") { code = evt.code || ""; architecture = evt.architecture || ""; }
                      else if (evt.event === "error") throw new Error(evt.message || "Build error");
                    } catch { /* ignore parse */ }
                  }
                }
                if (!code) throw new Error("Pipeline finished without code");
                const dataUrl = `data:text/html;charset=utf-8;base64,${btoa(unescape(encodeURIComponent(code)))}`;
                let savedId: string | undefined;
                const saved: any = await saveMedia.mutateAsync({
                  media_type: "app" as any,
                  title: `App: ${prompt.slice(0, 60)}`,
                  url: dataUrl,
                  source_page: "app-builder",
                  metadata: { kind: "app", prompt, architecture: architecture.slice(0, 1500), built_by: "oracle-marker" } as any,
                });
                savedId = saved?.id || saved;
                askOpenChoice({ kind: "app", url: dataUrl, libraryId: savedId, deepPath: savedId ? `/media-library?item=${savedId}` : "/app-builder" });
              } catch (e) {
                console.error("GEN_APP build failed", e);
                toast.error("The build failed — opening App Builder with your brief");
                try { sessionStorage.setItem("app-builder-prefill", prompt); } catch {}
                toast("Open App Builder to try your brief", { action: { label: "App Builder", onClick: () => navigate(`/app-builder?prompt=${encodeURIComponent(prompt)}`) } });
              }
            })();
          } else if (kind === "VIDEO") {
            // Real pipeline: cinematic hero frame -> Gemini/Veo image-to-video.
            // If the animation step fails we still keep (and save) the frame.
            toast.success("Filming that for you…");
            (async () => {
              let imgUrl: string | undefined;
              try {
                const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-gen`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${getEdgeAuthTokenSync()}` },
                  body: JSON.stringify({ prompt: `Cinematic still frame: ${prompt}` }),
                });
                if (!r.ok) throw new Error("image-gen failed");
                const data = await r.json();
                imgUrl = data?.images?.[0]?.image_url?.url || data?.images?.[0]?.url || data?.images?.[0];
              } catch (e) { console.error("GEN_VIDEO frame failed", e); }
              if (!imgUrl) { toast.error("Video generation failed — please try again"); return; }
              try {
                const vdata = await generateMemberVideo({ image_url: imgUrl, prompt, duration: 5 });
                const videoUrl = vdata?.video_url;
                if (!videoUrl) throw new Error("no video_url");
                let savedId: string | undefined;
                try {
                  const saved: any = vdata.media_id || await saveMedia.mutateAsync({
                    media_type: "video" as any,
                    title: `Video: ${prompt.slice(0, 60)}`,
                    url: videoUrl,
                    source_page: "oracle-video",
                    metadata: { kind: "video", prompt, source_frame: imgUrl } as any,
                  });
                  savedId = saved?.id || saved;
                } catch (err) { console.error("Oracle video library save failed", err); }
                askOpenChoice({ kind: "video", url: videoUrl, libraryId: savedId, deepPath: savedId ? `/media-library?item=${savedId}` : "/media-library" });
              } catch (e) {
                console.error("GEN_VIDEO animate failed", e);
                try {
                  await saveMedia.mutateAsync({ media_type: "image", title: `Video frame: ${prompt.slice(0, 60)}`, url: imgUrl, source_page: "oracle-video-fallback", metadata: { kind: "image", prompt } });
                  toast("Video failed; only its still frame was saved to Library.");
                } catch { toast.error("Video failed and its still frame could not be saved."); }
              }
            })();
          }
        }
      } catch (e) { console.error("creation marker parse failed", e); }

      try {
        for (const rm of recodeMarkers) {
          const summary = rm[1].trim().replace(/^['"]|['"]$/g, "");
          if (!summary || !isOwner) continue;
          const fullRequest = `${text}\n\nOwner coding request summary: ${summary}`;
          toast.success("Oracle Coder is working on that now…");
          (async () => {
            try {
              const r = await fetch(ORACLE_CODER_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${getEdgeAuthTokenSync()}` },
                body: JSON.stringify({ messages: [{ role: "user", content: fullRequest }], mode: "chat", reasoning: "medium" }),
              });
              if (!r.ok) throw new Error(await r.text().catch(() => `HTTP ${r.status}`));
              const raw = r.body ? await new Response(r.body).text() : await r.text();
              const coderText = raw.split("\n").map((line) => {
                if (!line.startsWith("data: ")) return "";
                const data = line.slice(6).trim();
                if (!data || data === "[DONE]") return "";
                try { return JSON.parse(data).choices?.[0]?.delta?.content || ""; } catch { return ""; }
              }).join("").replace(/\[\[\/?CHAT\]\]/g, "").trim();
              const dataUrl = `data:text/plain;charset=utf-8;base64,${btoa(unescape(encodeURIComponent(coderText || fullRequest)))}`;
              await saveMedia.mutateAsync({
                media_type: "text",
                title: `Oracle Coder: ${summary.slice(0, 60)}`,
                url: dataUrl,
                source_page: "oracle-coder",
                metadata: { kind: "code-plan", request: fullRequest },
              });
              const coderMsg: Message = {
                id: `${Date.now()}-coder`, role: "assistant", sender: oracleName, emoji: "🧑‍💻", color: "#FFD700",
                content: `Oracle Coder finished a code plan and saved it to your Library. To change the live app source, keep using Lovable build mode here.`,
              };
              setMessages(prev => [...prev, coderMsg]);
              if (!isMuted) speakAsAgent(coderMsg.content, oracleName);
            } catch (e) {
              console.error(e);
              toast.error("Oracle Coder could not finish that request");
            }
          })();
        }
      } catch (e) { console.error("recode marker parse failed", e); }


      // Handle navigation commands in Oracle response
      const { cleanContent, navPath, isBackground } = parseAndHandleNavigation(cleanedOracleContent);

      // Update displayed message with cleaned content
      const finalDisplayContent = stripSelfNaming(cleanContent || cleanedOracleContent);
      let verifyTargetId: string | null = null;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.sender === oracleName) {
          verifyTargetId = last.id;
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: finalDisplayContent } : m);
        }
        const newId = "oracle-" + Date.now();
        verifyTargetId = newId;
        return [...prev, {
          id: newId, role: "assistant", sender: oracleName,
          emoji: oracleAvatar ? "👤" : "🔮", color: "#9b87f5", content: finalDisplayContent,
          avatar_url: oracleAvatar?.image_url || undefined,
        }];
      });

      // ─── BACKGROUND ANSWER SWARM ───
      // The user already has Oracle's first answer. In the background a small
      // swarm independently re-answers, fact-checks and critiques it, and a
      // judge merges the best of everything. If the result is materially
      // better, the visible answer is quietly upgraded in place — so the user
      // always ends up with the best answer, not just the first one.
      // Skipped for creations/navigation turns (those already did real work)
      // and for trivially short replies where there is nothing to improve.
      if (
        finalDisplayContent.length > 120 &&
        creationMarkers.length === 0 &&
        recodeMarkers.length === 0 &&
        !navPath
      ) {
        const verifyId = verifyTargetId;
        const verifyQuestion = text;
        const verifyHistory = allMsgs.slice(-6).map(m => `${m.sender}: ${m.content}`).join("\n").slice(0, 4000);
        (async () => {
          try {
            const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-verify-swarm`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${getEdgeAuthTokenSync()}` },
              body: JSON.stringify({
                question: verifyQuestion,
                draft: finalDisplayContent,
                history: verifyHistory,
                checkers: 3,
              }),
            });
            if (!resp.ok) return;
            const v = await resp.json();
            if (!v?.materially_better || typeof v.final !== "string" || !v.final.trim()) return;
            const improved = stripSelfNaming(v.final.trim());
            setMessages(prev => prev.map(m => (m.id === verifyId ? { ...m, content: improved, verified: true } as any : m)));
            toast.success("I double-checked that with my swarm and improved the answer.");
          } catch (e) {
            // Verification is a bonus pass — never surface its failures.
            console.warn("verify swarm skipped", e);
          }
        })();
      }


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
          triggerExplosion(navPath);
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
      else if (e instanceof EdgeSessionRequiredError) { setInput(text); toast.error(e.message); }
      else { console.error(e); toast.error("Failed to connect to Oracle AI"); }
    } finally { setIsLoading(false); abortRef.current = null; }
  };

  const stopOracle = () => {
    abortRef.current?.abort();
    if (isListeningRef.current) toggleMic();
    speechQueueRef.current = []; isSpeakingQueueRef.current = false;
    cancelCurrentSpeech(); mutedRef.current = true; setMuted(true);
  };
  const latest = messages[messages.length - 1];
  const renderAnswer = (msg: Message) => <>
    <ReactMarkdown>{msg.content}</ReactMarkdown>
    {msg.role === "assistant" && <OracleResponseFeedback userId={user?.id} messageId={msg.id} />}
    {msg.artifact && <div className="mt-3 flex gap-2">
      <Button size="sm" onClick={() => { cancelCurrentSpeech(); setViewingArtifact(msg.artifact || null); }}>Show me</Button>
      <Button size="sm" variant="outline" onClick={() => toast("Kept in this conversation for later.")}>Later</Button>
    </div>}
  </>;
  return <>
    <SEO title="Oracle Lunar — Your AI companion" description="Your Oracle Lunar companion, saved creations and connected tools in one private workspace." path="/oracle" />
    <main className="oracle-call h-[100dvh] flex flex-col relative overflow-hidden bg-background">
      <OraclePresenterStage userId={user?.id} state={isSpeaking ? "speaking" : isLoading ? "thinking" : isListening ? "listening" : "idle"} cue={presenterCue} onCueDone={() => setPresenterCue(null)} />
      <header className="oracle-header relative z-10 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-semibold text-foreground">Oracle <span className="font-normal text-primary">Lunar</span></h1>
          <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-primary" />{isSpeaking ? "Speaking" : isLoading ? "Working on it" : isListening ? "Listening" : "Here with you"} · Reused AI video</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="oracle-control" aria-label="Conversation history" title="Conversation history" aria-pressed={conversationOpen} onClick={() => setConversationOpen(v => !v)}>{conversationOpen ? <X /> : <MessageSquare />}</Button>
          <OracleAccountMenu />
        </div>
      </header>
      <div className="relative min-h-0 flex-1">
        {oracleMedia && <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-background/80">
          <Button variant="outline" size="icon" className="absolute top-3 right-3" aria-label="Dismiss" onClick={() => setOracleMedia(null)}><X /></Button>
          {oracleMedia.kind === "video" ? <video src={oracleMedia.url} autoPlay playsInline controls onEnded={() => setOracleMedia(null)} className="max-w-full max-h-full" /> : <img src={oracleMedia.url} alt="Generated creation" className="max-w-full max-h-full object-contain" />}
        </div>}
      </div>
      {conversationOpen && <section ref={scrollRef} aria-label="Oracle conversation" className="oracle-transcript">
        <h2 className="text-sm font-semibold text-primary">Conversation</h2>
        {!messages.length && <p className="mt-5 text-sm text-muted-foreground">No messages yet.</p>}
        {messages.map(msg => <article key={msg.id} className={`oracle-message ${msg.role === "user" ? "oracle-message-user" : ""}`}><p className="mb-2 text-xs font-semibold text-primary">{msg.role === "user" ? "You" : msg.sender}</p>{renderAnswer(msg)}</article>)}
      </section>}
      <div className="oracle-dock relative z-10 shrink-0">
        {!conversationOpen && latest && <section aria-label="Latest Oracle message" className="oracle-reply">{renderAnswer(latest)}</section>}
        {(isLoading || debateActive || isListening) && <p role="status" className="mb-2 text-center text-xs text-foreground">{debateActive ? "Agents working…" : isLoading ? "Working on your request…" : wakeActive ? "Listening…" : "Microphone paused"}</p>}
        <OraclePromptBox input={input} onInput={setInput} onSend={() => sendMessage(input)} onStop={stopOracle} busy={isLoading || debateActive} listening={isListening} muted={isMuted} uploading={uploading} onMic={toggleMic}
          onSpeaker={() => { if (isMuted) testSpeaker(); else { mutedRef.current = true; speechQueueRef.current = []; cancelCurrentSpeech(); setMuted(true); } }}
          onAttach={() => uploadInputRef.current?.click()} onSettings={() => setVoiceOptionsOpen(true)} tools={
          <OracleToolsMenu>
          <Button
            type="button"
            onClick={() => {
              const next = !councilMode;
              setCouncilMode(next);
              try { localStorage.setItem("oracle-council-mode", next ? "1" : "0"); } catch { /* storage blocked */ }
              toast(next
                ? "Council on — Nova, Lyra, Sage and Kai will all answer, debate, then I give you the best answer."
                : "Council off — it's just me answering now.");
            }}
            title={councilMode ? "Council mode on — every agent answers and debates" : "Council mode off — Oracle answers alone"}
            className={`p-2 rounded-full transition-colors ${councilMode ? "bg-[#FFAA00] text-black" : "bg-[#FFAA00]/15 text-[#FFAA00] hover:bg-[#FFAA00]/30"}`}
          >
            <Gavel className="w-5 h-5" />
          </Button>
          <SwarmAgentsButton
            currentInput={input}
            onResult={(markdown) =>
              setMessages(prev => [...prev, { id: `swarm-${Date.now()}`, role: "assistant", sender: `${oracleName} Swarm`, emoji: "🐝", color: "#FFD700", content: markdown } as any])
            }
          />
          </OracleToolsMenu>
          } />
        <input ref={uploadInputRef} type="file" accept="image/*,video/*,audio/*,application/pdf,text/*,.doc,.docx,.txt,.md,.json,.csv" className="hidden" onChange={handleUpload} />
      </div>
      <Dialog open={voiceOptionsOpen} onOpenChange={setVoiceOptionsOpen}><DialogContent className="oracle-settings">
        <DialogTitle>Oracle settings</DialogTitle>
        <DialogDescription>Reused AI footage; lips do not match new answers. Device voice varies by device. Premium speech and new AI creations use your wallet.</DialogDescription>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={testSpeaker}><Volume2 />Test speaker</Button>
          <Button variant="outline" size="sm" onClick={toggleMic}><Mic />{isListening ? "Stop mic" : "Allow mic"}</Button>
          <Button variant="outline" size="sm" onClick={stopOracle}><PhoneOff />Stop Oracle</Button>
        </div>
        {micPermissionError && <p className="text-sm text-destructive">{micPermissionError}</p>}
        <div className="flex flex-wrap gap-2">
          <Select value={speechMode} onValueChange={value => {
            if (value !== "device" && value !== "premium") return;
            cancelCurrentSpeech(); speechQueueRef.current = []; isSpeakingQueueRef.current = false;
            speechModeRef.current = value; setSpeechMode(value);
            if (user?.id) localStorage.setItem(`oracle-speech-mode:${user.id}`, value);
          }}><SelectTrigger aria-label="Oracle speech mode" className="h-9 w-auto max-w-full"><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="device">Device voice · no TTS fee</SelectItem>
            <SelectItem value="premium">Premium voice · wallet paid</SelectItem>
          </SelectContent></Select>
          {speechMode === "device" && <Select value={deviceVoice || "automatic"} onValueChange={value => {
            const selected = value === "automatic" ? "" : value; setDeviceVoice(selected); voiceMapRef.current.clear();
            if (user?.id) localStorage.setItem(`oracle-device-voice:${user.id}`, selected);
          }}><SelectTrigger aria-label="Device voice" className="h-9 w-auto max-w-full sm:max-w-[260px]"><SelectValue placeholder="Automatic voice" /></SelectTrigger><SelectContent>
            <SelectItem value="automatic">Automatic device voice</SelectItem>
            {deviceVoices.filter((v, i, all) => all.findIndex(x => x.voiceURI === v.voiceURI) === i).map(v => <SelectItem key={v.voiceURI} value={v.voiceURI}>{v.name} · {v.lang}</SelectItem>)}
          </SelectContent></Select>}

        </div>
        <AgentPicker />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowOracleSwap(v => !v)}><Crown />Appearance</Button>
          <Button variant="outline" onClick={() => setShowFriendPanel(v => !v)}><Users />Chat agents</Button>
          <OracleImageComposer />
          {usage && <Button variant="outline" onClick={() => navigate("/subscribe", { state: { oracleWorkspace: true } })}>{usage.count} / {usage.limit} messages</Button>}
        </div>
      {/* ======== ORACLE SWAP PANEL ======== */}
      {showOracleSwap && (
        <div className="relative border border-border rounded-lg p-4 w-full">
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
        <div className="relative border border-border rounded-lg p-4 w-full">
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


      </DialogContent></Dialog>
      <OracleArtifactViewer artifact={viewingArtifact} onClose={() => setViewingArtifact(null)} />
      <SystemDoctorPanel open={showDoctor} onClose={() => setShowDoctor(false)} />
      <AudioClarifyDialog open={audioClarify.open} fragment={audioClarify.fragment} onResolve={(intent: AudioIntent) => {
        const { fragment } = audioClarify; setAudioClarify({ open: false, fragment: "" });
        const cleaned = intentToPrompt(intent, fragment); setTimeout(() => sendMessageRef.current?.(cleaned), 0);
      }} />
    </main>
  </>;
};
export default OraclePage;
