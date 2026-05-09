import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { saveToLibrary } from "@/lib/saveToLibrary";
import { PublishSellControls, defaultPublishSellState, type PublishSellState } from "@/components/PublishSellControls";
import {
  Wand2, Loader2, Sparkles, Sliders, Scissors, RotateCw, FlipHorizontal, FlipVertical,
  Sun, Contrast, Droplet, Palette, Eraser, Maximize2, Image as ImageIcon, Brush,
  Zap, Snowflake, Flame, Camera, Aperture, Wind, Star, Download, Save, X, Undo2,
  Redo2, Crop, Type, Smile, Trees, Building, Heart, Moon, Box
} from "lucide-react";

const Photo3DViewer = lazy(() => import("./Photo3DViewer"));

interface PhotoEditStudioProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  onSave: (newUrl: string) => void;
}

type Tab = "ai" | "adjust" | "transform" | "filters" | "3d";

// ── AI quick actions ──
const AI_ACTIONS = [
  { label: "Enhance Quality", prompt: "Dramatically enhance the quality, sharpness, and detail of this photo. Professional DSLR finish.", icon: Sparkles, color: "from-amber-500/30 to-yellow-500/30" },
  { label: "Remove Background", prompt: "Remove the background completely, leaving only the main subject on a clean transparent or white background.", icon: Eraser, color: "from-rose-500/30 to-pink-500/30" },
  { label: "Restore Old Photo", prompt: "Restore this old or damaged photo. Fix scratches, faded colors, blur, and noise. Bring it back to life.", icon: Heart, color: "from-red-500/30 to-orange-500/30" },
  { label: "Colorize B&W", prompt: "Add realistic, beautiful, natural colors to this black and white photo.", icon: Palette, color: "from-violet-500/30 to-purple-500/30" },
  { label: "Upscale 4K", prompt: "Upscale this image to ultra high resolution 4K with maximum detail preservation.", icon: Maximize2, color: "from-blue-500/30 to-cyan-500/30" },
  { label: "Cartoon Style", prompt: "Transform this photo into a beautiful cartoon/anime illustration style while keeping the subject recognizable.", icon: Smile, color: "from-pink-500/30 to-rose-500/30" },
  { label: "Oil Painting", prompt: "Transform this photo into a museum-quality oil painting with visible brush strokes.", icon: Brush, color: "from-orange-500/30 to-amber-500/30" },
  { label: "Watercolor", prompt: "Transform this photo into a soft, beautiful watercolor painting.", icon: Droplet, color: "from-cyan-500/30 to-blue-500/30" },
  { label: "Pencil Sketch", prompt: "Transform this photo into a detailed black and white pencil sketch drawing.", icon: Brush, color: "from-zinc-500/30 to-slate-500/30" },
  { label: "Retouch Skin", prompt: "Professionally retouch the skin: smooth, even tone, remove blemishes, keep natural texture. Magazine quality.", icon: Star, color: "from-fuchsia-500/30 to-pink-500/30" },
  { label: "Studio Lighting", prompt: "Add professional studio lighting: dramatic, balanced, with beautiful highlights and shadows.", icon: Aperture, color: "from-yellow-500/30 to-amber-500/30" },
  { label: "Sunset Glow", prompt: "Add warm golden hour sunset lighting and atmosphere to this photo.", icon: Sun, color: "from-orange-500/30 to-yellow-500/30" },
  { label: "Night Mode", prompt: "Transform the lighting to a dramatic nighttime scene with moody atmospheric lighting.", icon: Moon, color: "from-indigo-500/30 to-blue-500/30" },
  { label: "Cinematic", prompt: "Apply a cinematic film look with teal and orange color grading, letterbox feel, and movie-quality drama.", icon: Camera, color: "from-teal-500/30 to-orange-500/30" },
  { label: "Add Snow", prompt: "Add realistic falling snow and a winter wonderland atmosphere to this scene.", icon: Snowflake, color: "from-sky-500/30 to-cyan-500/30" },
  { label: "Add Fire/Magic", prompt: "Add dramatic magical fire/glowing energy effects swirling around the subject.", icon: Flame, color: "from-red-500/30 to-orange-500/30" },
  { label: "Beach Backdrop", prompt: "Replace the background with a stunning tropical beach at sunset.", icon: Sun, color: "from-cyan-500/30 to-yellow-500/30" },
  { label: "Forest Backdrop", prompt: "Replace the background with a magical enchanted forest with sunbeams.", icon: Trees, color: "from-green-500/30 to-emerald-500/30" },
  { label: "City Backdrop", prompt: "Replace the background with a stunning futuristic neon-lit city skyline at night.", icon: Building, color: "from-purple-500/30 to-pink-500/30" },
  { label: "Vintage Film", prompt: "Apply an authentic vintage film look: grain, faded colors, light leaks, 70s analog feel.", icon: Camera, color: "from-amber-700/30 to-orange-700/30" },
];

