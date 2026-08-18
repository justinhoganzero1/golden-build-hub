import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Loader2, Mic, Move, Sparkles, Tv, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import { CURATED_ELEVENLABS_VOICES } from "@/data/elevenLabsVoices";
import {
  HOST_POSITION_PRESETS,
  MAX_INTERVIEW_SEC,
  clampInterviewSeconds,
  type HostBeat,
  type HostConfig,
  type InterviewBeat,
} from "@/lib/movieHost";

export interface HostScene {
  id: string;
  caption: string;
  image_url?: string;
  duration_sec: number;
  host_beat?: HostBeat;
  interview?: InterviewBeat;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  host: HostConfig;
  onHostChange: (patch: Partial<HostConfig>) => void;
  scenes: HostScene[];
  onSceneChange: (id: string, patch: Partial<HostScene>) => void;
  /** Generate the presenter portrait from the look description. */
  onGeneratePortrait: (look: string) => Promise<void>;
  generatingPortrait: boolean;
  /** Render the host's TTS for a scene beat. */
  onVoiceHostBeat: (sceneId: string) => Promise<void>;
  /** Render both sides of the ≤8s interview. */
  onVoiceInterview: (sceneId: string) => Promise<void>;
}

/**
 * Movie Host booth — a movable, lip-synced talking-head presenter that sits on
 * top of the movie, plus short two-avatar interview beats where the host
 * "interviews" a character from the film live on air (max 8 seconds).
 */
