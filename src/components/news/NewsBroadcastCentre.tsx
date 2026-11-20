// Oracle News — Broadcast Control Centre (owner only, top of the YouTube studio).
// Ready stories play in priority order: the newsroom presenter reads each script section with the
// free device voice while the wall monitor switches to that section's licensed visual (or a graphic).
// No subtitles (house rule). The presenter photo sways with her voice; her mouth does not move.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, SkipForward, RotateCcw, PenLine, Film, Eye, Radio, Loader2, Globe, Clapperboard, Stethoscope, XCircle, CheckCircle2, Cog } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { callNews } from "@/lib/newsApi";
import { chooseOracleDeviceVoice, shapeDeviceSpeech } from "@/lib/oracleDeviceVoice";
import { SCENE, shotRect, CAMERA_MOVE_SECONDS, type NewsroomShot, type Rect } from "@/lib/newsroomScene";
import { ChromaKeyer, drawNewsroom, type ScreenItem } from "@/components/youtube/newsroomRenderer";
import { STAGE_LABEL, planSectionVisuals, topTrending, thanksLine, TOP_STORIES, type PlannedVisual, type ScriptSection, type Stage, type Visual } from "../../../supabase/functions/_shared/newsPipeline";
import { CreditBanner, drawCreditBanner, clipPlayerUrl } from "./CreditBanner";
import studioLoop from "@/assets/newsroom/newsroom-studio-loop.mp4";
import studioStill from "@/assets/newsroom/newsroom-studio.jpg";
import deskLayer from "@/assets/newsroom/newsroom-desk-branded.webp";
import presenterGreen from "@/assets/newsroom/newsroom-host-green.jpg";

export interface StudioPayload { title: string; script: string; media: Array<{ kind: "image" | "video"; url: string }> }
interface Props { onSendToStudio?: (p: StudioPayload) => void }
type Row = Record<string, any>;
type Mode = "idle" | "auto" | "preview";

const PLAYABLE: Stage[] = ["ready_to_broadcast", "presenter_speaking", "broadcast_complete"];
const SHOT_FOR: Record<string, NewsroomShot> = { intro: "wide", what_happened: "screen", where_when: "screen", who: "host", background: "screen", figures: "screen", why_it_matters: "host", what_next: "screen", closing: "wide" };
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-AU", { timeZone: "Australia/Brisbane", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "never");
const stageVariant = (s: string) => (s === "failed" ? "destructive" : s === "ready_to_broadcast" || s === "broadcast_complete" ? "default" : "secondary") as "default" | "secondary" | "destructive";
const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const lerp = (a: Rect, b: Rect, p: number): Rect => ({ x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, w: a.w + (b.w - a.w) * p, h: a.h + (b.h - a.h) * p });
const css = (v: string, fb: string) => { const x = getComputedStyle(document.documentElement).getPropertyValue(v).trim(); return x ? `hsl(${x})` : fb; };
function loadImage(src: string, cors = false): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); if (cors) i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => rej(new Error("image")); i.src = src; });
}

