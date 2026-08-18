// SUPER AI — one button that hands the whole production to the swarm.
// First click opens "Super AI Home": a scrollable list of every job the AI can do.
// Jobs that need a choice (narration voice, music vibe, ad copy, credits) open
// their own sub-panel — a full dubbing booth without leaving the studio.
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Wand2, ChevronRight, ArrowLeft, Loader2, Mic, Music, Film, Clapperboard, Megaphone,
  Sparkles, Volume2, Type, Video, Scissors, ListVideo, Play,
} from "lucide-react";
import { CURATED_ELEVENLABS_VOICES } from "@/data/elevenLabsVoices";
import { MUSIC_PRESETS_TOP_100 } from "@/data/movieMusicPresets";

export type PipelineStatus = "waiting" | "working" | "complete" | "failed" | "cancelled";
export interface PipelineStep {
  id: string;
  label: string;
  status: PipelineStatus;
  error?: string;
}

export interface PipelineArtifact {
  id: string;
  label: string;
  have: number;
  total: number;
}

export interface AuditionLayers {
  music: boolean;
  sfx: boolean;
  voice: boolean;
  credits: boolean;
}

export interface ExportSettings {
  resolution: "720p" | "1080p" | "1440p" | "4k";
  bitrateMbps: number;
  container: "webm" | "mp4";
}


export interface SuperAIActions {
  /** Do absolutely everything: storyboard art, voices, SFX, score, titles, credits, final cut. */
  runEverything: () => Promise<void> | void;
  runProductionSwarm: () => Promise<void> | void;
  generateAllImages: () => Promise<void> | void;
  generateAllVideo: () => Promise<void> | void;
  generateAllAudio: () => Promise<void> | void;
  generateAllSfx: () => Promise<void> | void;
  /** Design SFX prompts, beat timestamps and volumes for every scene, then generate them. */
  autoSfxTimeline: () => Promise<void> | void;
  /** Map and place music cues across the whole timeline from the story beats. */
  autoScoreTimeline: () => Promise<void> | void;
  runScoreTeam: () => Promise<void> | void;
  generateMovieMusic: () => Promise<void> | void;
  composeIntro: () => Promise<void> | void;
  composeTheme: () => Promise<void> | void;
  composeOutro: () => Promise<void> | void;
  /** Build the opening title card AND the end credits roll from the story. */
  generateCredits: () => Promise<void> | void;
  /** Build the opening title card + credits scene at the very front of the movie. */
  addOpeningTitles: (subtitleLine: string) => Promise<void> | void;
  /** Apply one voice to every scene and re-dub them all. */
  applyVoiceToAll: (voiceId: string) => Promise<void> | void;
  /** Push a music prompt into the whole-movie score and compose it. */
  setMusicVibe: (prompt: string) => Promise<void> | void;
  /** Insert an advert break. position: "front" | "end" | scene index. */
  insertAd: (ad: { headline: string; script: string; visual: string; seconds: number; position: "front" | "end" }) => Promise<void> | void;
  generateTrailer: () => Promise<void> | void;
  exportMovie: () => Promise<void> | void;
  setMusicLevel: (v: number) => void;
  musicLevel: number;
  sceneCount: number;
  // Step-by-step production pipeline
  pipeline: PipelineStep[];
  pipelineRunning: boolean;
  pipelineStep: number;
  musicCueProgress: { done: number; total: number } | null;
  startPipeline: () => void;
  resumePipeline: () => void;
  cancelPipeline: () => void;
  /** What already exists on the timeline, so Resume can show what will be re-run. */
  pipelineArtifacts: PipelineArtifact[];
  /** Exact step Resume will run next. */
  nextPipelineStepLabel: string;
  // Preview mode — audition layers against the timeline, no render
  auditionLayers: AuditionLayers;
  auditionState: { at: number; total: number; label: string } | null;
  startAudition: (layers: AuditionLayers) => void;
  stopAudition: () => void;
  // Export controls
  exportSettings: ExportSettings;
  setExportSettings: (patch: Partial<ExportSettings>) => void;
  // Render report
  hasRenderReport: boolean;
  downloadRenderReport: () => void;
}


type JobId =
  | "everything" | "swarm" | "images" | "video" | "narration" | "sfx" | "sfxAuto" | "score" | "music" | "musicAuto"
  | "intro" | "theme" | "outro" | "credits" | "openingTitles" | "ads" | "mix" | "trailer" | "preview" | "exportSetup"
  | "export" | "report";


interface Job {
  id: JobId;
  icon: React.ElementType;
  title: string;
  desc: string;
  opensPanel?: boolean;
}

