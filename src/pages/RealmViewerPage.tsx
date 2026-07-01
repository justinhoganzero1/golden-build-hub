/**
 * RealmViewerPage — public / shared realm walk-in.
 *
 * Loads a realm by its share_slug (or id) and drops the visitor straight into
 * the FPS viewer if it's public. Paid realms are gated: preview visible, but
 * the "Walk in" button routes through shop-checkout for non-owners.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Lock, ShoppingBag, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import ImmersiveFPSViewer from "@/components/ImmersiveFPSViewer";
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
}

const fmtPrice = (c: number) => (c > 0 ? `$${(c / 100).toFixed(2)}` : "Free");

export default function RealmViewerPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [realm, setRealm] = useState<RealmRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [owned, setOwned] = useState(false);
  const [walkMode, setWalkMode] = useState(false);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      // Try share_slug first, then fall back to id
      let { data } = await supabase
        .from("user_realms")
        .select("id,user_id,title,prompt,skybox_url,avatar_url,is_public,share_slug,shop_enabled,shop_price_cents")
        .eq("share_slug", slug)
        .maybeSingle();
      if (!data) {
        const alt = await supabase
          .from("user_realms")
          .select("id,user_id,title,prompt,skybox_url,avatar_url,is_public,share_slug,shop_enabled,shop_price_cents")
          .eq("id", slug)
          .maybeSingle();
        data = alt.data;
      }
      setRealm((data as RealmRow | null) ?? null);
      setLoading(false);

      // view_count is bumped server-side on purchase; skip client-side updates (RLS-restricted).
    })();
  }, [slug]);

  // Check ownership (creator or prior purchase)
  useEffect(() => {
    if (!realm || !user?.id) return;
    if (realm.user_id === user.id) { setOwned(true); return; }
    if (!realm.shop_enabled || realm.shop_price_cents === 0) { setOwned(true); return; }
    (async () => {
      const { data } = await supabase
        .from("shop_purchases")
        .select("id")
        .eq("buyer_id", user.id)
        .eq("item_id", realm.id)
        .eq("item_kind", "realm")
        .eq("status", "paid")
        .maybeSingle();
      setOwned(!!data);
    })();
  }, [realm, user?.id]);

  const gated = useMemo(
    () => !!realm && realm.shop_enabled && realm.shop_price_cents > 0 && !owned,
    [realm, owned]
  );

  async function handleBuy() {
    if (!realm) return;
    if (!user?.id) { toast.error("Sign in to purchase"); return; }
    setBuying(true);
    try {
      const { data, error } = await supabase.functions.invoke("shop-checkout", {
        body: { item_id: realm.id, item_kind: "realm" },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error("Checkout failed", { description: e?.message });
    } finally {
      setBuying(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  if (!realm || !realm.is_public || !realm.skybox_url) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-3">
        <p className="text-white/60">This realm is private or does not exist.</p>
        <Button asChild variant="secondary"><Link to="/realms">Browse public realms</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SEO
        title={`${realm.title} — Realm`}
        description={realm.prompt?.slice(0, 155) ?? "Walk into an 8K photoreal realm on Oracle Lunar."}
      />
      <header className="border-b border-white/10 bg-black/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button asChild size="sm" variant="ghost" className="text-white/70 hover:text-white">
            <Link to="/realms"><ArrowLeft className="w-4 h-4 mr-1" /> Library</Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">{realm.title}</h1>
            <p className="text-xs text-white/50 truncate">{realm.prompt}</p>
          </div>
          <Button asChild size="sm" variant="ghost" className="text-amber-400">
            <Link to="/realm-builder"><Wand2 className="w-4 h-4 mr-1" /> Build your own</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Card className="aspect-video bg-black border-white/10 overflow-hidden relative">
          {walkMode && !gated ? (
            <ImmersiveFPSViewer imageUrl={realm.skybox_url} onExit={() => setWalkMode(false)} />
          ) : (
            <div className="relative w-full h-full">
              <img src={realm.skybox_url} alt={realm.title} className={`w-full h-full object-cover ${gated ? "blur-md scale-105" : ""}`} />
              {realm.avatar_url && !gated && (
                <img src={realm.avatar_url} alt="Avatar" className="absolute bottom-4 right-4 w-24 h-24 rounded-full object-cover border-2 border-amber-400 shadow-2xl shadow-amber-500/30" />
              )}
              <div className="absolute inset-0 flex items-end justify-center pb-6">
                {gated ? (
                  <div className="text-center space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/70 border border-amber-400/40 text-amber-300 text-xs">
                      <Lock className="w-3 h-3" /> Premium realm — {fmtPrice(realm.shop_price_cents)}
                    </div>
                    <Button onClick={handleBuy} disabled={buying} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">
                      {buying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirecting…</> : <><ShoppingBag className="w-4 h-4 mr-2" /> Unlock & walk in</>}
                    </Button>
                    <p className="text-[11px] text-white/50">Creator earns 70% via Stripe Connect.</p>
                  </div>
                ) : (
                  <Button onClick={() => setWalkMode(true)} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">
                    Walk into this realm →
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
