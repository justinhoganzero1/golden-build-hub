import { getEdgeAuthTokenSync } from "@/lib/edgeAuth";
import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Film, Wand2, Plus, Play, Pause, Download, Trash2, Sparkles, RefreshCw, Pencil, ImagePlus, Upload, Mic, Volume2, Music, Waves, Star, Tv, Newspaper, Share2, Users, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useSaveMedia } from "@/hooks/useUserAvatars";
import { useAuth } from "@/contexts/AuthContext";
import MediaPickerDialog from "@/components/MediaPickerDialog";
import { supabase } from "@/integrations/supabase/client";
import { moderatePrompt } from "@/lib/contentSafety";
import { MUSIC_PRESETS_TOP_100 } from "@/data/movieMusicPresets";
import { CURATED_ELEVENLABS_VOICES } from "@/data/elevenLabsVoices";
import MovieShareDialog from "@/components/movie/MovieShareDialog";
import { readMovieFormat, type MovieFormat } from "@/lib/movieFormats";
import { resolveStorageUrl } from "@/lib/signedStorageUrl";
import StoryboardTimeline, { DEFAULT_TIMELINE_MIX, layerAudible, type TimelineMix } from "@/components/movie/StoryboardTimeline";
import SuperAIPanel, { type SuperAIActions, type PipelineStep, type PipelineStatus, type ExportSettings } from "@/components/movie/SuperAIPanel";
import MovieHostPanel from "@/components/movie/MovieHostPanel";
import {
  DEFAULT_HOST, audioEnvelope, envelopeAt, drawTalkingHead, hostRect, hostPortraitPrompt,
  clampInterviewSeconds, type HostConfig, type HostBeat, type InterviewBeat,
} from "@/lib/movieHost";



const SCENE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/script-to-scenes`;
const GEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-gen`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;
const SFX_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-sfx`;
const MUSIC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-music`;
const AUTH = `Bearer ${getEdgeAuthTokenSync()}`;
const CLIP_SECONDS = 20; // 20-second cinematic blocks per scene

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
const resolveVoiceId = (scene: { voice_id?: string; voice_style?: string }) =>
  scene.voice_id || voiceFor(scene.voice_style);

type Motion = "pan-left" | "pan-right" | "zoom-in" | "zoom-out" | "ken-burns" | "static";
type SceneTone = "calm" | "tense" | "emotional" | "epic" | "playful" | "neutral";
type CameraAngle = "auto" | "wide" | "medium" | "close-up" | "extreme-close-up" | "low-angle" | "high-angle" | "birds-eye" | "dutch-tilt" | "over-the-shoulder" | "tracking" | "drone";
type LightingPreset = "auto" | "golden-hour" | "blue-hour" | "high-key" | "low-key" | "noir" | "soft-natural" | "neon-cyberpunk" | "candlelit" | "studio-3-point" | "moonlit" | "harsh-midday";

const CAMERA_ANGLE_PROMPTS: Record<CameraAngle, string> = {
  "auto": "",
  "wide": "wide establishing shot, full scene visible",
  "medium": "medium shot, waist-up framing",
  "close-up": "close-up shot, head and shoulders, intimate framing",
  "extreme-close-up": "extreme close-up, eyes-only intensity",
  "low-angle": "low-angle hero shot looking up, powerful framing",
  "high-angle": "high-angle shot looking down, vulnerable framing",
  "birds-eye": "bird's-eye top-down view",
  "dutch-tilt": "dutch tilt camera angle, off-balance tension",
  "over-the-shoulder": "over-the-shoulder POV shot",
  "tracking": "tracking dolly shot, dynamic motion",
  "drone": "aerial drone shot, sweeping cinematic motion",
};
const LIGHTING_PRESET_PROMPTS: Record<LightingPreset, string> = {
  "auto": "",
  "golden-hour": "warm golden hour sunlight, long shadows, magic-hour glow",
  "blue-hour": "cool blue hour twilight, soft ambient light",
  "high-key": "bright high-key lighting, soft and even, minimal shadows",
  "low-key": "dramatic low-key lighting, deep shadows, single key light",
  "noir": "film noir chiaroscuro lighting, hard shadows, venetian-blind patterns",
  "soft-natural": "soft natural window lighting, diffused and gentle",
  "neon-cyberpunk": "neon cyberpunk lighting, magenta and cyan rim lights, wet reflections",
  "candlelit": "warm candlelit interior, flickering amber glow",
  "studio-3-point": "professional 3-point studio lighting with key, fill, and rim",
  "moonlit": "cool moonlit night scene, silver-blue rim light",
  "harsh-midday": "harsh midday sunlight, overhead, high contrast",
};

interface Scene {
  id: string;
  caption: string;
  photo_prompt: string;
  motion: Motion;
  duration_sec: number; // 20s default cinematic block
  image_url?: string;
  generating?: boolean;
  // Real AI video (Runway image-to-video). When present, MP4 plays during preview
  // and is composited into export instead of the canvas Ken Burns.
  video_url?: string;
  generatingVideo?: boolean;
  // Audio
  narration?: string;
  speaker?: string;
  voice_style?: string;
  voice_id?: string; // explicit ElevenLabs voice (overrides voice_style)
  audio_url?: string; // data URL of generated mp3
  voice_offset_sec?: number; // narration start offset within the scene
  generatingAudio?: boolean;
  // SFX (per scene)
  sfx_prompt?: string;
  sfx_url?: string;
  sfx_offset_sec?: number; // where in the scene the effect lands
  sfx_volume?: number;     // 0..1, default 0.6
  generatingSfx?: boolean;
  // Per-scene backing music
  music_prompt?: string;
  music_options?: string[]; // up to 3 candidate tracks
  music_url?: string; // chosen track
  music_volume?: number; // 0..1
  generatingSceneMusic?: boolean;
  tone?: SceneTone; // used by Oracle to auto-pick best music + cross-fade timing
  // Newsroom-specific extras
  is_news_segment?: boolean;
  lower_third_name?: string;   // e.g. "Maya Chen"
  lower_third_title?: string;  // e.g. "ORACLE LUNAR Tech Reporter"
  broll_url?: string;          // optional B-roll image overlay (cutaway)
  // Movie Host layer — lip-synced talking-head presenter over this scene
  host_beat?: HostBeat;
  // ≤8s two-avatar live interview (host ↔ character) over this scene
  interview?: InterviewBeat;

  // Director controls (preset-driven, baked into the photo prompt)
  camera_angle?: CameraAngle;
  lighting_preset?: LightingPreset;
  character_action?: string;   // "walks slowly into the room, hand trembling"
  character_emotion?: string;  // "anxious, breathing fast" — affects expression
  // Motion-video engine (per scene). Default = gemini (free, via Lovable AI).
  video_engine?: "gemini" | "runway";
  video_seconds?: 5 | 10;
}

interface MovieStudioProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  seedImage?: string | null;
  /** Pre-rendered sequential photos (e.g. from the Photo Story 10-frame generator). When provided, MovieStudio
   *  pre-populates scenes from these images and skips the planning step. */
  seedFrames?: string[];
  /** Script/intent text used when seedFrames are provided (becomes the movie's narration backbone). */
  seedScript?: string;
}

type ProductionAgentStatus = "waiting" | "working" | "complete" | "failed";
type ProductionAgent = {
  id: "visual" | "voice" | "sound" | "score" | "quality";
  name: string;
  task: string;
  status: ProductionAgentStatus;
};

const PRODUCTION_AGENTS: ProductionAgent[] = [
  { id: "visual", name: "Visual Director", task: "Generating cinematic scene artwork", status: "waiting" },
  { id: "voice", name: "Voice Director", task: "Producing expressive human narration", status: "waiting" },
  { id: "sound", name: "Sound Designer", task: "Building scene sound effects", status: "waiting" },
  { id: "score", name: "Score Composer", task: "Mapping suspense and music cues", status: "waiting" },
  { id: "quality", name: "Final-Cut Editor", task: "Checking every production lane", status: "waiting" },
];

const uid = () => Math.random().toString(36).slice(2, 10);

