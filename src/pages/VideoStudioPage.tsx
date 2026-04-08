import { useEffect, useRef, useState } from "react";
import { Film, Clapperboard, Wand2, Upload, Sparkles, Loader2, Play, Pause, Clock, DollarSign, Download } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
import { useMute } from "@/contexts/MuteContext";

const VIDEO_GEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-gen`;
const COST_PER_MINUTE = 0.50;
const PREVIEW_MIN_SECONDS = 6;
const PREVIEW_MAX_SECONDS = 12;
const PREVIEW_FPS = 24;

const templates = [
  { title: "Cinematic Intro", style: "Dark & Moody", prompt: "A cinematic dark moody establishing shot with dramatic lighting, slow camera dolly forward through fog" },
  { title: "Social Media Ad", style: "Bright & Bold", prompt: "A bright vibrant product showcase with smooth rotating camera movement, bold colors, clean background" },
  { title: "Documentary", style: "Clean & Minimal", prompt: "A sweeping aerial drone shot over a beautiful natural landscape, golden hour light, slow camera movement" },
  { title: "Music Video", style: "Vibrant & Dynamic", prompt: "An energetic neon-lit scene with dynamic camera movement, vibrant lights pulsing, urban nightlife" },
];

const RESOLUTIONS = ["1080p HD", "4K Ultra HD", "8K Cinema"];

const pickMimeType = () => {
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "video/webm";
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load generated frame"));
    img.src = src;
  });

const getCanvasSize = (resolution: string) => {
  switch (resolution) {
    case "8K Cinema":
      return { width: 1280, height: 720 };
    case "4K Ultra HD":
      return { width: 1152, height: 648 };
    default:
      return { width: 960, height: 540 };
  }
};

const getPreviewLength = (minutes: number) => Math.min(PREVIEW_MAX_SECONDS, Math.max(PREVIEW_MIN_SECONDS, minutes * 2));

const drawCoverImage = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  progress: number,
) => {
  const { width, height } = canvas;
  const imageRatio = image.width / image.height;
  const canvasRatio = width / height;

  let drawWidth = width;
  let drawHeight = height;

  if (imageRatio > canvasRatio) {
    drawHeight = height;
    drawWidth = height * imageRatio;
  } else {
    drawWidth = width;
    drawHeight = width / imageRatio;
  }

  const zoom = 1 + progress * 0.14;
  const driftX = Math.sin(progress * Math.PI) * width * 0.035;
  const driftY = (0.5 - progress) * height * 0.03;
  const scaledWidth = drawWidth * zoom;
  const scaledHeight = drawHeight * zoom;
  const x = (width - scaledWidth) / 2 - driftX;
  const y = (height - scaledHeight) / 2 - driftY;

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, x, y, scaledWidth, scaledHeight);

  const vignette = ctx.createRadialGradient(width / 2, height / 2, height * 0.15, width / 2, height / 2, height * 0.75);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.34)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
};

const renderPlayablePreview = async (
  imageSrc: string,
  resolution: string,
  minutes: number,
  onProgress: (progress: number) => void,
) => {
  const image = await loadImage(imageSrc);
  const { width, height } = getCanvasSize(resolution);
  const previewSeconds = getPreviewLength(minutes);

  return new Promise<string>((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Video canvas is not available"));
      return;
    }

    const stream = canvas.captureStream(PREVIEW_FPS);
    const chunks: BlobPart[] = [];
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 3_000_000 });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    recorder.onerror = () => reject(new Error("Video recorder failed"));

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      resolve(URL.createObjectURL(blob));
    };

    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      const progress = Math.min(elapsed / previewSeconds, 1);
      onProgress(progress);
      drawCoverImage(ctx, canvas, image, progress);

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        onProgress(1);
        recorder.stop();
      }
    };

    drawCoverImage(ctx, canvas, image, 0);
    recorder.start(250);
    requestAnimationFrame(tick);
  });
};

const VideoStudioPage = () => {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedFrame, setGeneratedFrame] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(1);
  const [resolution, setResolution] = useState("8K Cinema");
  const [generationPhase, setGenerationPhase] = useState("");
  const [renderProgress, setRenderProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isMuted } = useMute();

  useEffect(() => {
    return () => {
      if (videoUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  const generateVideo = async (p: string) => {
    if (!p.trim()) return;

    setIsGenerating(true);
    setIsPlaying(false);
    setGeneratedFrame(null);
    setRenderProgress(0);
    setGenerationPhase("Generating cinematic keyframe...");

    setVideoUrl((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return null;
    });

    try {
      const resp = await fetch(VIDEO_GEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ prompt: p, duration: duration * 60, resolution }),
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        toast.error(data.error || "Generation failed");
        return;
      }

      if (!data.image_url) {
        toast.error("No video frame was returned");
        return;
      }

      setGeneratedFrame(data.image_url);
      setGenerationPhase("Rendering playable video preview...");

      const clipUrl = await renderPlayablePreview(data.image_url, resolution, duration, setRenderProgress);
      setVideoUrl(clipUrl);
      setGenerationPhase("");
      toast.success("Playable video generated");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to generate video");
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlayback = async () => {
    if (!videoRef.current || !videoUrl) return;

    try {
      if (videoRef.current.paused) {
        await videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    } catch {
      toast.error("Could not play video");
    }
  };

  const estimatedCost = (duration * COST_PER_MINUTE).toFixed(2);
  const previewLength = getPreviewLength(duration);

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Film className="w-7 h-7 text-primary" /></div>
          <div>
            <h1 className="text-xl font-bold text-primary">Video Studio</h1>
            <p className="text-muted-foreground text-xs">AI-powered 8K video creation</p>
          </div>
        </div>

        <div className="aspect-video bg-card border border-primary/30 rounded-xl mb-4 overflow-hidden relative">
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-cover"
              muted={isMuted}
              loop
              playsInline
              controls={false}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />
          ) : generatedFrame ? (
            <img src={generatedFrame} alt="Generated video frame" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-secondary/30">
              <div className="text-center px-6">
                {isGenerating ? (
                  <>
                    <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">{generationPhase}</p>
                  </>
                ) : (
                  <>
                    <Film className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Create your first video</p>
                  </>
                )}
              </div>
            </div>
          )}

          {(generatedFrame || videoUrl) && (
            <button
              onClick={togglePlayback}
              disabled={!videoUrl || isGenerating}
              className="absolute inset-0 flex items-center justify-center bg-black/20 disabled:cursor-not-allowed"
              aria-label={isPlaying ? "Pause video" : "Play video"}
            >
              {isGenerating ? (
                <div className="rounded-full bg-black/55 px-4 py-2 text-[11px] font-medium text-white">
                  Rendering {Math.round(renderProgress * 100)}%
                </div>
              ) : isPlaying ? (
                <Pause className="w-14 h-14 text-white drop-shadow-lg" />
              ) : (
                <Play className="w-14 h-14 text-white drop-shadow-lg" />
              )}
            </button>
          )}

          <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full">{resolution}</span>

          {videoUrl && (
            <a href={videoUrl} download="golden-build-video.webm" className="absolute bottom-2 right-2 bg-primary text-primary-foreground p-2 rounded-full">
              <Download className="w-4 h-4" />
            </a>
          )}
        </div>

        {(generationPhase || isGenerating) && (
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
              <span className="text-xs text-primary font-medium truncate">{generationPhase || "Working..."}</span>
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">{Math.round(renderProgress * 100)}%</span>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <h3 className="text-xs font-semibold text-foreground mb-3">Video Settings</h3>
          <div className="flex gap-2 mb-3">
            {RESOLUTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setResolution(r)}
                className={`flex-1 py-2 rounded-lg text-[10px] font-medium transition-colors ${resolution === r ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Duration:</span>
            <input type="range" min={1} max={30} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="flex-1 accent-primary" />
            <span className="text-xs text-foreground font-medium">{duration} min</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Estimated cost:</span>
            <span className="text-xs text-primary font-bold">${estimatedCost}</span>
            <span className="text-[10px] text-muted-foreground">($0.50/min)</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">Preview clip length: {previewLength}s</p>
        </div>

        <div className="bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3"><Wand2 className="w-5 h-5 text-primary" /><h3 className="text-foreground font-semibold text-sm">Create with AI</h3></div>
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generateVideo(prompt)}
            placeholder="Describe your video scene..."
            className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary mb-3"
          />
          <button
            onClick={() => generateVideo(prompt)}
            disabled={isGenerating || !prompt.trim()}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isGenerating ? "Generating video..." : `Generate ${resolution} Video — $${estimatedCost}`}
          </button>
        </div>

        <button className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-4 mb-6">
          <Upload className="w-6 h-6 text-primary" />
          <div className="text-left"><h3 className="text-sm font-semibold text-foreground">Upload & Edit</h3><p className="text-xs text-muted-foreground">Import your own footage</p></div>
        </button>

        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Quick Templates</h2>
        <div className="grid grid-cols-2 gap-3">
          {templates.map((t) => (
            <button
              key={t.title}
              onClick={() => {
                setPrompt(t.prompt);
                generateVideo(t.prompt);
              }}
              disabled={isGenerating}
              className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary transition-colors disabled:opacity-50"
            >
              <Clapperboard className="w-6 h-6 text-primary mb-2" />
              <h3 className="text-sm font-semibold text-foreground">{t.title}</h3>
              <p className="text-[10px] text-muted-foreground">{t.style}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VideoStudioPage;
