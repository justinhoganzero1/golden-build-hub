// Newsroom host template: the host stands at the anchor desk of a studio like the ad,
// the wall screen behind her shows what she's talking about, the camera eases between
// wide, close-up, two-shot and screen shots, and staff move at desks in the background.
// Settings are saved per account so the same template is ready every time.
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ImagePlus, Loader2, Mic, Save, Sparkles, Square, Video, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserAvatars } from "@/hooks/useUserAvatars";
import { narrateText, NarrationError } from "@/lib/storyNarration";
import { ORACLE_AD_VOICE_ID } from "@/lib/oraclePresenter";
import { REPORTERS, draftInterview, encodeWav, formatTurns, parseInterview, reporterById, timeTurns, type ReporterId } from "@/lib/newsroomReporters";
import { uploadCreationFile } from "@/lib/oracleCreationFiles";
import { saveToLibrary } from "@/lib/saveToLibrary";
import { generateImage, InsufficientCreditsError } from "@/lib/imageGen";
import { requireEdgeAuthToken } from "@/lib/edgeAuth";
import { canvasSizeFor, lineAt, pickRecorderType, slideBeats, splitSentences, timeSentences, type HostFormat, type TimedLine } from "@/lib/youtubeHost";
import { cameraAt, planInterviewShots, planShots, segmentAt, type ShotSegment, type SpokenLine } from "@/lib/newsroomScene";
import { ChromaKeyer, drawNewsroom, type ScreenItem } from "./newsroomRenderer";
import studioLoop from "@/assets/newsroom/newsroom-studio-loop.mp4";
import studioStill from "@/assets/newsroom/newsroom-studio.jpg";
import deskLayer from "@/assets/newsroom/newsroom-desk-branded.webp";
import presenterGreen from "@/assets/newsroom/newsroom-host-green.jpg";
import jackGreen from "@/assets/newsroom/reporter-jack-green.jpg";
import miaGreen from "@/assets/newsroom/reporter-mia-green.jpg";
import jackCard from "@/assets/newsroom/reporter-jack-card.webp";
import miaCard from "@/assets/newsroom/reporter-mia-card.webp";

const REPORTER_PICS: Record<ReporterId, string> = { jack: jackGreen, mia: miaGreen };
const REPORTER_CARDS: Record<ReporterId, string> = { jack: jackCard, mia: miaCard };

export interface NewsroomSavedInfo { blob: Blob; ext: string; libraryId: string | null; seconds: number }
interface Props {
  script: string; title: string; channelName: string; voiceId: string | null; voiceName: string | null;
  /** Footage loaded from outside (e.g. Oracle News approved clips); replaces the screen list when it changes. */
  presetScreenMedia?: Array<{ kind: "image" | "video"; url: string }>;
  /** Called after the filmed episode is saved to the Library. */
  onSaved?: (info: NewsroomSavedInfo) => void;
}

interface Template {
  showName: string; anchorName: string; format: HostFormat; captions: boolean;
  host: string; greenHosts: Record<string, string>;
  /** Interview guest: one of the built-in reporters, or null for a solo episode. */
  reporter: ReporterId | null;
}
interface LipClip { jobId: string; scriptHash: string; url?: string; billedCents?: number }

const templateKey = (uid: string) => `oracle-lunar:newsroom-template:${uid}`;
const lipKey = (uid: string) => `oracle-lunar:newsroom-lipsync:${uid}`;
const PRESENTER = "presenter";

function css(name: string, fallback: string) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw ? `hsl(${raw})` : fallback;
}
async function sha(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const money = (cents: number) => `A$${(cents / 100).toFixed(2)}`;
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    if (/^https?:/.test(src) && !src.startsWith(window.location.origin)) img.crossOrigin = "anonymous";
    img.onload = () => res(img); img.onerror = () => rej(new Error("image")); img.src = src;
  });
}
async function fileToDataUrl(file: File, max = 1024): Promise<string> {
  const img = await loadImage(URL.createObjectURL(file));
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.9);
}