const JOBS: Job[] = [
  { id: "everything", icon: Sparkles, title: "Make the whole movie for me", desc: "Step-by-step production with live progress — pause, resume or cancel at any point.", opensPanel: true },
  { id: "swarm", icon: Clapperboard, title: "Run the 5-agent production swarm", desc: "Visual Director, Voice Director, Sound Designer, Score Composer and Final-Cut Editor work in parallel." },
  { id: "images", icon: Film, title: "Illustrate every scene", desc: "4K cinematic, head-safe framing on every shot." },
  { id: "video", icon: Video, title: "Turn every scene into moving footage", desc: "Image-to-video motion on each beat." },
  { id: "narration", icon: Mic, title: "Narration & dubbing booth", desc: "Pick the voice, re-dub every beat, or hand it a new performance.", opensPanel: true },
  { id: "sfxAuto", icon: Volume2, title: "Auto sound design across the movie", desc: "AI writes an effect for every beat, places it on its timestamp with its own volume, then generates them all." },
  { id: "sfx", icon: Volume2, title: "Generate the sound effects I've written", desc: "Per-scene foley and impacts from the prompts already on the timeline." },
  { id: "musicAuto", icon: Music, title: "Auto background music across the timeline", desc: "Maps a cue to every story beat, generates it and sets the level from the beat's intensity." },
  { id: "score", icon: Music, title: "Adaptive score team (cue sheet only)", desc: "Writes a different original cue for every scene without generating audio." },
  { id: "music", icon: Music, title: "One track for the whole movie", desc: "Choose a vibe from 100 trending instrumentals or describe your own.", opensPanel: true },
  { id: "intro", icon: Play, title: "Compose the intro sting", desc: "Opening music bed under the titles." },
  { id: "theme", icon: Music, title: "Compose the main theme", desc: "The recurring signature track." },
  { id: "outro", icon: Music, title: "Compose the outro", desc: "Music that plays under the end credits." },
  { id: "credits", icon: ListVideo, title: "Opening + end credits from my story", desc: "Builds the title card at the front and the credits roll at the end, pulled from your story, cast and score." },
  { id: "openingTitles", icon: Type, title: "Opening credits only", desc: "Title card and front credits with your own tagline.", opensPanel: true },
  { id: "ads", icon: Megaphone, title: "Insert an advert", desc: "Drop your own promo at the front or the end — AI writes and voices it.", opensPanel: true },
  { id: "mix", icon: Scissors, title: "Final mix levels", desc: "Set how loud the music sits under the narration.", opensPanel: true },
  { id: "trailer", icon: Film, title: "Cut a preview trailer", desc: "Short punchy cut for socials." },
  { id: "export", icon: Clapperboard, title: "Render the final cut", desc: "Stitch every scene, voice, music and credits into one file." },
];

