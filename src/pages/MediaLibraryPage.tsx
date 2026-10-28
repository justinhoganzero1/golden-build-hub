import { Camera, Image, Video, Music, Grid, List, Search, Play, Download, Trash2, Eye, Share2, Sparkles, Palette, User, MessageSquare, Mic, Film, FileText, BookOpen, FolderOpen, Star, Clock, ArrowRight, Wand2, Globe, Layers, Globe2, ShoppingBag, DollarSign } from "lucide-react";
import SEO from "@/components/SEO";
import LibraryTileFace from "@/components/library/LibraryTileFace";
import LibraryCreationCard, { readableLibraryTitle } from "@/components/library/LibraryCreationCard";
import LibraryAppViewer, { isLibraryApp } from "@/components/library/LibraryAppViewer";
import ResilientVideo from "@/components/ResilientVideo";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { keepNewestVersions, matchesLibrarySearch } from "@/lib/librarySearch";
import { sendLibraryItemToMovieMaker } from "@/lib/movieHandoff";

import UniversalBackButton from "@/components/UniversalBackButton";
import { useState, useMemo, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useUserMedia, useMediaThumbnails } from "@/hooks/useUserAvatars";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import ShareDialog from "@/components/ShareDialog";
import { downloadFileFromUrl } from "@/lib/utils";
import { resolveStorageUrl } from "@/lib/signedStorageUrl";
import { Button } from "@/components/ui/button";