const MovieHostPanel = ({
  open, onOpenChange, host, onHostChange, scenes, onSceneChange,
  onGeneratePortrait, generatingPortrait, onVoiceHostBeat, onVoiceInterview,
}: Props) => {
  const [look, setLook] = useState("Warm, authoritative female news anchor in a navy blazer");
  const [tab, setTab] = useState<"host" | "beats" | "interview">("host");
  const dragRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const guestUploadFor = useRef<string | null>(null);

  const preview = scenes.find(s => s.image_url) || scenes[0];

  const readFile = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(file);
    });

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const guestScene = guestUploadFor.current;
    guestUploadFor.current = null;
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Choose an image file"); return; }
    const url = await readFile(file);
    if (guestScene) {
      const scene = scenes.find(s => s.id === guestScene);
      onSceneChange(guestScene, { interview: { ...emptyInterview(), ...(scene?.interview || {}), guestImageUrl: url } });
    } else {
      onHostChange({ imageUrl: url });
    }
    toast.success("Portrait loaded");
  };

  const emptyInterview = (): InterviewBeat => ({
    guestName: "",
    guestImageUrl: null,
    guestVoiceId: CURATED_ELEVENLABS_VOICES[0]?.id || "JBFqnCBsd6RMkjVDRZzb",
    hostLine: "",
    guestLine: "",
    offset_sec: 0,
    seconds: MAX_INTERVIEW_SEC,
  });

  // Drag the host card around the frame preview
  const onPadPointer = (e: React.PointerEvent) => {
    if (e.buttons !== 1 && e.type !== "pointerdown") return;
    const el = dragRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    // Keep the card mostly inside the frame
    onHostChange({
      x: Math.max(0, Math.min(1 - host.scale, x - host.scale / 2)),
      y: Math.max(0, Math.min(0.85, y - host.scale * 0.6)),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto bg-background border-primary/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Tv className="w-5 h-5" /> Movie Host — talking head & live interviews
          </DialogTitle>
        </DialogHeader>

        <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
          <div>
            <p className="text-sm font-semibold">Show the host in this movie</p>
            <p className="text-xs text-muted-foreground">
              Lip-synced to the text-to-speech, movable anywhere in the frame.
            </p>
          </div>
          <Switch checked={host.enabled} onCheckedChange={v => onHostChange({ enabled: v })} />
        </div>

        <div className="flex gap-2">
          {([["host", "Presenter"], ["beats", "Pieces to camera"], ["interview", "Live interviews"]] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 text-xs py-2 rounded-md border transition-colors ${
                tab === id ? "border-primary bg-primary/10 text-primary" : "border-border/60 hover:border-primary/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "host" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Host name</Label>
                <Input value={host.name} onChange={e => onHostChange({ name: e.target.value })} className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs">On-screen title</Label>
                <Input value={host.title} onChange={e => onHostChange({ title: e.target.value })} className="mt-1 text-sm" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Host voice</Label>
              <select
                value={host.voiceId}
                onChange={e => onHostChange({ voiceId: e.target.value })}
                className="mt-1 w-full h-9 rounded-md bg-background border border-border/60 text-sm px-2"
              >
                {CURATED_ELEVENLABS_VOICES.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs">Presenter look</Label>
              <Textarea value={look} onChange={e => setLook(e.target.value)} rows={2} className="mt-1 text-sm" />
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={() => onGeneratePortrait(look)} disabled={generatingPortrait} className="flex-1">
                  {generatingPortrait ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                  Generate host at the desk
                </Button>
                <Button size="sm" variant="outline" onClick={() => uploadRef.current?.click()}>
                  <Upload className="w-3.5 h-3.5 mr-1" /> Upload
                </Button>
              </div>
            </div>

            {/* Frame preview + drag pad */}
            <div>
              <Label className="text-xs flex items-center gap-1"><Move className="w-3 h-3" /> Drag the host anywhere in the frame</Label>
              <div
                ref={dragRef}
                onPointerDown={onPadPointer}
                onPointerMove={onPadPointer}
                className="mt-1 relative w-full aspect-video rounded-md overflow-hidden border border-border/60 bg-black cursor-move select-none"
              >
                {preview?.image_url && (
                  <img src={preview.image_url} alt="Frame preview" className="absolute inset-0 w-full h-full object-cover opacity-70" />
                )}
                <div
                  className="absolute rounded-md overflow-hidden border-2 border-primary shadow-lg bg-black/70"
                  style={{
                    left: `${host.x * 100}%`,
                    top: `${host.y * 100}%`,
                    width: `${host.scale * 100}%`,
                    aspectRatio: "1 / 1.25",
                  }}
                >
                  {host.imageUrl
                    ? <img src={host.imageUrl} alt={host.name} className="w-full h-full object-cover" draggable={false} />
                    : <div className="w-full h-full grid place-items-center text-[10px] text-muted-foreground px-1 text-center">No host portrait yet</div>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {HOST_POSITION_PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onHostChange({ x: p.x, y: p.y, scale: p.scale })}
                    className="text-[10px] px-2 py-1 rounded border border-border/60 hover:border-primary/60"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Size ({Math.round(host.scale * 100)}% of frame)</Label>
                <Slider value={[host.scale]} min={0.12} max={0.6} step={0.01} onValueChange={([v]) => onHostChange({ scale: v })} className="mt-2" />
              </div>
              <div>
                <Label className="text-xs">Frame style</Label>
                <div className="flex gap-1.5 mt-2">
                  {(["rounded", "circle", "square"] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => onHostChange({ frame: f })}
                      className={`flex-1 text-[10px] py-1.5 rounded border capitalize ${
                        host.frame === f ? "border-primary bg-primary/10" : "border-border/60"
                      }`}
                    >{f}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Mouth position — across ({Math.round(host.mouthX * 100)}%)</Label>
                <Slider value={[host.mouthX]} min={0.2} max={0.8} step={0.01} onValueChange={([v]) => onHostChange({ mouthX: v })} className="mt-2" />
              </div>
              <div>
                <Label className="text-xs">Mouth position — down ({Math.round(host.mouthY * 100)}%)</Label>
                <Slider value={[host.mouthY]} min={0.4} max={0.9} step={0.01} onValueChange={([v]) => onHostChange({ mouthY: v })} className="mt-2" />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs">
              <Switch checked={host.showPlate} onCheckedChange={v => onHostChange({ showPlate: v })} />
              Show the name plate under the host
            </label>
          </div>
        )}

        {tab === "beats" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Give the host a line on any scene. It renders as a lip-synced piece-to-camera over that scene.
            </p>
            {scenes.map((s, i) => {
              const beat = s.host_beat;
              return (
                <Card key={s.id} className="p-3 space-y-2 bg-card/60">
                  <p className="text-xs font-semibold truncate">{i + 1}. {s.caption}</p>
                  <Textarea
                    value={beat?.line || ""}
                    onChange={e => onSceneChange(s.id, {
                      host_beat: { offset_sec: 0, ...(beat || {}), line: e.target.value, audio_url: undefined },
                    })}
                    placeholder="What the host says to camera over this scene…"
                    rows={2}
                    className="text-xs"
                  />
                  {!!beat?.line && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        Starts at
                        <Input
                          type="number" min={0} max={s.duration_sec} step={0.5}
                          value={beat.offset_sec ?? 0}
                          onChange={e => onSceneChange(s.id, { host_beat: { ...beat, offset_sec: Number(e.target.value) || 0 } })}
                          className="h-7 w-16 text-[11px]"
                        />s
                      </div>
                      <Button size="sm" variant="outline" className="h-7 text-[11px]"
                        disabled={beat.generating}
                        onClick={() => onVoiceHostBeat(s.id)}>
                        {beat.generating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Mic className="w-3 h-3 mr-1" />}
                        {beat.audio_url ? "Re-voice" : "Voice it"}
                      </Button>
                      {beat.audio_url && <audio src={beat.audio_url} controls className="h-6 max-w-[160px]" />}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {tab === "interview" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Put the host and a character side by side, facing each other, for a live on-air exchange.
              Interviews are capped at {MAX_INTERVIEW_SEC} seconds.
            </p>
            {scenes.map((s, i) => {
              const iv = s.interview;
              const set = (patch: Partial<InterviewBeat>) =>
                onSceneChange(s.id, { interview: { ...emptyInterview(), ...(iv || {}), ...patch } });
              return (
                <Card key={s.id} className="p-3 space-y-2 bg-card/60">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold truncate">{i + 1}. {s.caption}</p>
                    <Switch
                      checked={!!iv}
                      onCheckedChange={v => onSceneChange(s.id, { interview: v ? { ...emptyInterview(), guestImageUrl: s.image_url || null } : undefined })}
                    />
                  </div>
                  {iv && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Input value={iv.guestName} onChange={e => set({ guestName: e.target.value })} placeholder="Guest name" className="h-8 text-xs" />
                        <select
                          value={iv.guestVoiceId}
                          onChange={e => set({ guestVoiceId: e.target.value, guestAudioUrl: undefined })}
                          className="h-8 rounded-md bg-background border border-border/60 text-xs px-2"
                        >
                          {CURATED_ELEVENLABS_VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-14 rounded overflow-hidden border border-border/60 bg-black/40 shrink-0">
                          {iv.guestImageUrl && <img src={iv.guestImageUrl} alt={iv.guestName} className="w-full h-full object-cover" />}
                        </div>
                        <Button size="sm" variant="outline" className="h-7 text-[11px]"
                          onClick={() => { guestUploadFor.current = s.id; uploadRef.current?.click(); }}>
                          <Upload className="w-3 h-3 mr-1" /> Guest photo
                        </Button>
                        {s.image_url && (
                          <Button size="sm" variant="ghost" className="h-7 text-[11px]"
                            onClick={() => set({ guestImageUrl: s.image_url! })}>
                            Use this scene's character
                          </Button>
                        )}
                      </div>
                      <Textarea value={iv.hostLine} onChange={e => set({ hostLine: e.target.value, hostAudioUrl: undefined })}
                        placeholder="Host question (keep it short — the whole exchange is 8s)" rows={2} className="text-xs" />
                      <Textarea value={iv.guestLine} onChange={e => set({ guestLine: e.target.value, guestAudioUrl: undefined })}
                        placeholder="Guest answer" rows={2} className="text-xs" />
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          Starts at
                          <Input type="number" min={0} max={s.duration_sec} step={0.5} value={iv.offset_sec}
                            onChange={e => set({ offset_sec: Number(e.target.value) || 0 })} className="h-7 w-16 text-[11px]" />s
                          · length
                          <Input type="number" min={2} max={MAX_INTERVIEW_SEC} step={1} value={iv.seconds}
                            onChange={e => set({ seconds: clampInterviewSeconds(Number(e.target.value)) })} className="h-7 w-16 text-[11px]" />s
                        </div>
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={iv.generating}
                          onClick={() => onVoiceInterview(s.id)}>
                          {iv.generating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Users className="w-3 h-3 mr-1" />}
                          Voice both sides
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        <Button className="w-full" onClick={() => onOpenChange(false)}>
          Done — host is live on the timeline
        </Button>
        <p className="text-[10px] text-muted-foreground text-center">
          The host is composited into preview and final render, lip-synced to the exact audio being recorded.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default MovieHostPanel;
