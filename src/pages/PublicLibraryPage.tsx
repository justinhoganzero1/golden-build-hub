import { useMemo, useState } from "react";
import { Sparkles, ShoppingBag, Download, Eye, Loader2, Filter, Search, X } from "lucide-react";
import PageShell from "@/components/PageShell";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePublicLibrary, PublicLibraryItem } from "@/hooks/usePublicLibrary";
import { supabase } from "@/integrations/supabase/client";
import { downloadFileFromUrl } from "@/lib/utils";

const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

type SortKey = "newest" | "popular" | "price_low" | "price_high";

const PublicLibraryPage = () => {
  const { user } = useAuth();
  const [filter, setFilter] = useState<"all" | "shop" | "media" | "gif" | "movie">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const { data: rawItems = [], isLoading } = usePublicLibrary(filter);
  const [busyId, setBusyId] = useState<string | null>(null);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rawItems;
    if (q) {
      list = list.filter(
        (i) =>
          (i.title || "").toLowerCase().includes(q) ||
          (i.creator_display_name || "").toLowerCase().includes(q)
      );
    }
    const sorted = [...list];
    if (sort === "popular") {
      sorted.sort((a, b) => (b.view_count + b.download_count) - (a.view_count + a.download_count));
    } else if (sort === "price_low") {
      sorted.sort((a, b) => (a.shop_price_cents || 0) - (b.shop_price_cents || 0));
    } else if (sort === "price_high") {
      sorted.sort((a, b) => (b.shop_price_cents || 0) - (a.shop_price_cents || 0));
    }
    return sorted;
  }, [rawItems, search, sort]);

  const member = useMemo(() => isMember(effectiveTier), [effectiveTier]);

  const handleDownload = async (item: PublicLibraryItem) => {
    if (!user) {
      toast.error("Sign in to download from the Public Library.");
      return;
    }
    if (!member) {
      toast.error("Membership required — any paid plan unlocks downloads.", {
        action: { label: "Upgrade", onClick: () => (window.location.href = "/subscribe") },
      });
      return;
    }
    if (!item.url) {
      toast.error("This item has no downloadable file yet.");
      return;
    }
    setBusyId(item.id);
    try {
      const ext =
        item.media_type === "video" ? "mp4" : item.media_type === "gif" ? "gif" : "jpg";
      const filename = `${(item.title || "creation").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.${ext}`;
      const result = await downloadFileFromUrl(item.url, filename);
      if (result === "saved") toast.success("Saved to your device.");
      else if (result === "opened") toast.info("Opened in a new tab — long-press to save.");
      else toast.error("Download failed.");
    } finally {
      setBusyId(null);
    }
  };

  const handleBuy = async (item: PublicLibraryItem) => {
    if (!user) {
      toast.error("Sign in to purchase from the Creators Shop.");
      return;
    }
    if (!member) {
      toast.error("Membership required to buy from creators.", {
        action: { label: "Upgrade", onClick: () => (window.location.href = "/subscribe") },
      });
      return;
    }
    setBusyId(item.id);
    try {
      const { data, error } = await supabase.functions.invoke("shop-checkout", {
        body: { item_id: item.id, item_kind: item.kind },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank", "noopener,noreferrer");
      else toast.error("Could not start checkout.");
    } catch (e: any) {
      toast.error(e?.message || "Checkout failed.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageShell title="Public Library" subtitle="Every creation, shared by every member">
      <SEO
        title="Public Library — Oracle Lunar"
        description="Browse and download photos, GIFs, videos and apps shared by Oracle Lunar members. Membership unlocks downloads and the Creators Shop."
      />

      {/* Banner */}
      <Card className="p-4 mb-6 bg-gradient-to-br from-primary/10 to-amber-500/10 border-primary/30">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold mb-1">A community gallery, powered by every member.</p>
            <p className="text-muted-foreground">
              All items here were marked <span className="text-foreground font-medium">public</span> by their creator.
              Anyone can view; <span className="text-foreground font-medium">members can download</span> for free, or
              <span className="text-foreground font-medium"> buy</span> shop items (creators keep 70%).
            </p>
            {!member && (
              <Button size="sm" className="mt-3" asChild>
                <Link to="/subscribe">
                  <Lock className="w-3.5 h-3.5 mr-1.5" /> Become a member to unlock downloads
                </Link>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="mb-4">
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="all"><Filter className="w-3 h-3 mr-1" /> All</TabsTrigger>
          <TabsTrigger value="shop"><ShoppingBag className="w-3 h-3 mr-1" /> Creators Shop</TabsTrigger>
          <TabsTrigger value="media">Photos</TabsTrigger>
          <TabsTrigger value="gif">Living GIFs</TabsTrigger>
          <TabsTrigger value="movie">Movies</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or creator…"
            className="pl-9 pr-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {(["newest", "popular", "price_low", "price_high"] as SortKey[]).map((k) => (
            <Button
              key={k}
              size="sm"
              variant={sort === k ? "default" : "outline"}
              onClick={() => setSort(k)}
              className="text-xs whitespace-nowrap"
            >
              {k === "newest" ? "Newest" : k === "popular" ? "Popular" : k === "price_low" ? "Price ↑" : "Price ↓"}
            </Button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        {items.length} {items.length === 1 ? "item" : "items"}
        {search && <> matching <span className="text-foreground">"{search}"</span></>}
      </p>

      {/* Grid */}
      {isLoading || subLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No public items yet. Be the first — open the Media Library and toggle{" "}
          <span className="text-foreground font-medium">Share to Public Library</span> on any creation.
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {items.map((item) => {
            const thumb = item.thumbnail_url || item.url;
            const isVideo = item.media_type === "video";
            const isShop = item.shop_enabled && item.shop_price_cents > 0;
            const busy = busyId === item.id;
            return (
              <Card
                key={`${item.kind}-${item.id}`}
                className="overflow-hidden group bg-card/60 border-border/60 hover:border-primary/50 transition-colors"
              >
                <div className="relative aspect-square bg-muted">
                  {isVideo ? (
                    <video
                      src={item.url}
                      poster={thumb || undefined}
                      muted
                      loop
                      playsInline
                      className="w-full h-full object-cover"
                      onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
                      onMouseLeave={(e) => (e.currentTarget as HTMLVideoElement).pause()}
                    />
                  ) : (
                    <img
                      src={thumb}
                      alt={item.title || "Public creation"}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  )}
                  {isShop && (
                    <Badge className="absolute top-1.5 right-1.5 bg-amber-500 text-amber-950 border-0">
                      <ShoppingBag className="w-3 h-3 mr-1" /> {formatPrice(item.shop_price_cents)}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="absolute top-1.5 left-1.5 text-[10px] capitalize">
                    {item.kind === "gif" ? "Living GIF" : item.kind}
                  </Badge>
                </div>
                <div className="p-2 space-y-1.5">
                  <p className="text-xs font-medium truncate" title={item.title || ""}>
                    {item.title || "Untitled"}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    by {item.creator_display_name || "Member"}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Eye className="w-3 h-3" /> {item.view_count}
                    <Download className="w-3 h-3 ml-1" /> {item.download_count}
                  </div>
                  {isShop ? (
                    <Button
                      size="sm"
                      className="w-full h-7 text-xs"
                      onClick={() => handleBuy(item)}
                      disabled={busy}
                    >
                      {busy ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <ShoppingBag className="w-3 h-3 mr-1" /> Buy {formatPrice(item.shop_price_cents)}
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-xs"
                      onClick={() => handleDownload(item)}
                      disabled={busy}
                    >
                      {busy ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : member ? (
                        <>
                          <Download className="w-3 h-3 mr-1" /> Download
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3 mr-1" /> Members only
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </PageShell>
  );
};

export default PublicLibraryPage;
