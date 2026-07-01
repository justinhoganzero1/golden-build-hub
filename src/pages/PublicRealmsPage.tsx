/**
 * PublicRealmsPage — Phase 4 of the Realm Builder.
 *
 * Public gallery of realms creators have chosen to publish. Free realms are
 * walkable inline; paid realms route through the shared shop-checkout →
 * Stripe Connect flow (70% creator / 30% platform).
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Globe2, Loader2, ShoppingBag, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
}

const fmtPrice = (c: number) => (c > 0 ? `$${(c / 100).toFixed(2)}` : "Free");

export default function PublicRealmsPage() {
  const { user } = useAuth();
  const [realms, setRealms] = useState<RealmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("user_realms")
        .select("id,user_id,title,prompt,skybox_url,avatar_url,is_public,share_slug,shop_enabled,shop_price_cents,download_count,view_count,created_at")
        .eq("is_public", true)
        .not("skybox_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(60);
      setRealms((data as RealmRow[] | null) ?? []);
      setLoading(false);
    })();
  }, []);

  async function handleBuy(r: RealmRow) {
    if (!user?.id) {
      toast.error("Sign in to purchase realms");
      return;
    }
    if (r.user_id === user.id) {
      toast.error("You already own this realm");
      return;
    }
    setBuying(r.id);
    try {
      const { data, error } = await supabase.functions.invoke("shop-checkout", {
        body: { item_id: r.id, item_kind: "realm" },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error("No checkout URL");
    } catch (e: any) {
      toast.error("Checkout failed", { description: e?.message });
    } finally {
      setBuying(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-neutral-950 to-black text-white">
      <SEO
        title="Public Realm Library — Oracle Lunar"
        description="Explore 8K photoreal 3D realms built by the Oracle Lunar community. Walk into free realms, buy premium ones with 70% going straight to creators."
      />
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

      <main className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-20 text-white/50">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : realms.length === 0 ? (
          <Card className="p-10 bg-neutral-900/70 border-white/10 text-center text-white/60">
            <Sparkles className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <p className="text-sm">No public realms yet. Be the first to publish one.</p>
            <Button asChild className="mt-4 bg-amber-500 hover:bg-amber-400 text-black">
              <Link to="/realm-builder">Open Realm Builder</Link>
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {realms.map((r) => (
              <Card key={r.id} className="bg-neutral-900/70 border-white/10 overflow-hidden group">
                <Link to={`/realm/${r.share_slug ?? r.id}`} className="block relative aspect-video overflow-hidden">
                  {r.skybox_url && (
                    <img src={r.skybox_url} alt={r.title} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                  )}
                  <div className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-1 rounded-full bg-black/70 border border-amber-400/40 text-amber-300">
                    {fmtPrice(r.shop_price_cents)}
                  </div>
                </Link>
                <div className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    {r.avatar_url && <img src={r.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover border border-amber-400/40" />}
                    <div className="text-sm font-semibold truncate flex-1">{r.title}</div>
                  </div>
                  {r.prompt && <p className="text-[11px] text-white/50 line-clamp-2">{r.prompt}</p>}
                  <div className="flex items-center gap-2 pt-1">
                    <Button asChild size="sm" variant="secondary" className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20">
                      <Link to={`/realm/${r.share_slug ?? r.id}`}>Walk in</Link>
                    </Button>
                    {r.shop_enabled && r.shop_price_cents > 0 && r.user_id !== user?.id && (
                      <Button
                        size="sm"
                        onClick={() => handleBuy(r)}
                        disabled={buying === r.id}
                        className="bg-amber-500 hover:bg-amber-400 text-black"
                      >
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
