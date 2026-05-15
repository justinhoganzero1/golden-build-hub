import { Camera, Image, Video, Music, Grid, List, Search, Play, Download, Trash2, Eye, Share2, Sparkles, Palette, User, MessageSquare, Mic, Film, FileText, FolderOpen, Star, Clock, ArrowRight, Wand2, Globe, Layers, Globe2, ShoppingBag, DollarSign } from "lucide-react";
import SEO from "@/components/SEO";
import { Link } from "react-router-dom";
import UniversalBackButton from "@/components/UniversalBackButton";
import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useUserMedia } from "@/hooks/useUserAvatars";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import ShareDialog from "@/components/ShareDialog";
import { downloadFileFromUrl } from "@/lib/utils";

/* ── Source-based collection config ── */
const COLLECTIONS = [
  { key: "all",           label: "All Creations",                             icon: Layers },
  { key: "movies",        label: "Movies",                                    icon: Film },
  { key: "favourite-music", label: "Favourite Tracks",                        icon: Star },
  { key: "avatar",        label: "Avatars",                                   icon: User },
  { key: "photography",   label: "ORACLE LUNAR AI Photographic Masterpiece Studio", icon: Camera },
  { key: "apps",          label: "Apps",                                      icon: Globe },
  { key: "ai-studio",     label: "AI Studio",                                icon: Sparkles },
  { key: "magic-hub",     label: "Magic Hub",                                icon: Wand2 },
  { key: "marketing-hub", label: "Marketing Hub",                            icon: Sparkles },
  { key: "video-editor",  label: "Video Editor",                             icon: Film },
  { key: "voice-studio",  label: "Voice Studio",                             icon: Mic },
  { key: "oracle",        label: "Oracle",                                   icon: Globe },
  { key: "live-vision",   label: "Live Vision",                              icon: Eye },
  { key: "other",         label: "Other",                                    icon: FileText },
] as const;

const TYPE_FILTERS = [
  { key: "all",    label: "All Types", icon: Layers },
  { key: "image",  label: "Images",    icon: Image },
  { key: "video",  label: "Videos",    icon: Video },
  { key: "audio",  label: "Audio",     icon: Music },
] as const;

/* ── Map source_page (and metadata) to collection keys ── */
function getCollectionKey(sourcePage: string | null, mediaType?: string, metadata?: any): string {
  // Movies: any video from Movie Studio
  if (mediaType === "video" && (sourcePage || "").toLowerCase().includes("movie")) return "movies";
  // Favourite music tracks: explicitly tagged
  if (metadata?.favourite === true || (sourcePage || "").toLowerCase() === "favourite-music") return "favourite-music";
  if (!sourcePage) return "other";
  const s = sourcePage.toLowerCase();
  if (s.includes("avatar")) return "avatar";
  if (s.includes("photo")) return "photography";
  if (s.includes("app-builder") || s.includes("app builder")) return "apps";
  if (s.includes("movie")) return "movies"; // catch-all for movie-studio assets
  if (s.includes("studio") && !s.includes("voice")) return "ai-studio";
  if (s.includes("magic")) return "magic-hub";
  if (s.includes("video")) return "video-editor";
  if (s.includes("voice")) return "voice-studio";
  if (s.includes("oracle")) return "oracle";
  if (s.includes("vision")) return "live-vision";
  return "other";
}

