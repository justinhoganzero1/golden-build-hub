import { useCallback, useEffect, useRef, useState } from "react";
import SEO from "@/components/SEO";
import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload, Play, Pause, Plus, Trash2, Volume2, VolumeX, Film, Layers, Image as ImageIcon,
  ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Save, FolderOpen, Download, Loader2,
  Sparkles, Wand2, BookOpen, RefreshCw, Captions, AlertTriangle, Mic,
} from "lucide-react";
import { CURATED_ELEVENLABS_VOICES } from "@/data/elevenLabsVoices";
import { Progress } from "@/components/ui/progress";
import Photo3DViewer, { type CameraMovement } from "@/components/Photo3DViewer";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const MAX_AUDIO_LAYERS = 20;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB per file
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ALLOWED_AUDIO = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/webm", "audio/aac", "audio/mp4", "audio/x-m4a", "audio/flac"];
const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const AUTOSAVE_DRAFT_KEY = "immersive-movie:draft";
const AUTOSAVE_DEBOUNCE_MS = 1500;

const CAMERA_OPTIONS: { value: CameraMovement; label: string }[] = [
  { value: "static", label: "Static (viewer looks around)" },
  { value: "orbit", label: "Gentle orbit" },
  { value: "pan", label: "Pan left↔right" },
  { value: "zoom-in", label: "Slow zoom in" },
  { value: "zoom-out", label: "Slow zoom out" },
];

type ExportFormat = "mp4" | "webm";
type ExportResolution = 720 | 1080 | 1440 | 2160;
interface ExportSettings {
  format: ExportFormat;
  resolution: ExportResolution;
  fps: number;
  bitrateMbps: number;
}
const DEFAULT_EXPORT: ExportSettings = { format: "mp4", resolution: 1080, fps: 30, bitrateMbps: 6 };

type SavedStatus = "idle" | "dirty" | "saving" | "saved" | "error";

// Default Aussie voice (Charlie). User can change per-scene.
const AUSSIE_VOICE_ID = "IKne3meq5aSn9XLyUdCD";

interface Scene {
  id: string;
  imageUrl: string;
  storagePath?: string;
  name: string;
  durationSec: number;
  depth: number;
  movement: CameraMovement;
  /** Original text prompt used to generate the visuals (enables per-scene regenerate). */
  prompt?: string;
  /** Scripted dialogue / caption shown as burned-in subtitle during playback + export. */
  caption?: string;
  /** ElevenLabs voice used for this scene's dialogue (defaults to Aussie Charlie). */
  dialogueVoiceId?: string;
  /** Blob URL (or signed URL after reload) of the generated dialogue audio. */
  dialogueUrl?: string;
  /** Cloud storage path once persisted. */
  dialogueStoragePath?: string;
}

interface AudioLayer {
  id: string;
  name: string;
  url: string;
  storagePath?: string;
  volume: number;
  muted: boolean;
  startSec: number;
  el?: HTMLAudioElement;
}

interface ProjectRow {
  id: string;
  name: string;
  updated_at: string;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const projectNameSchema = z.string().trim().min(1, "Name required").max(80, "Max 80 characters");

const ImmersiveMovieStudioPage = () => {
  const { user } = useAuth();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [layers, setLayers] = useState<AudioLayer[]>([]);
  const [playing, setPlaying] = useState(false);
  const [projectName, setProjectName] = useState("Untitled movie");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [savedProjects, setSavedProjects] = useState<ProjectRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportSettings, setExportSettings] = useState<ExportSettings>(DEFAULT_EXPORT);
  const [savedStatus, setSavedStatus] = useState<SavedStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const autosaveTimer = useRef<number | null>(null);
  const skipDirtyRef = useRef(true);
  const playTimer = useRef<number | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Add-scene dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"choose" | "prompt" | "story">("choose");
  const [scenePrompt, setScenePrompt] = useState("");
  const [storyIdea, setStoryIdea] = useState("");
  const [storyLength, setStoryLength] = useState(6);
  const [genBusy, setGenBusy] = useState(false);
  const [genProgress, setGenProgress] = useState<{ done: number; total: number; label?: string } | null>(null);
  const [genErrors, setGenErrors] = useState<string[]>([]);
  const [regenBusyId, setRegenBusyId] = useState<string | null>(null);
  const [dialogueBusyId, setDialogueBusyId] = useState<string | null>(null);
  const [defaultVoiceId, setDefaultVoiceId] = useState<string>(AUSSIE_VOICE_ID);
  const dialogueAudioRef = useRef<HTMLAudioElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const activeScene = scenes.find((s) => s.id === activeSceneId) ?? scenes[0];

  // ------------ Load saved project list ------------
  const refreshProjects = useCallback(async () => {
    if (!user) return;
    setLoadingList(true);
    const { data } = await supabase
      .from("immersive_movie_projects")
      .select("id, name, updated_at")
      .order("updated_at", { ascending: false })
      .limit(30);
    setSavedProjects((data as ProjectRow[]) ?? []);
    setLoadingList(false);
  }, [user]);
  useEffect(() => { refreshProjects(); }, [refreshProjects]);