/* ── Source-based collection config ── */
const COLLECTIONS = [
  { key: "all",           label: "All Creations",                             icon: Layers },
  { key: "movies",        label: "Movies",                                    icon: Film },
  { key: "favourite-music", label: "Favourite Tracks",                        icon: Star },
  { key: "avatar",        label: "Avatars",                                   icon: User },
  { key: "photography",   label: "ORACLE LUNAR AI Photographic Masterpiece Studio", icon: Camera },
  { key: "teleport",      label: "Teleport ✨",                               icon: Sparkles },
  { key: "apps",          label: "Apps",                                      icon: Globe },
  { key: "workcover",     label: "Reimagined Insurance",                      icon: FolderOpen },
  { key: "stories",       label: "Stories & Books",                           icon: BookOpen },
  { key: "ai-tutor",      label: "AI Tutor",                                  icon: FileText },
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

const PAGE_SIZE = 20;

/* ── Map source_page (and metadata) to collection keys ── */
function getCollectionKey(sourcePage: string | null, mediaType?: string, metadata?: any): string {
  // Movies: any video from Movie Studio
  if (mediaType === "video" && (sourcePage || "").toLowerCase().includes("movie")) return "movies";
  // Favourite music tracks: explicitly tagged
  if (metadata?.favourite === true || (sourcePage || "").toLowerCase() === "favourite-music") return "favourite-music";
  if (!sourcePage) return "other";
  const s = sourcePage.toLowerCase();
  if (s.includes("workcover")) return "workcover";
  if (s === "teleport" || s.includes("teleport")) return "teleport";
  if (s.includes("avatar")) return "avatar";
  if (s.includes("photo")) return "photography";
  if (s.includes("app-builder") || s.includes("app builder")) return "apps";
  if (s.includes("story-writer")) return "stories";
  if (s.includes("ai-tutor")) return "ai-tutor";
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
  const { isAdmin } = useIsAdmin();
  const [scope, setScope] = useState<"mine" | "others" | "everyone">("mine");
  const { data: ownMedia = [], isLoading: ownLoading } = useUserMedia(
    isAdmin && scope !== "mine" ? "everyone" : "mine",
  );
  const { user } = useAuth();
  const mediaItems = ownMedia;
  const isLoading = ownLoading;

  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [view, setView] = useState<"grid" | "list">("grid");
  const [activeCollection, setActiveCollection] = useState(searchParams.get("collection") || "all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [selected, setSelected] = useState<any>(null);
  const openedLinkRef = useRef<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [shareItem, setShareItem] = useState<any>(null);
  const [showCollections, setShowCollections] = useState(true);
  const [savingShare, setSavingShare] = useState(false);
  const [priceInput, setPriceInput] = useState<string>("");
  const [page, setPage] = useState(1);
  const [showOlder, setShowOlder] = useState(false);
  const [showAllApps, setShowAllApps] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const revealResults = () => {
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ block: "start", behavior: "instant" }));
  };

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

  const openItem = async (item: any) => {
    if (openingId) return;
    setOpeningId(item.id);
    try {
      const { data, error } = await supabase
        .from("user_media")
        .select("*")
        .eq("id", item.id)
        .single();
      if (error) throw error;
      const resolvedUrl = data.media_type === "text" ? data.url : await resolveStorageUrl(data.url);
      setSelected({ ...data, url: resolvedUrl });
    } catch (e: any) {
      toast.error(e?.message || "Could not open this creation.");
    } finally {
      setOpeningId(null);
    }
  };

  // A linked creation loads only that signed-in account's record through RLS.
  const linkedItemId = searchParams.get("item");
  useEffect(() => {
    if (!user?.id || !linkedItemId || openedLinkRef.current === `${user.id}:${linkedItemId}`) return;
    openedLinkRef.current = `${user.id}:${linkedItemId}`;
    void openItem({ id: linkedItemId });
  }, [user?.id, linkedItemId]);


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
  const scopedItems = useMemo(
    () => (scope === "others" ? mediaItems.filter((m: any) => m.user_id !== user?.id) : mediaItems),
    [mediaItems, scope, user?.id],
  );
  const collectionCounts = useMemo(() => {
    const counts: Record<string, number> = { all: scopedItems.length };
    scopedItems.forEach((m: any) => {
      const key = getCollectionKey(m.source_page, m.media_type, m.metadata);
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [scopedItems]);

  /* ── Filtering ── */
  const filtered = useMemo(() => {
    const matches = mediaItems.filter((m: any) => {
      if (scope === "others" && m.user_id === user?.id) return false;
      if (activeCollection !== "all" && getCollectionKey(m.source_page, m.media_type, m.metadata) !== activeCollection) return false;
      if (typeFilter !== "all" && m.media_type !== typeFilter) return false;
      if (!matchesLibrarySearch(m.title, search, m.source_page || "")) return false;
      return true;
    });
    return showOlder ? matches : keepNewestVersions(matches);
  }, [mediaItems, activeCollection, typeFilter, search, scope, user?.id, showOlder]);

  /* ── Pagination: 20 tiles per page (previews only render when in view) ── */
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { setPage(1); }, [activeCollection, typeFilter, search, view, scope]);
  useEffect(() => { if (page > pageCount) setPage(1); }, [page, pageCount]);
  const pagedRows = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );
  // Thumbnails are fetched only for the 20 rows on screen — stored previews can
  // be megabytes each, so they must never travel with the whole list.
  const { data: thumbMap = {} } = useMediaThumbnails(pagedRows.map((m: any) => m.id));
  const paged = useMemo(
    () => pagedRows.map((m: any) => ({ ...m, thumbnail_url: thumbMap[m.id] ?? null })),
    [pagedRows, thumbMap],
  );



  /* ── Main apps: newest version of each of my apps ── */
  const mainApps = useMemo(() => {
    const mine = mediaItems.filter((m: any) => isLibraryApp(m) && (!user?.id || m.user_id === user.id));
    return keepNewestVersions(mine).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [mediaItems, user?.id]);

  const getMediaIcon = (type: string) => {
    if (type === "image") return <Image className="w-5 h-5 text-primary" />;
    if (type === "gif") return <Image className="w-5 h-5 text-primary" />;
    if (type === "video") return <Video className="w-5 h-5 text-primary" />;
    if (type === "text" || type === "document") return <FileText className="w-5 h-5 text-primary" />;
    if (type === "app") return <Globe className="w-5 h-5 text-primary" />;
    return <Music className="w-5 h-5 text-primary" />;
  };

  // List queries omit heavy `url`/`metadata`; fall back to the stored thumbnail
  // so tiles still show the artwork (the detail dialog re-fetches the full row).
  const previewSrc = (m: any) =>
    m.url ||
    m.thumbnail_url ||
    (m.metadata && (m.metadata.thumbnail || m.metadata.cover || m.metadata.poster || m.metadata.preview_url || m.metadata.image)) ||
    null;
  // Type alone decides whether a tile shows artwork — LibraryTileFace lazily
  // pulls the row's `url` (omitted from the list query) when no thumbnail exists.
  const isImageLike = (m: any) => m.media_type === "image" || m.media_type === "gif";
  const isVideoLike = (m: any) => m.media_type === "video";

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
        const url = await resolveStorageUrl(selected.url);
        const result = await downloadFileFromUrl(url, selected.metadata?.filename || selected.title || "media");
        if (result === "failed") throw new Error("Download failed");
        if (result === "opened") { toast.info("File opened for saving"); return; }
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
              {`${filtered.length} creations across ${Object.keys(collectionCounts).length - 1} collections`}
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
          <Button variant="outline" size="icon" aria-label={view === "grid" ? "Show list" : "Show grid"} onClick={() => { setView(view === "grid" ? "list" : "grid"); revealResults(); }}
            className="p-2.5 rounded-xl bg-card border border-border hover:border-primary/50 transition-all">
            {view === "grid" ? <List className="w-4 h-4 text-primary" /> : <Grid className="w-4 h-4 text-primary" />}
          </Button>
        </div>
      </div>

      {/* ── Owner-only: whose creations to show ── */}
      {isAdmin && (
        <div className="px-4 mb-3 flex flex-wrap gap-1.5">
          {([
            { key: "mine", label: "My creations" },
            { key: "others", label: "Members' creations" },
            { key: "everyone", label: "Everyone" },
          ] as const).map((s) => (
            <button
              key={s.key}
              onClick={() => setScope(s.key)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                scope === s.key
                  ? "text-primary border-primary/50 bg-primary/10 font-semibold"
                  : "text-muted-foreground border-border hover:border-primary/40"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

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
                <Button variant="ghost" key={col.key} aria-pressed={isActive} onClick={() => { setActiveCollection(col.key); setTypeFilter("all"); setSearch(""); revealResults(); }}
                  className={`holo-tile relative h-auto justify-start whitespace-normal rounded-2xl p-3 text-left ${
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
                </Button>
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
              <Button variant="ghost" key={f.key} aria-pressed={typeFilter === f.key} onClick={() => { setTypeFilter(f.key); revealResults(); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all ${
                  typeFilter === f.key
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "bg-card border border-border text-muted-foreground hover:border-primary/40"
                }`}>
                <FIcon className="w-3 h-3" />
                {f.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* ── Main Apps showcase (only on "All") ── */}
      {activeCollection === "all" && typeFilter === "all" && mainApps.length > 0 && !search && (
        <section aria-label="My main apps" className="px-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">My Main Apps</h2>
            <span className="text-xs text-muted-foreground">newest version of each</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mainApps.slice(0, showAllApps ? undefined : 6).map((m: any) => (
              <div key={m.id}>
                <LibraryCreationCard item={m} collection="Main app" busy={openingId === m.id} onOpen={() => void openItem(m)} />
                {m.olderVersions?.length > 0 && <p className="text-xs text-muted-foreground mt-1 px-1">{m.olderVersions.length} older version{m.olderVersions.length > 1 ? "s" : ""} filed away</p>}
              </div>
            ))}
          </div>
          {mainApps.length > 6 && (
            <Button variant="outline" className="w-full mt-3" onClick={() => setShowAllApps(v => !v)}>
              {showAllApps ? "Show fewer apps" : `Show all ${mainApps.length} apps`}
            </Button>
          )}
        </section>
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
      <div ref={resultsRef} role="region" aria-label="Library results" className="px-4 scroll-mt-4">
        <div className="sticky top-0 z-20 bg-background py-3 mb-3 flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input aria-label={`Search ${activeCol.label}`} placeholder={`Search ${activeCol.label}…`} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          {(search || typeFilter !== "all") && <Button variant="outline" onClick={() => { setSearch(""); setTypeFilter("all"); }}>Clear</Button>}
          {activeCollection !== "all" && <Button variant="outline" onClick={() => { setActiveCollection("all"); setSearch(""); setTypeFilter("all"); }}>All collections</Button>}
          <Button variant="outline" aria-pressed={showOlder} onClick={() => setShowOlder(v => !v)}>{showOlder ? "Newest only" : "Show old versions"}</Button>
        </div>
        <p role="status" className="text-sm font-semibold text-foreground mb-3">
          {activeCol.label} · {typeFilter === "all" ? "All Types" : TYPE_FILTERS.find(f => f.key === typeFilter)?.label} · {filtered.length} items
        </p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paged.map((m: any) => {
              const collection = COLLECTIONS.find(c => c.key === getCollectionKey(m.source_page, m.media_type, m.metadata))?.label || "Other";
              return <LibraryCreationCard key={m.id} item={m} collection={collection} busy={openingId === m.id} onOpen={() => void openItem(m)} />;
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {paged.map((m: any) => {
              const colKey = getCollectionKey(m.source_page, m.media_type, m.metadata);
              const col = COLLECTIONS.find(c => c.key === colKey) || COLLECTIONS[COLLECTIONS.length - 1];
              return (
                <button key={m.id} onClick={() => void openItem(m)} disabled={openingId === m.id}
                  className="w-full flex items-center gap-3 bg-card border border-border rounded-2xl p-3 hover:border-primary/40 hover:shadow-md transition-all text-left group">
                  {isImageLike(m) || isVideoLike(m) ? (
                    <div className="w-14 h-14 rounded-xl overflow-hidden border border-border shrink-0">
                      <LibraryTileFace src={previewSrc(m)} alt={m.title} size={96} mediaId={m.id} canBackfill={isImageLike(m)} />
                    </div>
                  ) : (
                    <div className="holo-card w-14 h-14 rounded-xl border border-primary/25 flex items-center justify-center">
                      {getMediaIcon(m.media_type)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-base text-foreground font-medium break-words">{readableLibraryTitle(m.title)}</p>
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

        {/* ── Pagination (20 per page) ── */}
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-2 mt-5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-xs rounded-full border border-border text-foreground disabled:opacity-40 hover:border-primary/50"
            >
              Previous
            </button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {pageCount} · {filtered.length} items
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              className="px-3 py-1.5 text-xs rounded-full border border-border text-foreground disabled:opacity-40 hover:border-primary/50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* ── Detail dialog ── */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className={isLibraryApp(selected) ? "w-screen max-w-none h-[100dvh] max-h-[100dvh] p-0 gap-0 rounded-none border-0 bg-background flex flex-col" : "w-[95vw] max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl border-border bg-card"}>
          <DialogHeader>
            <DialogTitle className={isLibraryApp(selected) ? "text-base font-semibold px-4 pt-4 pr-12" : "text-base font-semibold"}>{readableLibraryTitle(selected?.title) || "Creation"}</DialogTitle>
          </DialogHeader>
          {selected && isLibraryApp(selected) && <>
            <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-border">
              <Button variant="outline" onClick={() => setSelected(null)}><ArrowRight className="h-4 w-4 rotate-180 mr-2" />Back to Library</Button>
              <Button variant="outline" onClick={handleDownloadSelected}><Download className="h-4 w-4 mr-2" />Download app</Button>
            </div>
            <LibraryAppViewer item={selected} />
          </>}
          {selected && !isLibraryApp(selected) && (
            <div className="space-y-4 mt-2">
              <div className="aspect-video bg-secondary rounded-2xl flex items-center justify-center overflow-hidden border border-border">
                {isImageLike(selected) ? (
                  <img src={selected.url} alt={selected.title} className="w-full h-full object-contain" />
                ) : selected.media_type === "video" ? (
                  <ResilientVideo src={selected.url} poster={selected.thumbnail_url || undefined} controls className="w-full h-full object-contain" />
                ) : selected.media_type === "text" ? (
                  <div className="w-full h-full overflow-auto p-4 text-left text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                    {selected.url}
                  </div>
                ) : selected.media_type === "document" ? (
                  <div className="text-center">
                    <FileText className="w-12 h-12 text-primary mx-auto mb-2" />
                    <p className="text-sm text-foreground">{selected.metadata?.filename || selected.title}</p>
                    <Button variant="outline" className="mt-3" onClick={() => window.open(selected.url, "_blank", "noopener,noreferrer")}>
                      <Eye className="w-4 h-4 mr-2" /> Open file
                    </Button>
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

              {/* Prompt / style details (from generation composer) */}
              {(selected.metadata?.prompt || selected.metadata?.style) && (
                <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Details</p>
                  {selected.metadata?.style && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
                        Style: {String(selected.metadata.style).replace(/[-_]/g, " ")}
                      </span>
                      {typeof selected.metadata?.references === "number" && selected.metadata.references > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                          {selected.metadata.references} reference photo{selected.metadata.references === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  )}
                  {selected.metadata?.prompt && (
                    <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                      {String(selected.metadata.prompt)}
                    </p>
                  )}
                </div>
              )}

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

              <button
                onClick={() => sendLibraryItemToMovieMaker(selected, navigate)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-fuchsia-500 via-primary to-amber-500 text-primary-foreground text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-primary/20"
              >
                <Film className="w-4 h-4" /> Send to Movie Maker
              </button>

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