async function callLipsync(body: Record<string, unknown>) {
  const token = await requireEdgeAuthToken();
  const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/host-lipsync`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

const NewsroomHostStudio = ({ script, title, channelName, voiceId, voiceName, presetScreenMedia, onSaved }: Props) => {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const { data: avatars = [] } = useUserAvatars() as { data?: Array<{ id: string; name: string; image_url: string | null }> };

  const [tpl, setTpl] = useState<Template>(() => ({ showName: "", anchorName: "Oracle", format: "youtube", captions: true, host: PRESENTER, greenHosts: {}, reporter: null }));
  const [tplLoaded, setTplLoaded] = useState(false);
  const [preparingHost, setPreparingHost] = useState(false);
  const [pendingHost, setPendingHost] = useState<{ src: string; name: string } | null>(null);
  const [screenMedia, setScreenMedia] = useState<Array<{ kind: "image" | "video"; url: string }>>([]);
  const [aiPics, setAiPics] = useState<Record<number, string>>({});
  const [makingPics, setMakingPics] = useState(false);
  const [narrating, setNarrating] = useState(false);
  const [narrationPct, setNarrationPct] = useState(0);
  const [audio, setAudio] = useState<{ url: string; blob: Blob; script: string; seconds: number; lines?: SpokenLine[] } | null>(null);
  const [interviewText, setInterviewText] = useState("");
  const [scriptHash, setScriptHash] = useState("");
  const [lip, setLip] = useState<LipClip | null>(null);
  const [lipQuote, setLipQuote] = useState<{ total_cents: number; seconds: number } | null>(null);
  const [lipConfirm, setLipConfirm] = useState(false);
  const [lipBusy, setLipBusy] = useState(false);
  const [lipReady, setLipReady] = useState(false);
  const [filming, setFilming] = useState(false);
  const [filmPct, setFilmPct] = useState(0);
  const [result, setResult] = useState<{ blob: Blob; url: string; ext: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const bgStillRef = useRef<HTMLImageElement | null>(null);
  const deskRef = useRef<HTMLImageElement | null>(null);
  const hostStillRef = useRef<{ canvas: HTMLCanvasElement; aspect: number } | null>(null);
  const hostGreenRef = useRef<HTMLImageElement | null>(null);
  const guestRef = useRef<{ canvas: HTMLCanvasElement; aspect: number } | null>(null);
  const lipVideoRef = useRef<HTMLVideoElement | null>(null);
  const liveKeyer = useRef<ChromaKeyer | null>(null);
  const screenEls = useRef<Map<string, HTMLImageElement | HTMLVideoElement>>(new Map());
  const filmRef = useRef<{ lines: Array<TimedLine | SpokenLine>; segs: ShotSegment[]; level: number; stop?: () => void }>({ lines: [], segs: [], level: 0 });

  const beats = useMemo(() => slideBeats(script, 8), [script]);
  const size = canvasSizeFor(tpl.format);
  const hostSrc = tpl.host === PRESENTER ? presenterGreen : tpl.greenHosts[tpl.host] || presenterGreen;
  const reporter = reporterById(tpl.reporter);
  const interview = !!reporter;
  const turns = useMemo(() => (reporter ? parseInterview(interviewText, reporter, tpl.anchorName) : []), [reporter, interviewText, tpl.anchorName]);
  /** What the voice step reads: the script, or the interview with who says each line. */
  const spokenKey = interview ? `${reporter!.id}|${tpl.anchorName}|${interviewText}` : script;
  const lipMatches = !interview && !!lip?.url && lip.scriptHash === scriptHash && lipReady;
  const voiceStale = !!audio && audio.script !== spokenKey;

  // ── Template: load once per account, save on change ──
  useEffect(() => {
    if (!uid) return;
    try {
      const saved = JSON.parse(localStorage.getItem(templateKey(uid)) || "null");
      if (saved && typeof saved === "object") setTpl((t) => ({ ...t, ...saved, greenHosts: saved.greenHosts || {} }));
      const l = JSON.parse(localStorage.getItem(lipKey(uid)) || "null");
      if (l?.jobId) setLip(l);
    } catch { /* ignore */ }
    setTplLoaded(true);
  }, [uid]);
  useEffect(() => {
    if (uid && tplLoaded) try { localStorage.setItem(templateKey(uid), JSON.stringify(tpl)); } catch { /* full */ }
  }, [tpl, uid, tplLoaded]);
  useEffect(() => { if (!tpl.showName && (title || channelName)) setTpl((t) => ({ ...t, showName: channelName || title })); }, [title, channelName]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void sha(`${script}|${voiceId || ""}|${tpl.host}`).then(setScriptHash); }, [script, voiceId, tpl.host]);

  // ── Studio layers ──
  useEffect(() => {
    const v = document.createElement("video");
    v.src = studioLoop; v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto";
    v.oncanplay = () => { bgVideoRef.current = v; };
    void v.play().catch(() => null);
    loadImage(studioStill).then((i) => { bgStillRef.current = i; }).catch(() => null);
    loadImage(deskLayer).then((i) => { deskRef.current = i; }).catch(() => null);
    liveKeyer.current = new ChromaKeyer(480);
    return () => { v.pause(); v.removeAttribute("src"); };
  }, []);

  useEffect(() => {
    let alive = true;
    loadImage(hostSrc).then((img) => {
      if (!alive) return;
      hostGreenRef.current = img;
      const aspect = img.naturalWidth / img.naturalHeight;
      const k = new ChromaKeyer(480);
      hostStillRef.current = { canvas: k.key(img, aspect), aspect };
    }).catch(() => toast.error("Couldn't load that host picture."));
    return () => { alive = false; };
  }, [hostSrc]);

  useEffect(() => {
    guestRef.current = null;
    if (!reporter) return;
    let alive = true;
    loadImage(REPORTER_PICS[reporter.id]).then((img) => {
      if (!alive) return;
      const aspect = img.naturalWidth / img.naturalHeight;
      guestRef.current = { canvas: new ChromaKeyer(480).key(img, aspect), aspect };
    }).catch(() => toast.error("Couldn't load the reporter picture."));
    return () => { alive = false; };
  }, [reporter?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const draftFromScript = (r = reporter) => {
    if (!r) return;
    const t = draftInterview(script, r, tpl.showName);
    setInterviewText(t.length ? formatTurns(t, r, tpl.anchorName) : "");
  };
  const chooseReporter = (id: ReporterId | null) => {
    setTpl((t) => ({ ...t, reporter: id }));
    const r = reporterById(id);
    if (r) draftFromScript(r);
  };
  useEffect(() => { if (reporter && !interviewText && script.trim()) draftFromScript(); }, [reporter?.id, script]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (presetScreenMedia?.length) setScreenMedia(presetScreenMedia.slice(0, 12));
  }, [presetScreenMedia]);

  // Screen media elements (member pictures/clips and AI pictures).
  useEffect(() => {
    const urls = [...screenMedia.map((m) => m.url), ...Object.values(aiPics)];
    urls.forEach((url) => {
      if (screenEls.current.has(url)) return;
      const m = screenMedia.find((s) => s.url === url);
      if (m?.kind === "video") {
        const v = document.createElement("video");
        if (/^https?:/i.test(url)) v.crossOrigin = "anonymous"; // keeps the canvas recordable
        v.src = url; v.muted = true; v.loop = true; v.playsInline = true; void v.play().catch(() => null);
        screenEls.current.set(url, v);
      } else loadImage(url).then((img) => screenEls.current.set(url, img)).catch(() => null);
    });
  }, [screenMedia, aiPics]);

  // Resume a lip-sync clip that was paid for earlier (no new charge).
  useEffect(() => {
    if (!lip?.jobId || lip.url) return;
    let stop = false;
    const poll = async () => {
      for (let i = 0; i < 120 && !stop; i++) {
        const { ok, data } = await callLipsync({ action: "status", job_id: lip.jobId }).catch(() => ({ ok: false, data: {} as any }));
        if (ok && data.status === "succeeded" && data.url) {
          const next = { ...lip, url: data.url, billedCents: data.total_billed_cents };
          setLip(next); setLipBusy(false);
          toast.success(`Lip-sync ready. Charged ${money(data.total_billed_cents ?? 0)}.`);
          return;
        }
        if (ok && (data.status === "failed" || data.error === "not_found")) {
          setLipBusy(false); setLip(null); try { localStorage.removeItem(lipKey(uid)); } catch { /* */ }
          toast.error(data.message || "Lip-sync didn't finish. Nothing was charged.");
          return;
        }
        if (!ok && data?.error === "not_found") { setLip(null); setLipBusy(false); return; }
        await new Promise((r) => setTimeout(r, 5000));
      }
      setLipBusy(false);
    };
    setLipBusy(true); void poll();
    return () => { stop = true; };
  }, [lip?.jobId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (uid && lip) try { localStorage.setItem(lipKey(uid), JSON.stringify({ jobId: lip.jobId, scriptHash: lip.scriptHash })); } catch { /* */ } }, [lip, uid]);

  // Load the finished lip-sync clip.
  useEffect(() => {
    setLipReady(false);
    if (!lip?.url) { lipVideoRef.current = null; return; }
    const v = document.createElement("video");
    v.crossOrigin = "anonymous"; v.src = lip.url; v.playsInline = true; v.preload = "auto"; v.muted = true;
    v.onloadeddata = () => { lipVideoRef.current = v; setLipReady(true); };
    v.onerror = () => toast.error("Couldn't open the lip-sync clip. Try again in a moment.");
    v.load();
  }, [lip?.url]);

  const colors = () => ({
    gold: css("--primary", "#d4af37"), fg: css("--foreground", "#f5f5f5"), bg: css("--background", "#0b0f14"),
    shade: css("--secondary", "#16202a"), teal: css("--accent", "#2dd4bf"),
  });

  const screenFor = (beat: number): ScreenItem => {
    const headline = beats[beat] || tpl.showName || title;
    const ai = aiPics[beat] ? screenEls.current.get(aiPics[beat]) : undefined;
    const media = screenMedia.length ? screenEls.current.get(screenMedia[beat % screenMedia.length].url) : undefined;
    const el = ai || media;
    if (el instanceof HTMLVideoElement) return { kind: "video", title: headline, video: el };
    if (el instanceof HTMLImageElement) return { kind: "image", title: headline, img: el };
    return { kind: "text", title: headline };
  };

  const draw = (t: number, live: boolean) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const f = filmRef.current;
    const segs = f.segs;
    const seg = segs.length ? segs[segmentAt(segs, t)] : null;
    let host: CanvasImageSource | null = hostStillRef.current?.canvas ?? null;
    let aspect = hostStillRef.current?.aspect ?? 0.53;
    const lv = lipVideoRef.current;
    const useLip = live && lipMatches && lv && lv.readyState >= 2 && liveKeyer.current;
    if (useLip) { aspect = lv.videoWidth / lv.videoHeight; host = liveKeyer.current!.key(lv, aspect); }
    const cur = lineAt(f.lines, t) as (TimedLine & { speaker?: SpokenLine["speaker"] }) | null;
    const g = interview ? guestRef.current : null;
    const speaker = cur?.speaker ?? "host";
    drawNewsroom(ctx, {
      t, camera: cameraAt(segs, t, tpl.format, interview ? "interview" : "solo"), bg: bgVideoRef.current ?? bgStillRef.current, desk: deskRef.current,
      host, hostAspect: aspect, level: live ? f.level : 0.35, lipSynced: !!useLip,
      guest: g && reporter ? { img: g.canvas, aspect: g.aspect, energy: reporter.energy } : null, speaker,
      nameLine: interview && reporter ? (speaker === "reporter" ? `${reporter.name} · ${reporter.genre} reporter` : [tpl.anchorName, tpl.showName].filter(Boolean).join(" · ")) : undefined,
      screen: screenFor(seg?.beat ?? 0), showName: tpl.showName, anchorName: tpl.anchorName,
      headline: beats[seg?.beat ?? 0] || tpl.showName || title, caption: tpl.captions && live && cur ? cur.text : null, colors: colors(),
    });
  };

  // Idle preview: rehearses the camera moves on a loop with 3-second lines.
  useEffect(() => {
    if (filming) return;
    let lines: Array<TimedLine | SpokenLine>;
    if (interview && turns.length) {
      lines = turns.slice(0, 10).map((tn, i) => ({ text: tn.text, start: i * 3, end: i * 3 + 3, speaker: tn.speaker }));
      filmRef.current.segs = planInterviewShots(lines as SpokenLine[], beats.length);
    } else {
      const sentences = splitSentences(script).slice(0, 10);
      lines = sentences.length ? sentences.map((s, i) => ({ text: s, start: i * 3, end: i * 3 + 3 })) : [{ text: "", start: 0, end: 12 }];
      filmRef.current.segs = planShots(lines, beats.length);
    }
    filmRef.current.lines = lines;
    const total = lines[lines.length - 1].end;
    let raf = 0; const start = performance.now();
    const loop = () => { draw(((performance.now() - start) / 1000) % total, false); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [filming, script, beats, tpl, aiPics, screenMedia, lipMatches, turns, interview]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Host choices ──
  const chooseHost = (src: string, name: string) => {
    if (src === PRESENTER) { setTpl((t) => ({ ...t, host: PRESENTER })); return; }
    if (tpl.greenHosts[src]) { setTpl((t) => ({ ...t, host: src })); return; }
    setPendingHost({ src, name });
  };
  const prepareHost = async () => {
    if (!pendingHost) return;
    setPreparingHost(true);
    try {
      const r = await generateImage({
        prompt: "Keep this exact same person, same face, hair, clothes and expression. Show them from the waist up, centred, facing the camera, arms relaxed, like a TV news presenter. Replace the entire background with a perfectly flat solid pure green chroma-key colour (#00FF00), no shadows, no gradient. Clean sharp edges around the hair. No text.",
        inputImage: pendingHost.src, noCache: true, libraryFallback: false, maxAttempts: 3,
      });
      if (r.fallback) throw new Error("fallback");
      const src = pendingHost.src;
      setTpl((t) => ({ ...t, host: src, greenHosts: { ...t.greenHosts, [src]: r.url } }));
      setPendingHost(null);
      toast.success("Your host is ready for the studio.");
    } catch (e) {
      toast.error(e instanceof InsufficientCreditsError ? "Top up your wallet to prepare this host." : "Couldn't prepare that host. Nothing new was saved.");
    } finally { setPreparingHost(false); }
  };
  const onHostPhoto = async (file?: File) => {
    if (!file?.type.startsWith("image/")) return;
    const dataUrl = await fileToDataUrl(file).catch(() => null);
    if (dataUrl) setPendingHost({ src: dataUrl, name: "your photo" });
  };

  // ── Screen pictures ──
  const onScreenFiles = (files: FileList | null) => {
    if (!files) return;
    const add = Array.from(files).filter((f) => /^(image|video)\//.test(f.type)).slice(0, 12)
      .map((f) => ({ kind: (f.type.startsWith("video/") ? "video" : "image") as "image" | "video", url: URL.createObjectURL(f) }));
    setScreenMedia((m) => [...m, ...add].slice(0, 12));
  };
  const makeScreenPics = async () => {
    if (!beats.length) { toast.error("Write the script first — each paragraph becomes a screen picture."); return; }
    setMakingPics(true);
    let made = 0;
    try {
      for (let i = 0; i < beats.length; i++) {
        if (aiPics[i]) continue;
        const r = await generateImage({ prompt: `Editorial TV news style photo illustrating: ${beats[i]}. Cinematic, realistic, 16:9. No text, no words, no logos.`, libraryFallback: false, maxAttempts: 3 });
        if (r.fallback) continue;
        made++; setAiPics((p) => ({ ...p, [i]: r.url }));
      }
      toast.success(made ? `${made} screen picture${made > 1 ? "s" : ""} ready.` : "Screen pictures are already made.");
    } catch (e) {
      toast.error(e instanceof InsufficientCreditsError ? "Top up your wallet to make more screen pictures." : "Some screen pictures couldn't be made.");
    } finally { setMakingPics(false); }
  };

  // ── Voice ──
  const makeInterviewVoice = async () => {
    if (!reporter || !turns.length) { toast.error("Write the interview first."); return; }
    setNarrating(true); setNarrationPct(0); setResult(null); setSavedId(null);
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const ac: AudioContext = new AC();
    try {
      const buffers: AudioBuffer[] = [];
      for (let i = 0; i < turns.length; i++) {
        const tn = turns[i];
        const opts = tn.speaker === "reporter"
          ? { voiceId: reporter.voiceId, settings: reporter.voiceSettings }
          : { voiceId: voiceId || ORACLE_AD_VOICE_ID };
        const bytes = await narrateText(tn.text, (p) => setNarrationPct(Math.round(((i + p / 100) / turns.length) * 100)), opts);
        const copy = new Uint8Array(bytes as Uint8Array).buffer;
        buffers.push(await ac.decodeAudioData(copy));
      }
      const rate = buffers[0]?.sampleRate || 44100;
      const gap = Math.round(rate * 0.35);
      const total = buffers.reduce((n, b) => n + Math.round(b.duration * rate) + gap, 0);
      const out = new Float32Array(total);
      const spans: Array<{ start: number; end: number }> = [];
      let pos = 0;
      for (const b of buffers) {
        const n = Math.round(b.duration * rate);
        const chans = Array.from({ length: b.numberOfChannels }, (_, c) => b.getChannelData(c));
        const step = b.sampleRate / rate;
        for (let i = 0; i < n; i++) {
          const k = Math.min(b.length - 1, Math.floor(i * step));
          let v = 0; for (const ch of chans) v += ch[k]; out[pos + i] = v / chans.length;
        }
        spans.push({ start: pos / rate, end: (pos + n) / rate });
        pos += n + gap;
      }
      const blob = encodeWav(out, rate);
      setAudio({ url: URL.createObjectURL(blob), blob, script: spokenKey, seconds: total / rate, lines: timeTurns(turns, spans) });
      toast.success(`Voices ready for you and ${reporter.firstName}. Charged to your wallet.`);
    } catch (e) {
      toast.error(e instanceof NarrationError ? e.message : "Couldn't make the voices. Nothing was saved.");
    } finally { setNarrating(false); void ac.close(); }
  };

  const makeVoice = async () => {
    if (interview) return makeInterviewVoice();
    if (!script.trim()) { toast.error("Write or generate a script first."); return; }
    setNarrating(true); setNarrationPct(0); setResult(null); setSavedId(null);
    try {
      const bytes = await narrateText(script, setNarrationPct, { voiceId: voiceId || ORACLE_AD_VOICE_ID });
      const blob = new Blob([bytes as BlobPart], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const seconds = await new Promise<number>((res) => { const a = new Audio(url); a.onloadedmetadata = () => res(a.duration || 0); a.onerror = () => res(0); });
      setAudio({ url, blob, script, seconds });
      toast.success("Host voice ready. Charged to your wallet.");
      if (seconds > 0) {
        const q = await callLipsync({ action: "quote", seconds });
        if (q.ok) setLipQuote(q.data.quote);
      }
    } catch (e) {
      toast.error(e instanceof NarrationError ? e.message : "Couldn't make the voice. Nothing was saved.");
    } finally { setNarrating(false); }
  };

  // ── Lip-sync (paid, confirmed) ──
  const startLipsync = async () => {
    setLipConfirm(false);
    if (!audio || !uid) return;
    setLipBusy(true);
    try {
      const hostBlob = await fetch(hostSrc).then((r) => r.blob());
      const audioPath = `${uid}/library/oracle/lipsync-input-${crypto.randomUUID()}.mp3`;
      const imagePath = `${uid}/library/oracle/lipsync-input-${crypto.randomUUID()}.jpg`;
      const up1 = await supabase.storage.from("photography-assets").upload(audioPath, audio.blob, { contentType: "audio/mpeg" });
      const up2 = await supabase.storage.from("photography-assets").upload(imagePath, hostBlob, { contentType: hostBlob.type || "image/jpeg" });
      if (up1.error || up2.error) throw new Error("upload");
      const { ok, status, data } = await callLipsync({
        action: "start", audio_path: audioPath, image_path: imagePath, seconds: audio.seconds,
        request_key: crypto.randomUUID(), script_hash: scriptHash,
      });
      if (!ok) {
        setLipBusy(false);
        if (status === 402 && data.error === "plan_required") toast.error("Lip-sync is part of the Pro plan.");
        else if (status === 402) toast.error(`Not enough in your wallet. Top up to use lip-sync.`);
        else toast.error(data.message || "Lip-sync didn't start. Nothing was charged.");
        return;
      }
      setLip({ jobId: data.job_id, scriptHash });
      toast.info("Lip-sync started. It usually takes a minute or two — you can keep working.");
    } catch {
      setLipBusy(false);
      toast.error("Couldn't send the voice for lip-sync. Nothing was charged.");
    }
  };

  // ── Film ──
  const film = async () => {
    const canvas = canvasRef.current;
    const lv = lipMatches ? lipVideoRef.current : null;
    if (!canvas || (!audio && !lv)) return;
    const type = pickRecorderType((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
    if (!type || !canvas.captureStream) { toast.error("This browser can't record video. Try Chrome on a computer or phone."); return; }

    setFilming(true); setFilmPct(0); setResult(null); setSavedId(null);
    const master: HTMLMediaElement = lv ?? new Audio(audio!.url);
    if (lv) { lv.currentTime = 0; lv.muted = false; }
    await new Promise<void>((res) => { if (master.readyState >= 1) res(); else { master.onloadedmetadata = () => res(); master.onerror = () => res(); } });
    const duration = master.duration || audio?.seconds || 1;
    if (interview && audio?.lines?.length) {
      filmRef.current.lines = audio.lines;
      filmRef.current.segs = planInterviewShots(audio.lines, beats.length);
    } else {
      const lines = timeSentences(splitSentences(script), duration);
      filmRef.current.lines = lines;
      filmRef.current.segs = planShots(lines, beats.length);
    }
    screenEls.current.forEach((el) => { if (el instanceof HTMLVideoElement) { el.currentTime = 0; void el.play().catch(() => null); } });

    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const ac: AudioContext = new AC();
    const src = ac.createMediaElementSource(master);
    const analyser = ac.createAnalyser(); analyser.fftSize = 512;
    const dest = ac.createMediaStreamDestination();
    src.connect(analyser); analyser.connect(ac.destination); src.connect(dest);
    const data = new Uint8Array(analyser.fftSize);
    const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const rec = new MediaRecorder(stream, { mimeType: type.mime, videoBitsPerSecond: 6_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

    let raf = 0; let cancelled = false;
    const loop = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0; for (const v of data) { const d = (v - 128) / 128; sum += d * d; }
      filmRef.current.level = filmRef.current.level * 0.7 + Math.min(1, Math.sqrt(sum / data.length) * 4) * 0.3;
      draw(master.currentTime, true);
      setFilmPct(Math.min(100, Math.round((master.currentTime / duration) * 100)));
      raf = requestAnimationFrame(loop);
    };
    filmRef.current.stop = () => { cancelled = true; master.pause(); };
    try {
      await ac.resume();
      rec.start(1000);
      raf = requestAnimationFrame(loop);
      await master.play();
      await new Promise<void>((res) => { master.onended = () => res(); master.onpause = () => res(); });
      await new Promise((r) => setTimeout(r, 400));
      cancelAnimationFrame(raf);
      await new Promise<void>((res) => { rec.onstop = () => res(); if (rec.state !== "inactive") rec.stop(); else res(); });
      if (cancelled) { toast.info("Filming stopped. Nothing was saved."); return; }
      const blob = new Blob(chunks, { type: type.mime.split(";")[0] });
      setResult({ blob, url: URL.createObjectURL(blob), ext: type.ext });
      toast.success("Episode filmed. Watch it, then download or save it.");
    } catch {
      toast.error("Filming stopped unexpectedly. Please try again.");
    } finally {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      void ac.close();
      if (lv) lv.muted = true;
      filmRef.current.stop = undefined;
      setFilming(false);
    }
  };

  const save = async () => {
    if (!result || !user) return;
    setSaving(true);
    try {
      const url = await uploadCreationFile(result.blob, user.id, title || "newsroom-episode", result.ext);
      if (!url) throw new Error("upload");
      const id = await saveToLibrary({
        media_type: "video", title: `${title || tpl.showName || "Newsroom episode"} (${tpl.format === "shorts" ? "Shorts" : "YouTube"})`, url,
        source_page: "/youtube-show-studio",
        metadata: { kind: "youtube_host", layout: "newsroom", format: tpl.format, voice: voiceName || "Oracle ad voice", host: lipMatches ? "lip-synced" : "animated photo (no lip-sync)", reporter: reporter ? `${reporter.name} (${reporter.genre})` : null, mime_type: result.blob.type },
      });
      setSavedId(id || "queued");
      toast.success("Saved to your Library.");
      onSaved?.({ blob: result.blob, ext: result.ext, libraryId: id || null, seconds: Math.round(audio?.seconds ?? 0) });
    } catch {
      toast.error("Couldn't save to your Library. Your video is still here — try again or download it.");
    } finally { setSaving(false); }
  };

  const choice = (active: boolean) => `px-3 py-1.5 rounded-lg border text-xs ${active ? "border-primary bg-primary/10 text-primary" : "border-border"}`;
  const hostTile = (active: boolean) => `w-16 h-16 rounded-xl overflow-hidden border-2 ${active ? "border-primary" : "border-border"}`;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Your host presents from the anchor desk of a newsroom like the ad. The big screen behind her shows each point she talks about, the camera moves between her, the screen and the whole studio, and staff work at desks in the background. Your choices are saved, so this studio is ready every time.
      </p>

      <div className="space-y-2">
        <p className="text-xs font-medium">1. Pick your host</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => chooseHost(PRESENTER, "Oracle")} className={hostTile(tpl.host === PRESENTER)} aria-label="Oracle presenter as host">
            <img src={presenterGreen} alt="Oracle presenter" className="w-full h-full object-cover object-top" />
          </button>
          {avatars.filter((a) => a.image_url).slice(0, 12).map((a) => (
            <button key={a.id} type="button" onClick={() => chooseHost(a.image_url!, a.name)} className={hostTile(tpl.host === a.image_url)} aria-label={`${a.name} as host`}>
              <img src={tpl.greenHosts[a.image_url!] || a.image_url!} alt={a.name} className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
          <label className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center text-[10px] text-muted-foreground cursor-pointer">
            <ImagePlus className="w-4 h-4 mb-0.5" /> Photo
            <Input type="file" accept="image/*" className="hidden" onChange={(e) => void onHostPhoto(e.target.files?.[0])} />
          </label>
        </div>
        {pendingHost && (
          <div className="rounded-lg border border-border p-3 space-y-2">
            <p className="text-[11px]">To stand {pendingHost.name} in the studio, Oracle first makes one picture of them on a green screen. This is one picture edit, charged to your wallet like any picture.</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={prepareHost} disabled={preparingHost}>
                {preparingHost ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1" />} Prepare host
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPendingHost(null)} disabled={preparingHost}>Cancel</Button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium">Interview a reporter (optional)</p>
        <p className="text-[11px] text-muted-foreground">Pick a reporter to stand beside your host. Each has their own news topic, voice and personality. Your host asks the questions; the reporter covers each point of your script.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <button type="button" onClick={() => chooseReporter(null)} aria-pressed={!reporter} disabled={filming || narrating}
            className={`rounded-xl border-2 p-3 text-left text-xs ${!reporter ? "border-primary bg-primary/10" : "border-border"}`}>
            <span className="font-semibold block">Just the host</span>
            <span className="text-muted-foreground">Solo episode, no guest.</span>
          </button>
          {REPORTERS.map((r) => (
            <button key={r.id} type="button" onClick={() => chooseReporter(r.id)} disabled={filming || narrating} aria-pressed={tpl.reporter === r.id} aria-label={`Interview ${r.name}, ${r.genre} reporter`}
              className={`rounded-xl border-2 p-2 text-left text-xs flex gap-2 items-start ${tpl.reporter === r.id ? "border-primary bg-primary/10" : "border-border"}`}>
              <img src={REPORTER_CARDS[r.id]} alt={r.name} className="w-12 h-16 rounded-lg object-cover object-top shrink-0" />
              <span className="min-w-0">
                <span className="font-semibold block">{r.name}</span>
                <span className="text-primary block">{r.genre}</span>
                <span className="text-muted-foreground block">{r.personality}</span>
                <span className="text-muted-foreground block">Voice: {r.voiceName}</span>
              </span>
            </button>
          ))}
        </div>
        {reporter && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">Interview script. Start each line with <strong>{tpl.anchorName || "Host"}:</strong> or <strong>{reporter.firstName}:</strong> to say who speaks.</p>
              <Button size="sm" variant="outline" onClick={() => draftFromScript()} disabled={!script.trim()}>
                <Wand2 className="w-4 h-4 mr-1" /> Write it from my script
              </Button>
            </div>
            <Textarea value={interviewText} onChange={(e) => setInterviewText(e.target.value)} rows={8} className="text-xs"
              placeholder={`${tpl.anchorName || "Host"}: Joining me is ${reporter.name}.\n\n${reporter.firstName}: ${reporter.intro}`} />
            <p className="text-[10px] text-muted-foreground">{turns.filter((t) => t.speaker === "host").length} lines for your host · {turns.filter((t) => t.speaker === "reporter").length} for {reporter.firstName}. Writing it is free.</p>
          </div>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-xs">Show name
          <Input value={tpl.showName} onChange={(e) => setTpl((t) => ({ ...t, showName: e.target.value.slice(0, 60) }))} placeholder="Oracle Tonight" />
        </label>
        <label className="space-y-1 text-xs">Host name on screen
          <Input value={tpl.anchorName} onChange={(e) => setTpl((t) => ({ ...t, anchorName: e.target.value.slice(0, 40) }))} placeholder="Oracle" />
        </label>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <p className="text-xs font-medium">Shape</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={choice(tpl.format === "youtube")} onClick={() => setTpl((t) => ({ ...t, format: "youtube" }))}>YouTube (wide)</button>
            <button type="button" className={choice(tpl.format === "shorts")} onClick={() => setTpl((t) => ({ ...t, format: "shorts" }))}>Shorts (tall)</button>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <Switch checked={tpl.captions} onCheckedChange={(v) => setTpl((t) => ({ ...t, captions: v }))} /> Captions
        </label>
      </div>

      <div className={`mx-auto rounded-xl overflow-hidden border border-border bg-muted ${tpl.format === "shorts" ? "max-w-[260px]" : "w-full"}`}>
        <canvas ref={canvasRef} width={size.width} height={size.height} className="w-full h-auto block" aria-label="Newsroom preview" />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium">2. What the big screen shows</p>
        <p className="text-[11px] text-muted-foreground">Each paragraph of your script is one point on the screen. Add your own pictures or clips (they show in order), or let Oracle make a picture for each point. Points without a picture show as a headline card.</p>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs cursor-pointer">
            <ImagePlus className="w-4 h-4" /> Add pictures or clips
            <Input type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => onScreenFiles(e.target.files)} />
          </label>
          <Button size="sm" variant="outline" onClick={makeScreenPics} disabled={makingPics || !beats.length}>
            {makingPics ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />} Make screen pictures ({beats.length})
          </Button>
          {(screenMedia.length > 0 || Object.keys(aiPics).length > 0) && (
            <Button size="sm" variant="ghost" onClick={() => { setScreenMedia([]); setAiPics({}); }}>Clear</Button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">Screen pictures are charged to your wallet per picture. {screenMedia.length} of yours added · {Object.keys(aiPics).length} made by Oracle.</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium">3. Make the host's voice</p>
        <p className="text-[11px] text-muted-foreground">
          {reporter ? `Host voice: ${voiceName || "Oracle ad voice"} · ${reporter.firstName}'s voice: ${reporter.voiceName}. Charged to your wallet.` : `Voice: ${voiceName || "Oracle ad voice"}. Charged to your wallet.`}
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <Button size="sm" onClick={makeVoice} disabled={narrating || filming || (interview ? !turns.length : !script.trim())}>
            {narrating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Mic className="w-4 h-4 mr-1" />}
            {narrating ? `Making voice ${narrationPct}%` : audio ? (interview ? "Remake voices" : "Remake voice") : (interview ? "Make voices" : "Make voice")}
          </Button>
          {audio && <audio src={audio.url} controls className="h-9 max-w-full" />}
        </div>
        {voiceStale && <p className="text-[11px] text-destructive">The script changed after the voice was made. Remake the voice so they match.</p>}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium">4. Real lip-sync (optional)</p>
        {interview ? (
          <p className="text-[11px] text-muted-foreground">Lip-sync is for solo episodes. In an interview, your host and {reporter!.firstName} are photos that move gently when they talk — their mouths don't move.</p>
        ) : (<>
        <p className="text-[11px] text-muted-foreground">
          Without lip-sync your host is a photo that moves gently with her voice. With lip-sync, a lip-sync service turns her picture into a video whose mouth moves with her voice. The price depends on the length of the voice and comes from your wallet. Pro plan.
        </p>
        {lipMatches ? (
          <p className="text-[11px] text-primary">Lip-sync ready{lip?.billedCents != null ? ` · charged ${money(lip.billedCents)}` : ""}. Filming will use it.</p>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setLipConfirm(true)} disabled={!audio || voiceStale || lipBusy || filming || !lipQuote}>
            {lipBusy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Video className="w-4 h-4 mr-1" />}
            {lipBusy ? "Making lip-sync…" : lipQuote ? `Add lip-sync · ${money(lipQuote.total_cents)}` : "Add lip-sync"}
          </Button>
        )}
        </>)}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium">5. Film the episode</p>
        <p className="text-[11px] text-muted-foreground">Filming plays in real time, so keep this screen open until it finishes. Filming itself is free.</p>
        <div className="flex flex-wrap gap-2 items-center">
          <Button size="sm" onClick={film} disabled={(!audio && !lipMatches) || voiceStale || filming || narrating}>
            {filming ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Video className="w-4 h-4 mr-1" />}
            {filming ? `Filming ${filmPct}%` : "Film episode"}
          </Button>
          {filming && <Button size="sm" variant="outline" onClick={() => filmRef.current.stop?.()}><Square className="w-4 h-4 mr-1" /> Stop</Button>}
        </div>
      </div>

      {result && (
        <div className="space-y-2">
          <p className="text-xs font-medium">6. Watch, then keep it</p>
          <video src={result.url} controls playsInline className={`rounded-lg border border-border ${tpl.format === "shorts" ? "max-w-[260px]" : "w-full"}`} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <a href={result.url} download={`${(title || "newsroom-episode").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.${result.ext}`}><Download className="w-4 h-4 mr-1" /> Download</a>
            </Button>
            <Button size="sm" onClick={save} disabled={saving || !!savedId}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              {savedId ? "Saved to Library" : "Save to Library"}
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={lipConfirm} onOpenChange={setLipConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add real lip-sync?</AlertDialogTitle>
            <AlertDialogDescription>
              {lipQuote
                ? `Your voice is ${Math.round(lipQuote.seconds)} seconds. It costs about ${money(lipQuote.total_cents)} from your wallet. You're charged for the exact length of the finished clip, and nothing if it fails.`
                : "Checking the price…"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction onClick={() => void startLipsync()}>Yes, add lip-sync</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default NewsroomHostStudio;
