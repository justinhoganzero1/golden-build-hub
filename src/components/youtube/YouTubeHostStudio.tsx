import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Download, Loader2, Mic, Save, Upload, Video, Square } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useUserAvatars } from "@/hooks/useUserAvatars";
import { narrateText, NarrationError } from "@/lib/storyNarration";
import { uploadCreationFile } from "@/lib/oracleCreationFiles";
import { saveToLibrary } from "@/lib/saveToLibrary";
import {
  canvasSizeFor, hostBox, lineAt, pickRecorderType, slideBeats, splitSentences, timeSentences, wrapText,
  type HostFormat, type HostLayout, type TimedLine,
} from "@/lib/youtubeHost";
import oraclePortrait from "@/assets/avatars/oracle-futuristic-office.jpg";
import NewsroomHostStudio from "./NewsroomHostStudio";

interface Props {
  script: string;
  title: string;
  channelName: string;
  voiceId: string | null;
  voiceName: string | null;
}

function cssColor(name: string, fallback: string, alpha = 1): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback;
  return alpha < 1 ? `hsl(${raw} / ${alpha})` : `hsl(${raw})`;
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, zoom = 1, dx = 0, dy = 0) {
  const ir = img.naturalWidth / img.naturalHeight;
  const br = w / h;
  let sw = img.naturalWidth, sh = img.naturalHeight;
  if (ir > br) sw = sh * br; else sh = sw / br;
  sw /= zoom; sh /= zoom;
  const sx = (img.naturalWidth - sw) / 2 - dx * (sw / w);
  const sy = Math.max(0, (img.naturalHeight - sh) * 0.3 - dy * (sh / h));
  ctx.drawImage(img, Math.max(0, sx), Math.min(sy, img.naturalHeight - sh), sw, sh, x, y, w, h);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const SimpleHostStudio = ({ script, title, channelName, voiceId, voiceName }: Props) => {
  const { user } = useAuth();
  const { data: avatars = [] } = useUserAvatars() as { data?: Array<{ id: string; name: string; image_url: string | null }> };
  const [hostSrc, setHostSrc] = useState<string>(oraclePortrait);
  const [format, setFormat] = useState<HostFormat>("youtube");
  const [layout, setLayout] = useState<HostLayout>("corner");
  const [captions, setCaptions] = useState(true);
  const [narrating, setNarrating] = useState(false);
  const [narrationPct, setNarrationPct] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioScript, setAudioScript] = useState("");
  const [filming, setFilming] = useState(false);
  const [filmPct, setFilmPct] = useState(0);
  const [result, setResult] = useState<{ blob: Blob; url: string; ext: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const linesRef = useRef<TimedLine[]>([]);
  const levelRef = useRef(0);
  const stopRef = useRef<(() => void) | null>(null);

  const size = canvasSizeFor(format);
  const beats = useMemo(() => slideBeats(script), [script]);
  const voiceStale = !!audioUrl && audioScript !== script;

  // Load host picture.
  useEffect(() => {
    const img = new Image();
    img.onload = () => { imgRef.current = img; };
    img.src = hostSrc;
  }, [hostSrc]);

  useEffect(() => () => { stopRef.current?.(); }, []);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  const drawFrame = (t: number, speaking: boolean) => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { width, height } = canvas;
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, cssColor("--background", "#0b0f14"));
    bg.addColorStop(1, cssColor("--secondary", "#16202a"));
    ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);

    const gold = cssColor("--primary", "#d4af37");
    const fg = cssColor("--foreground", "#f5f5f5");
    const box = hostBox(format, layout);
    const img = imgRef.current;
    // Gentle sway + breathing; louder speech = a little more movement. No mouth movement.
    const lvl = speaking ? levelRef.current : 0;
    const zoom = 1.04 + Math.sin(t * 0.9) * 0.008 + lvl * 0.012;
    const dx = Math.sin(t * 0.6) * 6 + Math.sin(t * 2.3) * lvl * 4;
    const dy = Math.cos(t * 0.8) * 3 - lvl * 3;

    if (layout === "corner") {
      // Slide side: episode title + current beat list.
      const pad = 56;
      const textW = format === "shorts" ? width - pad * 2 : box.x - pad * 1.5;
      ctx.fillStyle = gold; ctx.font = `700 ${format === "shorts" ? 46 : 44}px Georgia, serif`;
      const titleLines = wrapText(title || "My episode", textW, (s) => ctx.measureText(s).width, 2);
      titleLines.forEach((l, i) => ctx.fillText(l, pad, pad + 40 + i * 52));
      const cur = lineAt(linesRef.current, t);
      const progress = cur && linesRef.current.length ? linesRef.current.indexOf(cur) / linesRef.current.length : 0;
      const activeBeat = Math.min(beats.length - 1, Math.floor(progress * beats.length));
      ctx.font = `500 ${format === "shorts" ? 30 : 28}px system-ui, sans-serif`;
      let y = pad + 60 + titleLines.length * 52;
      beats.forEach((b, i) => {
        ctx.fillStyle = i === activeBeat && speaking ? gold : cssColor("--foreground", "#ddd", 0.75);
        const ls = wrapText(`• ${b}`, textW, (s) => ctx.measureText(s).width, 2);
        ls.forEach((l) => { ctx.fillText(l, pad, y); y += 38; });
        y += 10;
      });
      if (img) {
        ctx.save(); roundRect(ctx, box.x, box.y, box.w, box.h, 24); ctx.clip();
        drawCover(ctx, img, box.x, box.y, box.w, box.h, zoom, dx, dy);
        ctx.restore();
        ctx.strokeStyle = gold; ctx.lineWidth = 3 + lvl * 3;
        roundRect(ctx, box.x, box.y, box.w, box.h, 24); ctx.stroke();
      }
    } else if (img) {
      drawCover(ctx, img, 0, 0, width, height, zoom, dx, dy);
      ctx.fillStyle = cssColor("--background", "#000", 0.35);
      ctx.fillRect(0, 0, width, 90);
      ctx.fillStyle = gold; ctx.font = `700 34px Georgia, serif`;
      ctx.fillText(wrapText(title || "My episode", width - 80, (s) => ctx.measureText(s).width, 1)[0] || "", 40, 58);
    }

    if (channelName) {
      ctx.font = `600 22px system-ui, sans-serif`; ctx.fillStyle = fg;
      const w = ctx.measureText(channelName).width;
      ctx.fillText(channelName, width - w - 28, layout === "full" ? 56 : 40);
    }

    if (captions && speaking) {
      const cur = lineAt(linesRef.current, t);
      if (cur) {
        ctx.font = `700 ${format === "shorts" ? 38 : 34}px system-ui, sans-serif`;
        const ls = wrapText(cur.text, width - 120, (s) => ctx.measureText(s).width, 2);
        const lh = format === "shorts" ? 48 : 44;
        const boxH = ls.length * lh + 28;
        const top = height - boxH - (format === "shorts" ? 120 : layout === "corner" ? 24 : 36);
        ctx.fillStyle = cssColor("--background", "#000", 0.72);
        roundRect(ctx, 40, top, width - 80 - (layout === "corner" && format === "youtube" ? box.w + 24 : 0), boxH, 16); ctx.fill();
        ctx.fillStyle = fg;
        ls.forEach((l, i) => ctx.fillText(l, 60, top + 40 + i * lh));
      }
    }
  };

  // Idle preview loop.
  useEffect(() => {
    if (filming) return;
    let raf = 0; const start = performance.now();
    const loop = () => { drawFrame((performance.now() - start) / 1000, false); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filming, format, layout, captions, title, channelName, beats, hostSrc]);

  const onUpload = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose a photo."); return; }
    setHostSrc(URL.createObjectURL(file));
  };

  const makeVoice = async () => {
    if (!script.trim()) { toast.error("Write or generate a script first."); return; }
    setNarrating(true); setNarrationPct(0); setResult(null); setSavedId(null);
    try {
      const bytes = await narrateText(script, setNarrationPct, voiceId ? { voiceId } : undefined);
      const blob = new Blob([bytes as BlobPart], { type: "audio/mpeg" });
      setAudioUrl(URL.createObjectURL(blob));
      setAudioScript(script);
      toast.success("Host voice ready. Charged to your wallet.");
    } catch (e) {
      toast.error(e instanceof NarrationError ? e.message : "Couldn't make the voice. Nothing was saved.");
    } finally { setNarrating(false); }
  };

  const film = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !audioUrl) return;
    const type = pickRecorderType((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
    if (!type || !canvas.captureStream) { toast.error("This browser can't record video. Try Chrome on a computer or phone."); return; }

    setFilming(true); setFilmPct(0); setResult(null); setSavedId(null);
    const audio = new Audio(audioUrl);
    audio.crossOrigin = "anonymous";
    await new Promise<void>((res, rej) => { audio.onloadedmetadata = () => res(); audio.onerror = () => rej(new Error("audio")); }).catch(() => null);
    const duration = audio.duration || 1;
    linesRef.current = timeSentences(splitSentences(script), duration);

    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const ac: AudioContext = new AC();
    const src = ac.createMediaElementSource(audio);
    const analyser = ac.createAnalyser(); analyser.fftSize = 512;
    const dest = ac.createMediaStreamDestination();
    src.connect(analyser); analyser.connect(ac.destination); src.connect(dest);
    const data = new Uint8Array(analyser.fftSize);

    const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const rec = new MediaRecorder(stream, { mimeType: type.mime, videoBitsPerSecond: 5_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

    let raf = 0; let cancelled = false;
    const loop = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0; for (const v of data) { const d = (v - 128) / 128; sum += d * d; }
      levelRef.current = levelRef.current * 0.7 + Math.min(1, Math.sqrt(sum / data.length) * 4) * 0.3;
      drawFrame(audio.currentTime, true);
      setFilmPct(Math.min(100, Math.round((audio.currentTime / duration) * 100)));
      raf = requestAnimationFrame(loop);
    };
    const finish = () => new Promise<void>((res) => { rec.onstop = () => res(); if (rec.state !== "inactive") rec.stop(); else res(); });
    stopRef.current = () => { cancelled = true; audio.pause(); };

    try {
      await ac.resume();
      rec.start(1000);
      raf = requestAnimationFrame(loop);
      await audio.play();
      await new Promise<void>((res) => { audio.onended = () => res(); audio.onpause = () => res(); });
      await new Promise((r) => setTimeout(r, 400));
      cancelAnimationFrame(raf);
      await finish();
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
      stopRef.current = null;
      setFilming(false);
    }
  };

  const save = async () => {
    if (!result || !user) return;
    setSaving(true);
    try {
      const label = title || "youtube-episode";
      const url = await uploadCreationFile(result.blob, user.id, label, result.ext);
      if (!url) throw new Error("upload");
      const id = await saveToLibrary({
        media_type: "video", title: `${title || "YouTube episode"} (${format === "shorts" ? "Shorts" : "YouTube"})`, url,
        source_page: "/youtube-show-studio",
        metadata: { kind: "youtube_host", format, layout, captions, voice: voiceName || "default", host: "animated photo (no lip-sync)", mime_type: result.blob.type },
      });
      setSavedId(id || "queued");
      toast.success("Saved to your Library.");
    } catch {
      toast.error("Couldn't save to your Library. Your video is still here — try again or download it.");
    } finally { setSaving(false); }
  };

  const choice = (active: boolean) => `px-3 py-1.5 rounded-lg border text-xs ${active ? "border-primary bg-primary/10 text-primary" : "border-border"}`;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Camera className="w-4 h-4 text-primary" /> Host on camera
      </div>
      <p className="text-xs text-muted-foreground">
        Your host appears on screen reading your script, with captions and your episode points. The host is an animated photo that moves gently with the voice — it is not lip-synced.
      </p>

      <div className="space-y-2">
        <p className="text-xs font-medium">1. Pick your host</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setHostSrc(oraclePortrait)} className={`w-16 h-16 rounded-xl overflow-hidden border-2 ${hostSrc === oraclePortrait ? "border-primary" : "border-border"}`} aria-label="Oracle as host">
            <img src={oraclePortrait} alt="Oracle" className="w-full h-full object-cover" />
          </button>
          {avatars.filter((a) => a.image_url).slice(0, 12).map((a) => (
            <button key={a.id} type="button" onClick={() => setHostSrc(a.image_url!)} className={`w-16 h-16 rounded-xl overflow-hidden border-2 ${hostSrc === a.image_url ? "border-primary" : "border-border"}`} aria-label={`${a.name} as host`}>
              <img src={a.image_url!} alt={a.name} className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
          <label className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center text-[10px] text-muted-foreground cursor-pointer">
            <Upload className="w-4 h-4 mb-0.5" /> Photo
            <Input type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e.target.files?.[0])} />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium">Shape</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={choice(format === "youtube")} onClick={() => setFormat("youtube")}>YouTube (wide)</button>
            <button type="button" className={choice(format === "shorts")} onClick={() => setFormat("shorts")}>Shorts (tall)</button>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium">Host position</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={choice(layout === "corner")} onClick={() => setLayout("corner")}>Corner + points</button>
            <button type="button" className={choice(layout === "full")} onClick={() => setLayout("full")}>Full screen</button>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs self-end">
          <Switch checked={captions} onCheckedChange={setCaptions} /> Captions
        </label>
      </div>

      <div className={`mx-auto rounded-xl overflow-hidden border border-border bg-muted ${format === "shorts" ? "max-w-[260px]" : "w-full"}`}>
        <canvas ref={canvasRef} width={size.width} height={size.height} className="w-full h-auto block" aria-label="Host preview" />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium">2. Make the host's voice</p>
        <p className="text-[11px] text-muted-foreground">
          Voice: {voiceName || "Default narrator"}. This uses premium voice and is charged to your wallet at cost plus our margin.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <Button size="sm" onClick={makeVoice} disabled={narrating || filming || !script.trim()}>
            {narrating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Mic className="w-4 h-4 mr-1" />}
            {narrating ? `Making voice ${narrationPct}%` : audioUrl ? "Remake voice" : "Make voice"}
          </Button>
          {audioUrl && <audio src={audioUrl} controls className="h-9 max-w-full" />}
        </div>
        {voiceStale && <p className="text-[11px] text-destructive">The script changed after the voice was made. Remake the voice so they match.</p>}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium">3. Film the episode</p>
        <p className="text-[11px] text-muted-foreground">Filming plays in real time, so keep this screen open until it finishes. Filming itself is free.</p>
        <div className="flex flex-wrap gap-2 items-center">
          <Button size="sm" onClick={film} disabled={!audioUrl || filming || narrating}>
            {filming ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Video className="w-4 h-4 mr-1" />}
            {filming ? `Filming ${filmPct}%` : "Film episode"}
          </Button>
          {filming && (
            <Button size="sm" variant="outline" onClick={() => stopRef.current?.()}>
              <Square className="w-4 h-4 mr-1" /> Stop
            </Button>
          )}
        </div>
      </div>

      {result && (
        <div className="space-y-2">
          <p className="text-xs font-medium">4. Watch, then keep it</p>
          <video src={result.url} controls playsInline className={`rounded-lg border border-border ${format === "shorts" ? "max-w-[260px]" : "w-full"}`} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <a href={result.url} download={`${(title || "youtube-episode").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.${result.ext}`}>
                <Download className="w-4 h-4 mr-1" /> Download
              </a>
            </Button>
            <Button size="sm" onClick={save} disabled={saving || !!savedId}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              {savedId ? "Saved to Library" : "Save to Library"}
            </Button>
          </div>
          {result.ext === "webm" && <p className="text-[11px] text-muted-foreground">This browser films in WebM. YouTube accepts it as-is.</p>}
        </div>
      )}
    </Card>
  );
};

