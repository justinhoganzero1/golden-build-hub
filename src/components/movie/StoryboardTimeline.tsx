// Storyboard timeline: scrub the movie, drop different music tracks at different times,
// drag narration segments to new timings, and re-dub / add AI voice layers on any beat.
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Loader2, Music, Mic, Upload, Sparkles, Play, Volume2, VolumeX, Headphones } from "lucide-react";
import { toast } from "sonner";
import { MUSIC_PRESETS_TOP_100 } from "@/data/movieMusicPresets";
import { CURATED_ELEVENLABS_VOICES } from "@/data/elevenLabsVoices";
import VoiceWaveform from "@/components/movie/VoiceWaveform";

export interface TimelineScene {
  id: string;
  caption: string;
  duration_sec: number;
  image_url?: string;
  narration?: string;
  audio_url?: string;
  voice_id?: string;
  /** Seconds after the scene starts that this narration should begin. */
  voice_offset_sec?: number;
  music_url?: string;
  music_options?: string[];
  music_prompt?: string;
  music_volume?: number;
  generatingAudio?: boolean;
  generatingSceneMusic?: boolean;
}

export interface TimelineMix {
  musicMuted: boolean;
  voiceMuted: boolean;
  solo: "music" | "voice" | null;
}

export const DEFAULT_TIMELINE_MIX: TimelineMix = { musicMuted: false, voiceMuted: false, solo: null };

/** Effective audibility of a layer given mute/solo state. */
export const layerAudible = (mix: TimelineMix, layer: "music" | "voice") => {
  if (mix.solo) return mix.solo === layer;
  return layer === "music" ? !mix.musicMuted : !mix.voiceMuted;
};

interface Props {
  scenes: TimelineScene[];
  onUpdateScene: (id: string, patch: Partial<TimelineScene>) => void;
  /** Generate (or replace) the voice-over on a scene with the given text + voice. */
  onRedub: (id: string, text: string, voiceId: string) => Promise<void> | void;
  /** Generate backing music options for a scene from its music_prompt. */
  onGenerateSceneMusic: (id: string) => Promise<void> | void;
  mix?: TimelineMix;
  onMixChange?: (mix: TimelineMix) => void;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

const StoryboardTimeline = ({
  scenes,
  onUpdateScene,
  onRedub,
  onGenerateSceneMusic,
  mix = DEFAULT_TIMELINE_MIX,
  onMixChange,
}: Props) => {
  const [playhead, setPlayhead] = useState(0); // seconds
  const [dubText, setDubText] = useState<Record<string, string>>({});
  const [clipDur, setClipDur] = useState<Record<string, number>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const laneRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; base: number; max: number } | null>(null);

  const { starts, total } = useMemo(() => {
    const starts: number[] = [];
    let acc = 0;
    scenes.forEach(s => { starts.push(acc); acc += s.duration_sec || 20; });
    return { starts, total: acc };
  }, [scenes]);

  const activeIndex = useMemo(() => {
    let idx = 0;
    starts.forEach((st, i) => { if (playhead >= st) idx = i; });
    return idx;
  }, [playhead, starts]);

  if (!scenes.length) return null;
  const active = scenes[activeIndex];
  const activeVoice = active.voice_id || CURATED_ELEVENLABS_VOICES[0].id;
  const musicOn = layerAudible(mix, "music");
  const voiceOn = layerAudible(mix, "voice");

  const setMix = (patch: Partial<TimelineMix>) => onMixChange?.({ ...mix, ...patch });

  const preview = (url: string | undefined, layer: "music" | "voice") => {
    if (!url) return;
    if (!layerAudible(mix, layer)) {
      toast.info(`${layer === "music" ? "Music" : "Voice"} layer is muted — unmute to audition it`);
      return;
    }
    audioRef.current?.pause();
    const a = new Audio(url);
    audioRef.current = a;
    a.play().catch(() => toast.error("Could not play that audio"));
  };

  const readFile = (file: File, cb: (dataUrl: string) => void) => {
    const r = new FileReader();
    r.onload = () => cb(String(r.result));
    r.onerror = () => toast.error("Could not read that file");
    r.readAsDataURL(file);
  };

