// Oracle News Intelligence — owner control room (top of the YouTube studio).
// Every button calls the real news-controller; filming reuses the newsroom studio below.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Radio, RefreshCw, Search, Brain, Film, PenLine, Eye, Clapperboard, CheckCircle2, Send, Loader2, ExternalLink, Trash2, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { callNews, describeResult } from "@/lib/newsApi";
import { VERIFICATION_LABEL, nextBroadcastAt, type Verification } from "../../../supabase/functions/_shared/newsLogic";

export interface ProducePayload { broadcastId: string; title: string; script: string; footage: Array<{ kind: "video"; url: string }> }
interface Props { onProduce: (p: ProducePayload) => void; refreshKey?: number }

type Row = Record<string, any>;
const ratingVariant = (r: string) => (r === "green" ? "default" : r === "amber" ? "secondary" : "destructive") as "default" | "secondary" | "destructive";
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-AU", { timeZone: "Australia/Brisbane", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "never");
const STATUS_LABEL: Record<string, string> = { scripted: "Script ready", awaiting_approval: "Awaiting your approval", approved: "Approved — ready to film", produced: "Filmed — ready to publish", published: "Published", failed: "Failed" };

const NewsControlRoom = ({ onProduce, refreshKey = 0 }: Props) => {
  const [sources, setSources] = useState<Row[]>([]);
  const [stories, setStories] = useState<Row[]>([]);
  const [footage, setFootage] = useState<Row[]>([]);
  const [broadcasts, setBroadcasts] = useState<Row[]>([]);
  const [runs, setRuns] = useState<Row[]>([]);
  const [settings, setSettings] = useState<Row | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Row | null>(null);
  const [newFootage, setNewFootage] = useState({ url: "", title: "", story_id: "" });
  const [newSource, setNewSource] = useState({ name: "", url: "", region: "au", category: "australia", publisher_type: "publisher" });

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 48 * 3600_000).toISOString();
    const [s, st, f, b, r, cfg] = await Promise.all([
      supabase.from("news_sources").select("*").order("name"),
      supabase.from("news_stories").select("*").gte("last_updated", since).order("importance", { ascending: false }).limit(60),
      supabase.from("news_footage").select("*").order("created_at", { ascending: false }).limit(60),
      supabase.from("news_broadcasts").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("news_runs").select("*").order("started_at", { ascending: false }).limit(30),
      supabase.from("news_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    setSources(s.data ?? []); setStories(st.data ?? []); setFootage(f.data ?? []); setBroadcasts(b.data ?? []); setRuns(r.data ?? []); setSettings(cfg.data ?? null);
  }, []);
  useEffect(() => { void load(); }, [load, refreshKey]);
  // The only news scan of the day runs when Juzzy first opens the news room from 6 am (no timed scans).
  useEffect(() => {
    let live = true;
    setBusy("Today's news scan");
    callNews("daily_open").then((r) => {
      if (!live || r?.skipped || r?.busy) return;
      const text = describeResult("daily_open", r); setMessage(text); toast.success(text.slice(0, 140)); void load();
    }).catch((e) => { if (live) setMessage((e as Error).message || "Today's news scan didn't finish."); })
      .finally(() => { if (live) setBusy(null); });
    return () => { live = false; };
  }, [load]);

  const current = useMemo(() => broadcasts.find((b) => b.id === selectedId) ?? broadcasts.find((b) => b.status !== "published") ?? broadcasts[0] ?? null, [broadcasts, selectedId]);
  const currentFootage = useMemo(() => (current ? footage.filter((f) => current.story_ids?.includes(f.story_id)) : []), [current, footage]);

  // Signed links for green footage we hold (private storage).
  useEffect(() => {
    const paths = footage.filter((f) => f.file_path && !signed[f.file_path]).map((f) => f.file_path as string);
    if (!paths.length) return;
    void supabase.storage.from("news-footage").createSignedUrls(paths, 3600).then(({ data }) => {
      const add: Record<string, string> = {};
      (data ?? []).forEach((d) => { if (d.path && d.signedUrl) add[d.path] = d.signedUrl; });
      setSigned((m) => ({ ...m, ...add }));
    });
  }, [footage]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (action: string, extra: Record<string, unknown> = {}, label = action) => {
    setBusy(label); setMessage("");
    try {
      const r = await callNews(action, extra);
      const text = describeResult(action, r);
      setMessage(text); toast.success(text.slice(0, 140));
      if (action === "generate_script" && r?.broadcast_id) setSelectedId(r.broadcast_id);
      await load();
      return r;
    } catch (e) {
      const text = (e as Error).message || "That didn't work.";
      setMessage(text); toast.error(text.slice(0, 160));
    } finally { setBusy(null); }
  };

  const produce = () => {
    if (!current) return;
    const clips = currentFootage.filter((f) => f.rating === "green" && f.file_path && signed[f.file_path]).map((f) => ({ kind: "video" as const, url: signed[f.file_path] }));
    onProduce({ broadcastId: current.id, title: current.title, script: current.script, footage: clips });
  };

  const enabled = sources.filter((s) => s.enabled);
  const okSources = enabled.filter((s) => s.last_status === "ok");
  const lastOk = sources.map((s) => s.last_ok_at).filter(Boolean).sort().pop();
  const running = runs.find((r) => r.status === "running");
  const failed24 = runs.filter((r) => r.status === "failed" && Date.now() - new Date(r.started_at).getTime() < 86400_000);
  const counts = { green: footage.filter((f) => f.rating === "green").length, amber: footage.filter((f) => f.rating === "amber").length, red: footage.filter((f) => f.rating === "red").length };
  const tiles: Array<[string, string]> = [
    ["Sources connected", `${okSources.length} of ${enabled.length}`],
    ["Last successful scan", when(lastOk)],
    ["Stories found (48 h)", String(stories.length)],
    ["Verified by 2+ outlets", String(stories.filter((s) => s.verification === "corroborated").length)],
    ["Awaiting your review", String(broadcasts.filter((b) => b.status === "awaiting_approval").length)],
    ["Footage G / A / R", `${counts.green} / ${counts.amber} / ${counts.red}`],
    ["Production now", running ? `Running: ${running.step}` : current ? STATUS_LABEL[current.status] ?? current.status : "Idle"],
    ["Next broadcast", when(nextBroadcastAt(new Date()).toISOString())],
    ["Published", String(broadcasts.filter((b) => b.status === "published").length)],
    ["Failed tasks (24 h)", String(failed24.length)],
  ];

  const btn = (label: string, icon: React.ReactNode, onClick: () => void, disabled = false) => (
    <Button size="sm" variant="outline" onClick={onClick} disabled={!!busy || disabled}>
      {busy === label ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : icon} {label}
    </Button>
  );

  const saveRights = async () => {
    if (!editing) return;
    await act("set_rights", {
      footage_id: editing.id, copyright_owner: editing.copyright_owner ?? undefined, licence: editing.licence ?? undefined, attribution: editing.attribution ?? undefined,
      commercial_use: !!editing.commercial_use, editing_allowed: !!editing.editing_allowed, permission_expiry: editing.permission_expiry || null,
      approval_status: editing.approval_status, notes: editing.notes ?? undefined,
    }, "Save rights");
    setEditing(null);
  };

  return (
    <Card className="p-4 space-y-4 border-primary/40">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-primary/10"><Radio className="w-6 h-6 text-primary" /></div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-primary">Oracle News Intelligence</h2>
          <p className="text-xs text-muted-foreground">Oracle reads public news feeds, checks stories against each other, writes an original bulletin and lines up footage she is allowed to use. Owner only. Daily: research 5 am, script 6 am, ready by 7 am (Brisbane).</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {tiles.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border p-2"><p className="text-[10px] text-muted-foreground">{k}</p><p className="text-sm font-semibold break-words">{v}</p></div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {btn("Scan News Now", <Search className="w-4 h-4 mr-1" />, () => act("scan", {}, "Scan News Now"))}
        {btn("Refresh Sources", <RefreshCw className="w-4 h-4 mr-1" />, () => act("check_sources", {}, "Refresh Sources"))}
        {btn("Analyse News", <Brain className="w-4 h-4 mr-1" />, () => act("analyse", {}, "Analyse News"))}
        {btn("Find Footage", <Film className="w-4 h-4 mr-1" />, () => act("find_footage", current ? { story_ids: current.story_ids } : {}, "Find Footage"))}
        {btn("Generate Script", <PenLine className="w-4 h-4 mr-1" />, () => act("generate_script", { kind: "manual" }, "Generate Script"))}
        {btn("Preview Broadcast", <Eye className="w-4 h-4 mr-1" />, () => setPreview((p) => !p), !current)}
        {btn("Produce Broadcast", <Clapperboard className="w-4 h-4 mr-1" />, produce, !current || !["approved", "produced", "scripted"].includes(current?.status))}
        {btn("Approve Broadcast", <CheckCircle2 className="w-4 h-4 mr-1" />, () => current && act("approve", { broadcast_id: current.id }, "Approve Broadcast"), !current || !["scripted", "awaiting_approval"].includes(current?.status))}
        {btn("Publish Broadcast", <Send className="w-4 h-4 mr-1" />, () => current && act("publish", { broadcast_id: current.id }, "Publish Broadcast"), !current?.video_path || current?.status === "published")}
      </div>
      {message && <p className="text-xs rounded-lg bg-muted p-2">{message}</p>}
      {current && (
        <p className="text-[11px] text-muted-foreground">Working on: <span className="text-foreground font-medium">{current.title}</span> · {STATUS_LABEL[current.status] ?? current.status}. Produce loads it into the newsroom studio below — make the voice, film it, then save it to the Library and it's attached here ready to publish.</p>
      )}

      {preview && current && (
        <div className="rounded-xl border border-border p-3 space-y-3">
          <p className="text-sm font-semibold">{current.title}</p>
          <p className="text-xs whitespace-pre-wrap max-h-72 overflow-y-auto">{current.script}</p>
          <div className="space-y-1">
            <p className="text-xs font-medium">Footage for this broadcast</p>
            {currentFootage.length === 0 && <p className="text-[11px] text-muted-foreground">No footage — the screen will show headline cards.</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {currentFootage.map((f) => (
                <div key={f.id} className="rounded-lg border border-border p-2 space-y-1">
                  <div className="flex items-center gap-2"><Badge variant={ratingVariant(f.rating)}>{f.rating.toUpperCase()}</Badge><span className="text-[11px] truncate">{f.title}</span></div>
                  {f.rating === "green" && f.file_path && signed[f.file_path] && <video src={signed[f.file_path]} controls muted playsInline className="w-full rounded" />}
                  {f.rating === "amber" && f.embed_url && <iframe src={f.embed_url} title={f.title} className="w-full aspect-video rounded" allow="encrypted-media; picture-in-picture" allowFullScreen />}
                  <p className="text-[10px] text-muted-foreground">{f.rating === "green" ? `Goes into the downloadable broadcast. ${f.attribution ?? ""}` : f.rating === "amber" ? "Embed only — shown through YouTube's player, never in the downloaded video." : "Blocked — not authorised for reuse."}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium">Sources</p>
            {(current.sources ?? []).map((s: Row) => (
              <div key={s.story_id} className="text-[11px]">
                <p className="font-medium">{s.headline} <span className="text-muted-foreground">— {VERIFICATION_LABEL[s.verification as Verification] ?? s.verification}</span></p>
                <ul className="pl-3">{(s.links ?? []).map((l: Row) => <li key={l.url}><a className="text-primary inline-flex items-center gap-1" href={l.url} target="_blank" rel="noreferrer">{l.publisher}: {l.title}<ExternalLink className="w-3 h-3" /></a></li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <Tabs defaultValue="stories">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="stories">Stories</TabsTrigger>
          <TabsTrigger value="broadcasts">Broadcasts</TabsTrigger>
          <TabsTrigger value="footage">Footage rights</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="log">Log</TabsTrigger>
        </TabsList>

        <TabsContent value="stories" className="space-y-2">
          {stories.length === 0 && <p className="text-xs text-muted-foreground">No stories yet — press Scan News Now.</p>}
          {stories.slice(0, 30).map((s) => (
            <div key={s.id} className="rounded-lg border border-border p-2 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={s.verification === "corroborated" ? "default" : s.verification === "conflicting" || s.verification === "corrected_or_withdrawn" ? "destructive" : "secondary"}>{VERIFICATION_LABEL[s.verification as Verification] ?? s.verification}</Badge>
                {s.is_breaking && <Badge variant="destructive">Breaking</Badge>}
                <span className="text-[10px] text-muted-foreground">{s.source_count} outlet{s.source_count === 1 ? "" : "s"}{s.official_count ? ` · ${s.official_count} official` : ""} · {s.region === "au" ? "Australia" : "World"} · score {s.importance} · {s.status}</span>
              </div>
              <p className="text-sm">{s.headline}</p>
              {s.summary && <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{s.summary}</p>}
              {s.conflicts && <p className="text-[11px] text-destructive">Conflict: {s.conflicts}</p>}
              <div className="flex gap-2">
                {s.status !== "dismissed"
                  ? <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => act("set_story_status", { story_id: s.id, status: "dismissed" }, "dismiss")}>Leave out</Button>
                  : <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => act("set_story_status", { story_id: s.id, status: "new" }, "restore")}>Put back</Button>}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="broadcasts" className="space-y-2">
          {broadcasts.length === 0 && <p className="text-xs text-muted-foreground">No broadcasts yet — press Generate Script.</p>}
          {broadcasts.map((b) => (
            <div key={b.id} className={`rounded-lg border p-2 flex flex-wrap items-center gap-2 ${current?.id === b.id ? "border-primary" : "border-border"}`}>
              <button type="button" className="flex-1 min-w-0 text-left" onClick={() => setSelectedId(b.id)}>
                <p className="text-sm truncate">{b.title}</p>
                <p className="text-[10px] text-muted-foreground">{b.edition_date} · {b.kind} · {STATUS_LABEL[b.status] ?? b.status} · {b.story_ids?.length ?? 0} stories · ~{Math.round((b.duration_seconds ?? 0) / 60)} min</p>
              </button>
              {b.status === "published" && <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => act("unpublish", { broadcast_id: b.id }, "unpublish")}>Unpublish</Button>}
              <Button size="icon" variant="ghost" aria-label="Delete broadcast" disabled={!!busy} onClick={() => { if (confirm("Delete this broadcast and its video?")) void act("delete_broadcast", { broadcast_id: b.id }, "delete"); }}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="footage" className="space-y-2">
          <p className="text-[11px] text-muted-foreground">GREEN = approved for commercial use and goes into downloads (e.g. NASA public domain). AMBER = embed only or waiting for permission. RED = not allowed. Short clips are never assumed legal, and the news-reporting exception is never applied automatically.</p>
          <div className="rounded-lg border border-border p-2 space-y-2">
            <p className="text-xs font-medium flex items-center gap-1"><Plus className="w-3 h-3" /> Add a video page you want to use</p>
            <Input placeholder="https://… (official YouTube or other video page)" value={newFootage.url} onChange={(e) => setNewFootage({ ...newFootage, url: e.target.value })} />
            <Input placeholder="Title" value={newFootage.title} onChange={(e) => setNewFootage({ ...newFootage, title: e.target.value })} />
            <select className="w-full rounded-md border border-input bg-background p-2 text-xs" value={newFootage.story_id} onChange={(e) => setNewFootage({ ...newFootage, story_id: e.target.value })}>
              <option value="">Not linked to a story</option>
              {stories.slice(0, 30).map((s) => <option key={s.id} value={s.id}>{s.headline.slice(0, 80)}</option>)}
            </select>
            <Button size="sm" disabled={!!busy || !newFootage.url.startsWith("https://") || newFootage.title.length < 2} onClick={async () => { await act("add_footage", { url: newFootage.url, title: newFootage.title, story_id: newFootage.story_id || null }, "add footage"); setNewFootage({ url: "", title: "", story_id: "" }); }}>Add to register</Button>
          </div>
          {footage.map((f) => (
            <div key={f.id} className="rounded-lg border border-border p-2 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={ratingVariant(f.rating)}>{f.rating.toUpperCase()}</Badge>
                <a href={f.url} target="_blank" rel="noreferrer" className="text-xs text-primary truncate max-w-full">{f.title}</a>
              </div>
              <p className="text-[10px] text-muted-foreground">Owner: {f.copyright_owner ?? "unknown"} · Licence: {f.licence ?? "unknown"} · Commercial: {f.commercial_use ? "yes" : "no"} · Editing: {f.editing_allowed ? "yes" : "no"} · Credit: {f.attribution ?? "—"} · Expires: {f.permission_expiry ?? "—"} · Status: {f.approval_status}</p>
              {editing?.id === f.id ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <Input placeholder="Copyright owner" value={editing.copyright_owner ?? ""} onChange={(e) => setEditing({ ...editing, copyright_owner: e.target.value })} />
                  <Input placeholder="Licence" value={editing.licence ?? ""} onChange={(e) => setEditing({ ...editing, licence: e.target.value })} />
                  <Input placeholder="Attribution / credit" value={editing.attribution ?? ""} onChange={(e) => setEditing({ ...editing, attribution: e.target.value })} />
                  <Input type="date" value={editing.permission_expiry ?? ""} onChange={(e) => setEditing({ ...editing, permission_expiry: e.target.value })} />
                  <label className="flex items-center gap-2 text-xs"><Switch checked={!!editing.commercial_use} onCheckedChange={(v) => setEditing({ ...editing, commercial_use: v })} /> Commercial use allowed</label>
                  <label className="flex items-center gap-2 text-xs"><Switch checked={!!editing.editing_allowed} onCheckedChange={(v) => setEditing({ ...editing, editing_allowed: v })} /> Editing allowed</label>
                  <select className="rounded-md border border-input bg-background p-2 text-xs" value={editing.approval_status} onChange={(e) => setEditing({ ...editing, approval_status: e.target.value })}>
                    {["pending", "requested", "approved", "denied", "embed_only", "public_domain"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                  </select>
                  <Input placeholder="Notes (e.g. where permission was given)" value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
                  <div className="flex gap-2"><Button size="sm" onClick={saveRights} disabled={!!busy}>Save</Button><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
                </div>
              ) : <Button size="sm" variant="ghost" onClick={() => setEditing({ ...f })}><ShieldCheck className="w-4 h-4 mr-1" /> Edit rights</Button>}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="sources" className="space-y-2">
          {sources.map((s) => (
            <div key={s.id} className="rounded-lg border border-border p-2 flex items-start gap-2">
              <Switch checked={s.enabled} onCheckedChange={(v) => act("toggle_source", { source_id: s.id, enabled: v }, "toggle")} aria-label={`Use ${s.name}`} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">{s.name} <Badge variant={s.last_status === "ok" ? "default" : s.last_status === "never" ? "outline" : "destructive"} className="ml-1">{s.last_status === "ok" ? "Working" : s.last_status === "never" ? "Not checked" : "Unavailable"}</Badge></p>
                <p className="text-[10px] text-muted-foreground">{s.region === "au" ? "Australia" : "World"} · {s.publisher_type === "official" ? "Official" : "Publisher"} · last OK {when(s.last_ok_at)} · {s.items_last} headlines</p>
                {s.last_error && <p className="text-[10px] text-destructive break-words">{s.last_error}</p>}
              </div>
            </div>
          ))}
          <div className="rounded-lg border border-border p-2 space-y-2">
            <p className="text-xs font-medium flex items-center gap-1"><Plus className="w-3 h-3" /> Add a public RSS feed</p>
            <Input placeholder="Name" value={newSource.name} onChange={(e) => setNewSource({ ...newSource, name: e.target.value })} />
            <Input placeholder="https://…/rss.xml" value={newSource.url} onChange={(e) => setNewSource({ ...newSource, url: e.target.value })} />
            <div className="flex flex-wrap gap-2">
              <select className="rounded-md border border-input bg-background p-2 text-xs" value={newSource.region} onChange={(e) => setNewSource({ ...newSource, region: e.target.value })}><option value="au">Australia</option><option value="intl">World</option></select>
              <select className="rounded-md border border-input bg-background p-2 text-xs" value={newSource.publisher_type} onChange={(e) => setNewSource({ ...newSource, publisher_type: e.target.value })}><option value="publisher">Publisher</option><option value="official">Official / government</option></select>
              <Input className="w-40" placeholder="Category" value={newSource.category} onChange={(e) => setNewSource({ ...newSource, category: e.target.value })} />
            </div>
            <Button size="sm" disabled={!!busy || newSource.name.length < 2 || !newSource.url.startsWith("https://")} onClick={async () => { await act("add_source", { ...newSource, kind: "rss" }, "add source"); setNewSource({ ...newSource, name: "", url: "" }); }}>Add source</Button>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-3">
          {settings && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="space-y-1">Production mode
                <select className="w-full rounded-md border border-input bg-background p-2" value={settings.mode} onChange={(e) => setSettings({ ...settings, mode: e.target.value })}>
                  <option value="automatic">Automatic — script approved straight away</option>
                  <option value="approval">Approval — I approve each script</option>
                  <option value="manual">Manual — research only, I start scripts</option>
                </select>
              </label>
              <label className="space-y-1">Stories per broadcast<Input type="number" min={1} max={12} value={settings.story_count} onChange={(e) => setSettings({ ...settings, story_count: Number(e.target.value) })} /></label>
              <label className="space-y-1">Broadcast length (minutes)<Input type="number" min={1} max={20} value={settings.duration_minutes} onChange={(e) => setSettings({ ...settings, duration_minutes: Number(e.target.value) })} /></label>
              <label className="space-y-1">Australian stories (%)<Input type="number" min={0} max={100} value={settings.au_share} onChange={(e) => setSettings({ ...settings, au_share: Number(e.target.value) })} /></label>
              <label className="space-y-1 sm:col-span-2">Categories (comma separated)<Input value={(settings.categories ?? []).join(", ")} onChange={(e) => setSettings({ ...settings, categories: e.target.value.split(",").map((c: string) => c.trim().toLowerCase()).filter(Boolean) })} /></label>
              <label className="flex items-center gap-2"><Switch checked={!!settings.breaking_priority} onCheckedChange={(v) => setSettings({ ...settings, breaking_priority: v })} /> Put breaking news first</label>
              <div><Button size="sm" disabled={!!busy} onClick={() => act("save_settings", { mode: settings.mode, story_count: settings.story_count, duration_minutes: settings.duration_minutes, au_share: settings.au_share, breaking_priority: !!settings.breaking_priority, categories: settings.categories ?? [] }, "save settings")}>Save settings</Button></div>
              <p className="sm:col-span-2 text-[11px] text-muted-foreground">Oracle checks the feeds once an hour (breaking news alerts appear in your owner alerts). Filming needs this studio open, because videos are filmed in your browser.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="log" className="space-y-1">
          {runs.map((r) => (
            <div key={r.id} className="text-[11px] flex flex-wrap gap-2 border-b border-border py-1">
              <span className="text-muted-foreground">{when(r.started_at)}</span>
              <span className="font-medium">{r.step}</span>
              <Badge variant={r.status === "ok" ? "default" : r.status === "failed" ? "destructive" : "secondary"}>{r.status}</Badge>
              <span className="text-muted-foreground">{r.trigger}</span>
              {r.error && <span className="text-destructive break-words w-full">{r.error}</span>}
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default NewsControlRoom;