const SuperAIPanel = ({ actions }: { actions: SuperAIActions }) => {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<JobId | null>(null);
  const [busy, setBusy] = useState<JobId | null>(null);

  const [voiceId, setVoiceId] = useState(CURATED_ELEVENLABS_VOICES[0].id);
  const [musicPrompt, setMusicPrompt] = useState("");
  const [subtitleLine, setSubtitleLine] = useState("");
  const [ad, setAd] = useState({ headline: "", script: "", visual: "", seconds: 10, position: "front" as "front" | "end" });

  const run = async (id: JobId, fn: () => Promise<void> | void) => {
    setBusy(id);
    try { await fn(); } finally { setBusy(null); }
  };

  const onJob = (job: Job) => {
    if (job.opensPanel) { setPanel(job.id); return; }
    const map: Partial<Record<JobId, () => Promise<void> | void>> = {
      swarm: actions.runProductionSwarm,
      images: actions.generateAllImages,
      video: actions.generateAllVideo,
      sfx: actions.generateAllSfx,
      sfxAuto: actions.autoSfxTimeline,
      musicAuto: actions.autoScoreTimeline,
      score: actions.runScoreTeam,
      intro: actions.composeIntro,
      theme: actions.composeTheme,
      outro: actions.composeOutro,
      credits: actions.generateCredits,
      trailer: actions.generateTrailer,
      export: actions.exportMovie,
    };
    const fn = map[job.id];
    if (fn) void run(job.id, fn);
  };


  const Back = () => (
    <button onClick={() => setPanel(null)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
      <ArrowLeft className="w-3 h-3" /> Super AI home
    </button>
  );

  return (
    <>
      <Button
        type="button"
        onClick={() => { setPanel(null); setOpen(true); }}
        size="sm"
        className="bg-gradient-to-r from-primary to-accent-blue text-primary-foreground font-black uppercase tracking-wide"
        title="Hand the whole production to Super AI"
      >
        <Wand2 className="w-3.5 h-3.5 mr-1.5" /> Super AI
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-primary" /> Super AI
            </SheetTitle>
            <SheetDescription>
              {panel
                ? "Set this up and Super AI applies it across the whole movie."
                : `Everything Super AI can do for this production${actions.sceneCount ? ` — ${actions.sceneCount} scenes loaded` : ""}. Pick a job.`}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 -mx-6 px-6 mt-3">
            {!panel && (
              <div className="space-y-2 pb-8">
                {JOBS.map(job => {
                  const Icon = job.icon;
                  const isBusy = busy === job.id;
                  return (
                    <button
                      key={job.id}
                      onClick={() => onJob(job)}
                      disabled={!!busy}
                      className="w-full text-left rounded-lg border border-border hover:border-primary/60 bg-card/60 hover:bg-primary/5 transition-colors p-3 flex items-start gap-3 disabled:opacity-60"
                    >
                      <span className="mt-0.5 text-primary">
                        {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                      </span>
                      <span className="flex-1">
                        <span className="block text-xs font-bold">{job.title}</span>
                        <span className="block text-[10px] text-muted-foreground mt-0.5">{job.desc}</span>
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground mt-1" />
                    </button>
                  );
                })}
              </div>
            )}

            {panel === "everything" && (
              <div className="space-y-3 pb-8">
                <Back />
                <p className="text-[11px] text-muted-foreground">
                  Super AI runs the production one step at a time. If a step fails, fix the problem and hit resume — completed steps are never redone.
                </p>
                <div className="space-y-1.5">
                  {(actions.pipeline.length ? actions.pipeline : [
                    { id: "images", label: "Illustrate every scene", status: "waiting" as const },
                    { id: "voices", label: "Record the narration", status: "waiting" as const },
                    { id: "sfx", label: "Design and place the sound effects", status: "waiting" as const },
                    { id: "score", label: "Score the timeline with music cues", status: "waiting" as const },
                    { id: "extras", label: "Compose intro, theme and outro", status: "waiting" as const },
                    { id: "credits", label: "Build opening titles and end credits", status: "waiting" as const },
                  ]).map((step, i) => (
                    <div key={step.id} className="rounded-md border border-border p-2 flex items-start gap-2">
                      <span className="mt-0.5">
                        {step.status === "working" && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
                        {step.status === "complete" && <span className="text-[11px] text-primary font-bold">✓</span>}
                        {step.status === "failed" && <span className="text-[11px] text-destructive font-bold">!</span>}
                        {step.status === "cancelled" && <span className="text-[11px] text-muted-foreground font-bold">■</span>}
                        {step.status === "waiting" && <span className="text-[11px] text-muted-foreground">{i + 1}</span>}
                      </span>
                      <span className="flex-1">
                        <span className="block text-[11px] font-semibold">{step.label}</span>
                        {"error" in step && step.error && (
                          <span className="block text-[10px] text-destructive mt-0.5">{step.error}</span>
                        )}
                        {step.status === "working" && actions.musicCueProgress && step.id === "score" && (
                          <span className="block text-[10px] text-muted-foreground mt-0.5">
                            {actions.musicCueProgress.done} / {actions.musicCueProgress.total} cues placed
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" disabled={actions.pipelineRunning} onClick={() => actions.startPipeline()}>
                    {actions.pipelineRunning
                      ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Step {actions.pipelineStep + 1} running…</>
                      : <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Start production</>}
                  </Button>
                  {actions.pipelineRunning
                    ? <Button variant="destructive" onClick={() => actions.cancelPipeline()}>Cancel</Button>
                    : actions.pipeline.some(p => p.status === "failed" || p.status === "cancelled")
                      ? <Button variant="secondary" onClick={() => actions.resumePipeline()}>Resume</Button>
                      : null}
                </div>
              </div>
            )}

            {panel === "narration" && (
              <div className="space-y-3 pb-8">
                <Back />
                <p className="text-[11px] text-muted-foreground">
                  Pick the voice for the whole movie. Super AI re-dubs every beat with it — individual beats can still be re-dubbed on the timeline.
                </p>
                <div className="space-y-1 max-h-[45vh] overflow-y-auto pr-1">
                  {CURATED_ELEVENLABS_VOICES.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setVoiceId(v.id)}
                      className={`w-full text-left rounded-md border p-2 text-[11px] ${voiceId === v.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted/40"}`}
                    >
                      <span className="font-bold">{v.name}</span>
                      <span className="text-muted-foreground"> · {v.gender} · {v.accent} · {v.description}</span>
                    </button>
                  ))}
                </div>
                <Button
                  className="w-full"
                  disabled={busy === "narration"}
                  onClick={() => run("narration", () => actions.applyVoiceToAll(voiceId))}
                >
                  {busy === "narration" ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Dubbing every scene…</> : <><Mic className="w-3.5 h-3.5 mr-1.5" /> Dub the whole movie in this voice</>}
                </Button>
              </div>
            )}

            {panel === "music" && (
              <div className="space-y-3 pb-8">
                <Back />
                <select
                  className="w-full h-8 text-[11px] bg-input border border-border rounded px-2"
                  defaultValue=""
                  onChange={e => {
                    const p = MUSIC_PRESETS_TOP_100.find(x => x.id === e.target.value);
                    if (p) setMusicPrompt(p.prompt);
                  }}
                >
                  <option value="" disabled>Pick a vibe ({MUSIC_PRESETS_TOP_100.length} instrumentals)…</option>
                  {MUSIC_PRESETS_TOP_100.map(p => <option key={p.id} value={p.id}>{p.name} — {p.mood}</option>)}
                </select>
                <Textarea rows={3} className="text-xs" value={musicPrompt} onChange={e => setMusicPrompt(e.target.value)} placeholder="Or describe the background music (instrumental only)…" />
                <Button
                  className="w-full"
                  disabled={busy === "music" || !musicPrompt.trim()}
                  onClick={() => run("music", () => actions.setMusicVibe(musicPrompt.trim()))}
                >
                  {busy === "music" ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Composing…</> : <><Music className="w-3.5 h-3.5 mr-1.5" /> Score the whole movie with this</>}
                </Button>
              </div>
            )}

            {panel === "openingTitles" && (
              <div className="space-y-3 pb-8">
                <Back />
                <p className="text-[11px] text-muted-foreground">
                  Super AI builds a cinematic title card at the front of the movie using your title and story, then rolls the front credits.
                </p>
                <Input value={subtitleLine} onChange={e => setSubtitleLine(e.target.value)} placeholder="Optional line under the title (e.g. 'Based on a true sting')" className="text-xs" />
                <Button
                  className="w-full"
                  disabled={busy === "openingTitles"}
                  onClick={() => run("openingTitles", () => actions.addOpeningTitles(subtitleLine.trim()))}
                >
                  {busy === "openingTitles" ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Building titles…</> : <><Type className="w-3.5 h-3.5 mr-1.5" /> Add opening credits</>}
                </Button>
              </div>
            )}

            {panel === "ads" && (
              <div className="space-y-3 pb-8">
                <Back />
                <Input value={ad.headline} onChange={e => setAd({ ...ad, headline: e.target.value })} placeholder="Advert headline" className="text-xs" />
                <Textarea rows={3} className="text-xs" value={ad.script} onChange={e => setAd({ ...ad, script: e.target.value })} placeholder="What should the voice say in the ad?" />
                <Input value={ad.visual} onChange={e => setAd({ ...ad, visual: e.target.value })} placeholder="What should the ad look like?" className="text-xs" />
                <div>
                  <div className="flex justify-between text-[10px] mb-1"><span className="text-muted-foreground">Length</span><span className="font-semibold">{ad.seconds}s</span></div>
                  <Slider value={[ad.seconds]} min={5} max={30} step={5} onValueChange={v => setAd({ ...ad, seconds: v[0] })} />
                </div>
                <div className="flex gap-2">
                  {(["front", "end"] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setAd({ ...ad, position: p })}
                      className={`flex-1 rounded-md border p-2 text-[11px] font-semibold ${ad.position === p ? "border-primary bg-primary/10" : "border-border"}`}
                    >
                      {p === "front" ? "Before the movie" : "After the movie"}
                    </button>
                  ))}
                </div>
                <Button
                  className="w-full"
                  disabled={busy === "ads" || !ad.headline.trim()}
                  onClick={() => run("ads", () => actions.insertAd({ ...ad, headline: ad.headline.trim(), script: ad.script.trim(), visual: ad.visual.trim() }))}
                >
                  {busy === "ads" ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Inserting…</> : <><Megaphone className="w-3.5 h-3.5 mr-1.5" /> Insert this advert</>}
                </Button>
              </div>
            )}

            {panel === "mix" && (
              <div className="space-y-3 pb-8">
                <Back />
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-muted-foreground">Music level under narration</span>
                    <span className="font-semibold">{Math.round(actions.musicLevel * 100)}%</span>
                  </div>
                  <Slider value={[actions.musicLevel]} min={0} max={0.6} step={0.01} onValueChange={v => actions.setMusicLevel(v[0])} />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  15% keeps the score gently under the voice; push higher for action beats.
                </p>
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default SuperAIPanel;
