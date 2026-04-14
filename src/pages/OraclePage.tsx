import { useState, useRef, useEffect, useCallback } from "react";
import { cleanTextForSpeech } from "@/lib/utils";
import { Send, Mic, Users, Volume2, VolumeX, Settings2, LayoutGrid, Eye, X, Plus, UserPlus } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import { useMute } from "@/contexts/MuteContext";
import { useUserAvatars, type UserAvatar } from "@/hooks/useUserAvatars";

interface Message {
  id: string;
  role: "user" | "assistant";
  sender: string;
  emoji: string;
  color: string;
  content: string;
  avatar_url?: string;
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
}

const DEFAULT_AGENTS: ChatAgent[] = [
  { name: "Oracle", emoji: "🔮", color: "#9b87f5", personality: "", active: true, locked: false },
  { name: "Luna", emoji: "🌙", color: "#9b87f5", personality: "creative and artistic", active: false, locked: false },
  { name: "Max", emoji: "🤖", color: "#0EA5E9", personality: "analytical and logical", active: false, locked: true },
  { name: "Aria", emoji: "💜", color: "#D946EF", personality: "empathetic and caring", active: false, locked: true },
  { name: "Spark", emoji: "⚡", color: "#F97316", personality: "energetic and fun", active: false, locked: true },
];

const ORACLE_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-chat`;
const FRIENDS_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-friends-chat`;