const NewsBroadcastCentre = ({ onSendToStudio }: Props) => {
  const [stories, setStories] = useState<Row[]>([]);
  const [visuals, setVisuals] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState<Row | null>(null);
  const [lastBroadcast, setLastBroadcast] = useState<Row | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [paused, setPaused] = useState(false);
  const [current, setCurrent] = useState<{ story: Row; section: number } | null>(null);
  const [monitor, setMonitor] = useState("Studio");
  const [busy, setBusy] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [catFilter, setCatFilter] = useState<string>("all");
  const [health, setHealth] = useState<Row | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [voiceOk, setVoiceOk] = useState<boolean | null>(null);
  const [clip, setClip] = useState<{ url: string; credit: string } | null>(null);
  const creditRef = useRef<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layers = useRef<{ bg: HTMLVideoElement | null; still: HTMLImageElement | null; desk: HTMLImageElement | null; host: { canvas: HTMLCanvasElement; aspect: number } | null }>({ bg: null, still: null, desk: null, host: null });
  const screenRef = useRef<ScreenItem>({ kind: "text", title: "Oracle News" });
  const camRef = useRef<{ from: Rect; to: Rect; at: number }>({ from: shotRect("wide", "youtube"), to: shotRect("wide", "youtube"), at: 0 });
  const levelRef = useRef(0);
  const speakingRef = useRef(false);
  const headlineRef = useRef("Oracle News");
  const nameLineRef = useRef("Oracle · Oracle News");
  const runRef = useRef(0); // bumps to cancel whatever is playing
  const playedRef = useRef<string[]>([]);
  const failedMedia = useRef<Set<string>>(new Set());
  const skippedRef = useRef<Set<string>>(new Set());
  useEffect(() => { skippedRef.current = skipped; }, [skipped]);

  // ── data ──
  const load = useCallback(async () => {
    const since = new Date(Date.now() - 48 * 3600_000).toISOString();
    const [st, f, cfg, last] = await Promise.all([
      supabase.from("news_stories").select("id,headline,category,region,importance,verification,status,production_status,production_error,production_attempts,production_updated_at,script_sections,content_checked,broadcast_count,last_broadcast_at,public_at,last_updated")
        .gte("last_updated", since).neq("production_status", "expired").order("importance", { ascending: false }).limit(80),
      supabase.from("news_footage").select("id,story_id,section,media_type,media_url,embed_url,source_kind,thumbnail_url,rating,playback_status,title,attribution,licence,source_org,url").not("media_url", "is", null).order("created_at", { ascending: false }).limit(200),
      supabase.from("news_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("news_stories").select("headline,last_broadcast_at").not("last_broadcast_at", "is", null).order("last_broadcast_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setStories(st.data ?? []); setVisuals(f.data ?? []); setSettings(cfg.data ?? null); setLastBroadcast(last.data ?? null);
    const c: Record<string, number> = {};
    for (const s of st.data ?? []) c[s.production_status] = (c[s.production_status] ?? 0) + 1;
    setCounts(c);
  }, []);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 30_000); return () => clearInterval(t); }, [load]);

  const categories = useMemo(() => ["all", ...new Set(stories.map((s) => s.category).filter(Boolean))], [stories]);
  // Only the top ten trending stories in the world are broadcast.
  const topIds = useMemo(() => new Set(topTrending(stories as Array<Row & { importance: number | null }>, TOP_STORIES).map((s) => s.id as string)), [stories]);
  const queue = useMemo(() => stories.filter((s) => topIds.has(s.id) && s.production_status === "ready_to_broadcast" && !skipped.has(s.id) && (catFilter === "all" || s.category === catFilter)), [stories, topIds, skipped, catFilter]);
  const visualsFor = useCallback((id: string) => visuals.filter((v) => v.story_id === id), [visuals]);

  // ── studio layers + draw loop ──
  useEffect(() => {
    const v = document.createElement("video");
    v.src = studioLoop; v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto";
    v.oncanplay = () => { layers.current.bg = v; };
    void v.play().catch(() => null);
    loadImage(studioStill).then((i) => { layers.current.still = i; }).catch(() => null);
    loadImage(deskLayer).then((i) => { layers.current.desk = i; }).catch(() => null);
    loadImage(presenterGreen).then((img) => { const a = img.naturalWidth / img.naturalHeight; layers.current.host = { canvas: new ChromaKeyer(480).key(img, a), aspect: a }; }).catch(() => null);
    setVoiceOk(typeof window !== "undefined" && "speechSynthesis" in window);
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = canvasRef.current; const ctx = c?.getContext("2d"); if (!c || !ctx) return;
      const t = performance.now() / 1000;
      const cam = camRef.current;
      const p = ease(Math.min(1, Math.max(0, (t - cam.at) / CAMERA_MOVE_SECONDS)));
      // Voice-driven movement: decays between word pulses, gentle drift while speaking.
      levelRef.current = speakingRef.current ? Math.max(levelRef.current * 0.9, 0.25 + Math.abs(Math.sin(t * 7)) * 0.25) : levelRef.current * 0.9;
      const L = layers.current;
      drawNewsroom(ctx, {
        t, camera: lerp(cam.from, cam.to, p), bg: L.bg ?? L.still, desk: L.desk, host: L.host?.canvas ?? null, hostAspect: L.host?.aspect ?? 0.53,
        level: levelRef.current, lipSynced: false, screen: screenRef.current, showName: "Oracle News", anchorName: "Oracle",
        headline: headlineRef.current, caption: null /* house rule: no subtitles */, nameLine: nameLineRef.current,
        colors: { gold: css("--primary", "#d4af37"), fg: css("--foreground", "#f5f5f5"), bg: css("--background", "#0b0f14"), shade: css("--secondary", "#16202a"), teal: css("--accent", "#2dd4bf") },
      });
      drawCreditBanner(ctx, creditRef.current, c.width, c.height);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); v.pause(); v.removeAttribute("src"); window.speechSynthesis?.cancel(); };
  }, []);

  const moveCamera = (shot: NewsroomShot) => {
    const t = performance.now() / 1000; const cam = camRef.current;
    const p = ease(Math.min(1, Math.max(0, (t - cam.at) / CAMERA_MOVE_SECONDS)));
    camRef.current = { from: lerp(cam.from, cam.to, p), to: shotRect(shot, "youtube"), at: t };
  };

  /** Puts a section's visual on the wall monitor; any failure drops straight to the fallback. */
  const showVisual = async (plan: PlannedVisual, story: Row, section: ScriptSection, spare: PlannedVisual[]) => {
    const graphic = (): ScreenItem => ({ kind: "text", title: `${section.label}: ${story.headline}` });
    // A real clip of the story: cut to it full screen in YouTube's player, credit banner along the bottom.
    if (plan.kind === "embed") {
      const credit = plan.credit ?? "the original broadcaster";
      setClip((cur) => (cur?.url === plan.url ? cur : { url: plan.url, credit }));
      creditRef.current = credit; setMonitor(`Clip — ${credit}`);
      return;
    }
    setClip(null);
    const tryOne = (pv: PlannedVisual): Promise<ScreenItem | null> => new Promise((resolve) => {
      if (pv.kind === "graphic" || pv.kind === "embed" || failedMedia.current.has(pv.url)) return resolve(null);
      const fail = () => { failedMedia.current.add(pv.url); resolve(null); };
      const timer = setTimeout(fail, 6000);
      if (pv.kind === "image") {
        loadImage(pv.url, true).then((img) => { clearTimeout(timer); resolve({ kind: "image", title: story.headline, img }); }).catch(() => { clearTimeout(timer); fail(); });
      } else {
        const v = document.createElement("video");
        v.crossOrigin = "anonymous"; v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto";
        v.onerror = () => { clearTimeout(timer); fail(); };
        v.oncanplay = () => { clearTimeout(timer); void v.play().catch(() => null); resolve({ kind: "video", title: story.headline, video: v }); };
        v.src = pv.url;
      }
    });
    for (const pv of [plan, ...spare]) {
      const item = await tryOne(pv);
      if (item && pv.kind !== "graphic") { screenRef.current = item; creditRef.current = pv.credit; setMonitor(`${pv.kind === "video" ? "Video" : "Photo"}${pv.credit ? ` — ${pv.credit}` : ""}`); return; }
    }
    screenRef.current = graphic(); creditRef.current = null; setMonitor(`Graphic — ${section.label}`);
  };

  /** Speaks one phrase list with the device voice; resolves when finished or cancelled. */
  const speak = (text: string, run: number) => new Promise<void>((resolve) => {
    const synth = window.speechSynthesis;
    if (!synth) { setTimeout(resolve, Math.max(2000, text.split(/\s+/).length * 380)); return; }
    const phrases = shapeDeviceSpeech(text, "gentle");
    const voice = chooseOracleDeviceVoice(synth.getVoices());
    let i = 0;
    const next = () => {
      if (runRef.current !== run || i >= phrases.length) { speakingRef.current = false; return resolve(); }
      const ph = phrases[i++];
      const u = new SpeechSynthesisUtterance(ph.text);
      if (voice) u.voice = voice as SpeechSynthesisVoice;
      u.lang = voice?.lang || "en-AU"; u.pitch = ph.pitch; u.rate = ph.rate * 0.96;
      u.onstart = () => { speakingRef.current = true; };
      u.onboundary = () => { levelRef.current = 0.9; };
      // Some browsers never fire "end" (or have no voice at all): a timer keeps the broadcast moving.
      let moved = false;
      const go = () => { if (moved) return; moved = true; clearTimeout(guard); next(); };
      const guard = setTimeout(() => { synth.cancel(); go(); }, 4000 + ph.text.split(/\s+/).length * 600);
      u.onend = go; u.onerror = go;
      synth.speak(u);
    };
    next();
  });

  /** Plays one story section by section. Returns false when cancelled. */
  const playStory = async (story: Row, run: number, record: boolean, fromSection = 0): Promise<boolean> => {
    const sections: ScriptSection[] = story.script_sections?.sections ?? [];
    if (!sections.length) return true;
    const vis = visualsFor(story.id).map((v) => ({ ...v, playback_status: failedMedia.current.has(v.media_url) ? "failed" : v.playback_status })) as Visual[];
    const plan = planSectionVisuals(sections, vis);
    const spare = plan.filter((p) => p.kind === "video" || p.kind === "image");
    headlineRef.current = story.headline;
    const sources: string[] = story.script_sections?.attribution ?? [];
    nameLineRef.current = `Oracle · Source: ${sources.slice(0, 2).join(", ") || "Oracle News"}`;
    if (record) void callNews("mark_broadcast", { story_id: story.id, status: "presenter_speaking" }).catch(() => null);
    for (let i = fromSection; i < sections.length; i++) {
      if (runRef.current !== run) return false;
      setCurrent({ story, section: i });
      const s = sections[i];
      const hasVisual = plan[i]?.kind !== "graphic";
      moveCamera(hasVisual || ["what_happened", "where_when", "background", "figures", "what_next"].includes(s.key) ? SHOT_FOR[s.key] ?? "host" : "host");
      await showVisual(plan[i], story, s, spare.filter((p) => p !== plan[i]));
      await speak(s.text, run);
      if (runRef.current !== run) return false;
      // Thank whoever made the clip once it finishes, like a real newsreader.
      const pv = plan[i]; const nx = plan[i + 1];
      if (pv?.kind === "embed" && !(nx?.kind === "embed" && nx.url === pv.url)) {
        await speak(thanksLine(pv.credit), run);
        if (runRef.current !== run) return false;
        setClip(null); creditRef.current = null;
      }
    }
    if (record) {
      await callNews("mark_broadcast", { story_id: story.id, status: "broadcast_complete" }).catch(() => null);
      playedRef.current.push(story.id);
    }
    return true;
  };

  const stopAll = () => { runRef.current++; window.speechSynthesis?.cancel(); speakingRef.current = false; };
  const resetScreen = () => { setClip(null); creditRef.current = null; screenRef.current = { kind: "text", title: "Oracle News" }; headlineRef.current = "Oracle News"; nameLineRef.current = "Oracle · Oracle News"; moveCamera("wide"); setMonitor("Studio"); setCurrent(null); };

  /** Automatic broadcast: plays ready stories in priority order until the broadcast length is used. */
  const startBroadcast = async (fromStory?: Row, fromSection = 0) => {
    stopAll(); const run = runRef.current;
    setMode("auto"); setPaused(false);
    const limitSec = (settings?.duration_minutes ?? 5) * 60;
    const start = performance.now();
    const done = new Set<string>(playedRef.current);
    let story: Row | undefined = fromStory;
    let idleAsks = 0;
    while (runRef.current === run) {
      if (!story) {
        await load();
        const { data } = await supabase.from("news_stories").select("id,headline,category,region,status,verification,script_sections,production_status,importance").gte("last_updated", new Date(Date.now() - 48 * 3600_000).toISOString()).neq("production_status", "expired").order("importance", { ascending: false }).limit(60);
        story = topTrending(data ?? [], TOP_STORIES).filter((s) => s.production_status === "ready_to_broadcast").find((s) => !done.has(s.id) && !skippedRef.current.has(s.id) && (catFilter === "all" || s.category === catFilter));
      }
      if (!story) {
        // Nothing ready: produce the next story instead of sitting idle (daily limit applies).
        if (idleAsks++ >= 2) break;
        setMonitor("Producing the next story…");
        try { const r = await callNews("advance_pipeline", { limit: 1, respect_cap: true }); if (r?.skipped || !r?.produced) break; } catch { break; }
        continue;
      }
      const ok = await playStory(story, run, true, fromSection);
      fromSection = 0;
      if (!ok) return;
      done.add(story.id); story = undefined;
      if ((performance.now() - start) / 1000 > limitSec) break;
    }
    if (runRef.current === run) { setMode("idle"); resetScreen(); toast.success("Broadcast finished."); void load(); }
  };

  const preview = async (story: Row) => {
    stopAll(); const run = runRef.current; setMode("preview"); setPaused(false);
    await playStory(story, run, false);
    if (runRef.current === run) { setMode("idle"); resetScreen(); }
  };
  const pause = () => { stopAll(); setPaused(true); };
  const resume = () => { if (!current) return; mode === "preview" ? void preview(current.story) : void startBroadcast(current.story, current.section); };
  const skip = () => {
    if (!current) return;
    const next = new Set(skippedRef.current).add(current.story.id);
    skippedRef.current = next; setSkipped(next);
    const wasAuto = mode === "auto" && !paused;
    stopAll();
    if (wasAuto) void startBroadcast(); else { setMode("idle"); setPaused(false); resetScreen(); }
  };
  const replay = () => { const id = current?.story.id ?? playedRef.current[playedRef.current.length - 1]; const st = stories.find((s) => s.id === id); if (st) void preview(st); else toast.message("Nothing has been broadcast yet to replay."); };

  const act = async (label: string, action: string, extra: Record<string, unknown> = {}) => {
    setBusy(label);
    try { const r = await callNews(action, extra); await load(); return r; }
    catch (e) { toast.error((e as Error).message.slice(0, 180)); }
    finally { setBusy(null); }
  };
  const produceNext = async () => {
    const pick = stories.find((x) => x.id === selected && ["discovered", "failed"].includes(x.production_status));
    const r = await act("Produce next story", "advance_pipeline", { limit: 1, ...(pick ? { story_ids: [pick.id] } : {}) });
    if (!r) return;
    const res = r.results?.[0];
    if (res?.ok) toast.success(`Ready to broadcast: ${res.headline} (${res.videos} video, ${res.images} photo)`);
    else toast.message(res?.error ?? r.note ?? "Nothing to produce.");
  };
  const runHealth = async () => {
    const r = await act("Run health check", "health_check");
    if (r) {
      const voices = window.speechSynthesis?.getVoices() ?? [];
      const client = [
        { stage: "Presenter narration (this device)", ok: !!window.speechSynthesis && voices.length > 0, detail: window.speechSynthesis ? `${voices.length} device voices; using ${chooseOracleDeviceVoice(voices)?.name ?? "default"}.` : "This browser has no speech voice." },
        { stage: "Studio and monitor drawing", ok: !!layers.current.host && !!layers.current.desk, detail: layers.current.host ? "Presenter, desk and wall monitor loaded." : "Presenter picture didn't load." },
        { stage: "Presenter synchronisation", ok: true, detail: "Monitor and camera change at each spoken section; her photo moves with the voice. Mouth movement needs a paid lip-sync clip, so it isn't shown live." },
      ];
      setHealth({ ...r, checks: [...r.checks, ...client], passed: r.passed + client.filter((c) => c.ok).length, failed: r.failed + client.filter((c) => !c.ok).length });
    }
  };
  const sendToStudio = (story: Row) => {
    const secs: ScriptSection[] = story.script_sections?.sections ?? [];
    // Borrowed clips only play in their own player, so they can't be filmed into a video file.
    const media = visualsFor(story.id).filter((v) => v.rating === "green" && v.media_url && !v.embed_url && v.playback_status !== "failed").map((v) => ({ kind: v.media_type === "image" ? "image" as const : "video" as const, url: v.media_url }));
    onSendToStudio?.({ title: story.headline, script: secs.map((s) => s.text).join("\n\n"), media });
  };

  const live = current?.story;
  const liveSections: ScriptSection[] = live?.script_sections?.sections ?? [];
  const greenCount = visuals.filter((v) => v.rating === "green").length;
  const tiles: Array<[string, string]> = [
    ["Discovered (48 h)", String(stories.length)],
    ["Scripts completed", String(stories.filter((s) => s.script_sections).length)],
    ["Matching visuals", String(greenCount)],
    ["Ready to broadcast", String(counts.ready_to_broadcast ?? 0)],
    ["Broadcasting now", live ? live.headline : "—"],
    ["Presenter", mode === "idle" ? "Waiting" : paused ? "Paused" : speakingRef.current || live ? `Speaking — ${liveSections[current?.section ?? 0]?.label ?? ""}` : "Getting ready"],
    ["Monitor", monitor],
    ["Failed tasks", String(counts.failed ?? 0)],
    ["Last broadcast", lastBroadcast ? when(lastBroadcast.last_broadcast_at) : "never"],
  ];

  const b = (label: string, icon: React.ReactNode, onClick: () => void, disabled = false, variant: "default" | "outline" = "outline") => (
    <Button size="sm" variant={variant} onClick={onClick} disabled={disabled || (!!busy && busy !== label)}>
      {busy === label ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : icon} {label}
    </Button>
  );

  return (
    <Card className="p-4 space-y-4 border-primary/40">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-primary/10"><Radio className="w-6 h-6 text-primary" /></div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-primary">Oracle News — Broadcast Control Centre</h2>
          <p className="text-xs text-muted-foreground">Oracle covers the top {TOP_STORIES} trending stories in the world. When a real clip of the story exists she cuts to it with the credit banner along the bottom and thanks whoever made it. Owner only. Live playback uses this device's free voice; her mouth doesn't move. Borrowed clips play in YouTube's own player, so they show live and on the website but can't be filmed into a video file.</p>
        </div>
      </div>

      <div className="relative w-full rounded-xl overflow-hidden border border-border bg-background aspect-video">
        <canvas ref={canvasRef} width={SCENE.width} height={SCENE.height} className="absolute inset-0 w-full h-full" aria-label="Oracle News live studio" />
        {clip && (
          <div className="absolute inset-0 bg-background">
            <iframe key={clip.url} src={clipPlayerUrl(clip.url, { autoplay: true, muted: true })} title={`News clip from ${clip.credit}`} className="absolute inset-0 w-full h-full" allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" />
            <CreditBanner credit={clip.credit} className="absolute left-[3%] right-[3%] bottom-[2%] pointer-events-none" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {mode === "idle" || paused
          ? b(paused ? "Resume" : "Start Broadcast", <Play className="w-4 h-4 mr-1" />, () => (paused ? resume() : void startBroadcast()), false, "default")
          : b("Pause", <Pause className="w-4 h-4 mr-1" />, pause)}
        {b("Skip Story", <SkipForward className="w-4 h-4 mr-1" />, skip, !current)}
        {b("Replay Story", <RotateCcw className="w-4 h-4 mr-1" />, replay)}
        {b("Produce next story", <Cog className="w-4 h-4 mr-1" />, () => void produceNext())}
        {b("Run health check", <Stethoscope className="w-4 h-4 mr-1" />, () => void runHealth())}
        {(mode !== "idle" || paused) && <Button size="sm" variant="ghost" onClick={() => { stopAll(); setPaused(false); setMode("idle"); resetScreen(); }}>Stop</Button>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {tiles.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border p-2 min-w-0"><p className="text-[10px] text-muted-foreground">{k}</p><p className="text-sm font-semibold break-words line-clamp-2">{v}</p></div>
        ))}
      </div>

      {settings && (
        <div className="rounded-xl border border-border p-3 flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-2"><Switch checked={!!settings.auto_pipeline} onCheckedChange={(v) => { setSettings({ ...settings, auto_pipeline: v }); void act("save", "save_pipeline", { auto_pipeline: v, pipeline_daily_cap: settings.pipeline_daily_cap }); }} /> Produce stories during the daily news scan</label>
          <label className="flex items-center gap-2">Daily limit <Input type="number" min={0} max={40} className="w-20 h-8" value={settings.pipeline_daily_cap} onChange={(e) => setSettings({ ...settings, pipeline_daily_cap: Number(e.target.value) })} onBlur={() => void act("save", "save_pipeline", { auto_pipeline: !!settings.auto_pipeline, pipeline_daily_cap: Math.max(0, Math.min(40, settings.pipeline_daily_cap)) })} /></label>
          <label className="flex items-center gap-2">Show
            <select className="rounded-md border border-input bg-background p-1" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              {categories.map((c) => <option key={c} value={c}>{c === "all" ? "All categories" : c}</option>)}
            </select>
          </label>
          <span className="text-muted-foreground">Broadcast length: {settings.duration_minutes} min (change under Settings below). Each written story uses a small amount of AI credit.</span>
        </div>
      )}

      {health && (
        <div className="rounded-xl border border-border p-3 space-y-1">
          <p className="text-sm font-semibold">Health check — {health.passed} passed, {health.failed} failed</p>
          {health.checks.map((c: Row) => (
            <div key={c.stage} className="text-[11px] flex gap-2 items-start">
              {c.ok ? <CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> : <XCircle className="w-4 h-4 text-destructive shrink-0" />}
              <span><span className="font-medium">{c.stage}:</span> {c.detail}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-semibold">Production queue <span className="text-xs text-muted-foreground font-normal">({queue.length} ready to broadcast)</span></p>
        <div className="flex flex-wrap gap-1 text-[10px]">
          {(Object.keys(STAGE_LABEL) as Stage[]).filter((k) => k !== "expired" && counts[k]).map((k) => <Badge key={k} variant={stageVariant(k)}>{STAGE_LABEL[k]}: {counts[k]}</Badge>)}
        </div>
        {stories.filter((s) => s.production_status !== "discovered" || s.id === selected).slice(0, 30).map((s) => {
          const secs: ScriptSection[] = s.script_sections?.sections ?? [];
          const vis = visualsFor(s.id).filter((v) => v.rating === "green");
          const open = selected === s.id;
          return (
            <div key={s.id} className={`rounded-lg border p-2 space-y-1 ${live?.id === s.id ? "border-primary" : "border-border"}`}>
              <button type="button" className="w-full text-left space-y-1" onClick={() => setSelected(open ? null : s.id)}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={stageVariant(s.production_status)}>{STAGE_LABEL[s.production_status as Stage] ?? s.production_status}</Badge>
                  {s.public_at && <Badge variant="outline"><Globe className="w-3 h-3 mr-1" />On website</Badge>}
                  {topIds.has(s.id) && <Badge variant="outline">Top {TOP_STORIES}</Badge>}
                  <span className="text-[10px] text-muted-foreground">{s.category ?? "general"} · score {s.importance} · {vis.length} visual{vis.length === 1 ? "" : "s"}{s.broadcast_count ? ` · aired ${s.broadcast_count}×` : ""}</span>
                </div>
                <p className="text-sm">{s.headline}</p>
                {s.production_error && <p className="text-[11px] text-destructive">{s.production_error}</p>}
              </button>
              {open && (
                <div className="space-y-2 pt-1">
                  {secs.map((sec) => (
                    <div key={sec.key} className="text-[11px]"><span className="font-medium text-primary">{sec.label}: </span>{sec.text}</div>
                  ))}
                  {s.content_checked?.note && <p className="text-[10px] text-muted-foreground">{s.content_checked.note}</p>}
                  {(s.content_checked?.sources ?? []).map((src: Row) => <p key={src.url} className="text-[10px]"><a className="text-primary underline" href={src.url} target="_blank" rel="noreferrer">{src.publisher}</a> · {when(src.published_at)}</p>)}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {visualsFor(s.id).filter((v) => v.source_kind === "youtube_clip" && v.rating !== "red").map((v) => (
                      <div key={v.id} className="rounded border border-primary/50 p-1 space-y-1">
                        <a href={v.url} target="_blank" rel="noreferrer" className="block relative">
                          {v.thumbnail_url ? <img src={v.thumbnail_url} alt={v.title} className="w-full aspect-video object-cover rounded" loading="lazy" /> : <div className="w-full aspect-video rounded bg-secondary" />}
                          <CreditBanner compact credit={v.attribution ?? "YouTube"} className="absolute left-1 right-1 bottom-1 pointer-events-none" />
                        </a>
                        <p className="text-[9px] text-muted-foreground line-clamp-2">Real clip · {v.title}</p>
                        <div className="flex gap-1"><a href={v.url} target="_blank" rel="noreferrer" className="text-[9px] text-primary underline">Source</a><button type="button" className="text-[9px] text-destructive underline ml-auto" onClick={() => void act("remove", "remove_visual", { footage_id: v.id })}>Wrong clip — remove</button></div>
                      </div>
                    ))}
                    {vis.map((v) => (
                      <div key={v.id} className="rounded border border-border p-1 space-y-1">
                        {v.media_type === "image" ? <img src={v.media_url} alt={v.title} className="w-full aspect-video object-cover rounded" loading="lazy" /> : <video src={v.media_url} muted playsInline controls preload="metadata" className="w-full aspect-video rounded" />}
                        <p className="text-[9px] text-muted-foreground line-clamp-2">{v.section ? `${v.section.replace(/_/g, " ")} · ` : ""}{v.attribution}</p>
                        <div className="flex gap-1"><a href={v.url} target="_blank" rel="noreferrer" className="text-[9px] text-primary underline">Source</a><button type="button" className="text-[9px] text-destructive underline ml-auto" onClick={() => void act("remove", "remove_visual", { footage_id: v.id })}>Not relevant — remove</button></div>
                      </div>
                    ))}
                  </div>
                  {!vis.length && !visualsFor(s.id).some((v) => v.source_kind === "youtube_clip" && v.rating !== "red") && secs.length > 0 && <p className="text-[10px] text-muted-foreground">No licensed footage found — the monitor will show news graphics for this story.</p>}
                  <div className="flex flex-wrap gap-2">
                    {b("Preview Story", <Eye className="w-4 h-4 mr-1" />, () => void preview(s), !secs.length)}
                    {b("Broadcast from here", <Play className="w-4 h-4 mr-1" />, () => void startBroadcast(s), !PLAYABLE.includes(s.production_status))}
                    {b("Regenerate Script", <PenLine className="w-4 h-4 mr-1" />, () => void act("Regenerate Script", "regenerate_script", { story_id: s.id }))}
                    {b("Retry Footage Search", <Film className="w-4 h-4 mr-1" />, () => void act("Retry Footage Search", "retry_footage", { story_id: s.id }), !secs.length)}
                    {s.production_status === "failed" && b("Retry", <RotateCcw className="w-4 h-4 mr-1" />, () => void act("Retry", "advance_pipeline", { limit: 1, story_ids: [s.id] }))}
                    {onSendToStudio && b("Film in studio", <Clapperboard className="w-4 h-4 mr-1" />, () => sendToStudio(s), !secs.length)}
                    {secs.length > 0 && b(s.public_at ? "Remove from website" : "Publish to website", <Globe className="w-4 h-4 mr-1" />, () => void act(s.public_at ? "Remove from website" : "Publish to website", "set_public", { story_id: s.id, public: !s.public_at }))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {stories.filter((s) => s.production_status === "discovered").length > 0 && (
          <p className="text-[11px] text-muted-foreground">Only the top {TOP_STORIES} trending stories get produced and broadcast; {stories.filter((s) => s.production_status === "discovered" && !topIds.has(s.id)).length} others are outside the top {TOP_STORIES} right now (up to {settings?.pipeline_daily_cap ?? 10} written a day). Stories older than 36 hours are closed off as "not used".</p>
        )}
      </div>
      {voiceOk === false && <p className="text-xs text-destructive">This browser has no speech voice, so the presenter can't speak here. Try Chrome on your phone or computer.</p>}
    </Card>
  );
};

export default NewsBroadcastCentre;