const MovieStudio = ({ open, onOpenChange, seedImage, seedFrames, seedScript }: MovieStudioProps) => {
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
  const [timelineMix, setTimelineMix] = useState<TimelineMix>(DEFAULT_TIMELINE_MIX);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [publishedBlob, setPublishedBlob] = useState<Blob | null>(null);
  const [publishedFormat, setPublishedFormat] = useState<MovieFormat | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryTargetId, setLibraryTargetId] = useState<string | null>(null);
  const [creditsLow, setCreditsLow] = useState(false);
  const [genProgress, setGenProgress] = useState<{ done: number; total: number } | null>(null);
  const [audioProgress, setAudioProgress] = useState<{ done: number; total: number } | null>(null);
  const [sfxProgress, setSfxProgress] = useState<{ done: number; total: number } | null>(null);
  const [productionSwarm, setProductionSwarm] = useState<ProductionAgent[]>(PRODUCTION_AGENTS);
  const [productionSwarmBusy, setProductionSwarmBusy] = useState(false);
  // Super AI step-by-step pipeline
  const [pipeline, setPipeline] = useState<PipelineStep[]>([]);
  const [superAIRunning, setSuperAIRunning] = useState(false);
  const [superAIStep, setSuperAIStep] = useState(0);
  const [musicCueProgress, setMusicCueProgress] = useState<{ done: number; total: number } | null>(null);
  const superAICancel = useRef(false);
  // Music suite
  const [musicPrompt, setMusicPrompt] = useState("");
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [musicVolume, setMusicVolume] = useState(0.15); // ducked well under VO
  const [musicSpeed, setMusicSpeed] = useState(1); // 0.5x – 2x playback rate
  const [generatingMusic, setGeneratingMusic] = useState(false);
  const [scoreTeamBusy, setScoreTeamBusy] = useState(false);
  const [scoreTeamNotes, setScoreTeamNotes] = useState<string[]>([]);
  // Intro / Theme / Credits / Outro
  const [introMusicUrl, setIntroMusicUrl] = useState<string | null>(null);
  const [themeMusicUrl, setThemeMusicUrl] = useState<string | null>(null);
  const [outroMusicUrl, setOutroMusicUrl] = useState<string | null>(null);
  const [creditsLines, setCreditsLines] = useState<string[]>([]);
  const [generatingIntro, setGeneratingIntro] = useState(false);
  const [generatingTheme, setGeneratingTheme] = useState(false);
  const [generatingOutro, setGeneratingOutro] = useState(false);
  const [generatingCredits, setGeneratingCredits] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false); // OFF by default per user spec
  const [introStyle, setIntroStyle] = useState<"epic" | "playful" | "cinematic-drone" | "retro-news" | "trailer-hit">("epic");
  // Scene-block billing (sliding scale; admin = free)
  const [blocksProduced, setBlocksProduced] = useState(0); // how many 10-scene blocks already paid/produced this session
  const [payingBlock, setPayingBlock] = useState(false);
  const isAdmin = user?.email === "justinbretthogan@gmail.com";
  // Sliding scale: block 1 = $5, block 2 = $10, blocks 3..20 = +$20 each (30,50,70..370), block 21+ = $1000
  const priceForBlockUSD = (n: number): number => {
    if (n <= 0) return 0;
    if (n === 1) return 5;
    if (n === 2) return 10;
    if (n <= 20) return 10 + (n - 2) * 20;
    return 1000;
  };
  const nextBlockNumber = blocksProduced + 1;
  const nextBlockPrice = priceForBlockUSD(nextBlockNumber);
  // Newsroom (YouTube show) preset
  const [newsroomMode, setNewsroomMode] = useState(false);
  // ----- Movie Host layer (talking head + live interviews) -----
  const [host, setHost] = useState<HostConfig>(DEFAULT_HOST);
  const [hostPanelOpen, setHostPanelOpen] = useState(false);
  const [generatingPortrait, setGeneratingPortrait] = useState(false);
  const patchHost = (patch: Partial<HostConfig>) => setHost(prev => ({ ...prev, ...patch }));
  const [showName, setShowName] = useState("");          // e.g. "ORACLE LUNAR Daily"
  const [hostName, setHostName] = useState("");          // e.g. "Alex Rivera"
  const [hostTitle, setHostTitle] = useState("");        // e.g. "Lead Anchor"
  const [hostAvatarUrl, setHostAvatarUrl] = useState<string | null>(null);
  const [generatingNewsroom, setGeneratingNewsroom] = useState(false);
  // Auto-pick + cross-fade
  const [autoPickEnabled, setAutoPickEnabled] = useState(true); // Oracle picks best per-scene track
  const [crossfadeMode, setCrossfadeMode] = useState<"auto" | "1s" | "2s" | "off">("auto");
  // Favourites picker
  const [showFavouritesPicker, setShowFavouritesPicker] = useState(false);
  const [favouritesTargetId, setFavouritesTargetId] = useState<string | null>(null);
  const [savedTracks, setSavedTracks] = useState<Array<{ id: string; title: string | null; url: string }>>([]);
  // Cast & guest stars (rendered into opening + end credits)
  const [starring, setStarring] = useState("");          // "Maya Chen, Jordan Reyes"
  const [coStarring, setCoStarring] = useState("");      // "Sam Park, Alex Cruz"
  const [guestStars, setGuestStars] = useState("");      // "and James O'Neill as The Director"
  // AI 10×6s preview/trailer
  const [trailerScenes, setTrailerScenes] = useState<Array<{ id: string; image: string; tone?: SceneTone }>>([]);
  const [generatingTrailer, setGeneratingTrailer] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);
  /** Idempotency key for the current export attempt (prevents double charges). */
  const renderRequestKeyRef = useRef<string | null>(null);
  const previewAnimRef = useRef<number | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);

  // Bake camera + lighting + action + emotion into the final photo prompt
  const buildScenePhotoPrompt = (s: Scene, override?: string): string => {
    const base = (override || s.photo_prompt || "").trim();
    const cam = s.camera_angle && s.camera_angle !== "auto" ? CAMERA_ANGLE_PROMPTS[s.camera_angle] : "";
    const light = s.lighting_preset && s.lighting_preset !== "auto" ? LIGHTING_PRESET_PROMPTS[s.lighting_preset] : "";
    const action = s.character_action?.trim() ? `Character action: ${s.character_action.trim()}.` : "";
    const emotion = s.character_emotion?.trim() ? `Character emotion: ${s.character_emotion.trim()}.` : "";
    return [base, cam, light, action, emotion, "photoreal 4K resolution, ultra-detailed, cinematic lighting, sharp focus, film still"]
      .filter(Boolean).join(", ");
  };

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
      setProductionSwarm(PRODUCTION_AGENTS); setProductionSwarmBusy(false);
      setMusicPrompt(""); setMusicUrl(null); setGeneratingMusic(false);
      setIntroMusicUrl(null); setThemeMusicUrl(null); setOutroMusicUrl(null); setCreditsLines([]);
      setGeneratingIntro(false); setGeneratingTheme(false); setGeneratingOutro(false); setGeneratingCredits(false);
      setSubtitlesEnabled(false); setIntroStyle("epic");
      setBlocksProduced(0); setPayingBlock(false);
      setNewsroomMode(false); setShowName(""); setHostName(""); setHostTitle(""); setHostAvatarUrl(null);
      setGeneratingNewsroom(false); setAutoPickEnabled(true); setCrossfadeMode("auto");
      setShowFavouritesPicker(false); setFavouritesTargetId(null);
      setStarring(""); setCoStarring(""); setGuestStars("");
      setTrailerScenes([]); setGeneratingTrailer(false);
    }
  }, [open]);

  // Turn a Story Writer story into a COMPLETE storyboard automatically —
  // scene breakdown, captions, per-scene narration + voices, motion, ambience
  // and a matching score prompt. Existing story artwork is reused as frames.
  const autoStoryboardFromStory = async (
    storyScript: string,
    storyIntent: string,
    frames: string[],
    storyTitle?: string,
  ) => {
    setPlanning(true);
    const toastId = toast.loading("Oracle is building your entire storyboard from the story…");
    try {
      const targetScenes = Math.max(8, Math.min(20, frames.length ? frames.length * 2 : 12));
      const resp = await fetch(SCENE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH },
        body: JSON.stringify({
          script: storyScript.slice(0, 24000),
          intent:
            `${storyIntent}\n\n[STORY WRITER HANDOFF] Adapt this story into a cinematic film. Keep character, wardrobe and lighting continuity across every scene. Write spoken narration for every scene so the film plays start-to-finish with no gaps.`,
          targetDurationSec: targetScenes * 6,
        }),
      });
      if (!resp.ok) {
        toast.error("Auto-storyboard failed — tap Generate Scenes to retry", { id: toastId });
        return;
      }
      const data = await resp.json();
      const incoming: Scene[] = (data.scenes || []).slice(0, targetScenes).map((s: any, i: number) => ({
        id: uid(),
        caption: s.caption,
        photo_prompt: s.photo_prompt,
        motion: (s.motion || "ken-burns") as Motion,
        duration_sec: CLIP_SECONDS,
        narration: s.narration || s.caption,
        speaker: s.speaker || "narrator",
        voice_style: s.voice_style || "narrator-male-warm",
        sfx_prompt: s.sfx_hint || s.sfx_prompt || "",
        music_prompt: s.music_prompt || `Cinematic underscore for: ${s.caption}`,
        music_volume: 0.25,
        // Re-use the story's own cover / chapter artwork where we have it
        image_url: frames[i],
      }));
      if (!incoming.length) {
        toast.error("Auto-storyboard returned nothing — tap Generate Scenes", { id: toastId });
        return;
      }
      setTitle(prev => prev || storyTitle || data.title || "Untitled Movie");
      setMusicPrompt(
        data.music_prompt || `Cinematic score matching: ${(storyIntent || storyTitle || "").slice(0, 200)}`,
      );
      setScenes(incoming);
      setBlocksProduced(1);
      toast.success(
        `Storyboard ready — ${incoming.length} scenes, narration and score prompt all written.`,
        { id: toastId },
      );
    } catch (e) {
      console.error("[autoStoryboardFromStory]", e);
      toast.error("Auto-storyboard failed — tap Generate Scenes to retry", { id: toastId });
    } finally {
      setPlanning(false);
    }
  };

  // Hydrate from Oracle Movie Director (sessionStorage handoff)
  useEffect(() => {
    if (!open) return;
    try {
      const raw = sessionStorage.getItem("oracle_movie_brief");
      if (!raw) return;
      const brief = JSON.parse(raw);
      if (brief?.script) setScript(brief.script);
      if (brief?.intent) setIntent(brief.intent);
      if (brief?.youtube?.title) setTitle(brief.youtube.title);
      // Fully-authored segments (AI host show) — load straight onto the timeline
      if (Array.isArray(brief?.scenes) && brief.scenes.length) {
        setScenes(prev => prev.length ? prev : brief.scenes.slice(0, 30).map((s: any, i: number) => ({
          id: uid(),
          caption: s.caption || `Scene ${i + 1}`,
          photo_prompt: s.photo_prompt || s.caption || `Scene ${i + 1}`,
          motion: (s.motion || "ken-burns") as Motion,
          duration_sec: s.duration_sec || CLIP_SECONDS,
          image_url: s.image_url,
          narration: s.narration,
          speaker: s.speaker,
          voice_style: s.voice_style,
          is_news_segment: s.is_news_segment,
          lower_third_name: s.lower_third_name,
          lower_third_title: s.lower_third_title,
        })));
      }
      // Story Writer handoff — auto-build the ENTIRE storyboard from the story
      else if (brief?.script) {
        const rawFrames: string[] = Array.isArray(brief?.frames) ? brief.frames : [];
        // Story artwork lives in the PRIVATE photography-assets bucket, so the
        // `/object/public/...` URLs saved in the story doc are dead. Sign them
        // before they hit the timeline or every frame renders blank.
        void (async () => {
          const frames = rawFrames.length
            ? await Promise.all(rawFrames.map(u => resolveStorageUrl(u, 6 * 3600).catch(() => u)))
            : [];
          if (frames.length) {
            setScenes(prev => prev.length ? prev : frames.slice(0, 20).map((url: string, i: number) => ({
              id: uid(),
              caption: `Scene ${i + 1}`,
              photo_prompt: brief.intent || `Scene ${i + 1}`,
              motion: "ken-burns" as Motion,
              duration_sec: CLIP_SECONDS,
              image_url: url,
            })));
          }
          await autoStoryboardFromStory(brief.script, brief.intent || "", frames, brief.title);
        })();
      }
      sessionStorage.removeItem("oracle_movie_brief");


      // Stash YouTube package for later publish step
      if (brief?.youtube) sessionStorage.setItem("oracle_youtube_pkg", JSON.stringify(brief.youtube));
      toast.success("Oracle pre-filled your script — review and tap Generate Scenes");
    } catch { /* ignore */ }
  }, [open]);

  // Load saved favourite tracks when the studio opens
  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const { data } = await supabase
        .from("user_media")
        .select("id,title,url,metadata")
        .eq("user_id", user.id)
        .eq("media_type", "audio")
        .order("created_at", { ascending: false })
        .limit(50);
      const favs = (data || []).filter((d: any) => d.metadata?.favourite === true);
      setSavedTracks(favs.map((d: any) => ({ id: d.id, title: d.title, url: d.url })));
    })();
  }, [open, user]);

  // Pre-populate scenes from Photo Story 10-frame seed (skips planning step)
  useEffect(() => {
    if (!open) return;
    if (!seedFrames || seedFrames.length === 0) return;
    if (scenes.length > 0) return; // don't overwrite existing
    const baseScript = (seedScript || "").trim();
    if (baseScript && !script.trim()) setScript(baseScript);
    if (!title) setTitle(baseScript ? baseScript.slice(0, 60) : "Photo Story Movie");
    const built: Scene[] = seedFrames.map((url, i) => ({
      id: uid(),
      caption: `Scene ${i + 1}`,
      photo_prompt: baseScript || `Scene ${i + 1}`,
      motion: "ken-burns",
      duration_sec: CLIP_SECONDS,
      image_url: url,
      narration: baseScript ? `${baseScript} — moment ${i + 1}.` : `Scene ${i + 1}.`,
      speaker: "narrator",
      voice_style: "narrator-male-warm",
      music_prompt: `Cinematic underscore for: ${baseScript || "photo story"}`,
      music_volume: 0.25,
    }));
    setScenes(built);
    setBlocksProduced(1);
    if (baseScript) setMusicPrompt(`Cinematic score matching: ${baseScript.slice(0, 200)}`);
    toast.success(`${built.length} scenes loaded from your Photo Story — ready to render.`);
  }, [open, seedFrames, seedScript]);

  // Save a generated music track to the user's favourites library
  const saveTrackToFavourites = (url: string, label: string) => {
    if (!user) { toast.error("Sign in to save favourites"); return; }
    saveMedia.mutate({
      media_type: "audio",
      title: label,
      url,
      source_page: "favourite-music",
      metadata: { favourite: true, kind: "scene-music" },
    } as any);
    setSavedTracks(prev => [{ id: `local-${Date.now()}`, title: label, url }, ...prev]);
    toast.success("Saved to Favourite Tracks");
  };

  // Oracle auto-pick: choose the best of N music options based on scene tone + theme
  const oraclePickBest = (options: string[], _tone?: SceneTone): string => {
    // Simple heuristic for now: variant 0 = baseline (matches prompt closest)
    // For "tense"/"epic" prefer baseline; for "emotional" prefer slower variant (#2);
    // for "playful" prefer alternate instrumentation (#1).
    if (!options.length) return "";
    if (_tone === "emotional" && options[2]) return options[2];
    if (_tone === "playful" && options[1]) return options[1];
    return options[0];
  };

  // Cross-fade duration (seconds) between scene[i] and scene[i+1]
  const crossfadeFor = (a: Scene, b: Scene): number => {
    if (crossfadeMode === "off") return 0;
    if (crossfadeMode === "1s") return 1;
    if (crossfadeMode === "2s") return 2;
    // auto: longer fade on emotional shifts, shorter on cuts
    const aT = a.tone || "neutral", bT = b.tone || "neutral";
    if (aT === bT) return 1;
    if ((aT === "tense" && bT === "calm") || (aT === "calm" && bT === "tense")) return 2.5;
    if (aT === "emotional" || bT === "emotional") return 2;
    return 1.5;
  };

  // ----- Plan scenes (block of 10). First block gates on billing for non-admins. -----
  const SCENES_PER_BLOCK = 10;
  const planScenes = async (opts?: { append?: boolean; blockNumber?: number }) => {
    if (!script.trim()) { toast.error("Add a script first"); return; }
    const mod = moderatePrompt(script);
    if (!mod.ok) { toast.error(mod.reason || "Script blocked by content filter"); return; }
    const mod2 = moderatePrompt(intent || "");
    if (intent && !mod2.ok) { toast.error(mod2.reason || "Direction blocked by content filter"); return; }
    setPlanning(true);
    try {
      const append = !!opts?.append;
      const blockNum = opts?.blockNumber ?? (append ? blocksProduced + 1 : 1);
      const targetDuration = SCENES_PER_BLOCK * CLIP_SECONDS; // ~60s per block of 10
      const augmentedIntent = append
        ? `${intent}\n\n[CONTINUATION] Generate ${SCENES_PER_BLOCK} additional scenes that continue the existing story. This is block #${blockNum}. Existing scene count so far: ${scenes.length}.`
        : intent;
      const resp = await fetch(SCENE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH },
        body: JSON.stringify({ script, intent: augmentedIntent, targetDurationSec: targetDuration }),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        if (resp.status === 402) { setCreditsLow(true); toast.error("AI credits exhausted. Add credits in Lovable → Settings → Workspace → Usage."); }
        else if (resp.status === 429) toast.error("Too many requests. Wait a moment and try again.");
        else toast.error(e.error || "Scene planning failed");
        return;
      }
      const data = await resp.json();
      if (!append) setTitle(data.title || "Untitled Movie");
      const incoming: Scene[] = (data.scenes || []).slice(0, SCENES_PER_BLOCK).map((s: any) => ({
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
      if (!append) {
        if (data.music_prompt) setMusicPrompt(data.music_prompt);
        else if (intent.trim()) setMusicPrompt(`Cinematic score matching: ${intent.slice(0, 200)}`);
        if (seedImage && incoming[0]) incoming[0].image_url = seedImage;
        setScenes(incoming);
      } else {
        setScenes(prev => [...prev, ...incoming]);
      }
      setBlocksProduced(prev => Math.max(prev, blockNum));
      toast.success(`Block ${blockNum}: ${incoming.length} scenes ready.`);
    } catch (e) {
      console.error(e); toast.error("Scene planning failed");
    } finally { setPlanning(false); }
  };

  // Pay for & generate the next 10-scene block (admin = free, no Stripe)
  const purchaseAndGenerateNextBlock = async () => {
    if (!script.trim()) { toast.error("Add a script first"); return; }
    const blockNum = nextBlockNumber;
    if (isAdmin) {
      toast.info(`Admin: block ${blockNum} is free`);
      await planScenes({ append: blocksProduced > 0, blockNumber: blockNum });
      return;
    }
    const usd = priceForBlockUSD(blockNum);
    if (!confirm(`Block ${blockNum}: $${usd} USD for 10 scenes.\n\nAfter payment you'll be returned here. Continue to checkout?`)) return;
    setPayingBlock(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-block-payment", {
        body: { blockNumber: blockNum },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
        toast.success(`Checkout opened for block ${blockNum} ($${usd}). After paying, click "I've paid — generate" to continue.`);
      } else {
        throw new Error("No checkout URL");
      }
    } catch (e: any) {
      console.error(e); toast.error(e.message || "Could not start checkout");
    } finally { setPayingBlock(false); }
  };

  // After Stripe success the user comes back; they then click this to actually generate the paid block
  const confirmPaidAndGenerateBlock = async () => {
    const blockNum = nextBlockNumber;
    await planScenes({ append: blocksProduced > 0, blockNumber: blockNum });
  };


  // ----- Generate 4K photo for a scene -----
  const generateScenePhoto = async (sceneId: string, customPrompt?: string) => {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, generating: true } : s));
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    const finalPrompt = buildScenePhotoPrompt(scene, customPrompt);
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

  // ----- Movie Host: portrait, voices, interviews -----
  /** Render text to speech and return it as a data URL (used by the host layer). */
  const ttsToDataUrl = async (text: string, voiceId: string): Promise<string | null> => {
    try {
      const resp = await fetch(TTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH },
        body: JSON.stringify({ text, voiceId }),
      });
      if (!resp.ok) {
        if (resp.status === 402) { setCreditsLow(true); toast.error("Voice credits exhausted."); }
        else if (resp.status === 429) toast.error("Voice rate limit. Wait and retry.");
        else toast.error("Voice generation failed");
        return null;
      }
      const blob = await resp.blob();
      return await new Promise<string>((res, rej) => {
        const r = new FileReader(); r.onloadend = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("[ttsToDataUrl]", e);
      toast.error("Voice generation failed");
      return null;
    }
  };

  const generateHostPortrait = async (look: string) => {
    setGeneratingPortrait(true);
    try {
      const prompt = hostPortraitPrompt(host.name || "the host", host.title || "", look);
      const resp = await fetch(GEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH },
        body: JSON.stringify({ prompt }),
      });
      if (!resp.ok) {
        if (resp.status === 402) { setCreditsLow(true); toast.error("AI credits exhausted."); }
        else toast.error("Host portrait failed");
        return;
      }
      const data = await resp.json();
      const url = data.images?.[0]?.image_url?.url;
      if (!url) { toast.error("No portrait returned"); return; }
      patchHost({ imageUrl: url, enabled: true });
      if (user) saveMedia.mutate({
        media_type: "image",
        title: `Movie host — ${host.name}`,
        url,
        source_page: "movie-studio-host",
        metadata: { look },
      });
      toast.success("Host is on camera");
    } finally {
      setGeneratingPortrait(false);
    }
  };

  /** Voice one host piece-to-camera. */
  const voiceHostBeat = async (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    const beat = scene?.host_beat;
    if (!beat?.line?.trim()) { toast.error("Write the host's line first"); return; }
    updateScene(sceneId, { host_beat: { ...beat, generating: true } });
    const url = await ttsToDataUrl(beat.line.trim(), host.voiceId);
    setScenes(prev => prev.map(s => s.id === sceneId
      ? { ...s, host_beat: { ...(s.host_beat as HostBeat), audio_url: url ?? undefined, generating: false } }
      : s));
    if (url) toast.success("Host line recorded — lip-sync is live");
  };

  /** Voice both sides of a ≤8s live interview. */
  const voiceInterview = async (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    const iv = scene?.interview;
    if (!iv?.hostLine?.trim() || !iv?.guestLine?.trim()) {
      toast.error("Write both the host question and the guest answer"); return;
    }
    updateScene(sceneId, { interview: { ...iv, generating: true } });
    const [hostUrl, guestUrl] = await Promise.all([
      ttsToDataUrl(iv.hostLine.trim(), host.voiceId),
      ttsToDataUrl(iv.guestLine.trim(), iv.guestVoiceId),
    ]);
    setScenes(prev => prev.map(s => s.id === sceneId
      ? {
          ...s,
          interview: {
            ...(s.interview as InterviewBeat),
            hostAudioUrl: hostUrl ?? undefined,
            guestAudioUrl: guestUrl ?? undefined,
            seconds: clampInterviewSeconds((s.interview as InterviewBeat).seconds),
            generating: false,
          },
        }
      : s));
    if (hostUrl && guestUrl) toast.success("Interview recorded — both avatars will lip-sync");
  };

  // ----- Generate REAL AI motion video for a scene -----

  // Engine = "gemini" (free, default) or "runway" (premium quality, requires RUNWAY_API_KEY).
  // Length = 5 or 10 seconds per scene (set on the scene card).
  const generateSceneVideo = async (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene?.image_url) { toast.error("Generate the scene photo first"); return; }
    const engine = scene.video_engine || "gemini";
    const seconds = (scene.video_seconds || 5) as 5 | 10;
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, generatingVideo: true } : s));
    const motionPrompt = `${scene.caption}. ${scene.character_action || ""} ${scene.character_emotion || ""}`.trim();
    try {
      const path = engine === "runway" ? "runway-image-to-video" : "gemini-video";
      const ratio = engine === "runway" ? "1280:768" : "16:9";
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH },
        body: JSON.stringify({
          image_url: scene.image_url,
          prompt: motionPrompt,
          duration: seconds,
          ratio,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        if (data.error === "RUNWAY_API_KEY missing") {
          toast.error("Add a RUNWAY_API_KEY in project secrets to enable Runway. Switch to Gemini engine for free video.", { duration: 6000 });
        } else if (resp.status === 402) {
          toast.error("AI credits exhausted. Add credits in Lovable → Settings → Workspace → Usage.");
        } else if (resp.status === 429) {
          toast.error("Too many video requests — wait a moment and try again.");
        } else {
          toast.error(data.error || "Video generation failed");
        }
        setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, generatingVideo: false } : s));
        return;
      }
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, video_url: data.video_url, generatingVideo: false } : s));
      if (user && data.video_url) saveMedia.mutate({
        media_type: "video",
        title: `Movie clip [${engine}] - ${scene.caption.slice(0, 40)}`,
        url: data.video_url,
        source_page: "movie-studio",
        metadata: { sceneId, source: engine, seconds },
      });
      toast.success(`${engine === "runway" ? "Runway" : "Gemini"} video clip generated (${seconds}s)`);
    } catch (e) {
      console.error(e); toast.error("Video generation failed");
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, generatingVideo: false } : s));
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
        body: JSON.stringify({ text, voiceId: resolveVoiceId(scene) }),
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

  /** Replace (dub over) the voice-over on a scene with new text and/or a different voice. */
  const redubScene = async (sceneId: string, text: string, voiceId: string) => {
    setScenes(prev => prev.map(s => s.id === sceneId
      ? { ...s, narration: text, voice_id: voiceId, audio_url: undefined }
      : s));
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, generatingAudio: true } : s));
    try {
      const resp = await fetch(TTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH },
        body: JSON.stringify({ text, voiceId }),
      });
      if (!resp.ok) {
        if (resp.status === 402) { setCreditsLow(true); toast.error("Voice credits exhausted."); }
        else if (resp.status === 429) toast.error("Voice rate limit. Wait and retry.");
        else toast.error("Dub failed");
        return;
      }
      const blob = await resp.blob();
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader(); r.onloadend = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(blob);
      });
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, audio_url: dataUrl, generatingAudio: false } : s));
      toast.success("Voice layer dubbed");
    } catch (e) {
      console.error(e); toast.error("Dub failed");
    } finally {
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, generatingAudio: false } : s));
    }
  };

  const generateAllAudio = async () => {
    const pending = scenes.filter(s => !s.audio_url && (s.narration || s.caption)).map(s => s.id);
    if (pending.length === 0) { toast.info("All scenes already have audio"); return; }
    setAudioProgress({ done: 0, total: pending.length });
    let done = 0;
    // Four parallel voice workers keep long films moving without flooding the provider.
    const BATCH = 4;
    for (let i = 0; i < pending.length; i += BATCH) {
      const chunk = pending.slice(i, i + BATCH);
      await Promise.all(chunk.map(async id => {
        await generateSceneAudio(id);
        done += 1;
        setAudioProgress({ done, total: pending.length });
      }));
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
    const BATCH = 4;
    for (let i = 0; i < pending.length; i += BATCH) {
      const chunk = pending.slice(i, i + BATCH);
      await Promise.all(chunk.map(async id => {
        await generateSceneSfx(id);
        done += 1;
        setSfxProgress({ done, total: pending.length });
      }));
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
    const picked = autoPickEnabled ? oraclePickBest(results, scenes.find(x => x.id === sceneId)?.tone) : results[0];
    setScenes(prev => prev.map(s => s.id === sceneId
      ? { ...s, music_options: results, music_url: s.music_url || picked, generatingSceneMusic: false }
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

  const runAdaptiveScoreTeam = async () => {
    if (!scenes.length) { toast.error("Build the movie scenes first"); return; }
    setScoreTeamBusy(true);
    setScoreTeamNotes([]);
    try {
      const sceneList = scenes.map((scene, index) =>
        `${index + 1}. ${scene.caption} | tone=${scene.tone || "neutral"} | narration=${(scene.narration || "").slice(0, 180)}`
      ).join("\n");
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH },
        body: JSON.stringify({
          type: "assistant",
          prompt: `You are a film-score team with four roles: COMPOSER creates memorable original motifs; MUSIC EDITOR maps intensity to every scene; DIALOGUE MIXER keeps the score gentle under speech; QUALITY JUDGE rejects repetitive or tonally wrong cues. Design an original, copyright-safe, upbeat comic-action adventure score with bright 1980s synth-funk propulsion, heroic brass-and-snare rescue energy, nimble masked-swashbuckler guitar colours, and suspense that rises only where the story rises. Do not name or imitate any existing film, television theme, artist or song. Return exactly one numbered line per scene in this format: N. <instrumental generation prompt including BPM, instruments, mood, intensity 1-10, transition and NO vocals>.\n\nMOVIE: ${title || "Untitled movie"}\nINTENT: ${intent}\nSCENES:\n${sceneList}`,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      const payload = await response.json();
      const text = typeof payload === "string" ? payload : (payload.text || payload.result || "");
      const cues = String(text).split("\n").map(line => line.replace(/^\s*\d+[.)-]?\s*/, "").trim()).filter(Boolean).slice(0, scenes.length);
      if (cues.length !== scenes.length) throw new Error("The score team did not return a complete cue sheet");
      setScoreTeamNotes(cues);
      setScenes(previous => previous.map((scene, index) => ({ ...scene, music_prompt: cues[index] })));
      toast.success(`Score team approved ${cues.length} adaptive scene cues — generate or audition each cue below`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Score team failed");
    } finally {
      setScoreTeamBusy(false);
    }
  };

  const runProductionSwarm = async () => {
    if (!scenes.length) { toast.error("Build the movie scenes first"); return; }
    if (productionSwarmBusy) return;
    setProductionSwarmBusy(true);
    setProductionSwarm(PRODUCTION_AGENTS.map(agent => ({
      ...agent,
      status: agent.id === "quality" ? "waiting" : "working",
    })));

    const setAgentStatus = (id: ProductionAgent["id"], status: ProductionAgentStatus) => {
      setProductionSwarm(previous => previous.map(agent => agent.id === id ? { ...agent, status } : agent));
    };
    const runLane = async (id: ProductionAgent["id"], work: () => Promise<void>) => {
      try {
        await work();
        setAgentStatus(id, "complete");
        return true;
      } catch (error) {
        console.error(`${id} production agent failed`, error);
        setAgentStatus(id, "failed");
        return false;
      }
    };

    try {
      const results = await Promise.all([
        runLane("visual", generateAll),
        runLane("voice", generateAllAudio),
        runLane("sound", generateAllSfx),
        runLane("score", runAdaptiveScoreTeam),
      ]);
      setAgentStatus("quality", "working");
      const failed = results.filter(result => !result).length;
      setAgentStatus("quality", failed ? "failed" : "complete");
      if (failed) toast.error(`Production swarm finished with ${failed} lane${failed === 1 ? "" : "s"} needing retry`);
      else toast.success("All five production agents completed their work");
    } finally {
      setProductionSwarmBusy(false);
    }
  };

  // ----- Intro fanfare (5 selectable styles) -----
  const INTRO_STYLE_PROMPTS: Record<typeof introStyle, string> = {
    "epic": `Epic, triumphant orchestral fanfare with rising strings, soaring brass and a powerful timpani hit, 4 seconds, builds energy for the opening of a movie titled "${title || "this movie"}"`,
    "playful": `Playful, light, jingle-style intro with cheerful piano, ukulele and a bright bell flourish, 4 seconds, fun and welcoming opener for "${title || "this movie"}"`,
    "cinematic-drone": `Cinematic atmospheric drone opener with deep low strings, a slow-building synth pad and a subtle rising swell, 4 seconds, mysterious tone for "${title || "this movie"}"`,
    "retro-news": `Retro broadcast news intro with bold horns, urgent percussion and a vintage TV broadcast vibe, 4 seconds, "breaking news" energy for "${title || "this movie"}"`,
    "trailer-hit": `Modern blockbuster trailer hit with a deep cinematic boom, hybrid percussion and an explosive brass stab, 4 seconds, high-impact intro for "${title || "this movie"}"`,
  } as any;

  const composeIntroMusic = async () => {
    setGeneratingIntro(true);
    try {
      const prompt = INTRO_STYLE_PROMPTS[introStyle];
      const resp = await fetch(MUSIC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH },
        body: JSON.stringify({ prompt, duration_seconds: 10 }),
      });
      if (!resp.ok) {
        if (resp.status === 402) { setCreditsLow(true); toast.error("Music credits exhausted."); }
        else toast.error("Intro music generation failed");
        return;
      }
      const blob = await resp.blob();
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader(); r.onloadend = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(blob);
      });
      setIntroMusicUrl(dataUrl);
      if (user) saveMedia.mutate({
        media_type: "audio",
        title: `${title || "Movie"} - intro fanfare (${introStyle})`,
        url: dataUrl, source_page: "movie-studio",
        metadata: { kind: "intro-music", style: introStyle },
      });
      toast.success(`Intro fanfare ready (${introStyle})`);
    } catch (e) {
      console.error(e); toast.error("Intro music generation failed");
    } finally { setGeneratingIntro(false); }
  };

  // ----- Outro sting (short "The End" musical sting) -----
  const composeOutroMusic = async () => {
    setGeneratingOutro(true);
    try {
      const prompt = `Short, warm, conclusive cinematic outro sting for the end of a movie. Gentle strings and a final resolving chord with a soft timpani hit. 4 seconds. "The End" feel for "${title || "this movie"}"`;
      const resp = await fetch(MUSIC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH },
        body: JSON.stringify({ prompt, duration_seconds: 10 }),
      });
      if (!resp.ok) {
        if (resp.status === 402) { setCreditsLow(true); toast.error("Music credits exhausted."); }
        else toast.error("Outro music generation failed");
        return;
      }
      const blob = await resp.blob();
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader(); r.onloadend = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(blob);
      });
      setOutroMusicUrl(dataUrl);
      if (user) saveMedia.mutate({
        media_type: "audio",
        title: `${title || "Movie"} - outro sting`,
        url: dataUrl, source_page: "movie-studio",
        metadata: { kind: "outro-music" },
      });
      toast.success("Outro sting ready");
    } catch (e) {
      console.error(e); toast.error("Outro music generation failed");
    } finally { setGeneratingOutro(false); }
  };

  // ----- Theme soundtrack (always upbeat & exciting, plays as the main score) -----
  const composeThemeTrack = async () => {
    setGeneratingTheme(true);
    try {
      const totalSecs = Math.max(30, scenes.length * CLIP_SECONDS);
      const prompt = `Upbeat, exciting, energetic cinematic theme soundtrack, driving rhythm, uplifting orchestral and modern hybrid score, adventurous and triumphant, perfect as the main theme for a movie titled "${title || "this movie"}". Keep energy high throughout.`;
      const resp = await fetch(MUSIC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH },
        body: JSON.stringify({ prompt, duration_seconds: totalSecs }),
      });
      if (!resp.ok) {
        if (resp.status === 402) { setCreditsLow(true); toast.error("Music credits exhausted."); }
        else toast.error("Theme music generation failed");
        return;
      }
      const blob = await resp.blob();
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader(); r.onloadend = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(blob);
      });
      setThemeMusicUrl(dataUrl);
      setMusicUrl(dataUrl); // theme replaces global score
      if (user) saveMedia.mutate({
        media_type: "audio",
        title: `${title || "Movie"} - theme soundtrack`,
        url: dataUrl, source_page: "movie-studio",
        metadata: { kind: "theme-music", durationSec: totalSecs },
      });
      toast.success("Upbeat theme soundtrack ready");
    } catch (e) {
      console.error(e); toast.error("Theme music generation failed");
    } finally { setGeneratingTheme(false); }
  };

  // ----- AI-generated end credits -----
  const generateCredits = async () => {
    setGeneratingCredits(true);
    try {
      // Reuse the script-to-scenes endpoint? It only does scenes. Use image-gen? No.
      // Build credits locally from what we know — speakers, title, intent — then ask AI to enrich via a tiny prompt to MUSIC? No. Just compose locally for reliability.
      const speakers = Array.from(new Set(scenes.map(s => s.speaker).filter(Boolean))) as string[];
      const lines: string[] = [];
      lines.push(`${title || "Untitled Movie"}`);
      lines.push("");
      lines.push("— A ORACLE LUNAR Production —");
      lines.push("");
      lines.push("Directed by");
      lines.push("The ORACLE LUNAR Oracle");
      lines.push("");
      if (starring.trim()) {
        lines.push("Starring");
        starring.split(/[,\n]/).map(s => s.trim()).filter(Boolean).forEach(n => lines.push(n));
        lines.push("");
      }
      if (coStarring.trim()) {
        lines.push("Co-starring");
        coStarring.split(/[,\n]/).map(s => s.trim()).filter(Boolean).forEach(n => lines.push(n));
        lines.push("");
      }
      if (guestStars.trim()) {
        lines.push("Guest Stars");
        guestStars.split(/[,\n]/).map(s => s.trim()).filter(Boolean).forEach(n => lines.push(n));
        lines.push("");
      }
      if (intent.trim()) {
        lines.push("Story");
        lines.push(intent.trim().slice(0, 120));
        lines.push("");
      }
      if (speakers.length > 0) {
        lines.push("Voice Cast");
        speakers.forEach(sp => lines.push(sp));
        lines.push("");
      }
      lines.push("Original Score");
      lines.push("ElevenLabs Music");
      lines.push("");
      lines.push("Visuals");
      lines.push("Generated with AI");
      lines.push("");
      lines.push("Made with ♥ on ORACLE LUNAR");
      setCreditsLines(lines);
      toast.success("Credits ready");
    } catch (e) {
      console.error(e); toast.error("Credits generation failed");
    } finally { setGeneratingCredits(false); }
  };

  // Auto-generate intro + theme + outro + credits in one click — Oracle's "make it complete" button
  const generateAllExtras = async () => {
    if (!title) toast.info("Tip: set a title first for best intro/credits");
    if (!themeMusicUrl) await composeThemeTrack();
    if (!introMusicUrl) await composeIntroMusic();
    if (!outroMusicUrl) await composeOutroMusic();
    if (creditsLines.length === 0) await generateCredits();
  };

  // ----- YouTube Newsroom preset (one-click full show) -----
  const generateYouTubeShow = async () => {
    if (!script.trim()) { toast.error("Add your show script first"); return; }
    setGeneratingNewsroom(true);
    try {
      const show = showName || "ORACLE LUNAR Daily";
      const host = hostName || "Alex Rivera";
      const role = hostTitle || "Lead Anchor";
      setNewsroomMode(true);
      if (!title) setTitle(show);
      // Plan scenes if needed
      if (scenes.length === 0) await planScenes();
      // Tag every scene as a news segment with lower-thirds
      setScenes(prev => prev.map((s, i) => ({
        ...s,
        is_news_segment: true,
        lower_third_name: i === 0 || i === prev.length - 1 ? host : (s.speaker || host),
        lower_third_title: i === 0 || i === prev.length - 1 ? role : "Field Report",
        speaker: s.speaker || host,
        voice_style: s.voice_style || "narrator-male-warm",
        photo_prompt: s.is_news_segment ? s.photo_prompt :
          (i === 0 || i === prev.length - 1)
            ? `Professional TV news anchor ${host} at a modern newsroom desk, multiple monitors behind, cinematic studio lighting, "${show}" logo on screen, broadcast quality 4K`
            : `B-roll cutaway image for news story: ${s.photo_prompt}, photojournalism, broadcast TV news look`,
      })));
      // Auto-create intro fanfare + upbeat theme + credits
      await generateAllExtras();
      toast.success("YouTube Show preset applied. Generate photos & voices to finish.");
    } catch (e) {
      console.error(e); toast.error("Newsroom preset failed");
    } finally { setGeneratingNewsroom(false); }
  };

  // ----- AI-generated 10×6s preview / trailer (best parts of the movie picked by AI) -----
  // Picks up to 10 scenes from the existing scene list. Oracle scoring favours scenes that
  // have an image AND a tone of "epic"/"emotional"/"playful"; the user can swap any clip
  // with the "Use scene N" buttons next to each trailer slot.
  const generatePreviewTrailer = async () => {
    if (scenes.length === 0) { toast.error("Plan a movie first"); return; }
    setGeneratingTrailer(true);
    try {
      const candidates = scenes.filter(s => s.image_url);
      if (candidates.length === 0) {
        toast.error("Generate at least one scene photo before building a trailer");
        return;
      }
      const tonePriority: Record<SceneTone, number> = {
        epic: 5, emotional: 4, tense: 4, playful: 3, calm: 2, neutral: 1,
      };
      const ranked = [...candidates].sort((a, b) => {
        const ta = tonePriority[a.tone || "neutral"];
        const tb = tonePriority[b.tone || "neutral"];
        return tb - ta;
      });
      // Always keep first + last for narrative bookends, then fill from ranked
      const picks: typeof candidates = [];
      const add = (s: typeof candidates[number]) => { if (!picks.find(p => p.id === s.id) && picks.length < 10) picks.push(s); };
      if (candidates[0]) add(candidates[0]);
      if (candidates[candidates.length - 1]) add(candidates[candidates.length - 1]);
      ranked.forEach(add);
      // Re-sort picks by their original scene order so the trailer flows
      picks.sort((a, b) => scenes.findIndex(s => s.id === a.id) - scenes.findIndex(s => s.id === b.id));
      setTrailerScenes(picks.map(p => ({ id: p.id, image: p.image_url!, tone: p.tone })));
      toast.success(`Trailer ready — ${picks.length} clips × 6s with the movie soundtrack`);
    } catch (e) {
      console.error(e); toast.error("Trailer generation failed");
    } finally { setGeneratingTrailer(false); }
  };

  const swapTrailerClip = (slotIndex: number, sceneId: string) => {
    const s = scenes.find(x => x.id === sceneId);
    if (!s?.image_url) return;
    setTrailerScenes(prev => prev.map((t, i) => i === slotIndex ? { id: s.id, image: s.image_url!, tone: s.tone } : t));
  };

  const removeTrailerClip = (slotIndex: number) => {
    setTrailerScenes(prev => prev.filter((_, i) => i !== slotIndex));
  };

  // ================= SUPER AI ==================================================
  // One button that can run every production job in the studio, plus the jobs the
  // swarm needs for a finished film: opening credits, advert breaks, end credits.
  const generateAllVideo = async () => {
    for (const s of scenes) {
      if (!s.video_url && s.image_url) await generateSceneVideo(s.id);
    }
  };

  const applyVoiceToAll = async (voiceId: string) => {
    for (const s of scenes) {
      const text = (s.narration || "").trim();
      if (!text) continue;
      await redubScene(s.id, text, voiceId);
    }
    toast.success("Whole movie re-dubbed in the new voice");
  };

  const setMusicVibe = async (prompt: string) => {
    setMusicPrompt(prompt);
    await generateMusic();
  };

  const addOpeningTitles = async (subtitleLine: string) => {
    if (creditsLines.length === 0) await generateCredits();
    const id = uid();
    const movieTitle = title || "Untitled Movie";
    setScenes(prev => [{
      id,
      caption: `TITLE CARD — ${movieTitle}`,
      photo_prompt: `Cinematic 4K opening title card for the film "${movieTitle}". ${subtitleLine ? `Tagline: ${subtitleLine}. ` : ""}Dramatic negative space in the lower third for titles, film-grain, award-winning key art, no text artefacts, no cropped heads.`,
      motion: "ken-burns",
      duration_sec: 8,
      narration: subtitleLine || "",
      speaker: "narrator",
      voice_style: "narrator-male-warm",
      sfx_prompt: "",
      music_prompt: "epic opening title sting, cinematic, instrumental",
      music_volume: 0.35,
    }, ...prev]);
    await generateScenePhoto(id);
    toast.success("Opening credits added at the front of the movie");
  };

  const insertAd = async (adSpec: { headline: string; script: string; visual: string; seconds: number; position: "front" | "end" }) => {
    const id = uid();
    const adScene: Scene = {
      id,
      caption: `AD — ${adSpec.headline}`,
      photo_prompt: adSpec.visual || `High-end commercial key visual for "${adSpec.headline}", 4K, glossy advertising photography, bold clean composition, space for a headline.`,
      motion: "ken-burns",
      duration_sec: adSpec.seconds,
      narration: adSpec.script || adSpec.headline,
      speaker: "narrator",
      voice_style: "narrator-male-warm",
      sfx_prompt: "",
      music_prompt: "upbeat commercial bed, instrumental",
      music_volume: 0.3,
    };
    setScenes(prev => adSpec.position === "front" ? [adScene, ...prev] : [...prev, adScene]);
    await generateScenePhoto(id);
    await generateSceneAudio(id);
    toast.success(`Advert inserted ${adSpec.position === "front" ? "before" : "after"} the movie`);
  };

  // ---- Credits pulled from the story: opening title card + end credits roll ----
  const generateStoryCredits = async () => {
    if (!scenes.length) { toast.error("Build the movie scenes first"); return; }
    await generateCredits();
    const movieTitle = title || "Untitled Movie";
    const hasOpening = scenes.some(s => s.caption.startsWith("TITLE CARD"));
    const hasEnd = scenes.some(s => s.caption.startsWith("END CREDITS"));
    if (!hasOpening) await addOpeningTitles("");
    if (!hasEnd) {
      const id = uid();
      setScenes(prev => [...prev, {
        id,
        caption: `END CREDITS — ${movieTitle}`,
        photo_prompt: `Cinematic 4K end-credits backdrop for the film "${movieTitle}": dark, moody, wide negative space, subtle film grain, no text, no faces cropped.`,
        motion: "ken-burns",
        duration_sec: 14,
        narration: "",
        speaker: "narrator",
        voice_style: "narrator-male-warm",
        sfx_prompt: "",
        music_prompt: "warm conclusive end-credits cue, instrumental, cinematic",
        music_volume: 0.4,
      }]);
      await generateScenePhoto(id);
    }
    if (!outroMusicUrl) await composeOutroMusic();
    toast.success("Opening titles and end credits built from your story");
  };

  // ---- Automatic music cues placed across the whole timeline from the story beats ----
  const autoScoreTimeline = async () => {
    if (!scenes.length) { toast.error("Build the movie scenes first"); return; }
    await runAdaptiveScoreTeam();
    // Read the freshly-written cues off state
    const withCues = await new Promise<Scene[]>(resolve => setScenes(prev => { resolve(prev); return prev; }));
    const targets = withCues.filter(s => !s.music_url && s.music_prompt?.trim());
    if (!targets.length) { toast.info("Every beat already has a music cue"); return; }
    let done = 0;
    for (const scene of targets) {
      if (superAICancel.current) break;
      const url = await generateSceneMusicOption(scene.id, scene.music_prompt!.trim());
      const intensity = Number((scene.music_prompt!.match(/intensity\s*(\d+)/i) || [])[1] || 5);
      if (url) {
        setScenes(prev => prev.map(s => s.id === scene.id
          ? { ...s, music_url: url, music_volume: Math.max(0.08, Math.min(0.45, intensity / 22)) }
          : s));
      }
      done += 1;
      setMusicCueProgress({ done, total: targets.length });
    }
    setTimeout(() => setMusicCueProgress(null), 1500);
    toast.success("Music cues placed across the whole timeline");
  };

  // ---- Automatic SFX design: prompts, beat timestamps and volumes for every scene ----
  const autoSfxTimeline = async () => {
    if (!scenes.length) { toast.error("Build the movie scenes first"); return; }
    try {
      const sceneList = scenes.map((s, i) =>
        `${i + 1}. ${s.caption} | ${s.duration_sec}s | ${(s.narration || s.photo_prompt || "").slice(0, 160)}`
      ).join("\n");
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH },
        body: JSON.stringify({
          type: "assistant",
          prompt: `You are a film sound designer. For each scene below return exactly one line:\nN | <short sound effect description> | <seconds into the scene the effect hits> | <volume 0.1-1.0>\nKeep the effect under the dialogue, never louder than 0.8 when there is narration, and vary the timestamps so hits land on the story beat.\n\nSCENES:\n${sceneList}`,
        }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const payload = await resp.json();
      const text = typeof payload === "string" ? payload : (payload.text || payload.result || "");
      const rows = String(text).split("\n").map(l => l.trim()).filter(l => /\|/.test(l));
      if (!rows.length) throw new Error("The sound designer returned no cue sheet");
      setScenes(prev => prev.map((s, i) => {
        const row = rows[i];
        if (!row) return s;
        const parts = row.split("|").map(p => p.trim());
        const prompt = (parts[1] || "").replace(/^\d+[.)-]?\s*/, "");
        const at = Number((parts[2] || "").replace(/[^\d.]/g, ""));
        const vol = Number((parts[3] || "").replace(/[^\d.]/g, ""));
        if (!prompt) return s;
        return {
          ...s,
          sfx_prompt: prompt,
          sfx_url: undefined,
          sfx_offset_sec: Number.isFinite(at) ? Math.max(0, Math.min(s.duration_sec, at)) : 0,
          sfx_volume: Number.isFinite(vol) && vol > 0 ? Math.max(0.05, Math.min(1, vol)) : 0.6,
        };
      }));
      toast.success("Sound design mapped to every beat — generating effects…");
      await generateAllSfx();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sound design failed");
      throw e;
    }
  };

  // ---- Step-by-step Super AI production pipeline (progress, errors, resume, cancel) ----
  const PIPELINE_STEPS: { id: string; label: string; run: () => Promise<void> }[] = [
    { id: "images", label: "Illustrate every scene", run: async () => { await generateAll(); } },
    { id: "voices", label: "Record the narration", run: async () => { await generateAllAudio(); } },
    { id: "sfx", label: "Design and place the sound effects", run: autoSfxTimeline },
    { id: "score", label: "Score the timeline with music cues", run: autoScoreTimeline },
    { id: "extras", label: "Compose intro, theme and outro", run: async () => { await generateAllExtras(); } },
    { id: "credits", label: "Build opening titles and end credits", run: generateStoryCredits },
  ];

  const runPipeline = async (fromIndex = 0) => {
    if (superAIRunning) return;
    superAICancel.current = false;
    setSuperAIRunning(true);
    setPipeline(prev => {
      const base = PIPELINE_STEPS.map((s, i) => {
        const existing = prev.find(p => p.id === s.id);
        return { id: s.id, label: s.label, status: (i < fromIndex && existing?.status === "complete" ? "complete" : "waiting") as PipelineStatus, error: undefined as string | undefined };
      });
      return base;
    });
    try {
      for (let i = fromIndex; i < PIPELINE_STEPS.length; i++) {
        if (superAICancel.current) {
          setPipeline(prev => prev.map((p, idx) => idx === i ? { ...p, status: "cancelled" } : p));
          setSuperAIStep(i);
          toast.info("Super AI production cancelled — resume when you're ready");
          return;
        }
        setSuperAIStep(i);
        setPipeline(prev => prev.map((p, idx) => idx === i ? { ...p, status: "working", error: undefined } : p));
        try {
          await PIPELINE_STEPS[i].run();
          setPipeline(prev => prev.map((p, idx) => idx === i ? { ...p, status: "complete" } : p));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Step failed";
          console.error(`Super AI step ${PIPELINE_STEPS[i].id} failed`, error);
          setPipeline(prev => prev.map((p, idx) => idx === i ? { ...p, status: "failed", error: message } : p));
          toast.error(`${PIPELINE_STEPS[i].label} failed — fix it and resume`);
          return;
        }
      }
      toast.success("Super AI finished the production — review the timeline, then render the final cut.");
    } finally {
      setSuperAIRunning(false);
    }
  };

  const cancelPipeline = () => { superAICancel.current = true; };
  const resumePipeline = () => {
    const nextIndex = pipeline.findIndex(p => p.status !== "complete");
    void runPipeline(nextIndex === -1 ? 0 : nextIndex);
  };

  const runEverything = async () => {
    toast.info("Super AI is taking over the whole production…");
    await runPipeline(0);
  };

  // ---- What already exists, so Resume can tell you exactly what will be re-run ----
  const pipelineArtifacts = (() => {
    const total = scenes.length;
    const count = (fn: (s: Scene) => boolean) => scenes.filter(fn).length;
    return [
      { id: "images", label: "Scene artwork", have: count(s => !!s.image_url), total },
      { id: "voices", label: "Narration takes", have: count(s => !!s.audio_url), total },
      { id: "sfx", label: "Sound effects", have: count(s => !!s.sfx_url), total },
      { id: "score", label: "Music cues placed", have: count(s => !!s.music_url), total },
      {
        id: "extras",
        label: "Intro / theme / outro",
        have: [introMusicUrl, themeMusicUrl, outroMusicUrl].filter(Boolean).length,
        total: 3,
      },
      {
        id: "credits",
        label: "Titles + end credits",
        have: (scenes.some(s => s.caption.startsWith("TITLE CARD")) ? 1 : 0) +
          (scenes.some(s => s.caption.startsWith("END CREDITS")) ? 1 : 0),
        total: 2,
      },
    ];
  })();

  const nextPipelineIndex = (() => {
    if (!pipeline.length) return 0;
    const idx = pipeline.findIndex(p => p.status !== "complete");
    return idx === -1 ? 0 : idx;
  })();
  const nextPipelineStepLabel = PIPELINE_STEPS[nextPipelineIndex]?.label ?? PIPELINE_STEPS[0].label;

  // ---- Preview mode: audition music / SFX / voice / credits against the timeline ----
  const auditionRef = useRef<{ ctx: AudioContext; timer: number } | null>(null);
  const [auditionLayers, setAuditionLayers] = useState({ music: true, sfx: true, voice: true, credits: true });
  const [auditionState, setAuditionState] = useState<{ at: number; total: number; label: string } | null>(null);

  const stopAudition = () => {
    const a = auditionRef.current;
    if (a) {
      window.clearInterval(a.timer);
      try { void a.ctx.close(); } catch { /* already closed */ }
    }
    auditionRef.current = null;
    setAuditionState(null);
  };

  useEffect(() => () => stopAudition(), []);

  const startAudition = async (layers: { music: boolean; sfx: boolean; voice: boolean; credits: boolean }) => {
    stopAudition();
    setAuditionLayers(layers);
    const isCreditsScene = (s: Scene) => s.caption.startsWith("TITLE CARD") || s.caption.startsWith("END CREDITS");
    const list = scenes.filter(s => layers.credits || !isCreditsScene(s));
    if (!list.length) { toast.error("Nothing on the timeline to audition yet"); return; }

    const AudioCtor: typeof AudioContext = (window.AudioContext || (window as any).webkitAudioContext);
    const ctx = new AudioCtor();
    const decode = async (u?: string | null) => {
      if (!u) return null;
      try { return await ctx.decodeAudioData(await (await fetch(u)).arrayBuffer()); } catch { return null; }
    };

    const starts: number[] = [];
    let acc = 0;
    list.forEach(s => { starts.push(acc); acc += s.duration_sec || CLIP_SECONDS; });
    const total = acc;

    const t0 = ctx.currentTime + 0.25;
    const play = (buf: AudioBuffer | null, at: number, vol: number) => {
      if (!buf) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = Math.max(0, Math.min(1, vol));
      src.connect(g).connect(ctx.destination);
      src.start(t0 + at);
    };

    await Promise.all(list.map(async (s, i) => {
      const base = starts[i];
      if (layers.voice) play(await decode(s.audio_url), base + (s.voice_offset_sec ?? 0), 1);
      if (layers.sfx) play(await decode(s.sfx_url), base + (s.sfx_offset_sec ?? 0), s.sfx_volume ?? 0.6);
      if (layers.music) play(await decode(s.music_url), base, s.music_volume ?? 0.25);
    }));
    if (layers.music && musicUrl) play(await decode(musicUrl), 0, musicVolume);

    const timer = window.setInterval(() => {
      const at = Math.max(0, ctx.currentTime - t0);
      let idx = 0;
      starts.forEach((st, i) => { if (at >= st) idx = i; });
      setAuditionState({ at: Math.min(at, total), total, label: list[idx]?.caption || "" });
      setPreviewSceneId(list[idx]?.id ?? null);
      if (at >= total) stopAudition();
    }, 250);
    auditionRef.current = { ctx, timer };
    setAuditionState({ at: 0, total, label: list[0].caption });
    toast.success("Auditioning the timeline — nothing is being rendered");
  };

  // ---- Export controls (resolution / bitrate / container) ----
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    resolution: "1080p",
    bitrateMbps: 8,
    container: "webm",
  });

  // ---- Render report produced after a Super AI run / export ----
  const [renderReport, setRenderReport] = useState<{ filename: string; text: string } | null>(null);

  const buildRenderReport = (extra: { errors: string[]; blobBytes?: number; durationSec?: number; usedScenes: Scene[] }) => {
    const voiceName = (id?: string) =>
      CURATED_ELEVENLABS_VOICES.find(v => v.id === id)?.name || id || "default narrator";
    const lines: string[] = [];
    lines.push(`RENDER REPORT — ${title || "Untitled Movie"}`);
    lines.push(`Generated ${new Date().toISOString()}`);
    lines.push("");
    lines.push(`Output: ${exportSettings.resolution} · ${exportSettings.bitrateMbps} Mbps · .${exportSettings.container}`);
    if (extra.blobBytes) lines.push(`File size: ${(extra.blobBytes / 1024 / 1024).toFixed(1)} MB`);
    if (extra.durationSec) lines.push(`Runtime: ${Math.floor(extra.durationSec / 60)}m ${Math.round(extra.durationSec % 60)}s`);
    lines.push(`Scenes rendered: ${extra.usedScenes.length} of ${scenes.length}`);
    lines.push("");
    lines.push("PRODUCTION STEPS");
    pipeline.forEach((p, i) => lines.push(`  ${i + 1}. ${p.label} — ${p.status}${p.error ? ` (${p.error})` : ""}`));
    if (!pipeline.length) lines.push("  (no Super AI pipeline run this session)");
    lines.push("");
    lines.push("TIMELINE");
    extra.usedScenes.forEach((s, i) => {
      lines.push(`  ${i + 1}. ${s.caption} — ${s.duration_sec || CLIP_SECONDS}s`);
      lines.push(`     voice: ${s.audio_url ? `${voiceName(resolveVoiceId(s))} @ +${(s.voice_offset_sec ?? 0).toFixed(1)}s` : "none"}`);
      lines.push(`     music: ${s.music_url ? `${s.music_prompt || "cue"} @ ${Math.round((s.music_volume ?? 0.25) * 100)}%` : "none"}`);
      lines.push(`     sfx:   ${s.sfx_url ? `${s.sfx_prompt || "effect"} @ +${(s.sfx_offset_sec ?? 0).toFixed(1)}s, ${Math.round((s.sfx_volume ?? 0.6) * 100)}%` : "none"}`);
    });
    lines.push("");
    lines.push("GLOBAL AUDIO");
    lines.push(`  Whole-movie score: ${musicUrl ? `${musicPrompt || "custom track"} @ ${Math.round(musicVolume * 100)}%` : "none"}`);
    lines.push(`  Intro sting: ${introMusicUrl ? "yes" : "no"} · Theme: ${themeMusicUrl ? "yes" : "no"} · Outro: ${outroMusicUrl ? "yes" : "no"}`);
    lines.push(`  Mix: music ${layerAudible(timelineMix, "music") ? "on" : "muted"} · voice ${layerAudible(timelineMix, "voice") ? "on" : "muted"}`);
    lines.push("");
    lines.push("ERRORS");
    if (extra.errors.length) extra.errors.forEach(e => lines.push(`  - ${e}`));
    else lines.push("  none");
    const safe = (title || "movie").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    return { filename: `${safe}-render-report.txt`, text: lines.join("\n") };
  };

  const downloadRenderReport = () => {
    if (!renderReport) { toast.error("Run a render first — the report is written when it finishes"); return; }
    const blob = new Blob([renderReport.text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = renderReport.filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };


  const superAIActions: SuperAIActions = {
    runEverything,
    runProductionSwarm,
    generateAllImages: generateAll,
    generateAllVideo,
    generateAllAudio,
    generateAllSfx,
    autoSfxTimeline,
    autoScoreTimeline,
    runScoreTeam: runAdaptiveScoreTeam,
    generateMovieMusic: generateMusic,
    composeIntro: composeIntroMusic,
    composeTheme: composeThemeTrack,
    composeOutro: composeOutroMusic,
    generateCredits: generateStoryCredits,
    addOpeningTitles,
    applyVoiceToAll,
    setMusicVibe,
    insertAd,
    generateTrailer: generatePreviewTrailer,
    exportMovie: () => exportMovie(),
    setMusicLevel: setMusicVolume,
    musicLevel: musicVolume,
    sceneCount: scenes.length,
    pipeline,
    pipelineRunning: superAIRunning,
    pipelineStep: superAIStep,
    musicCueProgress,
    startPipeline: () => { void runPipeline(0); },
    resumePipeline,
    cancelPipeline,
    pipelineArtifacts,
    nextPipelineStepLabel,
    // Preview mode (audition, no render)
    auditionLayers,
    auditionState,
    startAudition: layers => { void startAudition(layers); },
    stopAudition,
    // Export controls
    exportSettings,
    setExportSettings: patch => setExportSettings(prev => ({ ...prev, ...patch })),
    // Render report
    hasRenderReport: !!renderReport,
    downloadRenderReport,
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

  // Stitched preview — plays ALL scenes back-to-back with cinematic transitions
  // in the preview canvas (silent, visual only). Confirms scenes are joined into
  // one continuous movie before exporting.
  const previewFullMovie = async () => {
    const ready = scenes.filter(s => s.image_url);
    if (ready.length === 0) { toast.error("Generate at least one scene photo first"); return; }
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    setPreviewSceneId("__full__");
    try {
      const imgs = await Promise.all(ready.map(s => new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image(); i.crossOrigin = "anonymous";
        i.onload = () => res(i); i.onerror = rej; i.src = s.image_url!;
      })));
      let cancelled = false;
      const cancelCheck = () => { if (previewAnimRef.current === -1) cancelled = true; };
      previewAnimRef.current = 1;
      for (let idx = 0; idx < ready.length; idx++) {
        if (cancelled) break;
        const scene = ready[idx];
        const img = imgs[idx];
        const dur = Math.max(2000, scene.duration_sec * 1000);
        const start = performance.now();
        await new Promise<void>(resolve => {
          const tick = (now: number) => {
            cancelCheck(); if (cancelled) { resolve(); return; }
            const p = Math.min(1, (now - start) / dur);
            drawMotionFrame(ctx, img, canvas.width, canvas.height, scene.motion, p);
            if (p < 1) previewAnimRef.current = requestAnimationFrame(tick);
            else resolve();
          };
          previewAnimRef.current = requestAnimationFrame(tick);
        });
        if (cancelled) break;
        if (idx < ready.length - 1) {
          const next = ready[idx + 1];
          const nextImg = imgs[idx + 1];
          const a = scene.tone || "neutral";
          const b = next.tone || "neutral";
          let kind = 0;
          if (a === b) kind = 0;
          else if ((a === "tense" && b === "calm") || (a === "calm" && b === "tense")) kind = 1;
          else if (a === "epic" || b === "epic") kind = 3;
          else if (a === "playful" || b === "playful") kind = 2;
          const tDur = 700;
          const tStart = performance.now();
          await new Promise<void>(resolve => {
            const ttick = (now: number) => {
              cancelCheck(); if (cancelled) { resolve(); return; }
              const tp = Math.min(1, (now - tStart) / tDur);
              drawTransition(ctx, img, nextImg, canvas.width, canvas.height, scene.motion, next.motion, tp, kind);
              if (tp < 1) previewAnimRef.current = requestAnimationFrame(ttick);
              else resolve();
            };
            previewAnimRef.current = requestAnimationFrame(ttick);
          });
        }
      }
    } finally {
      setPreviewSceneId(null);
      previewAnimRef.current = null;
    }
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

    // ===== MANDATORY WALLET CHARGE (admin bypass) =====
    if (!isAdmin) {
      try {
        const { data: est } = await supabase.functions.invoke("movie-render-charge", {
          body: { scene_count: ready.length, hd: true, with_captions: subtitlesEnabled, action: "estimate" },
        });
        if (!est) { toast.error("Could not estimate render cost"); return; }
        const priceFmt = `$${(est.total_cents / 100).toFixed(2)}`;
        const balFmt = `$${(est.balance_cents / 100).toFixed(2)}`;
        if (!est.sufficient) {
          toast.error(`Insufficient wallet balance. Need ${priceFmt}, you have ${balFmt}. Top up in Wallet.`);
          return;
        }
        if (!confirm(`This export will charge ${priceFmt} from your wallet (balance: ${balFmt}). Proceed?`)) return;
        // Stable idempotency key per export attempt — a retry or double-click
        // reuses the same key so the wallet is only ever charged once.
        if (!renderRequestKeyRef.current) {
          renderRequestKeyRef.current = `movie-render:${crypto.randomUUID()}`;
        }
        const { data: chg, error: chgErr } = await supabase.functions.invoke("movie-render-charge", {
          body: {
            scene_count: ready.length,
            hd: true,
            with_captions: subtitlesEnabled,
            action: "charge",
            request_key: renderRequestKeyRef.current,
          },
        });
        if (chgErr || !chg?.success) {
          toast.error(chg?.error === "insufficient_balance" ? "Wallet ran out — top up first" : "Charge failed, export cancelled");
          return;
        }
        toast.success(`Charged ${priceFmt}. New balance: $${(chg.new_balance_cents / 100).toFixed(2)}`);
      } catch (e) {
        console.error("[movie-render-charge]", e);
        toast.error("Billing service unavailable, export cancelled");
        return;
      }
    }

    setExporting(true); setExportProgress(0);
    try {
      const canvas = exportCanvasRef.current!;
      const chosenFormat = readMovieFormat();
      // Export controls: user-chosen resolution wins over the saved aspect preset's height.
      const RES_HEIGHTS: Record<ExportSettings["resolution"], number> = { "720p": 720, "1080p": 1080, "1440p": 1440, "4k": 2160 };
      const baseW = chosenFormat?.width || 1920;
      const baseH = chosenFormat?.height || 1080;
      const targetH = RES_HEIGHTS[exportSettings.resolution];
      const scale = targetH / baseH;
      canvas.width = Math.round(baseW * scale / 2) * 2;
      canvas.height = Math.round(baseH * scale / 2) * 2;

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

      // Decode narration + sfx + per-scene music + global music + intro + theme + outro — in parallel
      const [voiceBuffers, sfxBuffers, sceneMusicBuffers, musicBuffer, introBuf, themeBuf, outroBuf] = await Promise.all([
        Promise.all(ready.map(s => decodeUrl(s.audio_url))),
        Promise.all(ready.map(s => decodeUrl(s.sfx_url))),
        Promise.all(ready.map(s => decodeUrl(s.music_url))),
        decodeUrl(musicUrl),
        decodeUrl(introMusicUrl),
        decodeUrl(themeMusicUrl),
        decodeUrl(outroMusicUrl),
      ]);

      // ----- Movie Host layer: audio buffers + lip-sync envelopes -----
      const hostActive = host.enabled && !!host.imageUrl;
      const [hostBeatBufs, ivHostBufs, ivGuestBufs] = await Promise.all([
        Promise.all(ready.map(s => (hostActive ? decodeUrl(s.host_beat?.audio_url) : Promise.resolve(null)))),
        Promise.all(ready.map(s => (hostActive ? decodeUrl(s.interview?.hostAudioUrl) : Promise.resolve(null)))),
        Promise.all(ready.map(s => decodeUrl(s.interview?.guestAudioUrl))),
      ]);
      const hostBeatEnv = hostBeatBufs.map(b => (b ? audioEnvelope(b) : null));
      const ivHostEnv = ivHostBufs.map(b => (b ? audioEnvelope(b) : null));
      const ivGuestEnv = ivGuestBufs.map(b => (b ? audioEnvelope(b) : null));

      const loadImg = (url?: string | null) =>
        new Promise<HTMLImageElement | null>(res => {
          if (!url) return res(null);
          const i = new Image(); i.crossOrigin = "anonymous";
          i.onload = () => res(i); i.onerror = () => res(null); i.src = url;
        });
      const hostImg = hostActive ? await loadImg(host.imageUrl) : null;
      const guestImgs = await Promise.all(ready.map(s => loadImg(s.interview?.guestImageUrl)));


      // Combine video + audio tracks
      const combined = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioDest.stream.getAudioTracks(),
      ]);

      const renderErrors: string[] = [];
      const preferred = exportSettings.container === "mp4"
        ? ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus"]
        : ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
      const mimeType = preferred.find(t => MediaRecorder.isTypeSupported(t)) || "video/webm";
      if (exportSettings.container === "mp4" && !mimeType.startsWith("video/mp4")) {
        renderErrors.push("MP4 recording is not supported by this browser — fell back to WebM.");
        toast.info("This browser can't record MP4 — rendering WebM instead");
      }
      const recorder = new MediaRecorder(combined, {
        mimeType,
        videoBitsPerSecond: Math.max(1, exportSettings.bitrateMbps) * 1_000_000,
      });
      const outType = mimeType.split(";")[0];
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      const finished = new Promise<Blob>(res => {
        recorder.onstop = () => res(new Blob(chunks, { type: outType }));
      });
      recorder.start();


      // Start music underscore at t=0, ducked under VO
      let musicSource: AudioBufferSourceNode | null = null;
      if (musicBuffer && layerAudible(timelineMix, "music")) {
        musicSource = audioCtx.createBufferSource();
        musicSource.buffer = musicBuffer;
        musicSource.loop = true;
        musicSource.playbackRate.value = Math.max(0.5, Math.min(2, musicSpeed));
        const musicGain = audioCtx.createGain();
        musicGain.gain.value = Math.max(0, Math.min(1, musicVolume));
        musicSource.connect(musicGain).connect(audioDest);
        musicSource.start();
      }

      // Preload scene images first so we can intercut intro
      const imgs = await Promise.all(ready.map(s => new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image(); i.crossOrigin = "anonymous";
        i.onload = () => res(i); i.onerror = rej; i.src = s.image_url!;
      })));

      // ===== INTRO TITLE CARD (4s) with intro fanfare =====
      if (introBuf || title) {
        if (introBuf) {
          const src = audioCtx.createBufferSource();
          src.buffer = introBuf;
          const g = audioCtx.createGain(); g.gain.value = 0.9;
          src.connect(g).connect(audioDest);
          src.start();
        }
        const introDur = 4000;
        const introStart = performance.now();
        await new Promise<void>(resolve => {
          const tick = (now: number) => {
            const p = Math.min(1, (now - introStart) / introDur);
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const grad = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width / 2);
            grad.addColorStop(0, `hsla(45, 90%, 60%, ${0.35 * (1 - Math.abs(p - 0.5) * 1.2)})`);
            grad.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const alpha = p < 0.25 ? p / 0.25 : p > 0.85 ? (1 - p) / 0.15 : 1;
            ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
            ctx.fillStyle = "hsl(45 90% 65%)";
            ctx.textAlign = "center";
            ctx.font = "bold 96px sans-serif";
            wrapText(ctx, title || "Untitled Movie", canvas.width / 2, canvas.height / 2, canvas.width - 200, 110);
            ctx.font = "italic 32px sans-serif";
            ctx.fillStyle = "#fff";
            ctx.fillText("a ORACLE LUNAR production", canvas.width / 2, canvas.height / 2 + 100);
            ctx.globalAlpha = 1;
            if (p < 1) requestAnimationFrame(tick);
            else resolve();
          };
          requestAnimationFrame(tick);
        });
      }

      // (legacy preload comment)


      for (let idx = 0; idx < ready.length; idx++) {
        const scene = ready[idx];
        const img = imgs[idx];
        const dur = scene.duration_sec * 1000;

        // Schedule this scene's narration (full volume)
        const vbuf = voiceBuffers[idx];
        if (vbuf && layerAudible(timelineMix, "voice")) {
          const src = audioCtx.createBufferSource();
          src.buffer = vbuf;
          const g = audioCtx.createGain(); g.gain.value = 1.0;
          src.connect(g).connect(audioDest);
          // Honour the timeline position the user dragged this narration to.
          const offset = Math.max(0, Math.min(scene.duration_sec || 0, scene.voice_offset_sec ?? 0));
          src.start(audioCtx.currentTime + offset);
        }
        // Schedule scene SFX at its beat timestamp, at the volume set on the scene.
        const sbuf = sfxBuffers[idx];
        if (sbuf) {
          const src = audioCtx.createBufferSource();
          src.buffer = sbuf;
          const g = audioCtx.createGain();
          g.gain.value = Math.max(0, Math.min(1, scene.sfx_volume ?? 0.6));
          src.connect(g).connect(audioDest);
          const sfxOffset = Math.max(0, Math.min(scene.duration_sec || 0, scene.sfx_offset_sec ?? 0));
          src.start(audioCtx.currentTime + sfxOffset);
        }
        // Schedule per-scene backing music with cross-fade between adjacent scenes.
        // Cross-fade duration is decided by crossfadeFor() (auto = Oracle picks per transition).
        const mbuf = sceneMusicBuffers[idx];
        if (mbuf && layerAudible(timelineMix, "music")) {
          const src = audioCtx.createBufferSource();
          src.buffer = mbuf;
          const g = audioCtx.createGain();
          const targetVol = Math.max(0, Math.min(1, scene.music_volume ?? 0.25));
          const prev = idx > 0 ? ready[idx - 1] : null;
          const next = idx < ready.length - 1 ? ready[idx + 1] : null;
          const fadeInSec = prev ? crossfadeFor(prev, scene) : 0;
          const fadeOutSec = next ? crossfadeFor(scene, next) : 0;
          const sceneSec = dur / 1000;
          const t0 = audioCtx.currentTime;
          if (fadeInSec > 0) {
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(targetVol, t0 + Math.min(fadeInSec, sceneSec / 2));
          } else {
            g.gain.setValueAtTime(targetVol, t0);
          }
          if (fadeOutSec > 0) {
            const fadeStart = t0 + Math.max(0, sceneSec - fadeOutSec);
            g.gain.setValueAtTime(targetVol, fadeStart);
            g.gain.linearRampToValueAtTime(0, t0 + sceneSec);
          }
          src.connect(g).connect(audioDest);
          src.start();
          // Stop slightly after scene end so cross-fade tail can finish
          try { src.stop(t0 + sceneSec + 0.05); } catch {}
        }
        // ----- Movie Host: schedule the presenter + interview audio for this scene -----
        const beat = scene.host_beat;
        const beatOffset = Math.max(0, Math.min(scene.duration_sec || 0, beat?.offset_sec ?? 0));
        const hbuf = hostBeatBufs[idx];
        if (hbuf) {
          const src = audioCtx.createBufferSource();
          src.buffer = hbuf;
          const g = audioCtx.createGain(); g.gain.value = 1.0;
          src.connect(g).connect(audioDest);
          src.start(audioCtx.currentTime + beatOffset);
        }
        const iv = scene.interview;
        const ivOffset = Math.max(0, Math.min(scene.duration_sec || 0, iv?.offset_sec ?? 0));
        const ivHostBuf = ivHostBufs[idx];
        const ivGuestBuf = ivGuestBufs[idx];
        // Host asks first, guest answers straight after — whole exchange capped at 8s.
        const ivHostDur = ivHostBuf?.duration ?? 0;
        const guestStartOffset = ivOffset + Math.min(ivHostDur + 0.25, (iv ? clampInterviewSeconds(iv.seconds) : 0) - 0.5);
        if (ivHostBuf) {
          const src = audioCtx.createBufferSource();
          src.buffer = ivHostBuf;
          src.connect(audioDest);
          src.start(audioCtx.currentTime + ivOffset);
        }
        if (ivGuestBuf) {
          const src = audioCtx.createBufferSource();
          src.buffer = ivGuestBuf;
          src.connect(audioDest);
          src.start(audioCtx.currentTime + Math.max(ivOffset, guestStartOffset));
        }

        const start = performance.now();
        await new Promise<void>(resolve => {
          const tick = (now: number) => {
            const p = Math.min(1, (now - start) / dur);
            drawMotionFrame(ctx, img, canvas.width, canvas.height, scene.motion, p);

            // ----- Movie Host overlay (lip-synced talking head) -----
            const tSec = (now - start) / 1000;
            const ivSeconds = iv ? clampInterviewSeconds(iv.seconds) : 0;
            const ivLive = !!iv && hostImg && tSec >= ivOffset && tSec <= ivOffset + ivSeconds;
            if (ivLive && hostImg) {
              // Two avatars facing each other — host left, guest right.
              const cardW = Math.round(canvas.width * 0.26);
              const cardH = Math.round(cardW * 1.25);
              const yPos = Math.round(canvas.height - cardH - canvas.height * 0.14);
              const hostLvl = envelopeAt(ivHostEnv[idx], tSec - ivOffset);
              const guestLvl = envelopeAt(ivGuestEnv[idx], tSec - Math.max(ivOffset, guestStartOffset));
              drawTalkingHead(ctx, {
                img: hostImg, x: Math.round(canvas.width * 0.06), y: yPos, w: cardW, h: cardH,
                level: hostLvl, mouthX: host.mouthX, mouthY: host.mouthY, frame: host.frame,
                name: host.showPlate ? host.name : undefined, title: host.showPlate ? host.title : undefined,
                time: tSec, speaking: hostLvl > 0.08,
              });
              const gImg = guestImgs[idx];
              if (gImg) {
                drawTalkingHead(ctx, {
                  img: gImg, x: Math.round(canvas.width * 0.68), y: yPos, w: cardW, h: cardH,
                  level: guestLvl, mouthX: host.mouthX, mouthY: host.mouthY, frame: host.frame,
                  name: host.showPlate ? (iv!.guestName || "Guest") : undefined,
                  title: host.showPlate ? "Live" : undefined,
                  flip: true, time: tSec, speaking: guestLvl > 0.08,
                });
              }
              // LIVE badge
              ctx.save();
              ctx.fillStyle = "rgba(200,20,30,0.9)";
              const bw = Math.round(canvas.width * 0.09), bh = Math.round(canvas.height * 0.05);
              ctx.fillRect(Math.round(canvas.width * 0.06), Math.round(canvas.height * 0.06), bw, bh);
              ctx.fillStyle = "#fff";
              ctx.textAlign = "center";
              ctx.font = `bold ${Math.round(bh * 0.5)}px sans-serif`;
              ctx.fillText("● LIVE", Math.round(canvas.width * 0.06) + bw / 2, Math.round(canvas.height * 0.06) + bh * 0.66);
              ctx.restore();
            } else if (hostActive && hostImg && beat?.audio_url && tSec >= beatOffset) {
              const rect = hostRect(canvas.width, canvas.height, {
                x: beat.x ?? host.x, y: beat.y ?? host.y, scale: beat.scale ?? host.scale,
              });
              drawTalkingHead(ctx, {
                img: hostImg, ...rect,
                level: envelopeAt(hostBeatEnv[idx], tSec - beatOffset),
                mouthX: host.mouthX, mouthY: host.mouthY, frame: host.frame,
                name: host.showPlate ? host.name : undefined,
                title: host.showPlate ? host.title : undefined,
                time: tSec, speaking: true,
              });
            }

            // Subtitles only render when explicitly enabled by the user (default OFF)
            if (subtitlesEnabled) {
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
            }
            // Burned-in call-to-action link bar (ad formats)
            if (chosenFormat?.ctaUrl) {
              const barH = Math.round(canvas.height * 0.09);
              const y = canvas.height - barH;
              ctx.fillStyle = "rgba(0,0,0,0.78)";
              ctx.fillRect(0, y, canvas.width, barH);
              ctx.fillStyle = "hsl(45 90% 60%)";
              ctx.fillRect(0, y, canvas.width, Math.max(3, Math.round(barH * 0.05)));
              ctx.textAlign = "center";
              ctx.fillStyle = "hsl(45 95% 70%)";
              ctx.font = `bold ${Math.round(barH * 0.44)}px sans-serif`;
              ctx.fillText(
                (chosenFormat.ctaLabel || chosenFormat.ctaUrl).toUpperCase(),
                canvas.width / 2,
                y + barH * 0.62,
              );
            }
            if (p < 1) requestAnimationFrame(tick);
            else resolve();
          };
          requestAnimationFrame(tick);
        });

        // ----- Cinematic transition into next scene (~700ms) -----
        if (idx < ready.length - 1) {
          const nextScene = ready[idx + 1];
          const nextImg = imgs[idx + 1];
          if (nextImg) {
            // Pick transition based on tone shift
            const a = scene.tone || "neutral";
            const b = nextScene.tone || "neutral";
            let kind = 0; // crossfade default
            if (a === b) kind = 0;
            else if ((a === "tense" && b === "calm") || (a === "calm" && b === "tense")) kind = 1; // dip
            else if (a === "epic" || b === "epic") kind = 3; // zoom-through
            else if (a === "playful" || b === "playful") kind = 2; // whip pan
            const tDur = 700;
            const tStart = performance.now();
            await new Promise<void>(resolve => {
              const ttick = (now: number) => {
                const tp = Math.min(1, (now - tStart) / tDur);
                drawTransition(ctx, img, nextImg, canvas.width, canvas.height, scene.motion, nextScene.motion, tp, kind);
                if (tp < 1) requestAnimationFrame(ttick);
                else resolve();
              };
              requestAnimationFrame(ttick);
            });
          }
        }
        setExportProgress(Math.round(((idx + 1) / ready.length) * 100));
      }

      // ===== "THE END" OUTRO CARD (3s) with outro sting =====
      if (outroBuf || creditsLines.length > 0) {
        if (outroBuf) {
          const src = audioCtx.createBufferSource();
          src.buffer = outroBuf;
          const g = audioCtx.createGain(); g.gain.value = 0.85;
          src.connect(g).connect(audioDest);
          src.start();
        }
        const outroDur = 3000;
        const outroStart = performance.now();
        await new Promise<void>(resolve => {
          const tick = (now: number) => {
            const p = Math.min(1, (now - outroStart) / outroDur);
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const alpha = p < 0.2 ? p / 0.2 : p > 0.8 ? (1 - p) / 0.2 : 1;
            ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
            ctx.fillStyle = "hsl(45 90% 65%)";
            ctx.textAlign = "center";
            ctx.font = "bold 140px serif";
            ctx.fillText("The End", canvas.width / 2, canvas.height / 2 + 30);
            ctx.globalAlpha = 1;
            if (p < 1) requestAnimationFrame(tick);
            else resolve();
          };
          requestAnimationFrame(tick);
        });
      }

      // ===== END CREDITS ROLL (8s) with theme music =====
      if (creditsLines.length > 0) {
        if (themeBuf) {
          const src = audioCtx.createBufferSource();
          src.buffer = themeBuf;
          const g = audioCtx.createGain(); g.gain.value = 0.7;
          src.connect(g).connect(audioDest);
          src.start();
        }
        const credDur = 8000;
        const credStart = performance.now();
        const lineHeight = 60;
        const totalRoll = (creditsLines.length * lineHeight) + canvas.height;
        await new Promise<void>(resolve => {
          const tick = (now: number) => {
            const p = Math.min(1, (now - credStart) / credDur);
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const offset = canvas.height - (p * totalRoll);
            ctx.textAlign = "center";
            creditsLines.forEach((line, i) => {
              const y = offset + (i * lineHeight);
              if (y < -lineHeight || y > canvas.height + lineHeight) return;
              if (i === 0) {
                ctx.font = "bold 64px sans-serif";
                ctx.fillStyle = "hsl(45 90% 65%)";
              } else if (line === "" ) {
                return;
              } else if (line.startsWith("— ")) {
                ctx.font = "italic 28px sans-serif";
                ctx.fillStyle = "hsl(45 90% 70%)";
              } else if (["Directed by", "Story", "Voice Cast", "Original Score", "Visuals", "Starring", "Co-starring", "Guest Stars"].includes(line)) {
                ctx.font = "bold 30px sans-serif";
                ctx.fillStyle = "hsl(45 90% 70%)";
              } else {
                ctx.font = "32px sans-serif";
                ctx.fillStyle = "#fff";
              }
              ctx.fillText(line, canvas.width / 2, y);
            });
            if (p < 1) requestAnimationFrame(tick);
            else resolve();
          };
          requestAnimationFrame(tick);
        });
      }


      recorder.stop();
      const blob = await finished;
      try { musicSource?.stop(); } catch {}
      try { audioCtx.close(); } catch {}

      // Hand the finished file straight to the share sheet (no auto-download spam)
      setPublishedBlob(blob);
      setPublishedFormat(chosenFormat);
      setShareOpen(true);

      // Save to library
      if (user) {
        const reader = new FileReader();
        reader.onloadend = () => {
          saveMedia.mutate({
            media_type: "video",
            title: title || "Oracle Lunar Movie",
            url: reader.result as string,
            source_page: "movie-studio",
            metadata: { sceneCount: ready.length, totalSeconds: ready.length * CLIP_SECONDS, withVoice: missingAudio < ready.length, format: chosenFormat?.id || "youtube_standard" },
          });
        };
        reader.readAsDataURL(blob);
      }

      // Render report — timeline, voices, music, SFX and any errors from this run
      if (missingAudio > 0) renderErrors.push(`${missingAudio} scene(s) rendered without narration.`);
      if (ready.length !== scenes.length) renderErrors.push(`${scenes.length - ready.length} scene(s) skipped — no artwork.`);
      pipeline.filter(p => p.status === "failed").forEach(p => renderErrors.push(`Pipeline step "${p.label}" failed: ${p.error || "unknown error"}`));
      setRenderReport(buildRenderReport({
        errors: renderErrors,
        blobBytes: blob.size,
        durationSec: ready.reduce((a, s) => a + (s.duration_sec || CLIP_SECONDS), 0),
        usedScenes: ready,
      }));
      toast.success("Movie published — render report ready in Super AI");

    } catch (e) {
      console.error(e); toast.error("Export failed");
      setRenderReport(buildRenderReport({
        errors: [e instanceof Error ? e.message : "Export failed"],
        usedScenes: scenes.filter(s => s.image_url),
      }));
    } finally { setExporting(false); }

  };

  const totalSec = scenes.length * CLIP_SECONDS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-movie-studio-dialog className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background border-primary/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Film className="w-5 h-5" /> Cinematic Clip Studio
            <span className="ml-auto text-xs text-muted-foreground font-normal">
              {scenes.length} scenes · {totalSec}s · 4K · 20s/clip
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Cinematic Clip Studio exemption notice — applies to ALL tiers including Lifetime */}
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
          <p>
            <span className="font-bold text-primary">⚠️ Cinematic Clip Studio is pay-per-use</span> and is <span className="font-semibold">not included</span> in any subscription or the $900 Lifetime Unlock. Each scene generates real images, AI voices, music and SFX through third-party providers (ElevenLabs, image-gen, etc.), so each clip is billed individually. Generate as many as you like — there's no cap.
          </p>
        </div>

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
        <section className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-3" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-bold text-primary">
                <Users className="w-4 h-4" /> Production swarm
              </div>
              <span className="text-xs text-muted-foreground">
                {productionSwarm.filter(agent => agent.status === "complete").length} / {productionSwarm.length} complete
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {productionSwarm.map(agent => (
                <div key={agent.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 min-h-14">
                  {agent.status === "working" && <Loader2 className="w-4 h-4 shrink-0 animate-spin text-primary" />}
                  {agent.status === "complete" && <CheckCircle2 className="w-4 h-4 shrink-0 text-primary" />}
                  {agent.status === "failed" && <AlertCircle className="w-4 h-4 shrink-0 text-destructive" />}
                  {agent.status === "waiting" && <span className="w-4 h-4 shrink-0 rounded-full border border-muted-foreground/50" />}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{agent.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{agent.status === "working" ? agent.task : agent.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
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
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs space-y-2">
              <div className="font-bold text-primary">10-scene block pricing</div>
              <div className="text-muted-foreground">
                {isAdmin
                  ? "Admin account — all blocks are free."
                  : <>Block 1: <b>$5</b> (launch rate) · Block 2: $10 · Block 3+: +$20/block up to block 20 ($370) · Block 21+: $1000/block. Each block adds 10 more scenes (~60s).</>}
              </div>
              <div className="font-bold">
                Next block ({nextBlockNumber}): {isAdmin ? "FREE" : `$${nextBlockPrice} USD`}
              </div>
            </div>
            <Button
              onClick={purchaseAndGenerateNextBlock}
              disabled={planning || payingBlock}
              className="w-full"
            >
              {planning
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Planning scenes...</>
                : payingBlock
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Opening checkout...</>
                  : <><Wand2 className="w-4 h-4 mr-2" /> {isAdmin ? `Generate first 10 scenes (free)` : `Pay $${nextBlockPrice} & generate first 10 scenes`}</>}
            </Button>
            {!isAdmin && (
              <Button
                onClick={confirmPaidAndGenerateBlock}
                disabled={planning}
                variant="outline"
                className="w-full text-xs"
              >
                I've paid — generate this block now
              </Button>
            )}
          </div>
        )}

        {/* Step 2: Scenes */}
        {scenes.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Movie title" className="flex-1 min-w-[200px]" />
              <SuperAIPanel actions={superAIActions} />
              <Button onClick={runProductionSwarm} disabled={productionSwarmBusy} size="sm" className="border border-primary/40">
                {productionSwarmBusy
                  ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Swarm running</>
                  : <><Users className="w-3 h-3 mr-1" /> Run 5-agent production swarm</>}
              </Button>

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
              <Button onClick={() => { setLibraryTargetId("__new__"); setShowLibrary(true); }} variant="outline" size="sm">
                <ImagePlus className="w-3 h-3 mr-1" /> From my Library
              </Button>

              <Button
                onClick={purchaseAndGenerateNextBlock}
                disabled={planning || payingBlock}
                variant="outline"
                size="sm"
                className="border-primary/40"
                title={isAdmin ? "Admin: free" : `Block ${nextBlockNumber}: $${nextBlockPrice}`}
              >
                {planning || payingBlock
                  ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  : <Plus className="w-3 h-3 mr-1" />}
                {isAdmin
                  ? `+10 scenes (free)`
                  : `+10 scenes ($${nextBlockPrice})`}
              </Button>
              <Button onClick={previewFullMovie} disabled={exporting || previewSceneId === "__full__"} size="sm" variant="secondary" title="Play all scenes back-to-back with transitions (silent preview)">
                {previewSceneId === "__full__" ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Playing…</> : <><Play className="w-3 h-3 mr-1" /> Preview full movie</>}
              </Button>
              <Button onClick={exportMovie} disabled={exporting} size="sm" title="Stitches every scene + transitions + voice + music + SFX into ONE continuous video file">
                {exporting ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />{exportProgress}%</> : <><Download className="w-3 h-3 mr-1" /> Publish movie</>}
              </Button>
              {publishedBlob && !exporting && (
                <Button onClick={() => setShareOpen(true)} size="sm" variant="default" title="Share the published movie file">
                  <Share2 className="w-3 h-3 mr-1" /> Share movie
                </Button>
              )}
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

            {/* Storyboard timeline: per-moment music + voice layers */}
            <StoryboardTimeline
              scenes={scenes}
              onUpdateScene={(id, patch) => setScenes(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))}
              onRedub={redubScene}
              onGenerateSceneMusic={(id) => generateSceneMusic(id)}
              mix={timelineMix}
              onMixChange={setTimelineMix}
            />

            {/* Music suite (full-track underscore for the whole movie) */}
            <div className="rounded-lg p-3 border border-primary/30 bg-primary/5 space-y-2">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-primary">MUSIC SCORE (Top 100 Trending Vibes)</span>
                <span className="text-[10px] text-muted-foreground ml-auto">Instrumental only · plays under whole movie</span>
              </div>
              <select
                onChange={(e) => {
                  const preset = MUSIC_PRESETS_TOP_100.find(p => p.id === e.target.value);
                  if (preset) {
                    setMusicPrompt(preset.prompt);
                    toast.success(`🎵 Loaded: ${preset.name} (${preset.genre})`);
                  }
                }}
                defaultValue=""
                className="w-full h-8 text-[11px] bg-input border border-border rounded px-2"
              >
                <option value="" disabled>🎵 Pick a trending instrumental track ({MUSIC_PRESETS_TOP_100.length} options)…</option>
                {Object.entries(
                  MUSIC_PRESETS_TOP_100.reduce((acc, p) => {
                    (acc[p.genre] ||= []).push(p);
                    return acc;
                  }, {} as Record<string, typeof MUSIC_PRESETS_TOP_100>)
                ).map(([genre, list]) => (
                  <optgroup key={genre} label={genre}>
                    {list.map(p => (
                      <option key={p.id} value={p.id}>{p.name} — {p.mood}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <Textarea
                value={musicPrompt}
                onChange={e => setMusicPrompt(e.target.value)}
                rows={2}
                className="text-xs"
                placeholder="Or describe your own (instrumental only — no vocals)…"
              />
              <div className="border border-accent-blue/40 bg-background/60 p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <Waves className="w-4 h-4 text-accent-blue" />
                  <span className="text-[11px] font-black uppercase text-accent-blue">Adaptive soundtrack team</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Composer, music editor, dialogue mixer and quality judge map a different original cue to every scene, with gentle dialogue beds and stronger suspense only where the action demands it.
                </p>
                <Button type="button" size="sm" variant="outline" onClick={runAdaptiveScoreTeam} disabled={scoreTeamBusy || !scenes.length}>
                  {scoreTeamBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {scoreTeamBusy ? "Team scoring every scene…" : "Team-design the full adaptive score"}
                </Button>
                {scoreTeamNotes.length > 0 && (
                  <div className="max-h-28 overflow-y-auto space-y-1 border-l-2 border-accent-blue/50 pl-2">
                    {scoreTeamNotes.map((note, index) => (
                      <p key={`${index}-${note}`} className="text-[9px] leading-relaxed text-foreground/80">
                        <strong>Scene {index + 1}:</strong> {note}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={generateMusic} size="sm" variant="secondary" className="h-7 text-xs"
                  disabled={generatingMusic || !musicPrompt.trim()}>
                  {generatingMusic
                    ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Composing...</>
                    : musicUrl ? <><RefreshCw className="w-3 h-3 mr-1" /> Re-compose</> : <><Sparkles className="w-3 h-3 mr-1" /> Compose music</>}
                </Button>
                <label className="h-7 px-2 text-xs inline-flex items-center gap-1 border border-border bg-input cursor-pointer hover:bg-muted/50">
                  <Upload className="w-3 h-3" /> Upload your own track
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        setMusicUrl(String(reader.result));
                        toast.success(`Soundtrack loaded: ${file.name}`);
                      };
                      reader.onerror = () => toast.error("Could not read that audio file");
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
                {musicUrl && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setMusicUrl(null)}>
                    Remove track
                  </Button>
                )}
                {musicUrl && (
                  <audio
                    src={musicUrl}
                    controls
                    className="h-7 flex-1 min-w-[200px]"
                    ref={el => { if (el) el.playbackRate = Math.max(0.5, Math.min(2, musicSpeed)); }}
                  />
                )}
                <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                  Music vol
                  <input type="range" min={0} max={1} step={0.05} value={musicVolume}
                    onChange={e => setMusicVolume(parseFloat(e.target.value))} className="w-24" />
                  <span className="w-8 text-right">{Math.round(musicVolume * 100)}%</span>
                </label>
                <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                  Music speed
                  <input type="range" min={0.5} max={2} step={0.05} value={musicSpeed}
                    onChange={e => setMusicSpeed(parseFloat(e.target.value))} className="w-24" />
                  <span className="w-10 text-right">{musicSpeed.toFixed(2)}x</span>
                  <button type="button" className="underline hover:text-primary" onClick={() => setMusicSpeed(1)}>reset</button>
                </label>
              </div>
            </div>

            {/* Intro / Theme / Credits / Subtitles */}
            <div className="rounded-lg p-3 border border-primary/30 bg-card space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Film className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-primary">INTRO • THEME • CREDITS</span>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  Subtitles are off by default — turn on if you want on-screen captions
                </span>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                  Intro style:
                  <select
                    value={introStyle}
                    onChange={e => setIntroStyle(e.target.value as any)}
                    className="h-7 text-xs bg-input border border-border rounded px-1"
                  >
                    <option value="epic">Epic fanfare</option>
                    <option value="playful">Playful jingle</option>
                    <option value="cinematic-drone">Cinematic drone</option>
                    <option value="retro-news">Retro news</option>
                    <option value="trailer-hit">Trailer hit</option>
                  </select>
                </label>
                <Button onClick={composeIntroMusic} size="sm" variant="secondary" className="h-7 text-xs"
                  disabled={generatingIntro}>
                  {generatingIntro
                    ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Intro music...</>
                    : introMusicUrl ? <><RefreshCw className="w-3 h-3 mr-1" /> Re-compose intro</> : <><Sparkles className="w-3 h-3 mr-1" /> Generate intro music</>}
                </Button>
                {introMusicUrl && <audio src={introMusicUrl} controls className="h-7 max-w-[180px]" />}
                <Button onClick={composeThemeTrack} size="sm" variant="secondary" className="h-7 text-xs"
                  disabled={generatingTheme}>
                  {generatingTheme
                    ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Theme...</>
                    : themeMusicUrl ? <><RefreshCw className="w-3 h-3 mr-1" /> Re-compose theme</> : <><Music className="w-3 h-3 mr-1" /> Generate upbeat theme</>}
                </Button>
                {themeMusicUrl && <audio src={themeMusicUrl} controls className="h-7 max-w-[180px]" />}
                <Button onClick={composeOutroMusic} size="sm" variant="secondary" className="h-7 text-xs"
                  disabled={generatingOutro}>
                  {generatingOutro
                    ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Outro...</>
                    : outroMusicUrl ? <><RefreshCw className="w-3 h-3 mr-1" /> Re-compose outro</> : <><Music className="w-3 h-3 mr-1" /> Generate "The End" outro</>}
                </Button>
                {outroMusicUrl && <audio src={outroMusicUrl} controls className="h-7 max-w-[180px]" />}
                <Button onClick={generateCredits} size="sm" variant="secondary" className="h-7 text-xs"
                  disabled={generatingCredits}>
                  {generatingCredits
                    ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Credits...</>
                    : creditsLines.length ? <><RefreshCw className="w-3 h-3 mr-1" /> Re-generate credits</> : <><Pencil className="w-3 h-3 mr-1" /> Generate title & credits</>}
                </Button>
                <Button onClick={generateAllExtras} size="sm" className="h-7 text-xs ml-auto">
                  <Wand2 className="w-3 h-3 mr-1" /> Auto-create all
                </Button>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                <input
                  id="subtitles-toggle"
                  type="checkbox"
                  checked={subtitlesEnabled}
                  onChange={e => setSubtitlesEnabled(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="subtitles-toggle" className="text-xs cursor-pointer">
                  Show subtitles / captions on screen <span className="text-muted-foreground">(off by default)</span>
                </label>
              </div>
              {creditsLines.length > 0 && (
                <details className="text-[11px]">
                  <summary className="cursor-pointer text-muted-foreground">Preview credits ({creditsLines.length} lines)</summary>
                  <div className="mt-1 p-2 rounded bg-muted/30 space-y-0.5 max-h-40 overflow-y-auto">
                    {creditsLines.map((line, i) => <div key={i}>{line || <>&nbsp;</>}</div>)}
                  </div>
                </details>
              )}
            </div>

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
                        <span className="text-[10px] text-muted-foreground">{s.motion} · 6s · 4K</span>
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
                        <Button
                          onClick={() => generateSceneVideo(s.id)}
                          size="sm"
                          className="h-7 text-xs bg-primary text-primary-foreground hover:opacity-90"
                          disabled={!s.image_url || s.generatingVideo}
                          title={`Turn this image into a real moving video clip (${s.video_engine || "gemini"} · ${s.video_seconds || 5}s)`}
                        >
                          🎬 {s.generatingVideo ? "Animating…" : s.video_url ? "Re-animate" : "Real video"}
                        </Button>
                        <select
                          value={s.video_engine || "gemini"}
                          onChange={e => updateScene(s.id, { video_engine: e.target.value as "gemini" | "runway" })}
                          className="h-7 text-[10px] rounded-md border border-border bg-background px-1"
                          title="Video engine"
                          disabled={s.generatingVideo}
                        >
                          <option value="gemini">Gemini (free)</option>
                          <option value="runway">Runway (premium)</option>
                        </select>
                        <select
                          value={s.video_seconds || 5}
                          onChange={e => updateScene(s.id, { video_seconds: Number(e.target.value) as 5 | 10 })}
                          className="h-7 text-[10px] rounded-md border border-border bg-background px-1"
                          title="Clip length"
                          disabled={s.generatingVideo}
                        >
                          <option value={5}>5s</option>
                          <option value={10}>10s</option>
                        </select>
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
                            value={s.voice_id || resolveVoiceId(s)}
                            onChange={e => updateScene(s.id, { voice_id: e.target.value, audio_url: undefined })}
                            className="h-6 text-[11px] bg-input border border-border rounded px-1 max-w-[200px]"
                          >
                            <optgroup label="Female">
                              {CURATED_ELEVENLABS_VOICES.filter(v => v.gender === "Female").map(v => (
                                <option key={v.id} value={v.id}>{v.name} — {v.accent} · {v.description}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Male">
                              {CURATED_ELEVENLABS_VOICES.filter(v => v.gender === "Male").map(v => (
                                <option key={v.id} value={v.id}>{v.name} — {v.accent} · {v.description}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Neutral">
                              {CURATED_ELEVENLABS_VOICES.filter(v => v.gender === "Neutral").map(v => (
                                <option key={v.id} value={v.id}>{v.name} — {v.accent} · {v.description}</option>
                              ))}
                            </optgroup>
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

                      {/* Per-scene Backing Music (ElevenLabs Music) */}
                      <div className="mt-2 p-2 rounded-md bg-primary/5 border border-primary/30 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Music className="w-3 h-3 text-primary" />
                          <span className="text-[10px] font-bold">SCENE BACKING MUSIC</span>
                          {s.music_url && <audio src={s.music_url} controls className="h-6 max-w-[200px] ml-auto" />}
                        </div>
                        <select
                          onChange={(e) => {
                            const preset = MUSIC_PRESETS_TOP_100.find(p => p.id === e.target.value);
                            if (preset) updateScene(s.id, { music_prompt: preset.prompt });
                          }}
                          defaultValue=""
                          className="w-full h-7 text-[11px] bg-input border border-border rounded px-1"
                        >
                          <option value="" disabled>🎵 Pick instrumental track for this scene…</option>
                          {Object.entries(
                            MUSIC_PRESETS_TOP_100.reduce((acc, p) => {
                              (acc[p.genre] ||= []).push(p);
                              return acc;
                            }, {} as Record<string, typeof MUSIC_PRESETS_TOP_100>)
                          ).map(([genre, list]) => (
                            <optgroup key={genre} label={genre}>
                              {list.map(p => (
                                <option key={p.id} value={p.id}>{p.name} — {p.mood}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <Textarea
                          value={s.music_prompt || ""}
                          onChange={e => updateScene(s.id, { music_prompt: e.target.value })}
                          rows={2}
                          className="text-xs"
                          placeholder="Or describe your own (instrumental only — no vocals)…"
                        />
                        <div className="flex flex-wrap gap-1 items-center">
                          <Button onClick={() => generateSceneMusic(s.id, 3)} size="sm" variant="secondary" className="h-7 text-xs"
                            disabled={s.generatingSceneMusic || !s.music_prompt?.trim()}>
                            {s.generatingSceneMusic
                              ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Composing 3 tracks...</>
                              : s.music_options?.length
                                ? <><RefreshCw className="w-3 h-3 mr-1" /> Re-compose options</>
                                : <><Sparkles className="w-3 h-3 mr-1" /> Generate 3 tracks</>}
                          </Button>
                          <label className="text-[10px] text-muted-foreground flex items-center gap-1 ml-auto">
                            Vol
                            <input
                              type="range" min={0} max={1} step={0.05}
                              value={s.music_volume ?? 0.25}
                              onChange={e => updateScene(s.id, { music_volume: Number(e.target.value) })}
                              className="w-20"
                            />
                          </label>
                        </div>
                        {!!s.music_options?.length && (
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground">Choose backing track for this scene:</p>
                            {s.music_options.map((url, i) => (
                              <div key={i} className={`flex items-center gap-2 p-1 rounded border ${s.music_url === url ? "border-primary bg-primary/10" : "border-border/40"}`}>
                                <Button
                                  size="sm" variant={s.music_url === url ? "default" : "outline"}
                                  className="h-6 text-[10px] px-2"
                                  onClick={() => updateScene(s.id, { music_url: url })}
                                >
                                  {s.music_url === url ? "✓ Selected" : `Use #${i + 1}`}
                                </Button>
                                <audio src={url} controls className="h-6 flex-1 min-w-0" />
                                <Button
                                  size="sm" variant="ghost" className="h-6 w-6 p-0"
                                  title="Save to Favourite Tracks"
                                  onClick={() => saveTrackToFavourites(url, `${title || "Movie"} — ${s.caption} #${i + 1}`)}
                                >
                                  <Star className="w-3 h-3 text-primary" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              size="sm" variant="outline" className="h-6 text-[10px] mt-1"
                              onClick={() => { setFavouritesTargetId(s.id); setShowFavouritesPicker(true); }}
                            >
                              <Star className="w-3 h-3 mr-1" /> Pick from Favourites
                            </Button>
                          </div>
                        )}
                        {/* Director controls — camera angle, lighting, action, emotion */}
                        <div className="grid grid-cols-2 gap-1 pt-2 border-t border-border/40">
                          <label className="text-[10px] text-muted-foreground flex flex-col gap-0.5">
                            Camera angle
                            <select
                              value={s.camera_angle || "auto"}
                              onChange={e => updateScene(s.id, { camera_angle: e.target.value as CameraAngle })}
                              className="h-6 text-[11px] bg-input border border-border rounded px-1"
                            >
                              {Object.keys(CAMERA_ANGLE_PROMPTS).map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                          </label>
                          <label className="text-[10px] text-muted-foreground flex flex-col gap-0.5">
                            Lighting
                            <select
                              value={s.lighting_preset || "auto"}
                              onChange={e => updateScene(s.id, { lighting_preset: e.target.value as LightingPreset })}
                              className="h-6 text-[11px] bg-input border border-border rounded px-1"
                            >
                              {Object.keys(LIGHTING_PRESET_PROMPTS).map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                          </label>
                          <Input value={s.character_action || ""} onChange={e => updateScene(s.id, { character_action: e.target.value })}
                            className="h-6 text-[11px] col-span-2" placeholder="Character action — e.g. 'walks toward camera, reaches out'" />
                          <Input value={s.character_emotion || ""} onChange={e => updateScene(s.id, { character_emotion: e.target.value })}
                            className="h-6 text-[11px] col-span-2" placeholder="Character emotion — e.g. 'anxious, breathing fast'" />
                        </div>
                      </div>

                      {editingSceneId === s.id && (
                        <div className="mt-2 p-2 rounded-md bg-primary/5 border border-primary/30 space-y-2">
                          <p className="text-[10px] text-muted-foreground">Tell the AI what to change in this clip's photo:</p>
                          <Textarea value={editPrompt} onChange={e => setEditPrompt(e.target.value)} rows={2}
                            className="text-xs" placeholder="e.g. Make it sunset, add rain, change outfit to red dress..." />
                          <Button onClick={applyClipEdit} size="sm" className="h-7 text-xs w-full">
                            <Wand2 className="w-3 h-3 mr-1" /> Apply edit (4K re-render)
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
        <MovieShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          blob={publishedBlob}
          title={title || "Oracle Lunar Movie"}
          format={publishedFormat}
        />
        <input ref={uploadInputRef} type="file" accept="image/*" onChange={handleUploadFile} className="hidden" />
        <MediaPickerDialog
          open={showLibrary}
          onOpenChange={setShowLibrary}
          filterType="image"
          title="Pick a photo — your Library or your device"
          onSelect={(url, pickedTitle) => {
            if (libraryTargetId === "__new__") {
              setScenes(prev => [...prev, {
                id: uid(),
                caption: pickedTitle || `Scene ${prev.length + 1}`,
                photo_prompt: pickedTitle || "Imported photo",
                motion: "ken-burns",
                duration_sec: CLIP_SECONDS,
                image_url: url,
              }]);
              toast.success("Photo added as a new scene");
            } else if (libraryTargetId) {
              updateScene(libraryTargetId, { image_url: url });
            }
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
  // Cinematic ease-in-out
  const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  // Cover-fit, oversized so motion never reveals edges
  const iar = img.width / img.height; const car = W / H;
  let bw = W, bh = H;
  if (iar > car) { bh = H; bw = H * iar; } else { bw = W; bh = W / iar; }
  bw *= 1.3; bh *= 1.3;
  let scale = 1, dx = 0, dy = 0;
  switch (motion) {
    case "zoom-in":   scale = 1 + 0.40 * ease; break;
    case "zoom-out":  scale = 1.40 - 0.40 * ease; break;
    case "pan-left":  dx = -0.25 * W * ease; break;
    case "pan-right": dx =  0.25 * W * ease; break;
    case "ken-burns": scale = 1 + 0.25 * ease; dx = -0.14 * W * ease; dy = -0.08 * H * ease; break;
    case "static":    scale = 1 + 0.08 * ease; dx = -0.04 * W * ease; break;
  }
  const dw = bw * scale, dh = bh * scale;
  const px = (W - dw) / 2 + dx;
  const py = (H - dh) / 2 + dy;

  // ---- Cinematic stack ----
  // 1) Subtle chromatic aberration: draw red & blue offset copies under main image
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.10;
  ctx.drawImage(img, px - 3, py, dw, dh); // red-ish ghost
  ctx.drawImage(img, px + 3, py, dw, dh); // blue-ish ghost
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  // 2) Main image
  ctx.drawImage(img, px, py, dw, dh);

  // 3) Vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // 4) Cinematic teal-orange tint (very light)
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.12;
  const tint = ctx.createLinearGradient(0, 0, W, H);
  tint.addColorStop(0, "rgba(0,80,120,1)");
  tint.addColorStop(1, "rgba(255,140,60,1)");
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  // 5) Drifting light leak (animated by p)
  const leakX = W * (0.2 + 0.6 * p);
  const leak = ctx.createRadialGradient(leakX, H * 0.3, 10, leakX, H * 0.3, W * 0.5);
  leak.addColorStop(0, "rgba(255,200,120,0.18)");
  leak.addColorStop(1, "rgba(255,200,120,0)");
  ctx.fillStyle = leak;
  ctx.fillRect(0, 0, W, H);

  // 6) Film grain — cheap noise dots
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = "#fff";
  const grainCount = 220;
  for (let i = 0; i < grainCount; i++) {
    const gx = Math.random() * W;
    const gy = Math.random() * H;
    ctx.fillRect(gx, gy, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;
}

// Cinematic transition between two scene frames during export.
// kind: 0=crossfade, 1=dip-to-black, 2=whip-pan, 3=zoom-through
function drawTransition(
  ctx: CanvasRenderingContext2D,
  imgA: HTMLImageElement,
  imgB: HTMLImageElement,
  W: number, H: number,
  motionA: Motion, motionB: Motion,
  p: number, // 0→1 across the transition
  kind: number,
) {
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  if (kind === 1) {
    // Dip to black: A fades out first half, B fades in second half
    if (p < 0.5) {
      drawMotionFrame(ctx, imgA, W, H, motionA, 1);
      ctx.fillStyle = `rgba(0,0,0,${p * 2})`; ctx.fillRect(0, 0, W, H);
    } else {
      drawMotionFrame(ctx, imgB, W, H, motionB, 0);
      ctx.fillStyle = `rgba(0,0,0,${(1 - p) * 2})`; ctx.fillRect(0, 0, W, H);
    }
  } else if (kind === 2) {
    // Whip pan: A slides left, B slides in from right, with motion blur
    ctx.save();
    ctx.translate(-W * ease, 0);
    drawMotionFrame(ctx, imgA, W, H, motionA, 1);
    ctx.restore();
    ctx.save();
    ctx.translate(W * (1 - ease), 0);
    drawMotionFrame(ctx, imgB, W, H, motionB, 0);
    ctx.restore();
    // motion blur streak
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    for (let i = 0; i < 8; i++) ctx.fillRect(0, (H / 8) * i, W, 2);
    ctx.globalAlpha = 1;
  } else if (kind === 3) {
    // Zoom through: A scales up & fades, B scales from small to normal
    ctx.save();
    const sa = 1 + ease * 0.6;
    ctx.translate(W / 2, H / 2); ctx.scale(sa, sa); ctx.translate(-W / 2, -H / 2);
    ctx.globalAlpha = 1 - ease;
    drawMotionFrame(ctx, imgA, W, H, motionA, 1);
    ctx.restore();
    ctx.save();
    const sb = 0.6 + ease * 0.4;
    ctx.translate(W / 2, H / 2); ctx.scale(sb, sb); ctx.translate(-W / 2, -H / 2);
    ctx.globalAlpha = ease;
    drawMotionFrame(ctx, imgB, W, H, motionB, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
  } else {
    // Crossfade (default)
    drawMotionFrame(ctx, imgA, W, H, motionA, 1);
    ctx.globalAlpha = ease;
    drawMotionFrame(ctx, imgB, W, H, motionB, 0);
    ctx.globalAlpha = 1;
  }
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