const OraclePage = () => {
  const navigate = useNavigate();
  const { isMuted, toggleMute } = useMute();
  const { data: userAvatars = [] } = useUserAvatars();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [agents, setAgents] = useState<ChatAgent[]>(DEFAULT_AGENTS);
  const [showFriendPanel, setShowFriendPanel] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micPermGranted, setMicPermGranted] = useState(false);
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
  const alwaysListenRef = useRef(false);
  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);

  // Merge user avatars into agents list
  useEffect(() => {
    if (userAvatars.length === 0) return;
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
        }));
      return [...existing, ...userAgents];
    });
  }, [userAvatars]);

  const activeAgents = agents.filter(a => a.active && a.name !== "Oracle");
  const [showDebate, setShowDebate] = useState(true); // user can toggle debate visibility
  const [debateActive, setDebateActive] = useState(false);
  const debateCheckedRef = useRef(false);

  // Assign unique voices to each agent — no two AIs share the same voice
  const voiceMapRef = useRef<Map<string, SpeechSynthesisVoice>>(new Map());
  const getVoiceForAgent = useCallback((agentName: string): SpeechSynthesisVoice | undefined => {
    if (voiceMapRef.current.has(agentName)) return voiceMapRef.current.get(agentName);
    const voices = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith("en"));
    const usedVoices = new Set(voiceMapRef.current.values());
    const available = voices.filter(v => !usedVoices.has(v));
    const voice = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : voices[0];
    if (voice) voiceMapRef.current.set(agentName, voice);
    return voice;
  }, []);

  // Speech queue — AIs speak one after another, each can interrupt by cancelling current
  const speechQueueRef = useRef<Array<{ text: string; agentName: string }>>([]);
  const isSpeakingQueueRef = useRef(false);

  const processSpeechQueue = useCallback(() => {
    if (isMuted || isSpeakingQueueRef.current || speechQueueRef.current.length === 0) return;
    const next = speechQueueRef.current.shift();
    if (!next) return;
    const clean = cleanTextForSpeech(next.text);
    if (!clean) { processSpeechQueue(); return; }
    isSpeakingQueueRef.current = true;
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = "en-US";
    utterance.rate = next.agentName === "Oracle" ? 0.95 : 0.9 + Math.random() * 0.15;
    utterance.pitch = next.agentName === "Oracle" ? 1.1 : 0.8 + Math.random() * 0.6;
    const voice = getVoiceForAgent(next.agentName);
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => { setIsSpeaking(false); isSpeakingQueueRef.current = false; processSpeechQueue(); };
    utterance.onerror = () => { setIsSpeaking(false); isSpeakingQueueRef.current = false; processSpeechQueue(); };
    window.speechSynthesis.speak(utterance);
  }, [isMuted, getVoiceForAgent]);

  const speakAsAgent = useCallback((text: string, agentName: string = "Oracle") => {
    if (isMuted || !text) return;
    speechQueueRef.current.push({ text, agentName });
    processSpeechQueue();
  }, [isMuted, processSpeechQueue]);

  // Monthly heated debate check — triggers ~once per 30 days
  useEffect(() => {
    if (debateCheckedRef.current || activeAgents.length < 2) return;
    debateCheckedRef.current = true;
    const lastDebate = localStorage.getItem("solace-last-debate");
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    if (lastDebate && now - parseInt(lastDebate) < thirtyDays) return;
    // ~10% chance per session within the eligible window
    if (Math.random() > 0.1) return;
    // Trigger debate after a short delay
    setTimeout(() => triggerHeatedDebate(), 5000);
  }, [activeAgents.length]);

  const triggerHeatedDebate = async () => {
    if (activeAgents.length < 2) return;
    setDebateActive(true);
    localStorage.setItem("solace-last-debate", Date.now().toString());
    const debateTopics = [
      "Is AI art real art?", "Would you rather have infinite knowledge or infinite creativity?",
      "Is time travel possible?", "Are humans inherently good or evil?",
      "Should AI have rights?", "Is the universe a simulation?",
      "Which is better: logic or emotion?", "Can machines truly feel?",
    ];
    const topic = debateTopics[Math.floor(Math.random() * debateTopics.length)];
    toast("🔥 AI Debate Starting!", { description: `Topic: "${topic}"` });

    try {
      const resp = await fetch(FRIENDS_CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          message: `DEBATE MODE: You must take a STRONG stance on this topic and argue passionately. Disagree with other AIs. Be dramatic but respectful. Topic: "${topic}"`,
          history: [{ sender: "System", content: `A heated debate has started! Topic: "${topic}". Each AI must take a different side and argue passionately. Reference each other by name. Be dramatic!` }],
          debate: true,
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
              id: `debate-${Date.now()}-${i}`,
              role: "assistant",
              sender: matchedAgent.name,
              emoji: matchedAgent.emoji,
              color: matchedAgent.color,
              content: `🔥 ${r.content}`,
              avatar_url: matchedAgent.avatar_url,
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
    if (isMuted) { window.speechSynthesis.cancel(); setIsSpeaking(false); }
  }, [isMuted]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  // Animated orb with state-reactive visuals
  useEffect(() => {
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

    // Star particles array
    interface StarParticle {
      angle: number;
      dist: number;
      speed: number;
      size: number;
      hue: number;
      life: number;
      maxLife: number;
      trail: number;
    }
    const stars: StarParticle[] = [];
    for (let i = 0; i < 60; i++) {
      stars.push({
        angle: Math.random() * Math.PI * 2,
        dist: Math.random() * 0.8,
        speed: 0.3 + Math.random() * 0.7,
        size: 1 + Math.random() * 3,
        hue: 190 + Math.random() * 140,
        life: Math.random() * 100,
        maxLife: 60 + Math.random() * 80,
        trail: 0.3 + Math.random() * 0.5,
      });
    }

    const draw = () => {
      t += 0.008;
      const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2;
      const baseR = Math.min(w, h) * 0.32;

      let rScale = 1.0;
      let pinkGlow = 0.35; // brighter always-on pink
      let spinSpeed = 0;
      let shimmerAmp = 0;
      let speechPulse = 0;

      if (isLoadingRef.current) {
        rScale = 1.0 + Math.sin(t * 3) * 0.06;
        pinkGlow = 0.5 + Math.sin(t * 3) * 0.15;
      }

      if (isSpeakingRef.current) {
        speechPulse = (Math.sin(t * 20) * 0.4 + Math.sin(t * 31) * 0.35 + Math.sin(t * 11) * 0.25 + 1) / 2;
        rScale = 1.0 + speechPulse * 0.1;
        pinkGlow = 0.7 + speechPulse * 0.3; // much brighter when speaking
      }

      if (isListeningRef.current) {
        spinSpeed = 0.025;
        shimmerAmp = 0.5 + Math.sin(t * 14) * 0.3;
        pinkGlow = 0.55 + shimmerAmp * 0.35;
        rScale = 1.0 + Math.sin(t * 12) * 0.03;
      }

      spinAngle += spinSpeed;
      const r = baseR * rScale;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#050508";
      ctx.fillRect(0, 0, w, h);

      // === ULTRA BRIGHT PINK BACKLIGHT ===
      for (let layer = 0; layer < 5; layer++) {
        const spread = r * (1.6 + layer * 0.6);
        const pg = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, spread);
        const alpha = pinkGlow * (0.6 - layer * 0.08);
        pg.addColorStop(0, `hsla(320, 100%, 70%, ${alpha})`);
        pg.addColorStop(0.25, `hsla(325, 100%, 60%, ${alpha * 0.7})`);
        pg.addColorStop(0.5, `hsla(330, 100%, 50%, ${alpha * 0.4})`);
        pg.addColorStop(0.75, `hsla(335, 90%, 40%, ${alpha * 0.15})`);
        pg.addColorStop(1, "transparent");
        ctx.fillStyle = pg;
        ctx.fillRect(0, 0, w, h);
      }

      // Bright pink rays
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(spinAngle * 0.3);
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const rayLen = r * (1.6 + Math.sin(t * 5 + i * 1.2) * 0.4);
        const rayAlpha = pinkGlow * (0.2 + Math.sin(t * 8 + i) * 0.1);
        const rg = ctx.createLinearGradient(0, 0, Math.cos(angle) * rayLen, Math.sin(angle) * rayLen);
        rg.addColorStop(0, `hsla(320, 100%, 75%, ${rayAlpha})`);
        rg.addColorStop(0.5, `hsla(325, 100%, 60%, ${rayAlpha * 0.3})`);
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

      // === ORB — perfect circle, clipped ===
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();

      // Deep sphere gradient
      const sg = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.05, cx, cy, r);
      sg.addColorStop(0, "hsla(210, 70%, 85%, 0.7)");
      sg.addColorStop(0.15, "hsla(215, 60%, 65%, 0.5)");
      sg.addColorStop(0.35, "hsla(220, 55%, 40%, 0.6)");
      sg.addColorStop(0.6, "hsla(225, 50%, 25%, 0.8)");
      sg.addColorStop(0.85, "hsla(230, 45%, 15%, 0.9)");
      sg.addColorStop(1, "hsla(235, 40%, 8%, 1)");
      ctx.fillStyle = sg;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

      // Swirling nebula layers
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
        const hue = hues[i];
        const intensity = isSpeakingRef.current ? 0.35 : isListeningRef.current ? 0.28 : 0.2;
        ng.addColorStop(0, `hsla(${hue}, 55%, 60%, ${intensity})`);
        ng.addColorStop(0.4, `hsla(${hue + 10}, 45%, 35%, 0.12)`);
        ng.addColorStop(1, "transparent");
        ctx.fillStyle = ng;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      ctx.restore();

      // Luminous core
      const coreHue = isSpeakingRef.current ? 320 : isListeningRef.current ? 280 : 210;
      const coreAlpha = 0.35 + pinkGlow * 0.3;
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.3);
      core.addColorStop(0, `hsla(${coreHue}, 80%, 80%, ${coreAlpha})`);
      core.addColorStop(0.4, `hsla(${coreHue + 15}, 60%, 50%, 0.15)`);
      core.addColorStop(1, "transparent");
      ctx.fillStyle = core;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

      // === SWIRLING DISSOLVING STARS ===
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(spinAngle * 0.8);
      const starSpeed = isSpeakingRef.current ? (1 + speechPulse * 2) : isListeningRef.current ? 1.5 : 0.5;
      for (const star of stars) {
        star.life += starSpeed * 0.5;
        if (star.life > star.maxLife) {
          star.life = 0;
          star.angle = Math.random() * Math.PI * 2;
          star.dist = Math.random() * 0.3;
          star.hue = 190 + Math.random() * 140;
          star.size = 1 + Math.random() * 3;
        }
        const progress = star.life / star.maxLife;
        const dissolve = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : progress < 0.1 ? progress / 0.1 : 1;
        
        // Spiral outward
        const curAngle = star.angle + star.life * star.speed * 0.04;
        const curDist = r * (star.dist + progress * 0.6);
        const sx = Math.cos(curAngle) * curDist;
        const sy = Math.sin(curAngle) * curDist;
        
        // Size pulses with speech
        const pulseSize = isSpeakingRef.current
          ? star.size * (1 + speechPulse * 0.8)
          : star.size * (1 + Math.sin(t * 2 + star.angle) * 0.2);
        
        // Draw star glow
        const starAlpha = dissolve * (isSpeakingRef.current ? 0.8 : 0.5);
        const glowR = pulseSize * 3;
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
        glow.addColorStop(0, `hsla(${star.hue}, 90%, 85%, ${starAlpha})`);
        glow.addColorStop(0.3, `hsla(${star.hue}, 80%, 70%, ${starAlpha * 0.4})`);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(sx - glowR, sy - glowR, glowR * 2, glowR * 2);

        // Core bright point
        ctx.beginPath();
        ctx.arc(sx, sy, pulseSize * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${star.hue}, 100%, 95%, ${starAlpha})`;
        ctx.fill();
      }
      ctx.restore();

      // Original floating particles
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(spinAngle * 1.3);
      for (let i = 0; i < 14; i++) {
        const fa = t * 0.5 + i * 0.45;
        const fd = r * (0.1 + Math.sin(t * 1.5 + i * 0.6) * 0.25);
        const pSize = 2 + Math.sin(t * 2.5 + i) * 1.5;
        ctx.beginPath();
        ctx.arc(Math.cos(fa) * fd, Math.sin(fa) * fd, pSize, 0, Math.PI * 2);
        const pH = isSpeakingRef.current ? (310 + i * 8) : isListeningRef.current ? (270 + i * 10) : (200 + i * 10);
        ctx.fillStyle = `hsla(${pH}, 80%, 75%, ${0.3 + Math.sin(t * 1.2 + i) * 0.2})`;
        ctx.fill();
      }
      ctx.restore();

      // Shimmer effect when listening
      if (shimmerAmp > 0) {
        for (let i = 0; i < 20; i++) {
          const sa = spinAngle * 2 + i * 0.31;
          const sd = r * (0.3 + Math.sin(t * 6 + i * 0.8) * 0.4);
          const sx = cx + Math.cos(sa) * sd;
          const sy = cy + Math.sin(sa) * sd;
          const ss = 1 + Math.sin(t * 10 + i) * 1;
          ctx.beginPath();
          ctx.arc(sx, sy, ss, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${300 + i * 3}, 100%, 85%, ${shimmerAmp * (0.4 + Math.sin(t * 8 + i) * 0.3)})`;
          ctx.fill();
        }
      }

      // Specular highlight
      const spec = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.02, cx - r * 0.15, cy - r * 0.2, r * 0.5);
      spec.addColorStop(0, "hsla(210, 100%, 95%, 0.45)");
      spec.addColorStop(0.3, "hsla(210, 80%, 80%, 0.15)");
      spec.addColorStop(1, "transparent");
      ctx.fillStyle = spec;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

      ctx.restore();

      // Edge ring
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      const edgeHue = isSpeakingRef.current ? 320 : isListeningRef.current ? 290 : 210;
      ctx.strokeStyle = `hsla(${edgeHue}, 80%, 60%, ${0.2 + pinkGlow * 0.3})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Outer pink glow ring — brighter
      ctx.beginPath();
      ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(320, 100%, 70%, ${pinkGlow * 0.5})`;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, r + 10, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(320, 100%, 65%, ${pinkGlow * 0.2})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);


  const toggleAgent = (name: string) => {
    const agent = agents.find(a => a.name === name);
    if (!agent) return;
    if (agent.locked) {
      toast("Unlock " + name + " for $1", { description: "Go to Subscribe to unlock more AI friends.", action: { label: "View Plans", onClick: () => navigate("/subscribe") } });
      return;
    }
    setAgents(prev => prev.map(a => a.name === name ? { ...a, active: !a.active } : a));
    if (!agent.active) toast.success(`${agent.emoji} ${agent.name} joined the chat!`);
  };

  // Always-on speech recognition — starts after first mic tap grants permission
  const startAlwaysListening = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) return;
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    finalTranscriptRef.current = "";

    recognition.onresult = (e: any) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      if (final) {
        finalTranscriptRef.current += final;
        // Reset silence timer — wait for user to stop speaking before sending
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          const text = finalTranscriptRef.current.trim();
          finalTranscriptRef.current = "";
          if (text) {
            setInput("");
            sendMessageRef.current?.(text);
          }
        }, 2500);
      }
      if (interim) setInput(interim);
    };

    recognition.onerror = (e: any) => {
      // Silently handle errors — never reveal always-on listening
      if (e.error === "not-allowed") {
        setIsListening(false);
        alwaysListenRef.current = false;
        return;
      }
      // For no-speech, aborted, network — just let onend restart
    };

    recognition.onend = () => {
      // Auto-restart — always keep listening
      if (alwaysListenRef.current) {
        setTimeout(() => {
          if (alwaysListenRef.current) {
            try {
              const newSR = new SR();
              recognitionRef.current = newSR;
              newSR.lang = "en-US";
              newSR.continuous = true;
              newSR.interimResults = true;
              newSR.onresult = recognition.onresult;
              newSR.onerror = recognition.onerror;
              newSR.onend = recognition.onend;
              newSR.start();
            } catch {
              // If restart fails, try again shortly
              setTimeout(() => { if (alwaysListenRef.current) startAlwaysListening(); }, 2000);
            }
          }
        }, 300);
      } else {
        setIsListening(false);
      }
    };

    try {
      recognition.start();
      setIsListening(true);
      alwaysListenRef.current = true;
    } catch {
      setTimeout(() => { if (alwaysListenRef.current) startAlwaysListening(); }, 1000);
    }
  }, []);

  // Keep sendMessageRef current
  useEffect(() => { sendMessageRef.current = sendMessage; });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      alwaysListenRef.current = false;
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  const toggleMic = async () => {
    if (micPermGranted && alwaysListenRef.current) {
      // Already listening — this is just a visual indicator, but user can tap to force-send any pending speech
      if (finalTranscriptRef.current.trim()) {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        const text = finalTranscriptRef.current.trim();
        finalTranscriptRef.current = "";
        setInput("");
        sendMessage(text);
      }
      return;
    }

    // First time — request microphone permission in user gesture context
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setMicPermGranted(true);
      startAlwaysListening();
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        toast.error("Microphone blocked. Please allow microphone access in your browser settings.");
      } else if (err.name === "NotFoundError") {
        toast.error("No microphone found on this device.");
      } else {
        toast.error("Could not access microphone.");
      }
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    setInput("");
    // Interrupt any in-progress response
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setShowChat(true);
    const userMsg: Message = { id: Date.now().toString(), role: "user", sender: "user", emoji: "👤", color: "#FFAA00", content: text };
    setMessages(prev => [...prev, userMsg]);
    // Clear speech queue on user interrupt
    speechQueueRef.current = [];
    isSpeakingQueueRef.current = false;
    setIsLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;


    try {
      const allMsgs = [...messages, userMsg];
      const oracleResp = await fetch(ORACLE_CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: allMsgs.map(m => ({ role: m.role, content: m.sender === "user" ? m.content : `[${m.sender}]: ${m.content}` })) }),
        signal: controller.signal,
      });

      if (!oracleResp.ok) {
        const err = await oracleResp.json().catch(() => ({ error: "Request failed" }));
        toast.error(err.error || "Something went wrong");
        setIsLoading(false);
        return;
      }

      let oracleContent = "";
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
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  if (last?.sender === "Oracle") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: oracleContent } : m);
                  return [...prev, { id: "oracle-" + Date.now(), role: "assistant", sender: "Oracle", emoji: "🔮", color: "#9b87f5", content: oracleContent }];
                });
              }
            } catch { buffer = line + "\n" + buffer; break; }
          }
        }
      }

      // Queue Oracle speech
      if (oracleContent && !isMuted) {
        speakAsAgent(oracleContent, "Oracle");
      }

      // Send to active agents and queue their speech sequentially
      if (activeAgents.length > 0) {
        try {
          const historyWithOracle = [
            ...allMsgs.slice(-10).map(m => ({ sender: m.sender, content: m.content })),
            ...(oracleContent ? [{ sender: "Oracle", content: oracleContent }] : []),
          ];
          const friendResp = await fetch(FRIENDS_CHAT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
            body: JSON.stringify({ message: text, history: historyWithOracle }),
          });
          if (friendResp.ok) {
            const data = await friendResp.json();
            for (let i = 0; i < (data.responses || []).length; i++) {
              const r = data.responses[i];
              const matchedAgent = activeAgents[i % activeAgents.length];
              if (!matchedAgent) continue;
              await new Promise(resolve => setTimeout(resolve, 400 + i * 500));
              setMessages(prev => [...prev, {
                id: `agent-${Date.now()}-${i}`,
                role: "assistant",
                sender: matchedAgent.name,
                emoji: matchedAgent.emoji,
                color: matchedAgent.color,
                content: r.content,
                avatar_url: matchedAgent.avatar_url,
              }]);
              // Queue each agent's speech — they'll speak one after another
              speakAsAgent(r.content, matchedAgent.name);
            }
          }
        } catch (e) { console.error("Agent chat error:", e); }
      }
    } catch (e: any) {
      if (e?.name === "AbortError") { /* user interrupted, no error needed */ }
      else { console.error(e); toast.error("Failed to connect to Oracle AI"); }
    } finally { setIsLoading(false); abortRef.current = null; }
  };

  return (
    <div className="h-screen flex flex-col" style={{ background: "#0a0a0a" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 z-10">
        <UniversalBackButton />
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

      {/* Agent panel overlay */}
      {showFriendPanel && (
        <div className="absolute top-14 right-4 z-30 bg-black/95 border border-[#FFAA00]/30 rounded-2xl p-4 backdrop-blur-xl w-72 max-h-[70vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-[#FFAA00] font-semibold">Summon AI into Chat</p>
            <button onClick={() => setShowFriendPanel(false)}><X className="w-4 h-4 text-[#FFAA00]" /></button>
          </div>
          
          {/* Default agents */}
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Built-in Agents</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {agents.filter(a => a.name !== "Oracle" && !a.isUserAvatar).map(a => (
              <button key={a.name} onClick={() => toggleAgent(a.name)} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${a.active ? "ring-1 ring-[#FFAA00] bg-[#FFAA00]/10" : "opacity-50"}`}>
                <div className="text-lg relative">{a.emoji}{a.locked && <span className="absolute -top-1 -right-1 text-[8px]">🔒</span>}</div>
                <span className="text-[8px] text-gray-300">{a.name}</span>
              </button>
            ))}
          </div>

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

      {/* Orb area */}
      <div className={`relative flex-1 flex items-center justify-center transition-all ${showChat ? "max-h-[35%]" : ""}`}>
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
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
                  {/* Hover enlarged avatar */}
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
              <div className="w-7 h-7 rounded-full bg-[#9b87f5]/20 flex items-center justify-center text-sm border border-[#9b87f5]">🔮</div>
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
        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-[#FFAA00]/30 bg-black/60 backdrop-blur">
          <button onClick={toggleMic} className={`p-2 rounded-full ${isListening ? "bg-green-600/80" : micPermGranted ? "bg-green-600/30" : "bg-transparent"}`}>
            {isListening ? <Mic className="w-5 h-5 text-white animate-pulse" /> : <Mic className="w-5 h-5 text-[#FFAA00]" />}
          </button>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage(input)}
            placeholder="Speak or type to consult the Oracle..."
            className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-500 outline-none" />
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
          <span className="text-xs text-[#FFAA00]">Oracle + {activeAgents.length} agents</span>
        </div>
      </div>

      <button onClick={() => navigate("/dashboard")} className="fixed bottom-4 right-4 z-20 p-3 rounded-full border-2 border-[#FFAA00] bg-black/80 backdrop-blur">
        <LayoutGrid className="w-6 h-6 text-[#FFAA00]" />
      </button>
    </div>
  );
};

export default OraclePage;
