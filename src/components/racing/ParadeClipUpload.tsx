import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { extractVideoFrames } from "@/lib/videoFrames";
import { callController, useRacingRefresh, useRacingTable, formatInZone } from "./racingData";
import { Panel } from "./RacingUi";

export const RACING_VIDEO_BUCKET = "racing-videos";
export const MAX_CLIP_MB = 50;

/** Read a stored clip with Oracle vision (frames only, owner-confirmed by the button press). */
export async function analyseStoredClip(videoId: string, source: File | string) {
  const frames = await extractVideoFrames(source, 6);
  return callController({ action: "analyse_clip", video_id: videoId, frames });
}

const CLIP_KINDS = [
  ["paddock", "Parade / mounting yard (before the race)"],
  ["training", "Trackwork or gallop"],
  ["trial", "Barrier trial"],
  ["warmup", "Warm-up"],
  ["race", "Race replay (after the race — learning only)"],
] as const;

export function ParadeClipUpload({ races, fixedRaceId, tz, defaultKind = "paddock" }: { races: any[]; fixedRaceId?: string; tz: string; defaultKind?: string }) {
  const refresh = useRacingRefresh();
  const [kind, setKind] = useState<string>(defaultKind);
  const [horseQ, setHorseQ] = useState("");
  const [horseId, setHorseId] = useState("");
  const horses = useRacingTable("upload-horses", () => supabase.from("racing_horses").select("id,name").ilike("name", `%${horseQ}%`).order("name").limit(30), [horseQ]);
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [raceId, setRaceId] = useState(fixedRaceId ?? "");
  const [analyse, setAnalyse] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const upload = async () => {
    if (!file) return;
    if (!file.type.startsWith("video/")) { toast.error("That file isn't a video."); return; }
    if (file.size > MAX_CLIP_MB * 1024 * 1024) { toast.error(`That clip is over ${MAX_CLIP_MB} MB. Trim it to about 30 seconds and try again.`); return; }
    const race = fixedRaceId ?? raceId;
    try {
      setBusy("Uploading clip…");
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "mp4";
      const path = `${kind}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(RACING_VIDEO_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw new Error(upErr.message);
      const { data: row, error } = await supabase.from("racing_video_sources").insert({
        provider_id: "owner-uploads", race_id: race || null, horse_id: horseId || null, kind, storage_path: path,
        recorded_at: new Date(file.lastModified || Date.now()).toISOString(), licence_note: "Your own recording",
      }).select("id").single();
      if (error) throw new Error(error.message);
      if (race && kind !== "race") await supabase.from("racing_races").update({ ...(kind === "paddock" ? { has_paddock_video: true } : { has_training_video: true }), updated_at: new Date().toISOString() }).eq("id", race);
      toast.success("Clip saved privately");
      if (analyse) {
        setBusy("Oracle is reading the clip…");
        const r = await analyseStoredClip(row.id, file);
        toast.success(r?.horses ? `Read ${r.horses} horse(s) · clip quality ${r?.quality ?? "unclear"}` : "Oracle couldn't see a horse clearly in that clip.");
      }
      setFile(null);
      if (input.current) input.current.value = "";
      refresh();
    } catch (e) {
      toast.error((e as Error).message.slice(0, 200));
      refresh();
    } finally { setBusy(null); }
  };

  return (
    <Panel title="Upload a clip">
      <p className="mb-3 text-xs text-muted-foreground">
        Use your own recordings. Clips stay private to you. Keep them under {MAX_CLIP_MB} MB (about 30 seconds).
        Oracle reads a few still pictures and describes what it can see. That's an AI view, not a tip. Race replays are only used for learning, never for that race's prediction.
      </p>
      <div className="space-y-3">
        <input ref={input} type="file" accept="video/*" aria-label="Choose parade clip"
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <label className="block text-sm">What kind of clip?
          <select className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
            {CLIP_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="block text-sm">Which horse? (optional — best for single-horse training clips)
          <input className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm" placeholder="Type to search horses" value={horseQ} onChange={(e) => { setHorseQ(e.target.value); setHorseId(""); }} />
          {horseQ && !horseId && (
            <div className="mt-1 flex flex-wrap gap-1">
              {(horses.data ?? []).map((h: any) => <Button key={h.id} type="button" size="sm" variant="outline" onClick={() => { setHorseId(h.id); setHorseQ(h.name); }}>{h.name}</Button>)}
              {!(horses.data ?? []).length && <span className="text-xs text-muted-foreground">No stored horse by that name.</span>}
            </div>
          )}
        </label>
        {!fixedRaceId && (
          <label className="block text-sm">Which race is it for? (optional)
            <select className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm" value={raceId} onChange={(e) => setRaceId(e.target.value)}>
              <option value="">Not linked to a race</option>
              {races.map((r: any) => <option key={r.id} value={r.id}>{formatInZone(r.start_time_utc, tz, { dateStyle: "short", timeStyle: "short" })} · {r.meeting?.racecourse?.name} R{r.race_number}</option>)}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={analyse} onChange={(e) => setAnalyse(e.target.checked)} />
          Let Oracle read the clip straight after uploading
        </label>
        <Button onClick={upload} disabled={!file || !!busy}>
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}{busy ?? "Upload clip"}
        </Button>
      </div>
    </Panel>
  );
}
