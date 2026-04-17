import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Film, Wand2, Plus, Play, Pause, Download, Trash2, Sparkles, RefreshCw, Pencil, ImagePlus, Upload } from "lucide-react";
import { toast } from "sonner";
import { useSaveMedia } from "@/hooks/useUserAvatars";
import { useAuth } from "@/contexts/AuthContext";
import MediaPickerDialog from "@/components/MediaPickerDialog";

const SCENE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/script-to-scenes`;
const GEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-gen`;
const AUTH = `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;
const CLIP_SECONDS = 6;

type Motion = "pan-left" | "pan-right" | "zoom-in" | "zoom-out" | "ken-burns" | "static";
interface Scene {
  id: string;
  caption: string;
  photo_prompt: string;
  motion: Motion;
  duration_sec: number; // always 6
  image_url?: string;
  generating?: boolean;
}

interface MovieStudioProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  seedImage?: string | null;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const MovieStudio = ({ open, onOpenChange, seedImage }: MovieStudioProps) => {
  const { user } = useAuth();
  const saveMedia = useSaveMedia();
  const [script, setScript] = useState("");
  const [intent, setIntent] = useState("");
  const [title, setTitle] = useState("");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [planning, setPlanning] = useState(false);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [previewSceneId, setPreviewSceneId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryTargetId, setLibraryTargetId] = useState<string | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewAnimRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setScenes([]); setScript(""); setIntent(""); setTitle("");
      setEditingSceneId(null); setEditPrompt(""); setPreviewSceneId(null);
      setExporting(false); setExportProgress(0);
    }
  }, [open]);

  // ----- Plan scenes -----
  const planScenes = async () => {
    if (!script.trim()) { toast.error("Add a script first"); return; }
    setPlanning(true);
    try {
      const resp = await fetch(SCENE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH },
        body: JSON.stringify({ script, intent, targetDurationSec: 60 }),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        toast.error(e.error || "Scene planning failed"); return;
      }
      const data = await resp.json();
      setTitle(data.title || "Untitled Movie");
      const newScenes: Scene[] = (data.scenes || []).map((s: any) => ({
        id: uid(),
        caption: s.caption,
        photo_prompt: s.photo_prompt,
        motion: s.motion,
        duration_sec: CLIP_SECONDS,
      }));
      // Seed first scene with the photo the user came in with
      if (seedImage && newScenes[0]) newScenes[0].image_url = seedImage;
      setScenes(newScenes);
      toast.success(`${newScenes.length} scenes ready. Generate photos to bring them to life.`);
    } catch (e) {
      console.error(e); toast.error("Scene planning failed");
    } finally { setPlanning(false); }
  };

  // ----- Generate 8K photo for a scene -----
  const generateScenePhoto = async (sceneId: string, customPrompt?: string) => {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, generating: true } : s));
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    const finalPrompt = `${customPrompt || scene.photo_prompt}, photoreal 8K resolution, ultra-detailed, cinematic lighting, sharp focus, film still`;
    try {
      const body: any = { prompt: finalPrompt };
      if (scene.image_url) body.inputImage = scene.image_url; // edit existing
      const resp = await fetch(GEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        toast.error(e.error || "Photo generation failed"); return;
      }
      const data = await resp.json();
      const url = data.images?.[0]?.image_url?.url;
      if (!url) { toast.error("No image returned"); return; }
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, image_url: url, generating: false } : s));
      if (user) saveMedia.mutate({
        media_type: "image",
        title: `Movie scene - ${scene.caption.slice(0, 40)}`,
        url,
        source_page: "movie-studio",
        metadata: { sceneId, prompt: finalPrompt },
      });
      toast.success("Scene photo ready");
    } catch (e) {
      console.error(e); toast.error("Photo generation failed");
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, generating: false } : s));
    }
  };

  const generateAll = async () => {
    for (const s of scenes) {
      if (!s.image_url) await generateScenePhoto(s.id);
    }
  };

  // ----- Apply AI edit to existing scene clip -----
  const applyClipEdit = async () => {
    if (!editingSceneId || !editPrompt.trim()) return;
    const scene = scenes.find(s => s.id === editingSceneId);
    if (!scene?.image_url) { toast.error("Generate the photo first"); return; }
    await generateScenePhoto(editingSceneId, `${editPrompt}. Keep subject and composition consistent.`);
    setEditPrompt("");
    setEditingSceneId(null);
  };

  // ----- Scene CRUD -----
  const addScene = () => {
    setScenes(prev => [...prev, {
      id: uid(),
      caption: "New scene",
      photo_prompt: "Describe this scene...",
      motion: "ken-burns",
      duration_sec: CLIP_SECONDS,
    }]);
  };
  const removeScene = (id: string) => setScenes(prev => prev.filter(s => s.id !== id));
  const updateScene = (id: string, patch: Partial<Scene>) =>
    setScenes(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));

  // ----- Preview a scene (Ken-Burns animation in canvas) -----
  const previewScene = (scene: Scene) => {
    if (!scene.image_url) return;
    setPreviewSceneId(scene.id);
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const start = performance.now();
      const dur = scene.duration_sec * 1000;
      const animate = (t: number) => {
        const p = Math.min(1, (t - start) / dur);
        drawMotionFrame(ctx, img, canvas.width, canvas.height, scene.motion, p);
        if (p < 1) previewAnimRef.current = requestAnimationFrame(animate);
        else setPreviewSceneId(null);
      };
      previewAnimRef.current = requestAnimationFrame(animate);
    };
    img.src = scene.image_url;
  };

  const stopPreview = () => {
    if (previewAnimRef.current) cancelAnimationFrame(previewAnimRef.current);
    setPreviewSceneId(null);
  };

  // ----- Export full movie as WebM -----
  const exportMovie = async () => {
    const ready = scenes.filter(s => s.image_url);
    if (ready.length === 0) { toast.error("Generate at least one scene photo"); return; }
    if (ready.length !== scenes.length) {
      if (!confirm(`${scenes.length - ready.length} scene(s) missing photos. Export only the ${ready.length} ready ones?`)) return;
    }
    setExporting(true); setExportProgress(0);
    try {
      const canvas = exportCanvasRef.current!;
      canvas.width = 1920; canvas.height = 1080;
      const ctx = canvas.getContext("2d")!;
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9", videoBitsPerSecond: 8_000_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

      const finished = new Promise<Blob>(res => {
        recorder.onstop = () => res(new Blob(chunks, { type: "video/webm" }));
      });
      recorder.start();

      // Preload all images
      const imgs = await Promise.all(ready.map(s => new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image(); i.crossOrigin = "anonymous";
        i.onload = () => res(i); i.onerror = rej; i.src = s.image_url!;
      })));

      for (let idx = 0; idx < ready.length; idx++) {
        const scene = ready[idx];
        const img = imgs[idx];
        const dur = scene.duration_sec * 1000;
        const start = performance.now();
        await new Promise<void>(resolve => {
          const tick = (now: number) => {
            const p = Math.min(1, (now - start) / dur);
            drawMotionFrame(ctx, img, canvas.width, canvas.height, scene.motion, p);
            // caption
            ctx.fillStyle = "rgba(0,0,0,0.55)";
            ctx.fillRect(0, canvas.height - 140, canvas.width, 140);
            ctx.fillStyle = "#fff";
            ctx.font = "bold 36px sans-serif";
            ctx.textAlign = "center";
            wrapText(ctx, scene.caption, canvas.width / 2, canvas.height - 80, canvas.width - 120, 44);
            if (p < 1) requestAnimationFrame(tick);
            else resolve();
          };
          requestAnimationFrame(tick);
        });
        setExportProgress(Math.round(((idx + 1) / ready.length) * 100));
      }

      recorder.stop();
      const blob = await finished;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${title || "solace-movie"}-${Date.now()}.webm`;
      a.click();

      // Save to library
      if (user) {
        const reader = new FileReader();
        reader.onloadend = () => {
          saveMedia.mutate({
            media_type: "video",
            title: title || "Solace Movie",
            url: reader.result as string,
            source_page: "movie-studio",
            metadata: { sceneCount: ready.length, totalSeconds: ready.length * CLIP_SECONDS },
          });
        };
        reader.readAsDataURL(blob);
      }
      toast.success("Movie exported and saved to library!");
    } catch (e) {
      console.error(e); toast.error("Export failed");
    } finally { setExporting(false); }
  };

  const totalSec = scenes.length * CLIP_SECONDS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background border-primary/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Film className="w-5 h-5" /> Movie Studio
            <span className="ml-auto text-xs text-muted-foreground font-normal">
              {scenes.length} scenes · {totalSec}s · 8K · 6s/clip
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Script */}
        {scenes.length === 0 && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Script / story</label>
              <Textarea value={script} onChange={e => setScript(e.target.value)} rows={6}
                placeholder="Write your story... e.g. A lone wanderer crosses the desert at dawn, discovers a hidden city of gold..." />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Direction / what you want from the movie</label>
              <Textarea value={intent} onChange={e => setIntent(e.target.value)} rows={3}
                placeholder="Tone, style, lead character look, color palette, references..." />
            </div>
            <Button onClick={planScenes} disabled={planning} className="w-full">
              {planning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
              {planning ? "Planning scenes..." : "Plan scenes with AI"}
            </Button>
          </div>
        )}

        {/* Step 2: Scenes */}
        {scenes.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Movie title" className="flex-1 min-w-[200px]" />
              <Button onClick={generateAll} variant="secondary" size="sm">
                <Sparkles className="w-3 h-3 mr-1" /> Generate all photos
              </Button>
              <Button onClick={addScene} variant="outline" size="sm">
                <Plus className="w-3 h-3 mr-1" /> Add scene
              </Button>
              <Button onClick={exportMovie} disabled={exporting} size="sm">
                {exporting ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />{exportProgress}%</> : <><Download className="w-3 h-3 mr-1" /> Export</>}
              </Button>
            </div>

            {/* Preview canvas */}
            <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
              <canvas ref={previewCanvasRef} width={1280} height={720} className="w-full h-full" />
              {previewSceneId && (
                <button onClick={stopPreview} className="absolute top-2 right-2 p-2 bg-black/60 rounded-full">
                  <Pause className="w-4 h-4 text-white" />
                </button>
              )}
            </div>

            {/* Scene list */}
            <div className="space-y-2">
              {scenes.map((s, idx) => (
                <div key={s.id} className="border border-border rounded-lg p-3 bg-card">
                  <div className="flex gap-3">
                    <div className="w-24 h-24 rounded-md bg-muted flex-shrink-0 overflow-hidden relative">
                      {s.image_url ? (
                        <img src={s.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <ImagePlus className="w-6 h-6" />
                        </div>
                      )}
                      {s.generating && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary">Scene {idx + 1}</span>
                        <span className="text-[10px] text-muted-foreground">{s.motion} · 6s · 8K</span>
                      </div>
                      <Input value={s.caption} onChange={e => updateScene(s.id, { caption: e.target.value })}
                        className="h-7 text-xs" placeholder="Caption" />
                      <Textarea value={s.photo_prompt} onChange={e => updateScene(s.id, { photo_prompt: e.target.value })}
                        rows={2} className="text-xs" placeholder="Photo prompt" />
                      <div className="flex flex-wrap gap-1">
                        <Button onClick={() => generateScenePhoto(s.id)} size="sm" variant="secondary" className="h-7 text-xs"
                          disabled={s.generating}>
                          {s.image_url ? <RefreshCw className="w-3 h-3 mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
                          {s.image_url ? "Re-gen" : "Generate"}
                        </Button>
                        <Button onClick={() => { setLibraryTargetId(s.id); setShowLibrary(true); }} size="sm" variant="outline" className="h-7 text-xs">
                          From library
                        </Button>
                        <Button onClick={() => previewScene(s)} size="sm" variant="outline" className="h-7 text-xs"
                          disabled={!s.image_url}>
                          <Play className="w-3 h-3 mr-1" /> Preview
                        </Button>
                        <Button onClick={() => setEditingSceneId(editingSceneId === s.id ? null : s.id)}
                          size="sm" variant="outline" className="h-7 text-xs" disabled={!s.image_url}>
                          <Pencil className="w-3 h-3 mr-1" /> Edit clip
                        </Button>
                        <select value={s.motion} onChange={e => updateScene(s.id, { motion: e.target.value as Motion })}
                          className="h-7 text-xs bg-input border border-border rounded px-2">
                          <option value="ken-burns">Ken Burns</option>
                          <option value="pan-left">Pan ←</option>
                          <option value="pan-right">Pan →</option>
                          <option value="zoom-in">Zoom in</option>
                          <option value="zoom-out">Zoom out</option>
                          <option value="static">Static</option>
                        </select>
                        <Button onClick={() => removeScene(s.id)} size="sm" variant="ghost" className="h-7 text-xs text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      {editingSceneId === s.id && (
                        <div className="mt-2 p-2 rounded-md bg-primary/5 border border-primary/30 space-y-2">
                          <p className="text-[10px] text-muted-foreground">Tell the AI what to change in this clip's photo:</p>
                          <Textarea value={editPrompt} onChange={e => setEditPrompt(e.target.value)} rows={2}
                            className="text-xs" placeholder="e.g. Make it sunset, add rain, change outfit to red dress..." />
                          <Button onClick={applyClipEdit} size="sm" className="h-7 text-xs w-full">
                            <Wand2 className="w-3 h-3 mr-1" /> Apply edit (8K re-render)
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <canvas ref={exportCanvasRef} style={{ display: "none" }} />
        <MediaPickerDialog
          open={showLibrary}
          onOpenChange={setShowLibrary}
          filterType="image"
          title="Pick scene photo"
          onSelect={(url) => {
            if (libraryTargetId) updateScene(libraryTargetId, { image_url: url });
            setLibraryTargetId(null);
          }}
        />
      </DialogContent>
    </Dialog>
  );
};

// ----- Helpers -----
function drawMotionFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  W: number, H: number,
  motion: Motion, p: number,
) {
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  // cover-fit base
  const iar = img.width / img.height; const car = W / H;
  let bw = W, bh = H;
  if (iar > car) { bh = H; bw = H * iar; } else { bw = W; bh = W / iar; }
  // motion offsets
  let scale = 1, dx = 0, dy = 0;
  switch (motion) {
    case "zoom-in": scale = 1 + 0.15 * p; break;
    case "zoom-out": scale = 1.15 - 0.15 * p; break;
    case "pan-left": dx = -0.1 * W * p; break;
    case "pan-right": dx = 0.1 * W * p; break;
    case "ken-burns": scale = 1 + 0.1 * p; dx = -0.05 * W * p; dy = -0.03 * H * p; break;
    case "static": break;
  }
  const dw = bw * scale, dh = bh * scale;
  ctx.drawImage(img, (W - dw) / 2 + dx, (H - dh) / 2 + dy, dw, dh);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" "); let line = ""; const lines: string[] = [];
  for (const w of words) {
    const test = line + w + " ";
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line.trim()); line = w + " "; }
    else line = test;
  }
  if (line) lines.push(line.trim());
  const total = lines.length;
  lines.forEach((l, i) => ctx.fillText(l, x, y + (i - (total - 1) / 2) * lineHeight));
}

export default MovieStudio;
