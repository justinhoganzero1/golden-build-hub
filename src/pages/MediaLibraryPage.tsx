import { Camera, Image, Video, Music, Grid, List, Search, Play, Download, Trash2, Eye, Share2, Sparkles, Palette, User, MessageSquare, Mic, Film, FileText, FolderOpen, Star, Clock, ArrowRight, Wand2, Globe, Layers } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useUserMedia } from "@/hooks/useUserAvatars";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import ShareDialog from "@/components/ShareDialog";

/* ── Source-based collection config ── */
const COLLECTIONS = [
  { key: "all",           label: "All Creations",                             icon: Layers,        color: "from-amber-500/20 to-yellow-500/20", accent: "text-amber-400", border: "border-amber-500/30" },
  { key: "avatar",        label: "Avatars",                                   icon: User,          color: "from-violet-500/20 to-purple-500/20", accent: "text-violet-400", border: "border-violet-500/30" },
  { key: "photography",   label: "SOLACE AI Photographic Masterpiece Studio", icon: Camera,        color: "from-sky-500/20 to-cyan-500/20", accent: "text-sky-400", border: "border-sky-500/30" },
  { key: "apps",          label: "Apps",                                      icon: Globe,         color: "from-lime-500/20 to-emerald-500/20", accent: "text-lime-400", border: "border-lime-500/30" },
  { key: "ai-studio",     label: "AI Studio",                                icon: Sparkles,      color: "from-pink-500/20 to-rose-500/20", accent: "text-pink-400", border: "border-pink-500/30" },
  { key: "magic-hub",     label: "Magic Hub",                                icon: Wand2,         color: "from-emerald-500/20 to-green-500/20", accent: "text-emerald-400", border: "border-emerald-500/30" },
  { key: "video-editor",  label: "Video Editor",                             icon: Film,          color: "from-orange-500/20 to-amber-500/20", accent: "text-orange-400", border: "border-orange-500/30" },
  { key: "voice-studio",  label: "Voice Studio",                             icon: Mic,           color: "from-teal-500/20 to-cyan-500/20", accent: "text-teal-400", border: "border-teal-500/30" },
  { key: "oracle",        label: "Oracle",                                   icon: Globe,         color: "from-yellow-500/20 to-amber-500/20", accent: "text-yellow-400", border: "border-yellow-500/30" },
  { key: "live-vision",   label: "Live Vision",                              icon: Eye,           color: "from-indigo-500/20 to-blue-500/20", accent: "text-indigo-400", border: "border-indigo-500/30" },
  { key: "other",         label: "Other",                                    icon: FileText,      color: "from-zinc-500/20 to-slate-500/20", accent: "text-zinc-400", border: "border-zinc-500/30" },
] as const;

const TYPE_FILTERS = [
  { key: "all",    label: "All Types", icon: Layers },
  { key: "image",  label: "Images",    icon: Image },
  { key: "video",  label: "Videos",    icon: Video },
  { key: "audio",  label: "Audio",     icon: Music },
] as const;

/* ── Map source_page strings to collection keys ── */
function getCollectionKey(sourcePage: string | null): string {
  if (!sourcePage) return "other";
  const s = sourcePage.toLowerCase();
  if (s.includes("avatar")) return "avatar";
  if (s.includes("photo")) return "photography";
  if (s.includes("app-builder") || s.includes("app builder")) return "apps";
  if (s.includes("studio") && !s.includes("voice")) return "ai-studio";
  if (s.includes("magic")) return "magic-hub";
  if (s.includes("video")) return "video-editor";
  if (s.includes("voice")) return "voice-studio";
  if (s.includes("oracle")) return "oracle";
  if (s.includes("vision")) return "live-vision";
  return "other";
}

