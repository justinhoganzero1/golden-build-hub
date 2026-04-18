import { useEffect, useState } from "react";
import { Youtube, Search, Sparkles, Mic, Film, Image as ImageIcon, ExternalLink, Plus, Trash2, Loader2, Tv, Megaphone } from "lucide-react";
import { Link } from "react-router-dom";
import UniversalBackButton from "@/components/UniversalBackButton";
import PaywallGate from "@/components/PaywallGate";
import SEO from "@/components/SEO";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSavedVoices } from "@/hooks/useSavedVoices";
import MovieStudio from "@/components/MovieStudio";

interface YTItem {
  videoId: string | null;
  channelId: string | null;
  title: string;
  channelTitle: string;
  thumbnail: string | null;
  publishedAt: string | null;
  description: string;
  url: string;
}

const STORAGE_KEY = "yt_show_studio_state_v1";

interface ShowState {
  channelName: string;
  showTitle: string;
  hostStyle: string;
  topic: string;
  script: string;
  shoutouts: string[];
  picks: YTItem[];
  voiceId: string | null;
  voiceName: string | null;
}

const DEFAULT_STATE: ShowState = {
  channelName: "",
  showTitle: "",
  hostStyle: "Energetic news anchor",
  topic: "",
  script: "",
  shoutouts: [],
  picks: [],
  voiceId: null,
  voiceName: null,
};

