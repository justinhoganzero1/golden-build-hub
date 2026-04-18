import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";

interface ConnectProduct {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  priceId: string | null;
  unitAmount: number | null;
  currency: string;
}

/**
 * StorefrontPage — public storefront for a single Stripe connected account.
 *
 * URL: /store/:accountId  (e.g. /store/acct_1Abc123…)
 *
 * NOTE: We use the Stripe account ID directly in the URL for demo simplicity.
 * In production, swap this for a friendly slug (e.g. /store/jane-doe) mapped
 * to the account ID server-side so you don't leak Stripe identifiers.
 */
export default function StorefrontPage() {
  const { accountId = "" } = useParams();
  const [products, setProducts] = useState<ConnectProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("connect-products", {
          body: { action: "list", accountId },
        });
        if (error) throw error;
        setProducts((data?.products as ConnectProduct[]) || []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load storefront");
      } finally {
        setLoading(false);
      }
    })();

    // Surface success/cancel from Stripe redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get("success")) toast.success("Payment successful 🎉");
    if (params.get("canceled")) toast.info("Checkout canceled");
  }, [accountId]);

  const handleBuy = async (priceId: string) => {
    setBuying(priceId);
    try {
      const { data, error } = await supabase.functions.invoke("connect-checkout", {
        body: { accountId, priceId, quantity: 1 },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start checkout");
    } finally {
      setBuying(null);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <SEO
        title="Creator Storefront"
        description="Buy products from a SOLACE creator powered by Stripe Connect."
        path={`/store/${accountId}`}
      />
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <header className="flex items-center gap-3">
          <ShoppingBag className="w-6 h-6 text-amber-400" />
          <div>
            <h1 className="text-2xl font-bold">Creator Storefront</h1>
            <p className="text-xs text-muted-foreground">
              Account: <code>{accountId}</code>
            </p>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading products…
          </div>
        ) : products.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            This creator hasn't published any products yet.
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => (
              <Card key={p.id} className="p-4 flex flex-col gap-3 bg-card/60 border-amber-500/20">
                {p.image && (
                  <img
                    src={p.image}
                    alt={p.name}
                    className="w-full aspect-video object-cover rounded"
                  />
                )}
                <div className="flex-1 space-y-1">
                  <h3 className="font-semibold">{p.name}</h3>
                  {p.description && (
                    <p className="text-xs text-muted-foreground line-clamp-3">
                      {p.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">
                    {p.unitAmount != null
                      ? new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: p.currency.toUpperCase(),
                        }).format(p.unitAmount / 100)
                      : "—"}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => p.priceId && handleBuy(p.priceId)}
                    disabled={!p.priceId || buying === p.priceId}
                  >
                    {buying === p.priceId ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Buy"
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