const MediaLibraryPage = () => {
  const { data: mediaItems = [], isLoading } = useUserMedia();
  const qc = useQueryClient();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [activeCollection, setActiveCollection] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [shareItem, setShareItem] = useState<any>(null);
  const [showCollections, setShowCollections] = useState(true);

  /* ── Counts per collection ── */
  const collectionCounts = useMemo(() => {
    const counts: Record<string, number> = { all: mediaItems.length };
    mediaItems.forEach((m: any) => {
      const key = getCollectionKey(m.source_page);
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [mediaItems]);

  /* ── Filtering ── */
  const filtered = useMemo(() => {
    return mediaItems.filter((m: any) => {
      if (activeCollection !== "all" && getCollectionKey(m.source_page) !== activeCollection) return false;
      if (typeFilter !== "all" && m.media_type !== typeFilter) return false;
      if (search && !(m.title || "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [mediaItems, activeCollection, typeFilter, search]);

  /* ── Recent & starred ── */
  const recentItems = useMemo(() => {
    return [...mediaItems].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6);
  }, [mediaItems]);

  const getMediaIcon = (type: string) => {
    if (type === "image") return <Image className="w-5 h-5 text-primary" />;
    if (type === "video") return <Video className="w-5 h-5 text-primary" />;
    return <Music className="w-5 h-5 text-primary" />;
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("user_media").delete().eq("id", id);
    if (!error) {
      toast.success("Deleted");
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["user-media"] });
    }
  };

  const activeCol = COLLECTIONS.find(c => c.key === activeCollection) || COLLECTIONS[0];

  return (
    <div className="min-h-screen bg-background pb-24">
      <UniversalBackButton />

      {/* ── Header ── */}
      <div className="px-4 pt-14 pb-2">
        <div className="flex items-center gap-3 mb-1">
          <div className="relative">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-primary/20 to-amber-500/20 border border-primary/30">
              <FolderOpen className="w-7 h-7 text-primary" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-primary-foreground" />
            </div>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground tracking-tight">My Library</h1>
            <p className="text-muted-foreground text-xs">{mediaItems.length} creations across {Object.keys(collectionCounts).length - 1} collections</p>
          </div>
          <button onClick={() => setView(view === "grid" ? "list" : "grid")}
            className="p-2.5 rounded-xl bg-card border border-border hover:border-primary/50 transition-all">
            {view === "grid" ? <List className="w-4 h-4 text-primary" /> : <Grid className="w-4 h-4 text-primary" />}
          </button>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="px-4 mb-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search all creations..."
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors" />
        </div>
      </div>

      {/* ── Collection Cards (App Faces) ── */}
      <div className="px-4 mb-4">
        <button onClick={() => setShowCollections(!showCollections)}
          className="flex items-center gap-2 mb-2 text-xs text-muted-foreground hover:text-primary transition-colors">
          <FolderOpen className="w-3.5 h-3.5" />
          <span className="font-medium">Collections</span>
          <ArrowRight className={`w-3 h-3 transition-transform ${showCollections ? "rotate-90" : ""}`} />
        </button>

        {showCollections && (
          <div className="grid grid-cols-2 gap-2">
            {COLLECTIONS.map(col => {
              const count = collectionCounts[col.key] || 0;
              const isActive = activeCollection === col.key;
              const ColIcon = col.icon;
              return (
                <button key={col.key} onClick={() => setActiveCollection(col.key)}
                  className={`holo-tile relative rounded-2xl p-3 text-left ${
                    isActive
                      ? `bg-gradient-to-br ${col.color} ${col.border} shadow-lg shadow-primary/5 scale-[1.02]`
                      : ""
                  }`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`holo-icon p-1.5 rounded-xl ${isActive ? `bg-gradient-to-br ${col.color}` : "bg-muted/50"}`}>
                      <ColIcon className={`w-4 h-4 ${isActive ? col.accent : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{col.label}</p>
                      <p className={`text-[10px] ${isActive ? col.accent : "text-muted-foreground/60"}`}>
                        {col.key === "all" ? `${mediaItems.length} total` : `${count} item${count !== 1 ? "s" : ""}`}
                      </p>
                    </div>
                  </div>
                  {isActive && (
                    <div className="absolute top-1 right-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Type filter pills ── */}
      <div className="px-4 mb-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {TYPE_FILTERS.map(f => {
            const FIcon = f.icon;
            return (
              <button key={f.key} onClick={() => setTypeFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all ${
                  typeFilter === f.key
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "bg-card border border-border text-muted-foreground hover:border-primary/40"
                }`}>
                <FIcon className="w-3 h-3" />
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Recent strip (only on "All") ── */}
      {activeCollection === "all" && recentItems.length > 0 && !search && (
        <div className="px-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">Recent Creations</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {recentItems.map((m: any) => (
              <button key={m.id} onClick={() => setSelected(m)}
                className="flex-shrink-0 w-20 h-20 rounded-2xl overflow-hidden border border-border hover:border-primary/50 transition-all bg-card">
                {m.media_type === "image" && m.url ? (
                  <img src={m.url} alt={m.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                    {getMediaIcon(m.media_type)}
                    <p className="text-[8px] text-muted-foreground truncate w-full text-center px-1">{m.title}</p>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Active collection header ── */}
      {activeCollection !== "all" && (
        <div className="px-4 mb-3">
          <div className={`flex items-center gap-2 p-2 rounded-xl bg-gradient-to-r ${activeCol.color} border ${activeCol.border}`}>
            <activeCol.icon className={`w-4 h-4 ${activeCol.accent}`} />
            <span className="text-sm font-semibold text-foreground">{activeCol.label}</span>
            <span className={`text-xs ml-auto ${activeCol.accent}`}>{filtered.length} items</span>
          </div>
        </div>
      )}

      {/* ── Content Grid / List ── */}
      <div className="px-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-primary/10 to-amber-500/10 border border-primary/20 flex items-center justify-center">
              <activeCol.icon className={`w-8 h-8 ${activeCol.accent}`} />
            </div>
            <p className="text-foreground text-sm font-medium mb-1">No creations yet</p>
            <p className="text-muted-foreground text-xs max-w-[200px] mx-auto">
              {activeCollection === "all"
                ? "Use any app in Solace to create content — it all appears here automatically."
                : `Create something in ${activeCol.label} and it'll show up here.`}
            </p>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-3 gap-2">
            {filtered.map((m: any) => (
              <button key={m.id} onClick={() => setSelected(m)}
                className="group aspect-square bg-card border border-border rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 relative">
                {m.media_type === "image" && m.url ? (
                  <>
                    <img src={m.url} alt={m.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-1 left-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-[8px] text-white truncate font-medium">{m.title || "Untitled"}</p>
                    </div>
                  </>
                ) : (
                  <>
                    {getMediaIcon(m.media_type)}
                    <p className="text-[9px] text-muted-foreground truncate w-full text-center px-1">{m.title}</p>
                  </>
                )}
                {/* Source badge */}
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="px-1 py-0.5 rounded bg-black/50 backdrop-blur-sm">
                    <p className="text-[7px] text-white/80">{m.source_page || "—"}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((m: any) => {
              const colKey = getCollectionKey(m.source_page);
              const col = COLLECTIONS.find(c => c.key === colKey) || COLLECTIONS[COLLECTIONS.length - 1];
              return (
                <button key={m.id} onClick={() => setSelected(m)}
                  className="w-full flex items-center gap-3 bg-card border border-border rounded-2xl p-3 hover:border-primary/40 hover:shadow-md transition-all text-left group">
                  {m.media_type === "image" && m.url ? (
                    <img src={m.url} alt={m.title} className="w-14 h-14 rounded-xl object-cover border border-border" />
                  ) : (
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${col.color} border ${col.border} flex items-center justify-center`}>
                      {getMediaIcon(m.media_type)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium truncate">{m.title || "Untitled"}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full bg-gradient-to-r ${col.color} ${col.accent} font-medium`}>{col.label}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(m.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Detail dialog ── */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-[95vw] rounded-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">{selected?.title || "Creation"}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 mt-2">
              <div className="aspect-video bg-secondary rounded-2xl flex items-center justify-center overflow-hidden border border-border">
                {selected.media_type === "image" && selected.url ? (
                  <img src={selected.url} alt={selected.title} className="w-full h-full object-contain" />
                ) : selected.media_type === "video" ? (
                  <div className="text-center">
                    <Play className="w-12 h-12 text-primary mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Tap to play</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Music className="w-12 h-12 text-primary mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Audio file</p>
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="flex items-center gap-2 flex-wrap">
                {(() => {
                  const colKey = getCollectionKey(selected.source_page);
                  const col = COLLECTIONS.find(c => c.key === colKey) || COLLECTIONS[COLLECTIONS.length - 1];
                  return (
                    <span className={`text-[10px] px-2 py-1 rounded-full bg-gradient-to-r ${col.color} ${col.accent} font-medium border ${col.border}`}>
                      {col.label}
                    </span>
                  );
                })()}
                <span className="text-[10px] text-muted-foreground px-2 py-1 rounded-full bg-muted/50">
                  {selected.media_type}
                </span>
                <span className="text-[10px] text-muted-foreground px-2 py-1 rounded-full bg-muted/50">
                  {new Date(selected.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className="flex gap-2">
                <button onClick={() => {
                  if (selected.url) {
                    const a = document.createElement("a");
                    a.href = selected.url;
                    a.download = selected.title || "media";
                    a.click();
                  }
                  toast.success("Downloaded!");
                }}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center gap-2 shadow-md shadow-primary/20">
                  <Download className="w-4 h-4" /> Download
                </button>
                <button onClick={() => setShareItem(selected)}
                  className="py-2.5 px-4 rounded-xl bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/80 transition-colors">
                  <Share2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(selected.id)}
                  className="py-2.5 px-4 rounded-xl bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ShareDialog
        open={!!shareItem}
        onOpenChange={() => setShareItem(null)}
        title={shareItem?.title || "Media"}
        url={shareItem?.url}
        imageUrl={shareItem?.url}
        description={`Check out this ${shareItem?.media_type || "media"} from Solace!`}
      />
    </div>
  );
};

export default MediaLibraryPage;