// ── CSS filter presets ──
const FILTER_PRESETS = [
  { name: "Original", filter: "" },
  { name: "Vivid", filter: "saturate(1.5) contrast(1.15)" },
  { name: "Noir", filter: "grayscale(1) contrast(1.3) brightness(0.9)" },
  { name: "Sepia", filter: "sepia(0.8) contrast(1.1)" },
  { name: "Cool", filter: "hue-rotate(180deg) saturate(1.2)" },
  { name: "Warm", filter: "sepia(0.3) saturate(1.4) brightness(1.05)" },
  { name: "Dreamy", filter: "blur(0.5px) brightness(1.1) saturate(1.3) contrast(0.95)" },
  { name: "HDR", filter: "contrast(1.4) saturate(1.5) brightness(1.05)" },
  { name: "Faded", filter: "contrast(0.8) saturate(0.7) brightness(1.1)" },
  { name: "Punch", filter: "contrast(1.3) saturate(1.7)" },
  { name: "Mono", filter: "grayscale(1)" },
  { name: "Invert", filter: "invert(1)" },
];

const PhotoEditStudio = ({ open, onOpenChange, imageUrl, onSave }: PhotoEditStudioProps) => {
  const { user } = useAuth();
  const isAdmin = user?.email === "justinbretthogan@gmail.com";
  const [tab, setTab] = useState<Tab>("ai");
  const [history, setHistory] = useState<string[]>([imageUrl]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  // CSS adjustments
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [hue, setHue] = useState(0);
  const [blur, setBlur] = useState(0);
  const [sepia, setSepia] = useState(0);
  const [grayscale, setGrayscale] = useState(0);
  const [presetFilter, setPresetFilter] = useState("");

  // Transforms
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  // 3D view
  const [depth3D, setDepth3D] = useState(0.35);
  const [autoOrbit, setAutoOrbit] = useState(false);
  const [mode3D, setMode3D] = useState<"parallax" | "ai">("parallax");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const current = history[historyIndex];
  const [publishSell, setPublishSell] = useState<PublishSellState>(defaultPublishSellState);

  useEffect(() => {
    if (open) {
      setHistory([imageUrl]);
      setHistoryIndex(0);
      resetAdjustments();
    }
  }, [open, imageUrl]);

  const resetAdjustments = () => {
    setBrightness(100); setContrast(100); setSaturation(100); setHue(0);
    setBlur(0); setSepia(0); setGrayscale(0); setPresetFilter("");
    setRotation(0); setFlipH(false); setFlipV(false);
  };

  const cssFilter = `${presetFilter} brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg) blur(${blur}px) sepia(${sepia}%) grayscale(${grayscale}%)`.trim();
  const cssTransform = `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`;

  const pushHistory = (url: string) => {
    const next = history.slice(0, historyIndex + 1);
    next.push(url);
    setHistory(next);
    setHistoryIndex(next.length - 1);
    resetAdjustments();
  };

  const undo = () => historyIndex > 0 && setHistoryIndex(historyIndex - 1);
  const redo = () => historyIndex < history.length - 1 && setHistoryIndex(historyIndex + 1);

  const aiEdit = async (prompt: string) => {
    if (!prompt.trim()) {
      toast.error("Type what you want to change first");
      return;
    }
    if (!current) {
      toast.error("No image loaded to edit");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("image-gen", {
        body: {
          prompt: `Edit the provided photo: ${prompt}. Modify the existing image directly — keep composition, subject, and pose recognizable unless the edit specifically requests otherwise. Return the edited photo as an image.`,
          inputImage: current,
          ownerBypass: isAdmin,
        },
      });
      if (error) {
        console.error("image-gen error:", error);
        toast.error(error.message || "AI edit failed");
        return;
      }
      const url = data?.images?.[0]?.image_url?.url;
      if (url) {
        pushHistory(url);
        // Auto-save AI edit result to the user's library
        void saveToLibrary({
          media_type: "image",
          title: `Photo edit: ${prompt.slice(0, 60)}`,
          url,
          source_page: "photo-edit-studio",
          metadata: { kind: "ai_photo_edit", prompt },
          is_public: publishSell.is_public,
          shop_enabled: publishSell.shop_enabled,
          shop_price_cents: publishSell.shop_price_cents,
        });
        toast.success("Edit applied ✨ Saved to your Library");
      } else {
        const msg = data?.text?.slice(0, 140);
        toast.error(msg ? `AI replied with text: ${msg}` : "AI didn't return an image — try rephrasing");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "AI edit failed");
    } finally {
      setBusy(false);
    }
  };

  // Bake CSS adjustments + transforms into a real image
  const bakeAndSave = async (closeAfter: boolean) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = canvasRef.current || document.createElement("canvas");
      const w = img.naturalWidth, h = img.naturalHeight;
      const rotated = rotation % 180 !== 0;
      canvas.width = rotated ? h : w;
      canvas.height = rotated ? w : h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.filter = cssFilter;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      const url = canvas.toDataURL("image/png");
      onSave(url);
      toast.success("Edits saved to library!");
      if (closeAfter) onOpenChange(false);
      else pushHistory(url);
    };
    img.onerror = () => toast.error("Could not load image for export");
    img.src = current;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl border-border bg-card">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold text-foreground flex-1">Photo Edit Studio</h2>
          <button onClick={undo} disabled={historyIndex === 0} className="p-2 rounded-lg bg-muted/50 disabled:opacity-30">
            <Undo2 className="w-4 h-4 text-foreground" />
          </button>
          <button onClick={redo} disabled={historyIndex === history.length - 1} className="p-2 rounded-lg bg-muted/50 disabled:opacity-30">
            <Redo2 className="w-4 h-4 text-foreground" />
          </button>
          <button onClick={() => onOpenChange(false)} className="p-2 rounded-lg bg-muted/50">
            <X className="w-4 h-4 text-foreground" />
          </button>
        </div>

        {/* Preview */}
        <div className="px-4 pt-4">
          <div className="aspect-square bg-muted/30 border border-border rounded-xl overflow-hidden relative flex items-center justify-center">
            {busy && (
              <div className="absolute inset-0 z-10 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-xs text-muted-foreground">AI is working its magic…</p>
              </div>
            )}
            <img
              src={current}
              alt="Editing"
              className="max-w-full max-h-full transition-all duration-200"
              style={{ filter: cssFilter, transform: cssTransform }}
            />
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Publish & Sell opt-in */}
        <div className="px-4 pt-3">
          <PublishSellControls
            value={publishSell}
            onChange={setPublishSell}
            kind="photo"
          />
        </div>

        {/* Tabs */}
        <div className="px-4 pt-3 flex gap-1.5 overflow-x-auto scrollbar-hide">
          {([
            { k: "ai", l: "AI Magic", I: Sparkles },
            { k: "adjust", l: "Adjust", I: Sliders },
            { k: "filters", l: "Filters", I: Palette },
            { k: "transform", l: "Transform", I: Crop },
            { k: "3d", l: "3D View", I: Box },
          ] as const).map(({ k, l, I }) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                tab === k ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}>
              <I className="w-3.5 h-3.5" /> {l}
            </button>
          ))}
        </div>

        {/* Panels */}
        <div className="p-4">
          {tab === "ai" && (
            <div className="space-y-3">
              <div className="bg-gradient-to-r from-primary/15 to-amber-500/15 border border-primary/30 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-2">Describe any edit and AI will apply it:</p>
                <div className="flex gap-2">
                  <input
                    value={customPrompt}
                    onChange={e => setCustomPrompt(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !busy) { aiEdit(customPrompt); setCustomPrompt(""); } }}
                    placeholder="e.g. add sunglasses, change shirt to red, make it snowing…"
                    className="flex-1 px-3 py-2 rounded-lg bg-input border border-border text-foreground text-xs outline-none focus:border-primary"
                  />
                  <button
                    onClick={() => { aiEdit(customPrompt); setCustomPrompt(""); }}
                    disabled={busy || !customPrompt.trim()}
                    className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium flex items-center gap-1 disabled:opacity-50">
                    <Wand2 className="w-3.5 h-3.5" /> Apply
                  </button>
                </div>
              </div>
              <p className="text-xs font-semibold text-foreground">Quick AI Tools</p>
              <div className="grid grid-cols-3 gap-2">
                {AI_ACTIONS.map(a => {
                  const I = a.icon;
                  return (
                    <button key={a.label} onClick={() => aiEdit(a.prompt)} disabled={busy}
                      className={`relative p-2.5 rounded-xl bg-gradient-to-br ${a.color} border border-border hover:border-primary/50 transition-all flex flex-col items-center gap-1.5 disabled:opacity-50`}>
                      <I className="w-4 h-4 text-foreground" />
                      <span className="text-[9px] text-foreground font-medium text-center leading-tight">{a.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "adjust" && (
            <div className="space-y-4">
              {[
                { label: "Brightness", val: brightness, set: setBrightness, min: 0, max: 200, unit: "%", I: Sun },
                { label: "Contrast", val: contrast, set: setContrast, min: 0, max: 200, unit: "%", I: Contrast },
                { label: "Saturation", val: saturation, set: setSaturation, min: 0, max: 200, unit: "%", I: Droplet },
                { label: "Hue", val: hue, set: setHue, min: -180, max: 180, unit: "°", I: Palette },
                { label: "Blur", val: blur, set: setBlur, min: 0, max: 10, unit: "px", I: Wind },
                { label: "Sepia", val: sepia, set: setSepia, min: 0, max: 100, unit: "%", I: Camera },
                { label: "Grayscale", val: grayscale, set: setGrayscale, min: 0, max: 100, unit: "%", I: ImageIcon },
              ].map(({ label, val, set, min, max, unit, I }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <I className="w-3.5 h-3.5 text-primary" /> {label}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">{val}{unit}</span>
                  </div>
                  <input type="range" min={min} max={max} value={val}
                    onChange={e => set(parseInt(e.target.value))}
                    className="w-full accent-primary" />
                </div>
              ))}
              <button onClick={resetAdjustments}
                className="w-full py-2 bg-muted/50 text-foreground rounded-lg text-xs font-medium border border-border">
                Reset Adjustments
              </button>
            </div>
          )}

          {tab === "filters" && (
            <div className="grid grid-cols-3 gap-2">
              {FILTER_PRESETS.map(f => (
                <button key={f.name} onClick={() => setPresetFilter(f.filter)}
                  className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                    presetFilter === f.filter ? "border-primary shadow-lg shadow-primary/20" : "border-border"
                  }`}>
                  <div className="relative w-full h-full">
                    <img src={current} alt={f.name} className="w-full h-full object-cover" style={{ filter: f.filter }} />
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm py-1">
                      <p className="text-[10px] text-white text-center font-medium">{f.name}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {tab === "transform" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setRotation((rotation + 90) % 360)}
                  className="p-3 bg-muted/50 border border-border rounded-xl flex items-center justify-center gap-2 hover:bg-muted text-foreground text-xs">
                  <RotateCw className="w-4 h-4" /> Rotate 90°
                </button>
                <button onClick={() => setRotation((rotation - 90 + 360) % 360)}
                  className="p-3 bg-muted/50 border border-border rounded-xl flex items-center justify-center gap-2 hover:bg-muted text-foreground text-xs">
                  <RotateCw className="w-4 h-4 -scale-x-100" /> Rotate -90°
                </button>
                <button onClick={() => setFlipH(!flipH)}
                  className={`p-3 border rounded-xl flex items-center justify-center gap-2 text-xs ${flipH ? "bg-primary/20 border-primary text-primary" : "bg-muted/50 border-border text-foreground"}`}>
                  <FlipHorizontal className="w-4 h-4" /> Flip Horizontal
                </button>
                <button onClick={() => setFlipV(!flipV)}
                  className={`p-3 border rounded-xl flex items-center justify-center gap-2 text-xs ${flipV ? "bg-primary/20 border-primary text-primary" : "bg-muted/50 border-border text-foreground"}`}>
                  <FlipVertical className="w-4 h-4" /> Flip Vertical
                </button>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-foreground">Free Rotate</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{rotation}°</span>
                </div>
                <input type="range" min={-180} max={180} value={rotation}
                  onChange={e => setRotation(parseInt(e.target.value))}
                  className="w-full accent-primary" />
              </div>
              <button onClick={() => { setRotation(0); setFlipH(false); setFlipV(false); }}
                className="w-full py-2 bg-muted/50 text-foreground rounded-lg text-xs font-medium border border-border">
                Reset Transform
              </button>
            </div>
          )}

          {tab === "3d" && (
            <div className="space-y-3">
              {/* Mode toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode3D("parallax")}
                  className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 ${
                    mode3D === "parallax" ? "bg-primary/20 border-primary text-primary" : "bg-muted/50 border-border text-foreground"
                  }`}
                >
                  <Box className="w-4 h-4" />
                  Live Parallax
                  <span className="text-[9px] text-muted-foreground font-normal">Instant • Free • Subtle tilt</span>
                </button>
                <button
                  onClick={() => setMode3D("ai")}
                  className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 ${
                    mode3D === "ai" ? "bg-primary/20 border-primary text-primary" : "bg-muted/50 border-border text-foreground"
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  AI Re-Render
                  <span className="text-[9px] text-muted-foreground font-normal">Photoreal • Full 3D • ~15s</span>
                </button>
              </div>

              {mode3D === "parallax" ? (
                <>
                  <div className="bg-gradient-to-r from-primary/15 to-amber-500/15 border border-primary/30 rounded-xl p-3">
                    <p className="text-[11px] text-muted-foreground">
                      Drag to tilt. Pinch / scroll to zoom. Subjects pop forward — backgrounds recede.
                    </p>
                  </div>
                  <div className="aspect-square w-full rounded-xl overflow-hidden border border-border bg-black">
                    <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-muted-foreground">Loading 3D viewer…</div>}>
                      <Photo3DViewer imageUrl={current} depth={depth3D} autoOrbit={autoOrbit} />
                    </Suspense>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <Maximize2 className="w-3.5 h-3.5 text-primary" /> Depth Strength
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">{depth3D.toFixed(2)}</span>
                    </div>
                    <input
                      type="range" min={0} max={1} step={0.01} value={depth3D}
                      onChange={e => setDepth3D(parseFloat(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>
                  <button
                    onClick={() => setAutoOrbit(o => !o)}
                    className={`w-full py-2 rounded-lg text-xs font-medium border ${
                      autoOrbit ? "bg-primary/20 border-primary text-primary" : "bg-muted/50 border-border text-foreground"
                    }`}
                  >
                    {autoOrbit ? "Stop Auto-Orbit" : "Start Auto-Orbit"}
                  </button>
                </>
              ) : (
                <>
                  <div className="bg-gradient-to-r from-primary/15 to-amber-500/15 border border-primary/30 rounded-xl p-3">
                    <p className="text-[11px] text-muted-foreground">
                      Pick an angle and AI will re-render the same scene from that view. Each angle becomes a new photo in your history.
                    </p>
                  </div>
                  <p className="text-xs font-semibold text-foreground">Camera Angles</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Left Side", prompt: "Re-render this exact same scene and subject from a camera angle rotated 45 degrees to the LEFT side. Keep the same subject, lighting, style, and background elements — just shift the camera viewpoint to the left so we see the left profile / left side of the scene. Photoreal, consistent." },
                      { label: "Right Side", prompt: "Re-render this exact same scene and subject from a camera angle rotated 45 degrees to the RIGHT side. Keep the same subject, lighting, style, and background — just shift the camera viewpoint to the right so we see the right profile / right side. Photoreal, consistent." },
                      { label: "Behind", prompt: "Re-render this exact same scene from BEHIND the subject. Keep the subject, outfit, lighting, and background consistent — show the back of the subject as if the camera moved 180° around. Photoreal." },
                      { label: "Top Down", prompt: "Re-render this exact same scene from a TOP-DOWN bird's eye view looking straight down. Keep the same subject, outfit, lighting, and elements — just change the camera to overhead. Photoreal." },
                      { label: "Low Angle", prompt: "Re-render this exact same scene from a dramatic LOW ANGLE looking up at the subject. Keep subject, outfit, lighting and style consistent. Photoreal, cinematic." },
                      { label: "Wide Shot", prompt: "Re-render this exact same scene as a WIDE establishing shot — pull the camera way back so we see much more of the surrounding environment. Keep subject and style consistent. Photoreal." },
                      { label: "Close-Up", prompt: "Re-render this exact same scene as a tight CLOSE-UP on the main subject's face/details. Keep lighting, style, mood consistent. Photoreal, sharp focus." },
                      { label: "Step Inside", prompt: "Re-render this scene from a first-person POV as if the viewer just STEPPED INSIDE the photo and is now standing in the environment looking around. Keep all environment details, lighting and mood consistent. Photoreal, immersive." },
                      { label: "Dolly Zoom", prompt: "Re-render this scene with a dramatic DOLLY ZOOM / vertigo effect — subject stays the same size but background warps and stretches. Cinematic, photoreal." },
                    ].map(angle => (
                      <button
                        key={angle.label}
                        onClick={() => aiEdit(angle.prompt)}
                        disabled={busy}
                        className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-amber-500/20 border border-border hover:border-primary/50 transition-all flex flex-col items-center gap-1 disabled:opacity-50"
                      >
                        <Camera className="w-4 h-4 text-foreground" />
                        <span className="text-[10px] text-foreground font-medium text-center leading-tight">{angle.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="bg-muted/30 border border-border rounded-xl p-3">
                    <p className="text-[11px] text-muted-foreground mb-2">Or describe a custom camera move:</p>
                    <div className="flex gap-2">
                      <input
                        value={customPrompt}
                        onChange={e => setCustomPrompt(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !busy && customPrompt.trim()) { aiEdit(`Re-render this exact scene from a new camera angle: ${customPrompt}. Keep the subject, outfit, lighting and style consistent — only change the camera viewpoint. Photoreal.`); setCustomPrompt(""); } }}
                        placeholder="e.g. from above looking down at 30°"
                        className="flex-1 px-3 py-2 rounded-lg bg-input border border-border text-foreground text-xs outline-none focus:border-primary"
                      />
                      <button
                        onClick={() => { aiEdit(`Re-render this exact scene from a new camera angle: ${customPrompt}. Keep the subject, outfit, lighting and style consistent — only change the camera viewpoint. Photoreal.`); setCustomPrompt(""); }}
                        disabled={busy || !customPrompt.trim()}
                        className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium disabled:opacity-50"
                      >
                        Render
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 bg-card/95 backdrop-blur-sm border-t border-border p-3 flex gap-2">
          <button onClick={() => bakeAndSave(false)}
            className="flex-1 py-2.5 bg-muted/50 border border-border text-foreground rounded-xl text-xs font-medium flex items-center justify-center gap-1.5">
            <Zap className="w-4 h-4" /> Bake Edits
          </button>
          <button onClick={() => bakeAndSave(true)}
            className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-medium flex items-center justify-center gap-1.5">
            <Save className="w-4 h-4" /> Save & Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoEditStudio;
