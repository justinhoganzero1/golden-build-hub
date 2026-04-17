import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Film, Wand2, Plus, Play, Pause, Download, Trash2, Sparkles, RefreshCw, Pencil, ImagePlus, Upload, Mic, Volume2, Music, Waves } from "lucide-react";
import { toast } from "sonner";
import { useSaveMedia } from "@/hooks/useUserAvatars";
import { useAuth } from "@/contexts/AuthContext";
import MediaPickerDialog from "@/components/MediaPickerDialog";

const SCENE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/script-to-scenes`;
const GEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-gen`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;
const SFX_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-sfx`;
const MUSIC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-music`;
const AUTH = `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;
const CLIP_SECONDS = 6;

// Map AI voice_style → ElevenLabs voice IDs (from approved list)
const VOICE_MAP: Record<string, string> = {
  "narrator-male-warm": "nPczCjzI2devNBz1zQrb", // Brian
  "narrator-female-warm": "EXAVITQu4vr4xnSDxMaL", // Sarah
  "male-young": "TX3LPaxmHKxFdv7VOQHJ", // Liam
  "male-deep": "JBFqnCBsd6RMkjVDRZzb", // George
  "female-young": "Xb7hH8MSUJpSbSDYk0k2", // Alice
  "female-mature": "XrExE9yKIg1WjnnlVkGX", // Matilda
  "child": "pFZP5JQG7iQjIQuC4Bku", // Lily
  "elder-male": "pqHfZKP75CvOlQylNhV4", // Bill
  "elder-female": "FGY2WhTYpPnrIDTdsKH5", // Laura
  "villain": "onwK4e9ZLuTAKqWW03F9", // Daniel
  "hero": "bIHbv24MWmeRgasZH58o", // Will
};
const voiceFor = (style?: string) => VOICE_MAP[style || ""] || VOICE_MAP["narrator-male-warm"];

type Motion = "pan-left" | "pan-right" | "zoom-in" | "zoom-out" | "ken-burns" | "static";
interface Scene {
  id: string;
  caption: string;
  photo_prompt: string;
  motion: Motion;
  duration_sec: number; // always 6
  image_url?: string;
  generating?: boolean;
  // Audio
  narration?: string;
  speaker?: string;
  voice_style?: string;
  audio_url?: string; // data URL of generated mp3
  generatingAudio?: boolean;
  // SFX (per scene)
  sfx_prompt?: string;
  sfx_url?: string;
  generatingSfx?: boolean;
  // Per-scene backing music
  music_prompt?: string;
  music_options?: string[]; // up to 3 candidate tracks
  music_url?: string; // chosen track
  music_volume?: number; // 0..1
  generatingSceneMusic?: boolean;
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
  const [creditsLow, setCreditsLow] = useState(false);
  const [genProgress, setGenProgress] = useState<{ done: number; total: number } | null>(null);
  const [audioProgress, setAudioProgress] = useState<{ done: number; total: number } | null>(null);
  const [sfxProgress, setSfxProgress] = useState<{ done: number; total: number } | null>(null);
  // Music suite
  const [musicPrompt, setMusicPrompt] = useState("");
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [musicVolume, setMusicVolume] = useState(0.25); // ducked under VO
  const [generatingMusic, setGeneratingMusic] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewAnimRef = useRef<number | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);

  const triggerUpload = (sceneId: string) => {
    uploadTargetRef.current = sceneId;
    uploadInputRef.current?.click();
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = uploadTargetRef.current;
    e.target.value = ""; // allow re-selecting same file
    if (!file || !targetId) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    if (file.size > 25 * 1024 * 1024) { toast.error("Image too large (max 25MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      if (targetId === "__new__") {
        setScenes(prev => [...prev, {
          id: uid(),
          caption: file.name.replace(/\.[^.]+$/, ""),
          photo_prompt: "Uploaded photo",
          motion: "ken-burns",
          duration_sec: CLIP_SECONDS,
          image_url: url,
        }]);
      } else {
        updateScene(targetId, { image_url: url });
      }
      if (user) saveMedia.mutate({
        media_type: "image",
        title: file.name,
        url,
        source_page: "movie-studio-upload",
        metadata: { uploadedFromDevice: true },
      });
      toast.success("Photo added to movie");
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!open) {
      setScenes([]); setScript(""); setIntent(""); setTitle("");
      setEditingSceneId(null); setEditPrompt(""); setPreviewSceneId(null);
      setExporting(false); setExportProgress(0);
      setCreditsLow(false); setGenProgress(null); setAudioProgress(null); setSfxProgress(null);
      setMusicPrompt(""); setMusicUrl(null); setGeneratingMusic(false);
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
        if (resp.status === 402) { setCreditsLow(true); toast.error("AI credits exhausted. Add credits in Lovable → Settings → Workspace → Usage."); }
        else if (resp.status === 429) toast.error("Too many requests. Wait a moment and try again.");
        else toast.error(e.error || "Scene planning failed");
        return;
      }
      const data = await resp.json();
      setTitle(data.title || "Untitled Movie");
      const newScenes: Scene[] = (data.scenes || []).map((s: any) => ({
        id: uid(),
        caption: s.caption,
        photo_prompt: s.photo_prompt,
        motion: s.motion,
        duration_sec: CLIP_SECONDS,
        narration: s.narration || s.caption,
        speaker: s.speaker || "narrator",
        voice_style: s.voice_style || "narrator-male-warm",
        sfx_prompt: s.sfx_prompt || s.ambient || "",
        music_prompt: s.music_prompt || s.score_prompt || `Cinematic underscore for: ${s.caption}`,
        music_volume: 0.25,
      }));
      // Auto-suggest a music prompt from the overall vibe
      if (data.music_prompt) setMusicPrompt(data.music_prompt);
      else if (intent.trim()) setMusicPrompt(`Cinematic score matching: ${intent.slice(0, 200)}`);
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
        if (resp.status === 402) { setCreditsLow(true); toast.error("AI credits exhausted. Add credits in Lovable → Settings → Workspace → Usage."); }
        else if (resp.status === 429) toast.error("Too many requests. Wait a moment and try again.");
        else toast.error(e.error || "Photo generation failed");
        setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, generating: false } : s));
        return;
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
    const pending = scenes.filter(s => !s.image_url).map(s => s.id);
    if (pending.length === 0) { toast.info("All scenes already have photos"); return; }
    const BATCH = 3;
    setGenProgress({ done: 0, total: pending.length });
    let done = 0;
    for (let i = 0; i < pending.length; i += BATCH) {
      const chunk = pending.slice(i, i + BATCH);
      await Promise.all(chunk.map(async id => {
        await generateScenePhoto(id);
        done += 1;
        setGenProgress({ done, total: pending.length });
      }));
    }
    setTimeout(() => setGenProgress(null), 1500);
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

  // ----- Audio generation (per-scene narration via ElevenLabs) -----
  const generateSceneAudio = async (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    const text = (scene.narration || scene.caption || "").trim();
    if (!text) { toast.error("Add narration text first"); return; }
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, generatingAudio: true } : s));
    try {
      const resp = await fetch(TTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH },
        body: JSON.stringify({ text, voiceId: voiceFor(scene.voice_style) }),
      });
      if (!resp.ok) {
        if (resp.status === 402) { setCreditsLow(true); toast.error("Voice credits exhausted."); }
        else if (resp.status === 429) toast.error("Voice rate limit. Wait and retry.");
        else toast.error("Voice generation failed");
        setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, generatingAudio: false } : s));
        return;
      }
      const blob = await resp.blob();
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader(); r.onloadend = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(blob);
      });
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, audio_url: dataUrl, generatingAudio: false } : s));
    } catch (e) {
      console.error(e); toast.error("Voice generation failed");
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, generatingAudio: false } : s));
    }
  };

  const generateAllAudio = async () => {
    const pending = scenes.filter(s => !s.audio_url && (s.narration || s.caption)).map(s => s.id);
    if (pending.length === 0) { toast.info("All scenes already have audio"); return; }
    setAudioProgress({ done: 0, total: pending.length });
    let done = 0;
    // Sequential to be gentle on TTS rate limits
    for (const id of pending) {
      await generateSceneAudio(id);
      done += 1;
      setAudioProgress({ done, total: pending.length });
    }
    setTimeout(() => setAudioProgress(null), 1500);
    toast.success("All voices generated");
  };

  // ----- SFX (per scene, ElevenLabs sound-generation) -----
  const generateSceneSfx = async (sceneId: string, customPrompt?: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    const promptText = (customPrompt ?? scene.sfx_prompt ?? "").trim();
    if (!promptText) { toast.error("Add a sound effect description first"); return; }
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, generatingSfx: true } : s));
    try {
      const resp = await fetch(SFX_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH },
        body: JSON.stringify({ prompt: promptText, duration_seconds: CLIP_SECONDS, prompt_influence: 0.5 }),
      });
      if (!resp.ok) {
        if (resp.status === 402) { setCreditsLow(true); toast.error("Audio credits exhausted."); }
        else if (resp.status === 429) toast.error("SFX rate limit. Wait and retry.");
        else toast.error("SFX generation failed");
        setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, generatingSfx: false } : s));
        return;
      }
      const blob = await resp.blob();
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader(); r.onloadend = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(blob);
      });
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, sfx_url: dataUrl, generatingSfx: false } : s));
    } catch (e) {
      console.error(e); toast.error("SFX generation failed");
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, generatingSfx: false } : s));
    }
  };

  const generateAllSfx = async () => {
    const pending = scenes.filter(s => !s.sfx_url && s.sfx_prompt?.trim()).map(s => s.id);
    if (pending.length === 0) { toast.info("Add SFX descriptions to scenes first"); return; }
    setSfxProgress({ done: 0, total: pending.length });
    let done = 0;
    for (const id of pending) {
      await generateSceneSfx(id);
      done += 1;
      setSfxProgress({ done, total: pending.length });
    }
    setTimeout(() => setSfxProgress(null), 1500);
    toast.success("All sound effects generated");
  };

  // ----- Per-scene backing music (generates 3 options to choose from) -----
  const generateSceneMusicOption = async (sceneId: string, prompt: string): Promise<string | null> => {
    try {
      const resp = await fetch(MUSIC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH },
        body: JSON.stringify({ prompt, duration_seconds: CLIP_SECONDS + 4 }),
      });
      if (!resp.ok) {
        if (resp.status === 402) { setCreditsLow(true); toast.error("Music credits exhausted."); }
        else if (resp.status === 429) toast.error("Music rate limit. Wait and retry.");
        else toast.error("Scene music generation failed");
        return null;
      }
      const blob = await resp.blob();
      return await new Promise<string>((res, rej) => {
        const r = new FileReader(); r.onloadend = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(blob);
      });
    } catch (e) { console.error(e); return null; }
  };

  const generateSceneMusic = async (sceneId: string, count = 3) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    const base = (scene.music_prompt || `Cinematic backing track for: ${scene.caption}`).trim();
    if (!base) { toast.error("Describe the music vibe for this scene first"); return; }
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, generatingSceneMusic: true } : s));
    const variants = [
      base,
      `${base} — alternate take, different instrumentation`,
      `${base} — slower, more emotional version`,
    ].slice(0, count);
    const results: string[] = [];
    for (const v of variants) {
      const url = await generateSceneMusicOption(sceneId, v);
      if (url) results.push(url);
    }
    setScenes(prev => prev.map(s => s.id === sceneId
      ? { ...s, music_options: results, music_url: s.music_url || results[0], generatingSceneMusic: false }
      : s));
    if (results.length === 0) {
      toast.error("Could not generate music tracks");
    } else {
      toast.success(`${results.length} backing tracks ready — choose one`);
      if (user) saveMedia.mutate({
        media_type: "audio",
        title: `${title || "Movie"} - scene music: ${scene.caption}`.slice(0, 200),
        url: results[0],
        source_page: "movie-studio",
        metadata: { kind: "scene-music", sceneId, prompt: base },
      });
    }
  };

  const generateMusic = async () => {
    const text = musicPrompt.trim();
    if (!text) { toast.error("Describe the music vibe first"); return; }
    setGeneratingMusic(true);
    try {
      const totalSecs = Math.max(10, scenes.length * CLIP_SECONDS);
      const resp = await fetch(MUSIC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH },
        body: JSON.stringify({ prompt: text, duration_seconds: totalSecs }),
      });
      if (!resp.ok) {
        if (resp.status === 402) { setCreditsLow(true); toast.error("Music credits exhausted."); }
        else if (resp.status === 429) toast.error("Music rate limit. Wait and retry.");
        else toast.error("Music generation failed");
        return;
      }
      const blob = await resp.blob();
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader(); r.onloadend = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(blob);
      });
      setMusicUrl(dataUrl);
      if (user) saveMedia.mutate({
        media_type: "audio",
        title: `${title || "Movie"} - score`,
        url: dataUrl,
        source_page: "movie-studio",
        metadata: { kind: "music", prompt: text, durationSec: totalSecs },
      });
      toast.success("Music score ready");
    } catch (e) {
      console.error(e); toast.error("Music generation failed");
    } finally { setGeneratingMusic(false); }
  };

  // ----- Scene CRUD -----
  const addScene = () => {
    setScenes(prev => [...prev, {
      id: uid(),
      caption: "New scene",
      photo_prompt: "Describe this scene...",
      motion: "ken-burns",
      duration_sec: CLIP_SECONDS,
      narration: "",
      speaker: "narrator",
      voice_style: "narrator-male-warm",
      sfx_prompt: "",
      music_prompt: "",
      music_volume: 0.25,
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

  // ----- Export full movie as WebM (with AI voice audio muxed in) -----
  const exportMovie = async () => {
    const ready = scenes.filter(s => s.image_url);
    if (ready.length === 0) { toast.error("Generate at least one scene photo"); return; }
    if (ready.length !== scenes.length) {
      if (!confirm(`${scenes.length - ready.length} scene(s) missing photos. Export only the ${ready.length} ready ones?`)) return;
    }
    const missingAudio = ready.filter(s => !s.audio_url).length;
    if (missingAudio > 0) {
      const proceed = confirm(`${missingAudio} scene(s) have no AI voice yet. Export silent for those? (Cancel to generate voices first.)`);
      if (!proceed) return;
    }
    setExporting(true); setExportProgress(0);
    try {
      const canvas = exportCanvasRef.current!;
      canvas.width = 1920; canvas.height = 1080;
      const ctx = canvas.getContext("2d")!;

      // Video stream from canvas
      const videoStream = canvas.captureStream(30);

      // Audio: build a Web Audio graph, route to a destination MediaStream
      const AudioCtor: typeof AudioContext = (window.AudioContext || (window as any).webkitAudioContext);
      const audioCtx = new AudioCtor();
      const audioDest = audioCtx.createMediaStreamDestination();

      // Helper: decode an audio data URL into an AudioBuffer
      const decodeUrl = async (u?: string | null): Promise<AudioBuffer | null> => {
        if (!u) return null;
        try {
          const r = await fetch(u);
          const ab = await r.arrayBuffer();
          return await audioCtx.decodeAudioData(ab);
        } catch (err) { console.warn("audio decode failed", err); return null; }
      };

      // Decode narration + sfx + per-scene music + global music — in parallel
      const [voiceBuffers, sfxBuffers, sceneMusicBuffers, musicBuffer] = await Promise.all([
        Promise.all(ready.map(s => decodeUrl(s.audio_url))),
        Promise.all(ready.map(s => decodeUrl(s.sfx_url))),
        Promise.all(ready.map(s => decodeUrl(s.music_url))),
        decodeUrl(musicUrl),
      ]);

      // Combine video + audio tracks
      const combined = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioDest.stream.getAudioTracks(),
      ]);

      const recorder = new MediaRecorder(combined, { mimeType: "video/webm;codecs=vp9,opus", videoBitsPerSecond: 8_000_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      const finished = new Promise<Blob>(res => {
        recorder.onstop = () => res(new Blob(chunks, { type: "video/webm" }));
      });
      recorder.start();

      // Start music underscore at t=0, ducked under VO
      let musicSource: AudioBufferSourceNode | null = null;
      if (musicBuffer) {
        musicSource = audioCtx.createBufferSource();
        musicSource.buffer = musicBuffer;
        musicSource.loop = true;
        const musicGain = audioCtx.createGain();
        musicGain.gain.value = Math.max(0, Math.min(1, musicVolume));
        musicSource.connect(musicGain).connect(audioDest);
        musicSource.start();
      }

      // Preload all images
      const imgs = await Promise.all(ready.map(s => new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image(); i.crossOrigin = "anonymous";
        i.onload = () => res(i); i.onerror = rej; i.src = s.image_url!;
      })));

      for (let idx = 0; idx < ready.length; idx++) {
        const scene = ready[idx];
        const img = imgs[idx];
        const dur = scene.duration_sec * 1000;

        // Schedule this scene's narration (full volume)
        const vbuf = voiceBuffers[idx];
        if (vbuf) {
          const src = audioCtx.createBufferSource();
          src.buffer = vbuf;
          const g = audioCtx.createGain(); g.gain.value = 1.0;
          src.connect(g).connect(audioDest);
          src.start();
        }
        // Schedule scene SFX (slightly ducked so VO stays clear)
        const sbuf = sfxBuffers[idx];
        if (sbuf) {
          const src = audioCtx.createBufferSource();
          src.buffer = sbuf;
          const g = audioCtx.createGain(); g.gain.value = 0.6;
          src.connect(g).connect(audioDest);
          src.start();
        }
        // Schedule per-scene backing music (overrides global score for this clip if present)
        const mbuf = sceneMusicBuffers[idx];
        if (mbuf) {
          const src = audioCtx.createBufferSource();
          src.buffer = mbuf;
          const g = audioCtx.createGain();
          g.gain.value = Math.max(0, Math.min(1, scene.music_volume ?? 0.25));
          src.connect(g).connect(audioDest);
          src.start();
        }
        await new Promise<void>(resolve => {
          const tick = (now: number) => {
            const p = Math.min(1, (now - start) / dur);
            drawMotionFrame(ctx, img, canvas.width, canvas.height, scene.motion, p);
            // caption + speaker tag
            ctx.fillStyle = "rgba(0,0,0,0.55)";
            ctx.fillRect(0, canvas.height - 160, canvas.width, 160);
            ctx.fillStyle = "#fff";
            ctx.font = "bold 36px sans-serif";
            ctx.textAlign = "center";
            wrapText(ctx, scene.caption, canvas.width / 2, canvas.height - 90, canvas.width - 120, 44);
            if (scene.speaker && scene.speaker !== "narrator") {
              ctx.font = "italic 22px sans-serif";
              ctx.fillStyle = "hsl(45 90% 70%)";
              ctx.fillText(`— ${scene.speaker}`, canvas.width / 2, canvas.height - 30);
            }
            if (p < 1) requestAnimationFrame(tick);
            else resolve();
          };
          requestAnimationFrame(tick);
        });
        setExportProgress(Math.round(((idx + 1) / ready.length) * 100));
      }

      recorder.stop();
      const blob = await finished;
      try { musicSource?.stop(); } catch {}
      try { audioCtx.close(); } catch {}

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
            metadata: { sceneCount: ready.length, totalSeconds: ready.length * CLIP_SECONDS, withVoice: missingAudio < ready.length },
          });
        };
        reader.readAsDataURL(blob);
      }
      toast.success("Movie exported with AI voices and saved to library!");
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

        {creditsLow && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm flex items-center justify-between gap-3">
            <span className="text-destructive">AI credits exhausted. Top up to keep generating.</span>
            <a
              href="https://lovable.dev/settings/workspace"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
            >
              Add credits
            </a>
          </div>
        )}

        {genProgress && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Generating photos...</span>
              <span>{genProgress.done} / {genProgress.total}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(genProgress.done / genProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {audioProgress && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Mic className="w-3 h-3" /> Generating AI voices...</span>
              <span>{audioProgress.done} / {audioProgress.total}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(audioProgress.done / audioProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
        {sfxProgress && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Waves className="w-3 h-3" /> Generating sound effects...</span>
              <span>{sfxProgress.done} / {sfxProgress.total}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(sfxProgress.done / sfxProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
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
              <Button onClick={generateAllAudio} variant="secondary" size="sm">
                <Mic className="w-3 h-3 mr-1" /> Generate all voices
              </Button>
              <Button onClick={generateAllSfx} variant="secondary" size="sm">
                <Waves className="w-3 h-3 mr-1" /> Generate all SFX
              </Button>
              <Button onClick={addScene} variant="outline" size="sm">
                <Plus className="w-3 h-3 mr-1" /> Add scene
              </Button>
              <Button onClick={() => triggerUpload("__new__")} variant="outline" size="sm">
                <Upload className="w-3 h-3 mr-1" /> Upload photo
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

            {/* Music suite (full-track underscore for the whole movie) */}
            <div className="rounded-lg p-3 border border-primary/30 bg-primary/5 space-y-2">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-primary">MUSIC SCORE (ElevenLabs)</span>
                <span className="text-[10px] text-muted-foreground ml-auto">Plays under the entire movie</span>
              </div>
              <Textarea
                value={musicPrompt}
                onChange={e => setMusicPrompt(e.target.value)}
                rows={2}
                className="text-xs"
                placeholder="e.g. Cinematic orchestral score, slow build, melancholy strings, hopeful finale, 90 BPM"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={generateMusic} size="sm" variant="secondary" className="h-7 text-xs"
                  disabled={generatingMusic || !musicPrompt.trim()}>
                  {generatingMusic
                    ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Composing...</>
                    : musicUrl ? <><RefreshCw className="w-3 h-3 mr-1" /> Re-compose</> : <><Sparkles className="w-3 h-3 mr-1" /> Compose music</>}
                </Button>
                {musicUrl && <audio src={musicUrl} controls className="h-7 flex-1 min-w-[200px]" />}
                <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                  Music vol
                  <input type="range" min={0} max={1} step={0.05} value={musicVolume}
                    onChange={e => setMusicVolume(parseFloat(e.target.value))} className="w-24" />
                  <span className="w-8 text-right">{Math.round(musicVolume * 100)}%</span>
                </label>
              </div>
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
                        <Button onClick={() => triggerUpload(s.id)} size="sm" variant="outline" className="h-7 text-xs">
                          <Upload className="w-3 h-3 mr-1" /> Upload
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
                      {/* Narration / voice block */}
                      <div className="mt-2 p-2 rounded-md bg-primary/5 border border-primary/20 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Mic className="w-3 h-3 text-primary" />
                          <span className="text-[10px] font-bold text-primary">VOICE</span>
                          <Input value={s.speaker || ""} onChange={e => updateScene(s.id, { speaker: e.target.value, audio_url: undefined })}
                            className="h-6 text-[11px] w-32" placeholder="Speaker (e.g. Maya)" />
                          <select
                            value={s.voice_style || "narrator-male-warm"}
                            onChange={e => updateScene(s.id, { voice_style: e.target.value, audio_url: undefined })}
                            className="h-6 text-[11px] bg-input border border-border rounded px-1"
                          >
                            {Object.keys(VOICE_MAP).map(k => <option key={k} value={k}>{k}</option>)}
                          </select>
                          {s.audio_url && (
                            <audio src={s.audio_url} controls className="h-6 max-w-[180px]" />
                          )}
                        </div>
                        <Textarea
                          value={s.narration || ""}
                          onChange={e => updateScene(s.id, { narration: e.target.value, audio_url: undefined })}
                          rows={2}
                          className="text-xs"
                          placeholder="What is spoken during this 6s scene..."
                        />
                        <div className="flex gap-1">
                          <Button onClick={() => generateSceneAudio(s.id)} size="sm" variant="secondary" className="h-7 text-xs"
                            disabled={s.generatingAudio || !(s.narration || s.caption)}>
                            {s.generatingAudio
                              ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              : s.audio_url ? <RefreshCw className="w-3 h-3 mr-1" /> : <Volume2 className="w-3 h-3 mr-1" />}
                            {s.audio_url ? "Re-voice" : "Generate voice"}
                          </Button>
                        </div>
                      </div>

                      {/* SFX block (per-scene ElevenLabs sound effect) */}
                      <div className="mt-2 p-2 rounded-md bg-accent/5 border border-accent/30 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Waves className="w-3 h-3 text-accent-foreground" />
                          <span className="text-[10px] font-bold">SOUND EFFECT</span>
                          {s.sfx_url && <audio src={s.sfx_url} controls className="h-6 max-w-[200px] ml-auto" />}
                        </div>
                        <Textarea
                          value={s.sfx_prompt || ""}
                          onChange={e => updateScene(s.id, { sfx_prompt: e.target.value, sfx_url: undefined })}
                          rows={2}
                          className="text-xs"
                          placeholder="Describe the ambient sound — e.g. 'wind across desert dunes', 'busy cafe with distant traffic', 'ocean waves crashing on rocks'"
                        />
                        <div className="flex gap-1">
                          <Button onClick={() => generateSceneSfx(s.id)} size="sm" variant="secondary" className="h-7 text-xs"
                            disabled={s.generatingSfx || !s.sfx_prompt?.trim()}>
                            {s.generatingSfx
                              ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              : s.sfx_url ? <RefreshCw className="w-3 h-3 mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
                            {s.sfx_url ? "Re-generate SFX" : "Generate SFX"}
                          </Button>
                        </div>
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
        <input ref={uploadInputRef} type="file" accept="image/*" onChange={handleUploadFile} className="hidden" />
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