type StudioStyle = "newsroom" | "simple";
const STYLE_KEY = "oracle-lunar:youtube-host-style";

/** Newsroom (like the ad) is the default; the original simple layouts stay available. */
const YouTubeHostStudio = (props: Props) => {
  const [style, setStyle] = useState<StudioStyle>(() => {
    try { return localStorage.getItem(STYLE_KEY) === "simple" ? "simple" : "newsroom"; } catch { return "newsroom"; }
  });
  const pick = (s: StudioStyle) => { setStyle(s); try { localStorage.setItem(STYLE_KEY, s); } catch { /* ignore */ } };
  const choice = (active: boolean) => `px-3 py-1.5 rounded-lg border text-xs ${active ? "border-primary bg-primary/10 text-primary" : "border-border"}`;
  const toggle = (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Studio style">
      <button type="button" className={choice(style === "newsroom")} onClick={() => pick("newsroom")}>Newsroom studio</button>
      <button type="button" className={choice(style === "simple")} onClick={() => pick("simple")}>Simple</button>
    </div>
  );
  if (style === "simple") return <div className="space-y-2">{toggle}<SimpleHostStudio {...props} /></div>;
  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Camera className="w-4 h-4 text-primary" /> Host on camera
      </div>
      {toggle}
      <NewsroomHostStudio {...props} />
    </Card>
  );
};

export default YouTubeHostStudio;
