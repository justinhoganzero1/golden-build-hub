/**
 * PublicRealmsPage — Phase 4/5. Public gallery with search, tags, and sort.
 * Free realms walk inline; paid realms route through shop-checkout →
 * Stripe Connect (70/30). Removed realms are hidden.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Globe2, Loader2, ShoppingBag, Sparkles, Wand2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import { toast } from "sonner";

interface RealmRow {
  id: string;
  user_id: string;
  title: string;
  prompt: string | null;
  skybox_url: string | null;
  avatar_url: string | null;
  is_public: boolean;
  share_slug: string | null;
  shop_enabled: boolean;
  shop_price_cents: number;
  download_count: number;
  view_count: number;
  created_at: string;
  tags?: string[] | null;
  moderation_status?: string | null;
}

type SortMode = "newest" | "most_viewed" | "most_bought";

const fmtPrice = (c: number) => (c > 0 ? `$${(c / 100).toFixed(2)}` : "Free");

export default function PublicRealmsPage() {
  const { user } = useAuth();
  const [realms, setRealms] = useState<RealmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("newest");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const orderCol = sort === "most_viewed" ? "view_count" : sort === "most_bought" ? "download_count" : "created_at";
      const { data } = await (supabase as any)
        .from("user_realms")
        .select("id,user_id,title,prompt,skybox_url,avatar_url,is_public,share_slug,shop_enabled,shop_price_cents,download_count,view_count,created_at,tags,moderation_status")
        .eq("is_public", true)
        .not("skybox_url", "is", null)
        .neq("moderation_status", "removed")
        .order(orderCol, { ascending: false })
        .limit(120);
      setRealms(((data as RealmRow[] | null) ?? []).filter(r => r.moderation_status !== "removed"));
      setLoading(false);
    })();
  }, [sort]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    realms.forEach((r) => (r.tags ?? []).forEach((t) => s.add(t)));
    return Array.from(s).sort().slice(0, 20);
  }, [realms]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return realms.filter((r) => {
      if (activeTag && !(r.tags ?? []).includes(activeTag)) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        (r.prompt ?? "").toLowerCase().includes(q) ||
        (r.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [realms, query, activeTag]);

  async function handleBuy(r: RealmRow) {
    if (!user?.id) { toast.error("Sign in to purchase realms"); return; }
    if (r.user_id === user.id) { toast.error("You already own this realm"); return; }
    setBuying(r.id);
    try {
      const { data, error } = await supabase.functions.invoke("shop-checkout", { body: { item_id: r.id, item_kind: "realm" } });
      if (error) throw error;
      if ((data as any)?.url) window.location.href = (data as any).url;
      else throw new Error("No checkout URL");
    } catch (e: any) {
      toast.error("Checkout failed", { description: e?.message });
    } finally {
      setBuying(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-neutral-950 to-black text-white">
      <SEO title="Public Realm Library — Oracle Lunar" description="Explore 8K photoreal 3D realms built by the Oracle Lunar community. Walk in free, or unlock premium realms — creators earn 70%." />
      <header className="border-b border-white/10 bg-black/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button asChild size="sm" variant="ghost" className="text-white/70 hover:text-white">
            <Link to="/dashboard"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Globe2 className="w-5 h-5 text-amber-400" /> Public Realm Library
            </h1>
            <p className="text-xs text-white/50">Walk through community-built 8K realms. Creators earn 70% on paid realms.</p>
          </div>
          <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-400 text-black">
            <Link to="/realm-builder"><Wand2 className="w-4 h-4 mr-1" /> Build yours</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* Search + sort */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search realms, prompts, or tags…" className="pl-8 bg-black/40 border-white/10" />
          </div>
          <div className="flex rounded-md border border-white/10 overflow-hidden text-xs">
            {(["newest", "most_viewed", "most_bought"] as SortMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setSort(m)}
                className={`px-3 py-1.5 transition ${sort === m ? "bg-amber-500 text-black font-semibold" : "bg-black/40 text-white/70 hover:bg-white/10"}`}
              >
                {m === "newest" ? "Newest" : m === "most_viewed" ? "Most viewed" : "Most bought"}
              </button>
            ))}
          </div>
        </div>

        {/* Tag chips */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activeTag && (
              <button onClick={() => setActiveTag(null)} className="text-[11px] px-2 py-1 rounded-full bg-amber-500 text-black font-semibold inline-flex items-center gap-1">
                {activeTag} <X className="w-3 h-3" />
              </button>
            )}
            {allTags.filter((t) => t !== activeTag).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTag(t)}
                className="text-[11px] px-2 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70"
              >
                #{t}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20 text-white/50"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <Card className="p-10 bg-neutral-900/70 border-white/10 text-center text-white/60">
            <Sparkles className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <p className="text-sm">{realms.length === 0 ? "No public realms yet. Be the first to publish one." : "No realms match your filters."}</p>
            <Button asChild className="mt-4 bg-amber-500 hover:bg-amber-400 text-black"><Link to="/realm-builder">Open Realm Builder</Link></Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => (
              <Card key={r.id} className="bg-neutral-900/70 border-white/10 overflow-hidden group">
                <Link to={`/realm/${r.share_slug ?? r.id}`} className="block relative aspect-video overflow-hidden">
                  {r.skybox_url && <img src={r.skybox_url} alt={r.title} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />}
                  <div className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-1 rounded-full bg-black/70 border border-amber-400/40 text-amber-300">
                    {fmtPrice(r.shop_price_cents)}
                  </div>
                  <div className="absolute bottom-2 left-2 flex gap-2 text-[10px] text-white/80">
                    <span className="px-1.5 py-0.5 rounded bg-black/60">👁 {r.view_count}</span>
                    <span className="px-1.5 py-0.5 rounded bg-black/60">🛒 {r.download_count}</span>
                  </div>
                </Link>
                <div className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    {r.avatar_url && <img src={r.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover border border-amber-400/40" />}
                    <div className="text-sm font-semibold truncate flex-1">{r.title}</div>
                  </div>
                  {r.prompt && <p className="text-[11px] text-white/50 line-clamp-2">{r.prompt}</p>}
                  {(r.tags?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {r.tags!.slice(0, 4).map((t) => (
                        <button key={t} onClick={() => setActiveTag(t)} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-white/60">#{t}</button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <Button asChild size="sm" variant="secondary" className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20">
                      <Link to={`/realm/${r.share_slug ?? r.id}`}>Walk in</Link>
                    </Button>
                    {r.shop_enabled && r.shop_price_cents > 0 && r.user_id !== user?.id && (
                      <Button size="sm" onClick={() => handleBuy(r)} disabled={buying === r.id} className="bg-amber-500 hover:bg-amber-400 text-black">
                        {buying === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><ShoppingBag className="w-3 h-3 mr-1" /> Buy</>}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