const MediaLibraryPage = () => {
  const { data: ownMedia = [], isLoading: ownLoading } = useUserMedia();
  const mediaItems = ownMedia;
  const isLoading = ownLoading;

  const qc = useQueryClient();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [activeCollection, setActiveCollection] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [shareItem, setShareItem] = useState<any>(null);
  const [showCollections, setShowCollections] = useState(true);
  const [savingShare, setSavingShare] = useState(false);
  const [priceInput, setPriceInput] = useState<string>("");

  // Sync price input with selected item
  useEffect(() => {
    if (selected) {
      const cents = selected.shop_price_cents || 0;
      setPriceInput(cents > 0 ? (cents / 100).toFixed(2) : "");
    }
  }, [selected]);

  const updateSelectedFlags = async (patch: { is_public?: boolean; shop_enabled?: boolean; shop_price_cents?: number }) => {
    if (!selected) return;
    setSavingShare(true);
    try {
      const { error } = await supabase
        .from("user_media")
        .update(patch)
        .eq("id", selected.id);
      if (error) throw error;
      setSelected({ ...selected, ...patch });
      qc.invalidateQueries({ queryKey: ["user-media"] });
      qc.invalidateQueries({ queryKey: ["all-user-media"] });
      qc.invalidateQueries({ queryKey: ["public-library"] });
      toast.success("Updated.");
    } catch (e: any) {
      toast.error(e?.message || "Could not update sharing settings.");
    } finally {
      setSavingShare(false);
    }
  };


  // Auto-refresh whenever any module saves something to the library
  useEffect(() => {
    const handler = () => {
      qc.invalidateQueries({ queryKey: ["user-media"] });
      qc.invalidateQueries({ queryKey: ["all-user-media"] });
    };
    window.addEventListener("library:updated", handler);
    return () => window.removeEventListener("library:updated", handler);
  }, [qc]);

  /* ── Counts per collection ── */
  const collectionCounts = useMemo(() => {
    const counts: Record<string, number> = { all: mediaItems.length };
    mediaItems.forEach((m: any) => {
      const key = getCollectionKey(m.source_page, m.media_type, m.metadata);
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [mediaItems]);

  /* ── Filtering ── */
  const filtered = useMemo(() => {
    return mediaItems.filter((m: any) => {
      if (activeCollection !== "all" && getCollectionKey(m.source_page, m.media_type, m.metadata) !== activeCollection) return false;
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
    if (type === "gif") return <Image className="w-5 h-5 text-primary" />;
    if (type === "video") return <Video className="w-5 h-5 text-primary" />;
    if (type === "text" || type === "document") return <FileText className="w-5 h-5 text-primary" />;
    if (type === "app") return <Globe className="w-5 h-5 text-primary" />;
    return <Music className="w-5 h-5 text-primary" />;
  };

  const isImageLike = (m: any) => (m.media_type === "image" || m.media_type === "gif") && !!m.url;
  const isVideoLike = (m: any) => m.media_type === "video" && !!m.url;

  const handleDownloadSelected = async () => {
    if (!selected?.url) return;
    try {
      if (selected.media_type === "text") {
        const blobUrl = URL.createObjectURL(new Blob([selected.url], { type: "text/plain" }));
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `${(selected.title || "library-note").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
      } else {
        await downloadFileFromUrl(selected.url, selected.title || "media");
      }
      toast.success("Downloaded!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to download media");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this item from your library?")) return;
    const { error } = await supabase.from("user_media").delete().eq("id", id);
    if (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete: " + error.message);
    } else {
      toast.success("Deleted");
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["user-media"] });
    }
  };

  const handleWipeAll = async () => {
    if (mediaItems.length === 0) {
      toast.info("Your library is already empty.");
      return;
    }
    const first = confirm(`Delete ALL ${mediaItems.length} items from your library? This cannot be undone.`);
    if (!first) return;
    const second = confirm("Are you absolutely sure? Everything in your library will be erased.");
    if (!second) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Sign in required"); return; }
    const { error } = await supabase.from("user_media").delete().eq("user_id", user.id);
    if (error) {
      console.error("Wipe error:", error);
      toast.error("Failed to wipe library: " + error.message);
    } else {
      toast.success("Library cleared");
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["user-media"] });
    }
  };

  const activeCol = COLLECTIONS.find(c => c.key === activeCollection) || COLLECTIONS[0];

  return (
    <div className="min-h-screen bg-background pb-24">
      <SEO title="Media Library — Your AI Creations | Oracle Lunar" description="All your AI photos, voices, avatars and videos saved in one place." path="/media-library" />
      <UniversalBackButton />

      {/* ── Header ── */}
      <div className="px-4 pt-14 pb-2">
        <div className="flex items-center gap-3 mb-1">
          <div className="relative">
            <div className="holo-bubble p-2.5 rounded-2xl border border-primary/30">
              <FolderOpen className="w-7 h-7 text-primary" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-primary-foreground" />
            </div>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
              My Library
            </h1>
            <p className="text-muted-foreground text-xs">
              {`${mediaItems.length} creations across ${Object.keys(collectionCounts).length - 1} collections`}
            </p>
          </div>
          <button onClick={handleWipeAll}
            title="Delete every item in my library"
            className="p-2.5 rounded-xl bg-card border border-border hover:border-destructive/60 hover:text-destructive transition-all">
            <Trash2 className="w-4 h-4" />
          </button>
          <Link to="/library/public"
            title="Browse the Public Library"
            className="p-2.5 rounded-xl bg-card border border-border hover:border-primary/50 transition-all">
            <Globe2 className="w-4 h-4 text-primary" />
          </Link>
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
                        ? "ring-1 ring-primary/50 shadow-lg shadow-primary/10 scale-[1.02]"
                      : ""
                  }`}>
                  <div className="flex items-center gap-2.5">
                      <div className={`holo-icon p-1.5 rounded-xl ${isActive ? "bg-primary/15" : "bg-muted/50"}`}>
                        <ColIcon className={`w-4 h-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{col.label}</p>
                        <p className={`text-[10px] ${isActive ? "text-primary" : "text-muted-foreground/60"}`}>
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
                {isImageLike(m) ? (
                  <img src={m.url} alt={m.title} className="w-full h-full object-cover" />
                ) : isVideoLike(m) ? (
                  <video src={m.url} poster={m.thumbnail_url || undefined} muted loop playsInline className="w-full h-full object-cover" />
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
          <div className="holo-card flex items-center gap-2 p-2 rounded-xl border border-primary/25">
            <activeCol.icon className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{activeCol.label}</span>
            <span className="text-xs ml-auto text-primary">{filtered.length} items</span>
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
            <div className="holo-card w-16 h-16 mx-auto mb-3 rounded-2xl border border-primary/20 flex items-center justify-center">
              <activeCol.icon className="w-8 h-8 text-primary" />
            </div>
            <p className="text-foreground text-sm font-medium mb-1">No creations yet</p>
            <p className="text-muted-foreground text-xs max-w-[200px] mx-auto">
              {activeCollection === "all"
                ? "Use any app in Oracle Lunar to create content — it all appears here automatically."
                : `Create something in ${activeCol.label} and it'll show up here.`}
            </p>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-3 gap-2">
            {filtered.map((m: any) => {
              const thumb = m.thumbnail_url || (m.metadata && (m.metadata.thumbnail || m.metadata.cover || m.metadata.poster || m.metadata.preview_url || m.metadata.image)) || null;
              const isAudio = m.media_type === "audio";
              const isText = m.media_type === "text" || m.media_type === "story" || m.media_type === "document";
              const isApp = m.media_type === "app";
              return (
              <button key={m.id} onClick={() => setSelected(m)}
                className="group aspect-square bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 relative">
                {isImageLike(m) ? (
                  <>
                    <img src={m.url} alt={m.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/0 to-transparent" />
                    <div className="absolute bottom-1 left-1.5 right-1.5">
                      <p className="text-[9px] text-foreground truncate font-medium drop-shadow">{m.title || "Untitled"}</p>
                    </div>
                  </>
                ) : isVideoLike(m) ? (
                  <>
                    <video src={m.url} poster={thumb || undefined} muted loop playsInline className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                    <Play className="absolute inset-0 m-auto w-7 h-7 text-primary drop-shadow-lg" />
                    <div className="absolute bottom-1 left-1.5 right-1.5">
                      <p className="text-[9px] text-foreground truncate font-medium drop-shadow">{m.title || "Untitled"}</p>
                    </div>
                  </>
                ) : thumb ? (
                  <>
                    <img src={thumb} alt={m.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/0 to-transparent" />
                    <div className="absolute bottom-1 left-1.5 right-1.5">
                      <p className="text-[9px] text-foreground truncate font-medium">{m.title || "Untitled"}</p>
                    </div>
                  </>
                ) : isText ? (
                  <div className="w-full h-full flex flex-col p-2 bg-gradient-to-br from-card to-muted/30">
                    <p className="text-[8px] leading-tight text-foreground/85 line-clamp-[8] flex-1 overflow-hidden whitespace-pre-wrap break-words">
                      {(m.url || m.title || "").slice(0, 280)}
                    </p>
                    <p className="text-[8px] text-primary truncate font-semibold mt-1 border-t border-border/50 pt-1">{m.title || "Note"}</p>
                  </div>
                ) : isAudio ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 p-2 bg-gradient-to-br from-primary/10 to-card">
                    <Music className="w-7 h-7 text-primary" />
                    <div className="flex items-end gap-0.5 h-4">
                      {[3,5,2,6,4,7,3,5,2].map((h,i) => (
                        <div key={i} className="w-0.5 bg-primary/60 rounded-full" style={{ height: `${h*3}px` }} />
                      ))}
                    </div>
                    <p className="text-[9px] text-foreground truncate w-full text-center font-medium">{m.title || "Audio"}</p>
                  </div>
                ) : isApp ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 p-2 bg-gradient-to-br from-primary/15 to-card">
                    <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center">
                      <Globe className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-[9px] text-foreground truncate w-full text-center font-semibold">{m.title || "App"}</p>
                    {m.url && <p className="text-[7px] text-muted-foreground truncate w-full text-center">{String(m.url).replace(/^https?:\/\//, "").slice(0, 22)}</p>}
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
                    {getMediaIcon(m.media_type)}
                    <p className="text-[9px] text-muted-foreground truncate w-full text-center">{m.title}</p>
                  </div>
                )}
                {/* Source badge */}
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="px-1 py-0.5 rounded bg-card/80 border border-primary/20">
                    <p className="text-[7px] text-muted-foreground">{m.source_page || "—"}</p>
                  </div>
                </div>
              </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((m: any) => {
              const colKey = getCollectionKey(m.source_page, m.media_type, m.metadata);
              const col = COLLECTIONS.find(c => c.key === colKey) || COLLECTIONS[COLLECTIONS.length - 1];
              return (
                <button key={m.id} onClick={() => setSelected(m)}
                  className="w-full flex items-center gap-3 bg-card border border-border rounded-2xl p-3 hover:border-primary/40 hover:shadow-md transition-all text-left group">
                  {isImageLike(m) ? (
                    <img src={m.url} alt={m.title} className="w-14 h-14 rounded-xl object-cover border border-border" />
                  ) : isVideoLike(m) ? (
                    <video src={m.url} poster={m.thumbnail_url || undefined} muted playsInline className="w-14 h-14 rounded-xl object-cover border border-border" />
                  ) : (
                    <div className="holo-card w-14 h-14 rounded-xl border border-primary/25 flex items-center justify-center">
                      {getMediaIcon(m.media_type)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium truncate">{m.title || "Untitled"}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-primary/25 bg-primary/10 text-primary font-medium">{col.label}</span>
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
                {isImageLike(selected) ? (
                  <img src={selected.url} alt={selected.title} className="w-full h-full object-contain" />
                ) : selected.media_type === "video" ? (
                  <video src={selected.url} poster={selected.thumbnail_url || undefined} controls playsInline className="w-full h-full object-contain" />
                ) : selected.media_type === "text" ? (
                  <div className="w-full h-full overflow-auto p-4 text-left text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                    {selected.url}
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
                  const colKey = getCollectionKey(selected.source_page, selected.media_type, selected.metadata);
                  const col = COLLECTIONS.find(c => c.key === colKey) || COLLECTIONS[COLLECTIONS.length - 1];
                  return (
                    <span className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary font-medium border border-primary/25">
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

              {/* ── Public Library + Creators Shop controls ── */}
              <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-amber-500/5 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe2 className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">Share to Public Library</p>
                      <p className="text-[10px] text-muted-foreground">Members can view and download.</p>
                    </div>
                  </div>
                  <Switch
                    checked={!!selected.is_public}
                    disabled={savingShare}
                    onCheckedChange={(v) => updateSelectedFlags({ is_public: v })}
                  />
                </div>

                {selected.is_public && (
                  <>
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                      <div className="flex items-center gap-2 min-w-0">
                        <ShoppingBag className="w-4 h-4 text-amber-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground">Sell in Creators Shop</p>
                          <p className="text-[10px] text-muted-foreground">You keep 70%, platform 30%.</p>
                        </div>
                      </div>
                      <Switch
                        checked={!!selected.shop_enabled}
                        disabled={savingShare}
                        onCheckedChange={(v) => updateSelectedFlags({ shop_enabled: v })}
                      />
                    </div>

                    {selected.shop_enabled && (
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <Label className="text-[10px] text-muted-foreground">Price (USD)</Label>
                          <div className="relative mt-1">
                            <DollarSign className="w-3.5 h-3.5 absolute left-2 top-2.5 text-muted-foreground" />
                            <Input
                              type="number"
                              min="0.50"
                              step="0.50"
                              value={priceInput}
                              onChange={(e) => setPriceInput(e.target.value)}
                              placeholder="2.00"
                              className="pl-7 h-8 text-xs"
                            />
                          </div>
                        </div>
                        <button
                          disabled={savingShare}
                          onClick={() => {
                            const dollars = parseFloat(priceInput);
                            if (isNaN(dollars) || dollars < 0.5) {
                              toast.error("Minimum price is $0.50");
                              return;
                            }
                            updateSelectedFlags({ shop_price_cents: Math.round(dollars * 100) });
                          }}
                          className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
                        >
                          Save price
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={handleDownloadSelected}
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
        description={`Check out this ${shareItem?.media_type || "media"} from Oracle Lunar!`}
      />
    </div>
  );
};

export default MediaLibraryPage;