const YouTubeShowStudioPage = () => {
  const [state, setState] = useState<ShowState>(DEFAULT_STATE);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<YTItem[]>([]);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const { voices: savedVoices } = useSavedVoices();

  // hydrate
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...DEFAULT_STATE, ...JSON.parse(raw) });
    } catch { /* ignore */ }
  }, []);

  // persist
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  const update = (patch: Partial<ShowState>) => setState((s) => ({ ...s, ...patch }));

  const searchYouTube = async () => {
    const q = searchQuery.trim() || state.topic.trim();
    if (!q) { toast.error("Enter a topic or search term first"); return; }
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("youtube-search", {
        body: { query: q, maxResults: 12 },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResults(((data as any)?.items ?? []) as YTItem[]);
      if (((data as any)?.items ?? []).length === 0) toast.info("No results for that query");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "YouTube search failed");
    } finally {
      setSearching(false);
    }
  };

  const togglePick = (item: YTItem) => {
    setState((s) => {
      const exists = s.picks.find((p) => p.url === item.url);
      const picks = exists ? s.picks.filter((p) => p.url !== item.url) : [...s.picks, item];
      // Auto-add channel as a shoutout
      let shoutouts = s.shoutouts;
      if (!exists && item.channelTitle && !shoutouts.includes(item.channelTitle)) {
        shoutouts = [...shoutouts, item.channelTitle];
      }
      return { ...s, picks, shoutouts };
    });
  };

  const removeShoutout = (name: string) => {
    update({ shoutouts: state.shoutouts.filter((n) => n !== name) });
  };

  const generateScript = async () => {
    if (!state.topic.trim()) { toast.error("Enter a show topic first"); return; }
    setGeneratingScript(true);
    try {
      const refList = state.picks
        .map((p, i) => `${i + 1}. "${p.title}" by ${p.channelTitle} — ${p.url}`)
        .join("\n");
      const shoutList = state.shoutouts.join(", ");
      const prompt = `You are writing a YouTube show script for the channel "${state.channelName || "My Channel"}".
Show title: ${state.showTitle || state.topic}
Host persona: ${state.hostStyle}
Topic: ${state.topic}

Reference videos to mention or react to (give credit and weave them in naturally):
${refList || "(none)"}

Channel shoutouts to include: ${shoutList || "(none)"}

Rules:
- Open with a punchy hook (1-2 sentences).
- Include a clear "subscribe & like" call-to-action early.
- Cover 4-6 key beats about the topic.
- For each reference video, briefly summarize and credit the source channel by name.
- Add genuine shoutouts to the listed channels.
- End with an outro inviting comments and a teaser for the next episode.
- Output PLAIN TEXT only — no markdown, no stage directions in brackets, ready to be read aloud by AI narration.
- Target length: ~350-500 words.`;

      const { data, error } = await supabase.functions.invoke("oracle-chat", {
        body: { messages: [{ role: "user", content: prompt }] },
      });
      if (error) throw error;
      const text = (data as any)?.reply || (data as any)?.message || (data as any)?.content || "";
      if (!text) throw new Error("No script returned");
      update({ script: text });
      toast.success("Script generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Script generation failed");
    } finally {
      setGeneratingScript(false);
    }
  };

  const sendToMovieStudio = () => {
    if (!state.script.trim()) { toast.error("Generate or paste a script first"); return; }
    // MovieStudio reads from localStorage seed
    try {
      localStorage.setItem("movie_studio_seed_script", state.script);
      localStorage.setItem("movie_studio_seed_intent", `YouTube show: ${state.showTitle || state.topic}`);
    } catch { /* ignore */ }
    setStudioOpen(true);
  };

  return (
    <PaywallGate requiredTier="monthly" featureName="YouTube Show Studio">
      <SEO
        title="YouTube Show Studio — AI-Hosted Channel Creator"
        description="Plan, script, narrate, and produce full AI-hosted YouTube shows with related-clip discovery and channel shoutouts."
      />
      <div className="min-h-screen bg-background pb-24">
        <UniversalBackButton />
        <div className="max-w-5xl mx-auto px-4 pt-14 pb-4 space-y-5">
          {/* Header */}
          <header className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10"><Youtube className="w-7 h-7 text-primary" /></div>
            <div>
              <h1 className="text-xl font-bold text-primary">YouTube Show Studio</h1>
              <p className="text-muted-foreground text-xs">
                Build a fully AI-hosted YouTube channel — script, narrate, render, and credit your sources.
              </p>
            </div>
          </header>

          {/* Channel + Show identity */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Tv className="w-4 h-4 text-primary" /> Channel & Episode
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Channel name</label>
                <Input value={state.channelName} onChange={(e) => update({ channelName: e.target.value })} placeholder="e.g. Solace Daily" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Episode / show title</label>
                <Input value={state.showTitle} onChange={(e) => update({ showTitle: e.target.value })} placeholder="e.g. The 5 AI Tools Changing Everything" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Host persona</label>
                <Input value={state.hostStyle} onChange={(e) => update({ hostStyle: e.target.value })} placeholder="Energetic news anchor / Calm documentary narrator…" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Topic</label>
                <Input value={state.topic} onChange={(e) => update({ topic: e.target.value })} placeholder="What is this episode about?" />
              </div>
            </div>
          </Card>

          {/* YouTube research */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Search className="w-4 h-4 text-primary" /> Find related & similar videos
            </div>
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={state.topic ? `Search YouTube (default: "${state.topic}")` : "Search YouTube…"}
                onKeyDown={(e) => { if (e.key === "Enter") searchYouTube(); }}
              />
              <Button onClick={searchYouTube} disabled={searching}>
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            {results.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Tip: Tap a result to add it as a reference clip — its channel is auto-added as a shoutout.
              </p>
            )}
            {results.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {results.map((r) => {
                  const picked = !!state.picks.find((p) => p.url === r.url);
                  return (
                    <button
                      key={r.url}
                      onClick={() => togglePick(r)}
                      className={`text-left rounded-lg overflow-hidden border transition ${picked ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50"}`}
                    >
                      {r.thumbnail && <img src={r.thumbnail} alt={r.title} className="w-full aspect-video object-cover" loading="lazy" />}
                      <div className="p-2">
                        <p className="text-xs font-medium line-clamp-2">{r.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{r.channelTitle}</p>
                        {picked && <Badge className="mt-1" variant="default">Added</Badge>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Picked clips & shoutouts */}
          {(state.picks.length > 0 || state.shoutouts.length > 0) && (
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Megaphone className="w-4 h-4 text-primary" /> Picked clips & shoutouts
              </div>
              {state.picks.length > 0 && (
                <ul className="space-y-2">
                  {state.picks.map((p) => (
                    <li key={p.url} className="flex items-center gap-2 text-xs">
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-primary hover:underline">
                        {p.title} <ExternalLink className="inline w-3 h-3 ml-1" />
                      </a>
                      <span className="text-muted-foreground">{p.channelTitle}</span>
                      <Button size="sm" variant="ghost" onClick={() => togglePick(p)}><Trash2 className="w-3 h-3" /></Button>
                    </li>
                  ))}
                </ul>
              )}
              {state.shoutouts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {state.shoutouts.map((s) => (
                    <Badge key={s} variant="secondary" className="cursor-pointer" onClick={() => removeShoutout(s)}>
                      {s} ✕
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Voice selection */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Mic className="w-4 h-4 text-primary" /> Host narration voice
            </div>
            {savedVoices.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                No saved voices yet.{" "}
                <Link to="/voice-studio" className="text-primary underline">Open Voice Studio</Link> to build a host voice.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {savedVoices.map((v) => {
                  const id = (v.voice_config as any)?.voice_id || v.id;
                  const active = state.voiceId === id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => update({ voiceId: id, voiceName: v.name })}
                      className={`p-2 rounded-lg border text-left transition ${active ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                    >
                      <p className="text-xs font-medium truncate">{v.name}</p>
                      <p className="text-[10px] text-muted-foreground">{v.profession || v.voice_style || "Custom voice"}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Script */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="w-4 h-4 text-primary" /> Show script
              </div>
              <Button size="sm" onClick={generateScript} disabled={generatingScript}>
                {generatingScript ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
                AI Generate
              </Button>
            </div>
            <Textarea
              value={state.script}
              onChange={(e) => update({ script: e.target.value })}
              placeholder="Your AI-hosted script will appear here. You can also paste your own."
              className="min-h-[220px] text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              The script automatically credits picked clips and includes your shoutouts.
            </p>
          </Card>

          {/* Produce */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Film className="w-4 h-4 text-primary" /> Produce the episode
            </div>
            <p className="text-xs text-muted-foreground">
              Send the script into Movie Studio Pro to auto-generate scenes, AI imagery, narration, music, and export an MP4 ready for YouTube.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={sendToMovieStudio} disabled={!state.script.trim()}>
                <Film className="w-4 h-4 mr-1" /> Open in Movie Studio
              </Button>
              <Button variant="outline" asChild>
                <Link to="/photography">
                  <ImageIcon className="w-4 h-4 mr-1" /> Make a thumbnail
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/voice-studio">
                  <Mic className="w-4 h-4 mr-1" /> Tune host voice
                </Link>
              </Button>
            </div>
          </Card>
        </div>

        <MovieStudio open={studioOpen} onOpenChange={setStudioOpen} onBalanceChange={() => { /* refresh handled inside */ }} />
      </div>
    </PaywallGate>
  );
};

export default YouTubeShowStudioPage;
