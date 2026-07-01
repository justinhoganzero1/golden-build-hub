import { useEffect, useRef, useState } from "react";
import SEO from "@/components/SEO";
import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Upload, Play, Pause, Plus, Trash2, Volume2, VolumeX, Film, Layers, Image as ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
import Photo3DViewer from "@/components/Photo3DViewer";
import { toast } from "sonner";

interface Scene {
  id: string;
  imageUrl: string;
  name: string;
  durationSec: number;
  depth: number;
}

interface AudioLayer {
  id: string;
  name: string;
  url: string;
  volume: number;
  muted: boolean;
  startSec: number;
  el?: HTMLAudioElement;
}

const MAX_AUDIO_LAYERS = 20;

const uid = () => Math.random().toString(36).slice(2, 10);

const ImmersiveMovieStudioPage = () => {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [layers, setLayers] = useState<AudioLayer[]>([]);
  const [playing, setPlaying] = useState(false);
  const playTimer = useRef<number | null>(null);

  const activeScene = scenes.find((s) => s.id === activeSceneId) ?? scenes[0];

  // ---- Scene upload ----
  const onImageFiles = (files: FileList | null) => {
    if (!files) return;
    const next: Scene[] = [];
    Array.from(files).forEach((f) => {
      if (!f.type.startsWith("image/")) return;
      next.push({
        id: uid(),
        imageUrl: URL.createObjectURL(f),
        name: f.name.replace(/\.[^.]+$/, ""),
        durationSec: 6,
        depth: 0.35,
      });
    });
    if (next.length) {
      setScenes((prev) => {
        const merged = [...prev, ...next];
        if (!activeSceneId) setActiveSceneId(merged[0].id);
        return merged;
      });
      toast.success(`Added ${next.length} scene${next.length > 1 ? "s" : ""}`);
    }
  };

  const removeScene = (id: string) => {
    setScenes((prev) => prev.filter((s) => s.id !== id));
    if (activeSceneId === id) setActiveSceneId(null);
  };

  // ---- Audio layers ----
  const onAudioFiles = (files: FileList | null) => {
    if (!files) return;
    const remaining = MAX_AUDIO_LAYERS - layers.length;
    if (remaining <= 0) {
      toast.error(`Max ${MAX_AUDIO_LAYERS} audio layers reached`);
      return;
    }
    const picked = Array.from(files).slice(0, remaining);
    const next: AudioLayer[] = picked.map((f) => ({
      id: uid(),
      name: f.name,
      url: URL.createObjectURL(f),
      volume: 0.8,
      muted: false,
      startSec: 0,
    }));
    setLayers((prev) => [...prev, ...next]);
  };

  const updateLayer = (id: string, patch: Partial<AudioLayer>) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const removeLayer = (id: string) => {
    setLayers((prev) => {
      const l = prev.find((x) => x.id === id);
      l?.el?.pause();
      return prev.filter((x) => x.id !== id);
    });
  };

  // ---- Playback: advances scenes on their duration + mixes all audio ----
  const stopAll = () => {
    if (playTimer.current) {
      window.clearTimeout(playTimer.current);
      playTimer.current = null;
    }
    layers.forEach((l) => {
      if (l.el) {
        l.el.pause();
        l.el.currentTime = 0;
      }
    });
    setPlaying(false);
  };

  const startPlayback = () => {
    if (!scenes.length) {
      toast.error("Add at least one scene");
      return;
    }
    setPlaying(true);
    // Play audio layers
    layers.forEach((l) => {
      const el = l.el ?? new Audio(l.url);
      el.loop = false;
      el.volume = l.muted ? 0 : l.volume;
      el.currentTime = 0;
      window.setTimeout(() => el.play().catch(() => {}), l.startSec * 1000);
      updateLayer(l.id, { el });
    });
    // Advance through scenes
    let idx = scenes.findIndex((s) => s.id === activeSceneId);
    if (idx < 0) idx = 0;
    setActiveSceneId(scenes[idx].id);
    const step = () => {
      idx += 1;
      if (idx >= scenes.length) {
        stopAll();
        return;
      }
      setActiveSceneId(scenes[idx].id);
      playTimer.current = window.setTimeout(step, scenes[idx].durationSec * 1000);
    };
    playTimer.current = window.setTimeout(step, scenes[idx].durationSec * 1000);
  };

  useEffect(() => stopAll, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Live volume updates during playback
  useEffect(() => {
    layers.forEach((l) => {
      if (l.el) l.el.volume = l.muted ? 0 : l.volume;
    });
  }, [layers]);

  const gotoOffset = (delta: number) => {
    if (!activeScene) return;
    const i = scenes.findIndex((s) => s.id === activeScene.id);
    const j = Math.max(0, Math.min(scenes.length - 1, i + delta));
    setActiveSceneId(scenes[j].id);
  };

  return (
    <>
      <SEO
        title="Immersive Movie Studio — 3D Stills + 20 Audio Layers"
        description="Turn still photos into an explorable 3D movie. Look around each scene, layer up to 20 audio tracks: voiceover, music, SFX, ambience."
        path="/immersive-movie-studio"
      />
      <PageShell
        title="🎞️ Immersive Movie Studio"
        subtitle="Enter your stills in 3D · Mix up to 20 layers of audio"
      >
        <div className="max-w-6xl mx-auto p-4 space-y-4">
          {/* Viewer */}
          <Card className="p-0 overflow-hidden border-primary/30">
            <div className="relative aspect-video bg-black">
              {activeScene ? (
                <Photo3DViewer imageUrl={activeScene.imageUrl} depth={activeScene.depth} autoOrbit={playing} />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
                  <ImageIcon className="w-10 h-10" />
                  <p className="text-sm">Upload stills below to enter your first scene</p>
                </div>
              )}
              {activeScene && (
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-3 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="ghost" onClick={() => gotoOffset(-1)} className="text-white hover:bg-white/10">
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <span className="text-xs text-white/80">
                      {scenes.findIndex((s) => s.id === activeScene.id) + 1} / {scenes.length} · {activeScene.name}
                    </span>
                    <Button size="icon" variant="ghost" onClick={() => gotoOffset(1)} className="text-white hover:bg-white/10">
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </div>
                  <Button size="sm" onClick={playing ? stopAll : startPlayback} className="bg-primary text-primary-foreground">
                    {playing ? <><Pause className="w-4 h-4 mr-1" /> Stop</> : <><Play className="w-4 h-4 mr-1" /> Play movie</>}
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Scenes */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold flex items-center gap-2"><Film className="w-4 h-4 text-primary" /> Scenes (stills)</h3>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onImageFiles(e.target.files)} />
                <span className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground">
                  <Upload className="w-3.5 h-3.5" /> Add stills
                </span>
              </label>
            </div>
            {scenes.length === 0 ? (
              <p className="text-xs text-muted-foreground">No scenes yet. Add photos — each becomes an explorable 3D shot.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {scenes.map((s) => (
                  <div
                    key={s.id}
                    className={`relative rounded-lg overflow-hidden border-2 cursor-pointer group ${s.id === activeScene?.id ? "border-primary" : "border-border"}`}
                    onClick={() => setActiveSceneId(s.id)}
                  >
                    <img src={s.imageUrl} alt={s.name} className="w-full aspect-video object-cover" />
                    <div className="p-2 bg-card">
                      <p className="text-[10px] font-medium truncate">{s.name}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[9px] text-muted-foreground w-8">Sec</span>
                        <Input
                          type="number"
                          min={1}
                          max={60}
                          value={s.durationSec}
                          onChange={(e) => setScenes((prev) => prev.map((p) => (p.id === s.id ? { ...p, durationSec: Math.max(1, Number(e.target.value) || 1) } : p)))}
                          className="h-6 text-[10px] px-1"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[9px] text-muted-foreground w-8">3D</span>
                        <Slider
                          min={0}
                          max={1}
                          step={0.05}
                          value={[s.depth]}
                          onValueChange={([v]) => setScenes((prev) => prev.map((p) => (p.id === s.id ? { ...p, depth: v } : p)))}
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeScene(s.id); }}
                      className="absolute top-1 right-1 p-1 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Audio layers */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" /> Audio layers
                <span className="text-[10px] text-muted-foreground font-normal">
                  {layers.length}/{MAX_AUDIO_LAYERS}
                </span>
              </h3>
              <label className={`cursor-pointer ${layers.length >= MAX_AUDIO_LAYERS ? "opacity-40 pointer-events-none" : ""}`}>
                <input type="file" accept="audio/*" multiple className="hidden" onChange={(e) => onAudioFiles(e.target.files)} />
                <span className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground">
                  <Plus className="w-3.5 h-3.5" /> Add audio
                </span>
              </label>
            </div>
            {layers.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No audio yet. Add up to 20 tracks: voiceover, music, SFX, ambience — each with its own volume and start time.
              </p>
            ) : (
              <div className="space-y-2">
                {layers.map((l, idx) => (
                  <div key={l.id} className="flex items-center gap-2 p-2 rounded-md bg-secondary/40">
                    <span className="text-[10px] font-mono text-muted-foreground w-6 text-center">#{idx + 1}</span>
                    <button
                      onClick={() => updateLayer(l.id, { muted: !l.muted })}
                      className={`p-1.5 rounded-md ${l.muted ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary"}`}
                    >
                      {l.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                    <span className="text-xs truncate flex-1 min-w-0">{l.name}</span>
                    <div className="flex items-center gap-1 w-36 shrink-0">
                      <span className="text-[9px] text-muted-foreground">Vol</span>
                      <Slider min={0} max={1} step={0.05} value={[l.volume]} onValueChange={([v]) => updateLayer(l.id, { volume: v })} />
                    </div>
                    <div className="flex items-center gap-1 w-24 shrink-0">
                      <span className="text-[9px] text-muted-foreground">Start</span>
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        value={l.startSec}
                        onChange={(e) => updateLayer(l.id, { startSec: Math.max(0, Number(e.target.value) || 0) })}
                        className="h-7 text-[10px] px-1"
                      />
                      <span className="text-[9px] text-muted-foreground">s</span>
                    </div>
                    <button onClick={() => removeLayer(l.id)} className="p-1.5 rounded-md text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <p className="text-[10px] text-center text-muted-foreground">
            Tip: drag inside a scene to look around · Playback plays scenes back-to-back with all audio layers mixed live.
          </p>
        </div>
      </PageShell>
    </>
  );
};

export default ImmersiveMovieStudioPage;