  // ------------ Local draft restore on mount ------------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTOSAVE_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft?.projectName) setProjectName(draft.projectName);
      if (Array.isArray(draft?.scenes)) setScenes(draft.scenes);
      if (Array.isArray(draft?.layers)) setLayers(draft.layers);
      if (draft?.exportSettings) setExportSettings({ ...DEFAULT_EXPORT, ...draft.exportSettings });
      if (draft?.projectId) setProjectId(draft.projectId);
      if (draft?.activeSceneId) setActiveSceneId(draft.activeSceneId);
    } catch { /* ignore corrupt draft */ }
    // allow subsequent state changes to be treated as dirty
    setTimeout(() => { skipDirtyRef.current = false; }, 0);
  }, []);

  // ------------ Autosave: local draft + debounced cloud save ------------
  useEffect(() => {
    if (skipDirtyRef.current) return;
    // Local draft snapshot (excludes blob URLs so we only persist metadata we can recreate)
    try {
      const draft = {
        projectName, projectId, activeSceneId, exportSettings,
        scenes: scenes.map((s) => ({ ...s, imageUrl: s.storagePath ? "" : s.imageUrl })),
        layers: layers.map((l) => ({ ...l, url: l.storagePath ? "" : l.url, el: undefined })),
      };
      localStorage.setItem(AUTOSAVE_DRAFT_KEY, JSON.stringify(draft));
    } catch { /* quota */ }
    setSavedStatus("dirty");
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    if (user && projectId) {
      autosaveTimer.current = window.setTimeout(() => { void handleSave(true); }, AUTOSAVE_DEBOUNCE_MS);
    }
    return () => { if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes, layers, projectName, exportSettings, activeSceneId]);

  // ------------ Scene upload (validated) ------------
  const onImageFiles = (files: FileList | null) => {
    if (!files) return;
    const accepted: Scene[] = [];
    const errors: string[] = [];
    Array.from(files).forEach((f) => {
      if (!ALLOWED_IMAGE.includes(f.type)) { errors.push(`${f.name}: unsupported image format`); return; }
      if (f.size > MAX_IMAGE_BYTES) { errors.push(`${f.name}: over 15 MB`); return; }
      accepted.push({
        id: uid(),
        imageUrl: URL.createObjectURL(f),
        name: f.name.replace(/\.[^.]+$/, ""),
        durationSec: 6,
        depth: 0.35,
        movement: "orbit",
      });
    });
    if (errors.length) toast.error(errors.slice(0, 3).join(" • "));
    if (accepted.length) {
      setScenes((prev) => {
        const merged = [...prev, ...accepted];
        if (!activeSceneId) setActiveSceneId(merged[0].id);
        return merged;
      });
      toast.success(`Added ${accepted.length} scene${accepted.length > 1 ? "s" : ""}`);
    }
  };

  const removeScene = (id: string) => {
    setScenes((prev) => prev.filter((s) => s.id !== id));
    if (activeSceneId === id) setActiveSceneId(null);
  };

  const moveScene = (id: string, dir: -1 | 1) => {
    setScenes((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const patchScene = (id: string, patch: Partial<Scene>) =>
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  // ------------ AI scene generation ------------
  const motionToMovement = (m?: string): CameraMovement => {
    switch (m) {
      case "pan-left":
      case "pan-right": return "pan";
      case "zoom-in":   return "zoom-in";
      case "zoom-out":  return "zoom-out";
      case "ken-burns": return "orbit";
      case "static":    return "static";
      default:          return "orbit";
    }
  };

  const generateSceneImage = async (prompt: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("image-gen", {
      body: { prompt, tier: "premium" },
    });
    if (error) throw new Error(error.message ?? "Image generation failed");
    if ((data as any)?.error && !(data as any)?.images?.length) {
      throw new Error((data as any).error);
    }
    const url = (data as any)?.images?.[0]?.image_url?.url
      || (data as any)?.images?.[0]?.url
      || (typeof (data as any)?.images?.[0] === "string" ? (data as any).images[0] : null);
    if (!url) throw new Error("No image returned");
    return url as string;
  };

  const addGeneratedScene = async () => {
    const prompt = scenePrompt.trim();
    if (prompt.length < 8) { toast.error("Describe the scene in at least a few words"); return; }
    if (!user) { toast.error("Sign in to generate scenes"); return; }
    setGenBusy(true);
    setGenErrors([]);
    setGenProgress({ done: 0, total: 1, label: "Generating scene…" });
    try {
      const url = await generateSceneImage(prompt);
      const scene: Scene = {
        id: uid(),
        imageUrl: url,
        name: prompt.slice(0, 50),
        durationSec: 6,
        depth: 0.35,
        movement: "orbit",
        prompt,
        caption: prompt.slice(0, 140),
      };
      setScenes((prev) => {
        const next = [...prev, scene];
        if (!activeSceneId) setActiveSceneId(scene.id);
        return next;
      });
      setGenProgress({ done: 1, total: 1, label: "Done" });
      toast.success("Scene generated");
      setScenePrompt("");
      setAddOpen(false);
      setAddMode("choose");
    } catch (e: any) {
      const msg = e?.message ?? "Generation failed";
      setGenErrors([msg]);
      toast.error(msg);
    } finally {
      setGenBusy(false);
      window.setTimeout(() => setGenProgress(null), 800);
    }
  };

  const regenerateScene = async (sceneId: string) => {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    const promptText = (scene.prompt ?? scene.caption ?? scene.name ?? "").trim();
    if (promptText.length < 8) {
      toast.error("This scene has no prompt to regenerate from. Edit its prompt below first.");
      return;
    }
    setRegenBusyId(sceneId);
    try {
      const url = await generateSceneImage(promptText);
      patchScene(sceneId, { imageUrl: url, storagePath: undefined });
      toast.success("Scene regenerated");
    } catch (e: any) {
      toast.error(`Regenerate failed: ${e?.message ?? "unknown"}`);
    } finally {
      setRegenBusyId(null);
    }
  };

  // ------------ ElevenLabs per-scene dialogue ------------
  const generateSceneDialogue = async (sceneId: string) => {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    const text = (scene.caption ?? "").trim();
    if (text.length < 2) { toast.error("Add scripted dialogue in the caption field first"); return; }
    if (!user) { toast.error("Sign in to generate voice audio"); return; }
    const voiceId = scene.dialogueVoiceId || defaultVoiceId || AUSSIE_VOICE_ID;
    setDialogueBusyId(sceneId);
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-tts", {
        body: { text, voiceId },
      });
      if (error) throw new Error(error.message ?? "TTS failed");
      // Edge function returns either a Blob (audio/mpeg) or a JSON fallback {error, fallback:true}
      let blob: Blob;
      if (data instanceof Blob) {
        blob = data;
      } else if (data && typeof data === "object" && (data as any).fallback) {
        throw new Error("ElevenLabs unavailable — connect the ElevenLabs account or add ELEVENLABS_API_KEY");
      } else {
        // supabase-js may auto-parse; fall back to raw fetch
        const resp = await fetch(
          `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/elevenlabs-tts`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
              Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ""}`,
            },
            body: JSON.stringify({ text, voiceId }),
          }
        );
        if (!resp.ok) throw new Error(`TTS HTTP ${resp.status}`);
        const ct = resp.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const j = await resp.json();
          throw new Error(j?.error || "TTS unavailable");
        }
        blob = await resp.blob();
      }
      const url = URL.createObjectURL(blob);
      patchScene(sceneId, { dialogueUrl: url, dialogueVoiceId: voiceId, dialogueStoragePath: undefined });
      toast.success("Dialogue generated");
    } catch (e: any) {
      toast.error(`Dialogue failed: ${e?.message ?? "unknown"}`);
    } finally {
      setDialogueBusyId(null);
    }
  };

    const story = storyIdea.trim();
    if (story.length < 12) { toast.error("Give me a bit more of the story idea"); return; }
    if (!user) { toast.error("Sign in to generate storyboards"); return; }
    const target = Math.max(2, Math.min(20, storyLength));
    setGenBusy(true);
    setGenErrors([]);
    setGenProgress({ done: 0, total: target, label: "Planning story…" });
    const failures: string[] = [];
    try {
      const { data: planData, error: planErr } = await supabase.functions.invoke("script-to-scenes", {
        body: { script: story, intent: "Immersive 3D still-image movie", targetDurationSec: target * 6 },
      });
      if (planErr) throw new Error(planErr.message ?? "Story planning failed");
      const planScenes: Array<{ caption?: string; photo_prompt: string; motion?: string; duration_sec?: number }> =
        (planData as any)?.scenes ?? [];
      if (!planScenes.length) throw new Error("The planner returned no scenes");
      const plan = planScenes.slice(0, target);
      setGenProgress({ done: 0, total: plan.length, label: `Building scene 1 of ${plan.length}…` });

      let firstIdSet = !activeSceneId;
      for (let i = 0; i < plan.length; i++) {
        const p = plan[i];
        try {
          const url = await generateSceneImage(p.photo_prompt);
          const scene: Scene = {
            id: uid(),
            imageUrl: url,
            name: (p.caption ?? `Scene ${i + 1}`).slice(0, 60),
            durationSec: Math.max(1, Math.min(60, Math.round(p.duration_sec ?? 6))),
            depth: 0.35,
            movement: motionToMovement(p.motion),
            prompt: p.photo_prompt,
            caption: (p.caption ?? "").slice(0, 200),
          };
          setScenes((prev) => {
            const next = [...prev, scene];
            if (!firstIdSet) { setActiveSceneId(scene.id); firstIdSet = true; }
            return next;
          });
        } catch (err: any) {
          const msg = `Scene ${i + 1}: ${err?.message ?? "unknown error"}`;
          failures.push(msg);
          toast.warning(msg);
        }
        setGenProgress({ done: i + 1, total: plan.length, label: `Built ${i + 1} of ${plan.length}` });
      }
      if (failures.length) setGenErrors(failures);
      const built = plan.length - failures.length;
      if (built > 0) toast.success(`Storyboard built: ${built} scenes${failures.length ? ` · ${failures.length} failed` : ""}`);
      else toast.error("No scenes could be generated. See error details.");
      if (!failures.length) {
        setStoryIdea("");
        setAddOpen(false);
        setAddMode("choose");
      }
    } catch (e: any) {
      const msg = e?.message ?? "Storyboard generation failed";
      setGenErrors((prev) => [msg, ...prev, ...failures]);
      toast.error(msg);
    } finally {
      setGenBusy(false);
      window.setTimeout(() => setGenProgress(null), 1200);
    }
  };

  // ------------ Audio layers (validated + capped) ------------
  const onAudioFiles = (files: FileList | null) => {
    if (!files) return;
    const remaining = MAX_AUDIO_LAYERS - layers.length;
    if (remaining <= 0) {
      toast.error(`You've reached the maximum of ${MAX_AUDIO_LAYERS} audio layers. Remove one before adding more.`);
      return;
    }
    const incoming = Array.from(files);
    if (incoming.length > remaining) {
      toast.warning(`Only adding ${remaining} of ${incoming.length} — max ${MAX_AUDIO_LAYERS} layers total.`);
    }
    const picked = incoming.slice(0, remaining);
    const accepted: AudioLayer[] = [];
    const rejected: string[] = [];
    picked.forEach((f) => {
      const typeOk = ALLOWED_AUDIO.includes(f.type) || /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(f.name);
      if (!typeOk) { rejected.push(`${f.name}: unsupported audio format`); return; }
      if (f.size > MAX_AUDIO_BYTES) { rejected.push(`${f.name}: over 25 MB`); return; }
      accepted.push({
        id: uid(),
        name: f.name,
        url: URL.createObjectURL(f),
        volume: 0.8,
        muted: false,
        startSec: 0,
      });
    });
    if (rejected.length) toast.error(rejected.slice(0, 3).join(" • "));
    if (accepted.length) setLayers((prev) => [...prev, ...accepted]);
  };

  const updateLayer = (id: string, patch: Partial<AudioLayer>) =>
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const removeLayer = (id: string) => {
    setLayers((prev) => {
      const l = prev.find((x) => x.id === id);
      l?.el?.pause();
      return prev.filter((x) => x.id !== id);
    });
  };

  // ------------ Playback ------------
  const stopAll = useCallback(() => {
    if (playTimer.current) { window.clearTimeout(playTimer.current); playTimer.current = null; }
    layers.forEach((l) => { if (l.el) { l.el.pause(); l.el.currentTime = 0; } });
    setPlaying(false);
  }, [layers]);

  const startPlayback = () => {
    if (!scenes.length) { toast.error("Add at least one scene"); return; }
    setPlaying(true);
    layers.forEach((l) => {
      const el = l.el ?? new Audio(l.url);
      el.loop = false;
      el.volume = l.muted ? 0 : l.volume;
      el.currentTime = 0;
      window.setTimeout(() => el.play().catch(() => {}), l.startSec * 1000);
      updateLayer(l.id, { el });
    });
    let idx = scenes.findIndex((s) => s.id === activeSceneId);
    if (idx < 0) idx = 0;
    setActiveSceneId(scenes[idx].id);
    const step = () => {
      idx += 1;
      if (idx >= scenes.length) { stopAll(); return; }
      setActiveSceneId(scenes[idx].id);
      playTimer.current = window.setTimeout(step, scenes[idx].durationSec * 1000);
    };
    playTimer.current = window.setTimeout(step, scenes[idx].durationSec * 1000);
  };

  useEffect(() => () => stopAll(), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    layers.forEach((l) => { if (l.el) l.el.volume = l.muted ? 0 : l.volume; });
  }, [layers]);

  const gotoOffset = (delta: number) => {
    if (!activeScene) return;
    const i = scenes.findIndex((s) => s.id === activeScene.id);
    const j = Math.max(0, Math.min(scenes.length - 1, i + delta));
    setActiveSceneId(scenes[j].id);
  };

  // ------------ Save / Load ------------
  const uploadBlobToStorage = async (url: string, existingPath: string | undefined, folder: string, filename: string) => {
    if (existingPath) return existingPath;
    if (!user) throw new Error("Not authenticated");
    const blob = await fetch(url).then((r) => r.blob());
    const path = `${user.id}/${folder}/${uid()}-${filename}`.replace(/[^a-zA-Z0-9/_.-]/g, "_");
    const { error } = await supabase.storage.from("immersive-movies").upload(path, blob, { upsert: false, contentType: blob.type || undefined });
    if (error) throw error;
    return path;
  };

  const signStoragePath = async (path: string) => {
    const { data, error } = await supabase.storage.from("immersive-movies").createSignedUrl(path, 60 * 60 * 6);
    if (error || !data) throw error ?? new Error("Failed to sign URL");
    return data.signedUrl;
  };

  const handleSave = async (silent = false) => {
    if (!user) { if (!silent) toast.error("Sign in to save projects"); return; }
    const parsed = projectNameSchema.safeParse(projectName);
    if (!parsed.success) { if (!silent) toast.error(parsed.error.issues[0].message); return; }
    setSaving(true);
    setSavedStatus("saving");
    try {
      const scenesToSave = await Promise.all(scenes.map(async (s) => ({
        id: s.id,
        name: s.name,
        durationSec: s.durationSec,
        depth: s.depth,
        movement: s.movement,
        storagePath: await uploadBlobToStorage(s.imageUrl, s.storagePath, "images", `${s.name}.img`),
      })));
      const layersToSave = await Promise.all(layers.map(async (l) => ({
        id: l.id,
        name: l.name,
        volume: l.volume,
        muted: l.muted,
        startSec: l.startSec,
        storagePath: await uploadBlobToStorage(l.url, l.storagePath, "audio", l.name),
      })));
      const payload = { scenes: scenesToSave, layers: layersToSave, exportSettings };
      if (projectId) {
        const { error } = await supabase
          .from("immersive_movie_projects")
          .update({ name: parsed.data, data: payload as any, updated_at: new Date().toISOString() })
          .eq("id", projectId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("immersive_movie_projects")
          .insert({ user_id: user.id, name: parsed.data, data: payload as any })
          .select("id")
          .single();
        if (error) throw error;
        setProjectId(data.id);
      }
      // Sync storagePaths back onto local state so subsequent saves skip re-upload
      setScenes((prev) => prev.map((s) => { const m = scenesToSave.find(x => x.id === s.id); return m ? { ...s, storagePath: m.storagePath } : s; }));
      setLayers((prev) => prev.map((l) => { const m = layersToSave.find(x => x.id === l.id); return m ? { ...l, storagePath: m.storagePath } : l; }));
      setSavedStatus("saved");
      setLastSavedAt(new Date());
      if (!silent) toast.success("Project saved");
      refreshProjects();
    } catch (e: any) {
      setSavedStatus("error");
      if (!silent) toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleOpen = async (id: string) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("immersive_movie_projects")
        .select("id, name, data")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) throw error ?? new Error("Not found");
      const payload = (data.data as any) ?? {};
      const scenesIn = (payload.scenes ?? []) as any[];
      const layersIn = (payload.layers ?? []) as any[];
      const restoredScenes: Scene[] = await Promise.all(scenesIn.map(async (s) => ({
        id: s.id ?? uid(),
        name: s.name ?? "Scene",
        durationSec: s.durationSec ?? 6,
        depth: s.depth ?? 0.35,
        movement: (s.movement as CameraMovement) ?? "orbit",
        storagePath: s.storagePath,
        imageUrl: await signStoragePath(s.storagePath),
      })));
      const restoredLayers: AudioLayer[] = await Promise.all(layersIn.map(async (l) => ({
        id: l.id ?? uid(),
        name: l.name ?? "Track",
        volume: l.volume ?? 0.8,
        muted: !!l.muted,
        startSec: l.startSec ?? 0,
        storagePath: l.storagePath,
        url: await signStoragePath(l.storagePath),
      })));
      setScenes(restoredScenes);
      setLayers(restoredLayers);
      setActiveSceneId(restoredScenes[0]?.id ?? null);
      setProjectId(data.id);
      setProjectName(data.name);
      toast.success(`Opened "${data.name}"`);
    } catch (e: any) {
      toast.error(e?.message ?? "Open failed");
    } finally {
      setSaving(false);
    }
  };

  const handleNewProject = () => {
    stopAll();
    setScenes([]); setLayers([]); setActiveSceneId(null);
    setProjectId(null); setProjectName("Untitled movie");
  };

  // ------------ Export (MediaRecorder over canvas + WebAudio mix) ------------
  const handleExport = async () => {
    if (!scenes.length) { toast.error("Add scenes first"); return; }
    if (exporting) return;
    const canvas = viewerRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) { toast.error("Viewer not ready"); return; }
    setExporting(true);
    setExportProgress(0);
    const totalMs = scenes.reduce((a, s) => a + s.durationSec * 1000, 0);
    try {
      // Composite canvas = live 3D canvas + burned-in caption text so subtitles
      // land in the exported video (canvas.captureStream would miss HTML overlays).
      const composite = document.createElement("canvas");
      composite.width = canvas.width || 1280;
      composite.height = canvas.height || 720;
      const cctx = composite.getContext("2d");
      if (!cctx) throw new Error("Could not create export canvas");
      let currentCaption = scenes[0]?.caption ?? "";
      let rafId = 0;
      const drawCaption = (text: string) => {
        if (!text) return;
        const w = composite.width;
        const h = composite.height;
        const fontSize = Math.max(18, Math.round(h * 0.038));
        cctx.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
        cctx.textAlign = "center";
        cctx.textBaseline = "bottom";
        // Naive wrap
        const maxWidth = w * 0.86;
        const words = text.split(/\s+/);
        const lines: string[] = [];
        let line = "";
        words.forEach((word) => {
          const test = line ? `${line} ${word}` : word;
          if (cctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
          else line = test;
        });
        if (line) lines.push(line);
        const padX = fontSize * 0.7;
        const padY = fontSize * 0.4;
        const lineH = fontSize * 1.25;
        const boxH = lines.length * lineH + padY * 2;
        const boxY = h - Math.round(h * 0.09) - boxH;
        // Background pill
        cctx.fillStyle = "rgba(0,0,0,0.7)";
        const boxW = Math.min(maxWidth + padX * 2, w * 0.94);
        const boxX = (w - boxW) / 2;
        const r = 12;
        cctx.beginPath();
        cctx.moveTo(boxX + r, boxY);
        cctx.lineTo(boxX + boxW - r, boxY);
        cctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + r);
        cctx.lineTo(boxX + boxW, boxY + boxH - r);
        cctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - r, boxY + boxH);
        cctx.lineTo(boxX + r, boxY + boxH);
        cctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - r);
        cctx.lineTo(boxX, boxY + r);
        cctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
        cctx.closePath();
        cctx.fill();
        // Text
        cctx.fillStyle = "#ffffff";
        lines.forEach((ln, i) => {
          cctx.fillText(ln, w / 2, boxY + padY + (i + 1) * lineH - fontSize * 0.25);
        });
      };
      const renderLoop = () => {
        try {
          cctx.drawImage(canvas, 0, 0, composite.width, composite.height);
          if (currentCaption) drawCaption(currentCaption);
        } catch { /* frame skip */ }
        rafId = requestAnimationFrame(renderLoop);
      };
      rafId = requestAnimationFrame(renderLoop);

      const videoStream = composite.captureStream(exportSettings.fps);
      const AudioCtx: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ac = new AudioCtx();
      const dest = ac.createMediaStreamDestination();
      const els: HTMLAudioElement[] = [];
      layers.forEach((l) => {
        const el = new Audio(l.url);
        el.crossOrigin = "anonymous";
        el.volume = 1;
        const src = ac.createMediaElementSource(el);
        const gain = ac.createGain();
        gain.gain.value = l.muted ? 0 : l.volume;
        src.connect(gain).connect(dest);
        els.push(el);
      });
      const combined = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);
      const preferMp4 = exportSettings.format === "mp4";
      const candidates = preferMp4
        ? ["video/mp4;codecs=h264,aac", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"]
        : ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
      const mime = candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? "video/webm";
      if (preferMp4 && !mime.includes("mp4")) {
        toast.warning("MP4 not supported in this browser — exporting WEBM instead");
      }
      const recorder = new MediaRecorder(combined, {
        mimeType: mime,
        videoBitsPerSecond: exportSettings.bitrateMbps * 1_000_000,
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const done = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
      recorder.start(200);

      layers.forEach((l, i) => window.setTimeout(() => els[i].play().catch(() => {}), l.startSec * 1000));
      const startedAt = performance.now();
      let idx = 0;
      setActiveSceneId(scenes[0].id);
      currentCaption = scenes[0].caption ?? "";
      const advance = () => {
        idx += 1;
        if (idx >= scenes.length) return;
        setActiveSceneId(scenes[idx].id);
        currentCaption = scenes[idx].caption ?? "";
        window.setTimeout(advance, scenes[idx].durationSec * 1000);
      };
      window.setTimeout(advance, scenes[0].durationSec * 1000);

      const progressTimer = window.setInterval(() => {
        setExportProgress(Math.min(99, ((performance.now() - startedAt) / totalMs) * 100));
      }, 200);

      await new Promise((r) => window.setTimeout(r, totalMs + 250));
      recorder.stop();
      els.forEach((e) => e.pause());
      await done;
      window.clearInterval(progressTimer);
      cancelAnimationFrame(rafId);
      ac.close();

      const ext = mime.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(chunks, { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName.replace(/[^\w-]+/g, "_")}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      setExportProgress(100);
      toast.success(`Exported ${ext.toUpperCase()} (${(blob.size / 1024 / 1024).toFixed(1)} MB)`);
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    } finally {
      setExporting(false);
      window.setTimeout(() => setExportProgress(0), 1500);
    }
  };

  return (
    <>
      <SEO
        title="Immersive Movie Studio — 3D Stills + 20 Audio Layers"
        description="Turn stills into an explorable 3D movie. Timeline, camera moves, 20-track mixer, MP4 export."
        path="/immersive-movie-studio"
      />
      <PageShell title="🎞️ Immersive Movie Studio" subtitle="Timeline · 3D scenes · 20 audio layers · MP4 export">
        <div className="max-w-6xl mx-auto p-4 space-y-4">
          {/* Project bar */}
          <Card className="p-3 flex flex-wrap items-center gap-2">
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              maxLength={80}
              className="max-w-xs h-9"
              placeholder="Project name"
            />
            <Button size="sm" onClick={() => handleSave(false)} disabled={saving || !user}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              {projectId ? "Save" : "Save new"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleNewProject}>New</Button>
            <Select onValueChange={handleOpen}>
              <SelectTrigger className="h-9 w-56"><SelectValue placeholder={loadingList ? "Loading..." : "Open saved project"} /></SelectTrigger>
              <SelectContent>
                {savedProjects.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No saved projects yet</div>
                ) : savedProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div
              data-testid="saved-status"
              data-status={savedStatus}
              className={`text-[11px] px-2 py-1 rounded ${
                savedStatus === "saved" ? "text-emerald-500" :
                savedStatus === "saving" ? "text-amber-500" :
                savedStatus === "dirty" ? "text-muted-foreground" :
                savedStatus === "error" ? "text-destructive" : "text-muted-foreground"
              }`}
              aria-live="polite"
            >
              {savedStatus === "saving" ? "Saving…" :
               savedStatus === "saved" ? `Saved${lastSavedAt ? ` · ${lastSavedAt.toLocaleTimeString()}` : ""}` :
               savedStatus === "dirty" ? (user && projectId ? "Unsaved changes…" : "Draft (local)") :
               savedStatus === "error" ? "Save failed" : (user ? "Ready" : "Sign in to sync")}
            </div>
            <div className="flex-1" />
            {/* Export settings */}
            <Select value={exportSettings.format} onValueChange={(v: ExportFormat) => setExportSettings((p) => ({ ...p, format: v }))}>
              <SelectTrigger className="h-9 w-24" aria-label="Export format"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mp4">MP4</SelectItem>
                <SelectItem value="webm">WEBM</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(exportSettings.resolution)} onValueChange={(v) => setExportSettings((p) => ({ ...p, resolution: Number(v) as ExportResolution }))}>
              <SelectTrigger className="h-9 w-28" aria-label="Resolution"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="720">720p</SelectItem>
                <SelectItem value="1080">1080p</SelectItem>
                <SelectItem value="1440">1440p</SelectItem>
                <SelectItem value="2160">4K</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(exportSettings.fps)} onValueChange={(v) => setExportSettings((p) => ({ ...p, fps: Number(v) }))}>
              <SelectTrigger className="h-9 w-20" aria-label="Frame rate"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="24">24</SelectItem>
                <SelectItem value="30">30</SelectItem>
                <SelectItem value="60">60</SelectItem>
              </SelectContent>
            </Select>
            <label className="text-[10px] text-muted-foreground flex items-center gap-1">
              Bitrate
              <Input
                type="number" min={1} max={40}
                value={exportSettings.bitrateMbps}
                onChange={(e) => setExportSettings((p) => ({ ...p, bitrateMbps: Math.max(1, Math.min(40, Number(e.target.value) || 1)) }))}
                className="h-8 w-16 text-[11px]"
                aria-label="Bitrate Mbps"
              />
              Mbps
            </label>
            <Button size="sm" variant="secondary" onClick={handleExport} disabled={exporting || !scenes.length}>
              {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
              {exporting ? `Exporting ${Math.round(exportProgress)}%` : `Export ${exportSettings.format.toUpperCase()}`}
            </Button>
          </Card>

          {/* Viewer */}
          <Card className="p-0 overflow-hidden border-primary/30">
            <div ref={viewerRef} className="relative aspect-video bg-black">
              {activeScene ? (
                <Photo3DViewer
                  imageUrl={activeScene.imageUrl}
                  depth={activeScene.depth}
                  movement={playing || exporting ? activeScene.movement : "static"}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
                  <ImageIcon className="w-10 h-10" />
                  <p className="text-sm">Upload stills below to enter your first scene</p>
                </div>
              )}
              {activeScene?.caption && (
                <div
                  data-testid="scene-caption"
                  className="absolute inset-x-0 bottom-16 flex justify-center px-4 pointer-events-none"
                >
                  <div className="max-w-[90%] px-4 py-2 rounded-md bg-black/70 text-white text-sm text-center leading-snug shadow-lg backdrop-blur-sm">
                    {activeScene.caption}
                  </div>
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

          {/* Generation progress + error panel */}
          {(genProgress || genErrors.length > 0) && (
            <Card className="p-3 space-y-2 border-primary/40">
              {genProgress && (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      {genProgress.label ?? "Working…"}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {genProgress.done}/{genProgress.total}
                    </span>
                  </div>
                  <Progress value={genProgress.total ? (genProgress.done / genProgress.total) * 100 : 0} className="h-2" />
                </>
              )}
              {genErrors.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1 text-destructive font-semibold">
                      <AlertTriangle className="w-3 h-3" /> {genErrors.length} error{genErrors.length === 1 ? "" : "s"}
                    </span>
                    <button className="text-[10px] underline text-muted-foreground" onClick={() => setGenErrors([])}>
                      Dismiss
                    </button>
                  </div>
                  <ul className="text-[11px] text-destructive space-y-0.5 max-h-24 overflow-auto">
                    {genErrors.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                </div>
              )}
            </Card>
          )}

          {/* Timeline / Scenes */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Film className="w-4 h-4 text-primary" /> Timeline
                <span className="text-[10px] text-muted-foreground font-normal">
                  {scenes.length} scene{scenes.length === 1 ? "" : "s"} · {scenes.reduce((a, s) => a + s.durationSec, 0)}s total
                </span>
              </h3>
              <Button
                size="sm"
                onClick={() => { setAddMode("choose"); setAddOpen(true); }}
                className="h-8"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add scene
              </Button>
              <input
                ref={uploadInputRef}
                type="file"
                accept={ALLOWED_IMAGE.join(",")}
                multiple
                className="hidden"
                onChange={(e) => { onImageFiles(e.target.files); if (uploadInputRef.current) uploadInputRef.current.value = ""; }}
              />
            </div>
            {scenes.length === 0 ? (
              <p className="text-xs text-muted-foreground">No scenes yet. JPG, PNG, WEBP, or GIF up to 15 MB.</p>
            ) : (
              <div className="space-y-2">
                {scenes.map((s, i) => (
                  <div
                    key={s.id}
                    data-testid="timeline-scene"
                    className={`flex items-start gap-3 p-2 rounded-lg border-2 ${s.id === activeScene?.id ? "border-primary" : "border-border"}`}
                  >
                    <div className="flex flex-col gap-1 pt-1">
                      <button onClick={() => moveScene(s.id, -1)} disabled={i === 0} className="p-1 rounded disabled:opacity-30 hover:bg-secondary">
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button onClick={() => moveScene(s.id, 1)} disabled={i === scenes.length - 1} className="p-1 rounded disabled:opacity-30 hover:bg-secondary">
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                    <img
                      src={s.imageUrl}
                      alt={s.name}
                      className="w-24 aspect-video object-cover rounded cursor-pointer shrink-0"
                      onClick={() => setActiveSceneId(s.id)}
                    />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground">#{i + 1}</span>
                        <Input
                          value={s.name}
                          onChange={(e) => patchScene(s.id, { name: e.target.value.slice(0, 60) })}
                          className="h-7 text-xs flex-1"
                          placeholder="Scene label"
                        />
                      </div>
                      <label className="text-[10px] text-muted-foreground flex items-start gap-1">
                        <Captions className="w-3 h-3 mt-1 shrink-0" />
                        <Textarea
                          value={s.caption ?? ""}
                          onChange={(e) => patchScene(s.id, { caption: e.target.value.slice(0, 200) })}
                          placeholder="Scripted dialogue / subtitle shown during this scene (also burned into export)"
                          className="min-h-[36px] text-[11px] py-1 flex-1"
                          rows={1}
                        />
                      </label>
                      <label className="text-[10px] text-muted-foreground flex items-start gap-1">
                        <Wand2 className="w-3 h-3 mt-1 shrink-0" />
                        <Textarea
                          value={s.prompt ?? ""}
                          onChange={(e) => patchScene(s.id, { prompt: e.target.value.slice(0, 800) })}
                          placeholder="Visual prompt (edit and click regenerate to remake just this scene)"
                          className="min-h-[36px] text-[11px] py-1 flex-1"
                          rows={1}
                        />
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                          Duration
                          <Input
                            type="number" min={1} max={60}
                            value={s.durationSec}
                            onChange={(e) => patchScene(s.id, { durationSec: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })}
                            className="h-7 w-16 text-[11px]"
                          />
                          s
                        </label>
                        <label className="text-[10px] text-muted-foreground flex items-center gap-1 w-40">
                          3D depth
                          <Slider min={0} max={1} step={0.05} value={[s.depth]} onValueChange={([v]) => patchScene(s.id, { depth: v })} className="flex-1" />
                        </label>
                        <Select value={s.movement} onValueChange={(v: CameraMovement) => patchScene(s.id, { movement: v })}>
                          <SelectTrigger className="h-7 w-48 text-[11px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CAMERA_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          disabled={regenBusyId === s.id || !user}
                          onClick={() => regenerateScene(s.id)}
                          title="Regenerate visuals from this scene's prompt"
                        >
                          {regenBusyId === s.id
                            ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            : <RefreshCw className="w-3 h-3 mr-1" />}
                          Regenerate
                        </Button>
                      </div>
                    </div>
                    <button onClick={() => removeScene(s.id)} className="p-1.5 rounded text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4" />
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
                <span className={`text-[10px] font-normal ${layers.length >= MAX_AUDIO_LAYERS ? "text-destructive" : "text-muted-foreground"}`}>
                  {layers.length}/{MAX_AUDIO_LAYERS}
                </span>
              </h3>
              <label className={`cursor-pointer ${layers.length >= MAX_AUDIO_LAYERS ? "opacity-40 pointer-events-none" : ""}`}>
                <input type="file" accept={ALLOWED_AUDIO.join(",")} multiple className="hidden" onChange={(e) => onAudioFiles(e.target.files)} />
                <span className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground">
                  <Plus className="w-3.5 h-3.5" /> Add audio
                </span>
              </label>
            </div>
            {layers.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                MP3, WAV, OGG, M4A, AAC, FLAC, or WEBM up to 25 MB each. Max {MAX_AUDIO_LAYERS} layers.
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
                        type="number" min={0} step={0.5}
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
            Export records the live 3D playback + audio mix from your browser. MP4 in Safari, WEBM elsewhere — both play everywhere.
          </p>
        </div>

        {/* Add-scene dialog: upload · prompt · storyboard */}
        <Dialog open={addOpen} onOpenChange={(o) => { if (!genBusy) { setAddOpen(o); if (!o) setAddMode("choose"); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {addMode === "choose" && <><Plus className="w-4 h-4" /> Add a scene</>}
                {addMode === "prompt" && <><Wand2 className="w-4 h-4" /> Generate a scene</>}
                {addMode === "story"  && <><BookOpen className="w-4 h-4" /> Generate a full storyboard</>}
              </DialogTitle>
              <DialogDescription>
                {addMode === "choose" && "Upload your own stills, describe a single 3D scene, or write a story idea and let the app build the whole movie."}
                {addMode === "prompt" && "Describe the shot in detail — subject, setting, lighting, camera, mood. It becomes one 3D still in your timeline."}
                {addMode === "story"  && "Type the story you want. The app will break it into linked scenes and generate each one so the whole movie runs end to end."}
              </DialogDescription>
            </DialogHeader>

            {addMode === "choose" && (
              <div className="grid gap-2 py-2">
                <Button variant="outline" className="justify-start h-auto py-3" onClick={() => { setAddOpen(false); uploadInputRef.current?.click(); }}>
                  <Upload className="w-4 h-4 mr-3 shrink-0" />
                  <div className="text-left">
                    <div className="text-sm font-semibold">Upload stills</div>
                    <div className="text-[11px] text-muted-foreground">Your own JPG/PNG/WEBP/GIF images.</div>
                  </div>
                </Button>
                <Button variant="outline" className="justify-start h-auto py-3" onClick={() => setAddMode("prompt")}>
                  <Wand2 className="w-4 h-4 mr-3 shrink-0" />
                  <div className="text-left">
                    <div className="text-sm font-semibold">Generate one scene from a prompt</div>
                    <div className="text-[11px] text-muted-foreground">Describe the 3D immersive scene and the app builds it.</div>
                  </div>
                </Button>
                <Button variant="outline" className="justify-start h-auto py-3" onClick={() => setAddMode("story")}>
                  <BookOpen className="w-4 h-4 mr-3 shrink-0" />
                  <div className="text-left">
                    <div className="text-sm font-semibold">Generate a full storyboard</div>
                    <div className="text-[11px] text-muted-foreground">Give the app a story idea — it links scenes into a full movie.</div>
                  </div>
                </Button>
              </div>
            )}

            {addMode === "prompt" && (
              <div className="space-y-3 py-2">
                <Textarea
                  value={scenePrompt}
                  onChange={(e) => setScenePrompt(e.target.value.slice(0, 800))}
                  placeholder="e.g. A Rottweiler in a Bintang singlet leans on a Bali beach bar at golden hour, ordering a cold Bintang. Photoreal 8K, warm rim light, shallow depth of field."
                  rows={5}
                  disabled={genBusy}
                />
                <div className="text-[10px] text-muted-foreground">{scenePrompt.length}/800</div>
              </div>
            )}

            {addMode === "story" && (
              <div className="space-y-3 py-2">
                <Textarea
                  value={storyIdea}
                  onChange={(e) => setStoryIdea(e.target.value.slice(0, 2000))}
                  placeholder="e.g. A Rottweiler who thinks he's human walks into a Bali beach bar in the late afternoon, orders a Bintang from the surprised bartender, tells everyone about his day, and stays until sunset."
                  rows={6}
                  disabled={genBusy}
                />
                <div className="flex items-center gap-3">
                  <label className="text-xs text-muted-foreground flex items-center gap-2 flex-1">
                    Number of scenes
                    <Slider
                      min={2} max={20} step={1}
                      value={[storyLength]}
                      onValueChange={([v]) => setStoryLength(v)}
                      disabled={genBusy}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono w-6 text-right">{storyLength}</span>
                  </label>
                </div>
                {genProgress && (
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Building scene {genProgress.done} of {genProgress.total}…
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              {addMode !== "choose" && (
                <Button variant="ghost" onClick={() => setAddMode("choose")} disabled={genBusy}>Back</Button>
              )}
              {addMode === "prompt" && (
                <Button onClick={addGeneratedScene} disabled={genBusy || scenePrompt.trim().length < 8}>
                  {genBusy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                  Generate scene
                </Button>
              )}
              {addMode === "story" && (
                <Button onClick={generateStoryboard} disabled={genBusy || storyIdea.trim().length < 12}>
                  {genBusy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                  Build storyboard
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageShell>
    </>

  );
};

export default ImmersiveMovieStudioPage;
