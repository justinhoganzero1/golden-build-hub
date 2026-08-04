import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Tv, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateImage } from "@/lib/imageGen";
import { listMovieHandoffs, stashMovieBrief, type MovieHandoffRecord } from "@/lib/movieHandoff";
import { getMovieFormat, stashMovieFormat } from "@/lib/movieFormats";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired once the full hosted episode is stashed and the studio should open. */
  onReady: () => void;
}

interface ShowSegment {
  kind?: "host" | "broll";
  heading?: string;
  narration?: string;
  image_prompt?: string;
  seconds?: number;
}

interface HostShow {
  host: { name: string; title?: string; persona?: string; appearance_prompt?: string; voice_style?: string };
  show_title?: string;
  segments: ShowSegment[];
  youtube?: { title?: string; description?: string; tags?: string[]; thumbnail_prompt?: string };
}

const HOST_STYLES = [
  "Warm, energetic explainer host",
  "Late-night comedy host",
  "Serious documentary presenter",
  "Tech news anchor",
  "Cosy storytime narrator on camera",
  "High-energy hype host for shorts",
];

/**
 * One flow: topic (or a Story Writer story) → Oracle invents a host,
 * writes the whole episode, generates the host's on-camera look, and
 * loads everything into Movie Studio ready to render and publish to YouTube.
 */