  // ---- draggable voice segments -------------------------------------------
  const onSegmentPointerDown = (e: React.PointerEvent, scene: TimelineScene, idx: number) => {
    e.preventDefault();
    const seg = clipDur[scene.id] ?? Math.min(scene.duration_sec, 4);
    dragRef.current = {
      id: scene.id,
      startX: e.clientX,
      base: scene.voice_offset_sec ?? 0,
      max: Math.max(0, (scene.duration_sec || 20) - Math.min(seg, scene.duration_sec || 20)),
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onSegmentPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const laneWidth = laneRef.current?.clientWidth || 1;
    if (!d) return;
    const deltaSec = ((e.clientX - d.startX) / laneWidth) * total;
    const next = Math.max(0, Math.min(d.max, d.base + deltaSec));
    onUpdateScene(d.id, { voice_offset_sec: Math.round(next * 10) / 10 });
  };

  const endDrag = () => { dragRef.current = null; };

  return (
    <div className="rounded-lg p-3 border border-accent-blue/40 bg-background/60 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Play className="w-4 h-4 text-accent-blue" />
        <span className="text-xs font-black uppercase text-accent-blue">Storyboard timeline</span>
        <div className="flex items-center gap-1 ml-auto">
          <Button type="button" size="sm" variant={mix.musicMuted ? "destructive" : "ghost"}
            className="h-6 text-[10px]" title="Mute music layer"
            onClick={() => setMix({ musicMuted: !mix.musicMuted })}>
            {mix.musicMuted ? <VolumeX className="w-3 h-3 mr-1" /> : <Music className="w-3 h-3 mr-1" />} Music
          </Button>
          <Button type="button" size="sm" variant={mix.solo === "music" ? "default" : "outline"}
            className="h-6 text-[10px]" title="Solo music layer"
            onClick={() => setMix({ solo: mix.solo === "music" ? null : "music" })}>
            <Headphones className="w-3 h-3" />
          </Button>
          <Button type="button" size="sm" variant={mix.voiceMuted ? "destructive" : "ghost"}
            className="h-6 text-[10px]" title="Mute voice layer"
            onClick={() => setMix({ voiceMuted: !mix.voiceMuted })}>
            {mix.voiceMuted ? <VolumeX className="w-3 h-3 mr-1" /> : <Mic className="w-3 h-3 mr-1" />} Voice
          </Button>
          <Button type="button" size="sm" variant={mix.solo === "voice" ? "default" : "outline"}
            className="h-6 text-[10px]" title="Solo voice layer"
            onClick={() => setMix({ solo: mix.solo === "voice" ? null : "voice" })}>
            <Headphones className="w-3 h-3" />
          </Button>
        </div>
        <span className="text-[10px] text-muted-foreground w-full">
          {scenes.length} beats · {fmt(total)} total · music {musicOn ? "on" : "muted"} · voice {voiceOn ? "on" : "muted"}
        </span>
      </div>

      {/* Scene strip */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 min-w-full">
          {scenes.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setPlayhead(starts[i])}
              style={{ flex: `${s.duration_sec || 20} 0 0`, minWidth: 64 }}
              className={`relative h-16 rounded overflow-hidden border text-left ${
                i === activeIndex ? "border-primary ring-1 ring-primary" : "border-border/60"
              }`}
              title={s.caption}
            >
              {s.image_url
                ? <img src={s.image_url} alt={s.caption} className="w-full h-full object-cover" loading="lazy" />
                : <div className="w-full h-full bg-muted" />}
              <span className="absolute top-0 left-0 px-1 text-[9px] bg-black/60 text-white">{i + 1}</span>
              <span className="absolute bottom-0 left-0 right-0 flex gap-0.5 p-0.5">
                <span className={`h-1 flex-1 rounded ${s.music_url ? "bg-accent-blue" : "bg-white/20"}`} />
                <span className={`h-1 flex-1 rounded ${s.audio_url ? "bg-primary" : "bg-white/20"}`} />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Draggable voice segment lane */}
      <div className="space-y-1">
        <p className="text-[10px] text-muted-foreground">
          Voice lane — drag any narration block sideways to change when it speaks.
        </p>
        <div
          ref={laneRef}
          className={`relative h-10 rounded border border-border/60 bg-muted/30 overflow-hidden ${voiceOn ? "" : "opacity-40"}`}
          onPointerMove={onSegmentPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
        >
          {scenes.map((s, i) => {
            if (!s.audio_url) return null;
            const dur = Math.min(clipDur[s.id] ?? Math.min(s.duration_sec, 4), s.duration_sec || 20);
            const left = ((starts[i] + (s.voice_offset_sec ?? 0)) / total) * 100;
            const width = Math.max(1.5, (dur / total) * 100);
            return (
              <div
                key={s.id}
                role="slider"
                aria-label={`Narration timing for beat ${i + 1}`}
                aria-valuemin={0}
                aria-valuemax={Math.round(s.duration_sec || 20)}
                aria-valuenow={Math.round(s.voice_offset_sec ?? 0)}
                tabIndex={0}
                onPointerDown={e => onSegmentPointerDown(e, s, i)}
                onKeyDown={e => {
                  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                  e.preventDefault();
                  const step = e.key === "ArrowLeft" ? -0.5 : 0.5;
                  const max = Math.max(0, (s.duration_sec || 20) - dur);
                  onUpdateScene(s.id, {
                    voice_offset_sec: Math.max(0, Math.min(max, (s.voice_offset_sec ?? 0) + step)),
                  });
                }}
                onDoubleClick={() => setPlayhead(starts[i])}
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`Beat ${i + 1} · +${(s.voice_offset_sec ?? 0).toFixed(1)}s — ${s.narration || s.caption}`}
                className={`absolute top-1 bottom-1 rounded cursor-ew-resize border px-1 ${
                  i === activeIndex ? "border-primary bg-primary/25" : "border-primary/40 bg-primary/10"
                }`}
              >
                <VoiceWaveform
                  url={s.audio_url}
                  height={22}
                  onDuration={d => setClipDur(prev => (prev[s.id] === d ? prev : { ...prev, [s.id]: d }))}
                />
              </div>
            );
          })}
          <div
            className="absolute top-0 bottom-0 w-px bg-primary pointer-events-none"
            style={{ left: `${(playhead / Math.max(1, total)) * 100}%` }}
          />
        </div>
      </div>

      {/* Playhead slider along the base of the storyboard */}
      <div className="space-y-1">
        <Slider
          value={[playhead]}
          min={0}
          max={Math.max(1, total - 1)}
          step={1}
          onValueChange={v => setPlayhead(v[0])}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{fmt(playhead)}</span>
          <span>Scene {activeIndex + 1}: {active.caption?.slice(0, 60)}</span>
          <span>{fmt(total)}</span>
        </div>
      </div>

      {/* MUSIC LAYER at the playhead */}
      <div className={`rounded border border-border/60 p-2 space-y-2 ${musicOn ? "" : "opacity-60"}`}>
        <div className="flex items-center gap-2">
          <Music className="w-3.5 h-3.5 text-accent-blue" />
          <span className="text-[11px] font-bold uppercase">Music layer · scene {activeIndex + 1}</span>
          {active.music_url && (
            <Button type="button" size="sm" variant="ghost" className="h-6 ml-auto text-[10px]"
              onClick={() => preview(active.music_url, "music")}>
              <Volume2 className="w-3 h-3 mr-1" /> Preview
            </Button>
          )}
        </div>
        <select
          value=""
          onChange={e => {
            const preset = MUSIC_PRESETS_TOP_100.find(p => p.id === e.target.value);
            if (preset) {
              onUpdateScene(active.id, { music_prompt: preset.prompt });
              toast.success(`Cue set for scene ${activeIndex + 1}: ${preset.name}`);
            }
          }}
          className="w-full h-8 text-[11px] bg-input border border-border rounded px-2"
        >
          <option value="" disabled>🎵 Pick a track for this point in the movie…</option>
          {Object.entries(
            MUSIC_PRESETS_TOP_100.reduce((acc, p) => {
              (acc[p.genre] ||= []).push(p);
              return acc;
            }, {} as Record<string, typeof MUSIC_PRESETS_TOP_100>)
          ).map(([genre, list]) => (
            <optgroup key={genre} label={genre}>
              {list.map(p => <option key={p.id} value={p.id}>{p.name} — {p.mood}</option>)}
            </optgroup>
          ))}
        </select>
        <Textarea
          rows={2}
          className="text-[11px]"
          placeholder="Describe the cue for this moment (instrumental only)…"
          value={active.music_prompt ?? ""}
          onChange={e => onUpdateScene(active.id, { music_prompt: e.target.value })}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="secondary" className="h-7 text-[11px]"
            disabled={active.generatingSceneMusic || !(active.music_prompt || "").trim()}
            onClick={() => onGenerateSceneMusic(active.id)}>
            {active.generatingSceneMusic
              ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Composing…</>
              : <><Sparkles className="w-3 h-3 mr-1" /> Generate cue here</>}
          </Button>
          <label className="h-7 px-2 text-[11px] inline-flex items-center gap-1 border border-border bg-input cursor-pointer hover:bg-muted/50">
            <Upload className="w-3 h-3" /> Upload track
            <input type="file" accept="audio/*" className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) readFile(file, url => {
                  onUpdateScene(active.id, { music_url: url });
                  toast.success(`Track added at ${fmt(starts[activeIndex])}`);
                });
              }} />
          </label>
          <div className="flex items-center gap-2 min-w-[140px]">
            <span className="text-[10px] text-muted-foreground">Vol</span>
            <Slider
              value={[Math.round((active.music_volume ?? 0.25) * 100)]}
              min={0} max={100} step={5}
              onValueChange={v => onUpdateScene(active.id, { music_volume: v[0] / 100 })}
            />
          </div>
        </div>
        {active.music_url && <VoiceWaveform url={active.music_url} height={24} color="hsl(200 90% 60%)" />}
        {!!active.music_options?.length && (
          <div className="flex flex-wrap gap-1">
            {active.music_options.map((url, i) => (
              <Button key={url.slice(-24) + i} type="button" size="sm"
                variant={active.music_url === url ? "default" : "outline"}
                className="h-6 text-[10px]"
                onClick={() => onUpdateScene(active.id, { music_url: url })}>
                Take {i + 1}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* VOICE LAYER at the playhead */}
      <div className={`rounded border border-border/60 p-2 space-y-2 ${voiceOn ? "" : "opacity-60"}`}>
        <div className="flex items-center gap-2">
          <Mic className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-bold uppercase">Voice layer · scene {activeIndex + 1}</span>
          {active.audio_url && (
            <Button type="button" size="sm" variant="ghost" className="h-6 ml-auto text-[10px]"
              onClick={() => preview(active.audio_url, "voice")}>
              <Volume2 className="w-3 h-3 mr-1" /> Play current dub
            </Button>
          )}
        </div>

        {active.audio_url && (
          <div className="rounded bg-muted/30 p-2 space-y-1">
            <VoiceWaveform
              url={active.audio_url}
              height={30}
              onDuration={d => setClipDur(prev => (prev[active.id] === d ? prev : { ...prev, [active.id]: d }))}
            />
            <p className="text-[10px] text-muted-foreground">
              Starts at {fmt(starts[activeIndex] + (active.voice_offset_sec ?? 0))} ·{" "}
              {(clipDur[active.id] ?? 0).toFixed(1)}s long · offset +{(active.voice_offset_sec ?? 0).toFixed(1)}s
            </p>
            <p className="text-[11px] italic">“{active.narration || active.caption}”</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">Start offset</span>
          <Slider
            value={[active.voice_offset_sec ?? 0]}
            min={0}
            max={Math.max(1, Math.round((active.duration_sec || 20) - Math.min(clipDur[active.id] ?? 2, active.duration_sec || 20)))}
            step={0.5}
            onValueChange={v => onUpdateScene(active.id, { voice_offset_sec: v[0] })}
          />
          <span className="text-[10px] tabular-nums w-10 text-right">+{(active.voice_offset_sec ?? 0).toFixed(1)}s</span>
        </div>

        <Textarea
          rows={2}
          className="text-[11px]"
          placeholder="Type exactly what you want said at this point in the movie…"
          value={dubText[active.id] ?? active.narration ?? ""}
          onChange={e => setDubText(prev => ({ ...prev, [active.id]: e.target.value }))}
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={activeVoice}
            onChange={e => onUpdateScene(active.id, { voice_id: e.target.value })}
            className="h-7 text-[11px] bg-input border border-border rounded px-2"
          >
            {CURATED_ELEVENLABS_VOICES.map(v => (
              <option key={v.id} value={v.id}>{v.name} — {v.gender}, {v.accent}</option>
            ))}
          </select>
          <Button type="button" size="sm" className="h-7 text-[11px]"
            disabled={active.generatingAudio}
            onClick={async () => {
              const text = (dubText[active.id] ?? active.narration ?? "").trim();
              if (!text) { toast.error("Type what the voice should say first"); return; }
              onUpdateScene(active.id, { narration: text });
              await onRedub(active.id, text, activeVoice);
            }}>
            {active.generatingAudio
              ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Dubbing…</>
              : <><Mic className="w-3 h-3 mr-1" /> {active.audio_url ? "Re-dub this beat only" : "Add voice here"}</>}
          </Button>
          <label className="h-7 px-2 text-[11px] inline-flex items-center gap-1 border border-border bg-input cursor-pointer hover:bg-muted/50">
            <Upload className="w-3 h-3" /> Upload voice
            <input type="file" accept="audio/*" className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) readFile(file, url => {
                  onUpdateScene(active.id, { audio_url: url });
                  toast.success("Voice layer replaced");
                });
              }} />
          </label>
          {active.audio_url && (
            <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px]"
              onClick={() => onUpdateScene(active.id, { audio_url: undefined, voice_offset_sec: 0 })}>
              Remove voice
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoryboardTimeline;