const AIHostShowWizard = ({ open, onOpenChange, onReady }: Props) => {
  const [topic, setTopic] = useState("");
  const [channelName, setChannelName] = useState("");
  const [hostStyle, setHostStyle] = useState(HOST_STYLES[0]);
  const [hostGender, setHostGender] = useState("any");
  const [minutes, setMinutes] = useState(8);
  const [stories, setStories] = useState<MovieHandoffRecord[]>([]);
  const [storyId, setStoryId] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(null);
    listMovieHandoffs().then(setStories).catch(() => setStories([]));
  }, [open]);

  const busy = step !== null;

  const build = async () => {
    const story = stories.find(s => s.id === storyId) || null;
    if (!topic.trim() && !story) {
      toast.error("Give the episode a topic, or pick a story to base it on");
      return;
    }

    try {
      setStep("Oracle is casting your host and writing the episode…");
      const { data, error } = await supabase.functions.invoke("youtube-host-show", {
        body: {
          topic: topic.trim() || story?.title,
          host_style: hostStyle,
          host_gender: hostGender,
          channel_name: channelName.trim(),
          minutes,
          source_text: story?.brief?.script?.slice(0, 12000) || "",
        },
      });
      if (error) throw error;
      const show = data as HostShow;
      if ((data as any)?.error) throw new Error((data as any).error);
      if (!show?.segments?.length) throw new Error("The show came back empty — try again");

      const hostName = show.host?.name || "Your Host";
      const appearance =
        show.host?.appearance_prompt ||
        `Professional TV presenter named ${hostName}, ${hostStyle}, studio lighting`;

      setStep(`Generating ${hostName} on camera…`);
      let hostImage: string | undefined;
      try {
        const res = await generateImage({
          prompt: `${appearance}. Waist-up shot of the presenter looking directly into the camera, modern YouTube studio set, soft key light, shallow depth of field, photorealistic 4K, no text, no captions, no watermark.`,
          tier: "premium",
        });
        hostImage = res.url;
      } catch (e) {
        console.error("[AIHostShowWizard] host portrait failed", e);
        toast.info("Host portrait didn't generate — you can regenerate it inside the studio.");
      }

      setStep("Laying the episode out on the timeline…");
      const voiceStyle = show.host?.voice_style || "narrator-male-warm";
      const scenes = show.segments.slice(0, 24).map((seg, i) => {
        const isHost = (seg.kind || (i % 2 === 0 ? "host" : "broll")) === "host";
        return {
          caption: seg.heading || (isHost ? `${hostName} — segment ${i + 1}` : `B-roll ${i + 1}`),
          narration: (seg.narration || "").trim(),
          photo_prompt: isHost
            ? `${appearance}. Presenter piece-to-camera, YouTube studio set, ${seg.heading || "on air"}, photorealistic, no text`
            : seg.image_prompt ||
              `Cinematic B-roll illustrating: ${seg.heading || topic}. Photorealistic, filmic colour grade, no text`,
          image_url: isHost ? hostImage : undefined,
          duration_sec: Math.min(30, Math.max(8, Math.round(seg.seconds || 20))),
          motion: isHost ? "static" : "ken-burns",
          speaker: hostName,
          voice_style: voiceStyle,
          is_news_segment: isHost,
          lower_third_name: isHost ? hostName : undefined,
          lower_third_title: isHost ? show.host?.title || channelName || "Host" : undefined,
        };
      });

      const script = show.segments.map(s => s.narration).filter(Boolean).join("\n\n");

      stashMovieBrief({
        script,
        intent: `${show.show_title || topic} — hosted by ${hostName} (${hostStyle})`,
        title: show.youtube?.title || show.show_title || topic,
        scenes,
        youtube: {
          title: show.youtube?.title || show.show_title || topic,
          description: show.youtube?.description || "",
          tags: show.youtube?.tags || [],
          thumbnail_prompt: show.youtube?.thumbnail_prompt || "",
        },
      } as any);
      stashMovieFormat(getMovieFormat("youtube_standard"));

      toast.success(`${hostName} is ready — ${scenes.length} segments loaded`);
      onOpenChange(false);
      onReady();
    } catch (e) {
      console.error("[AIHostShowWizard] build failed", e);
      toast.error(e instanceof Error ? e.message : "Could not build the show");
    } finally {
      setStep(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-background border-primary/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Tv className="w-5 h-5" /> Full YouTube video with an AI host
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Oracle casts a presenter, writes their entire script, generates them on camera, lays the episode on the
          timeline and writes the YouTube title, description and tags. You just render and publish.
        </p>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Episode topic</Label>
            <Textarea
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. 5 AI tools that will replace your whole marketing team in 2026"
              className="mt-1 text-sm"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Channel name (optional)</Label>
              <Input value={channelName} onChange={e => setChannelName(e.target.value)} className="mt-1 text-sm" placeholder="Oracle Lunar TV" />
            </div>
            <div>
              <Label className="text-xs">Runtime (minutes)</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={minutes}
                onChange={e => setMinutes(Math.min(30, Math.max(1, Number(e.target.value) || 1)))}
                className="mt-1 text-sm"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Host style</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {HOST_STYLES.map(s => (
                <button
                  key={s}
                  onClick={() => setHostStyle(s)}
                  className={`text-left text-[11px] p-2 rounded-md border transition-colors ${
                    hostStyle === s ? "border-primary bg-primary/10" : "border-border/60 hover:border-primary/50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Host presents as</Label>
            <div className="flex gap-2 mt-1">
              {["any", "female", "male"].map(g => (
                <button
                  key={g}
                  onClick={() => setHostGender(g)}
                  className={`flex-1 text-xs py-2 rounded-md border capitalize transition-colors ${
                    hostGender === g ? "border-primary bg-primary/10" : "border-border/60 hover:border-primary/50"
                  }`}
                >
                  <UserRound className="w-3 h-3 inline mr-1" />
                  {g}
                </button>
              ))}
            </div>
          </div>

          {stories.length > 0 && (
            <div>
              <Label className="text-xs">Base it on a Story Writer story (optional)</Label>
              <div className="space-y-1.5 mt-1 max-h-40 overflow-y-auto">
                {stories.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setStoryId(storyId === s.id ? null : s.id)}
                    className={`w-full text-left text-xs p-2 rounded-md border transition-colors ${
                      storyId === s.id ? "border-primary bg-primary/10" : "border-border/60 hover:border-primary/50"
                    }`}
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <Button onClick={build} disabled={busy} size="lg" className="w-full h-12 font-bold">
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {busy ? step : "Cast the host & write the whole episode"}
        </Button>

        <p className="text-[10px] text-muted-foreground text-center">
          B-roll frames and voiceover are generated in the studio, then Publish hands the finished MP4 straight to
          YouTube.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default AIHostShowWizard;
