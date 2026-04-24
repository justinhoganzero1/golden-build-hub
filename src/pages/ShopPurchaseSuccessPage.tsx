import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Download, Loader2, AlertCircle, ShoppingBag } from "lucide-react";
import PageShell from "@/components/PageShell";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { downloadFileFromUrl } from "@/lib/utils";

type PurchaseRow = {
  id: string;
  status: string;
  item_kind: "media" | "gif" | "movie";
  item_id: string;
  amount_cents: number;
  created_at: string;
};

type ItemRow = {
  id: string;
  title: string | null;
  url: string;
  thumbnail_url: string | null;
  media_type: string;
  creator_display_name: string | null;
};

const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const ShopPurchaseSuccessPage = () => {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const purchaseId = params.get("purchase_id");
  const sessionId = params.get("session_id");

  const [purchase, setPurchase] = useState<PurchaseRow | null>(null);
  const [item, setItem] = useState<ItemRow | null>(null);
  const [polling, setPolling] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Poll purchase status until paid (webhook may take a few seconds)
  useEffect(() => {
    if (!user) return;
    if (!purchaseId && !sessionId) {
      setError("Missing purchase reference.");
      setPolling(false);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20; // ~40s

    const fetchOnce = async () => {
      attempts += 1;
      const query = supabase
        .from("shop_purchases")
        .select("id,status,item_kind,item_id,amount_cents,created_at")
        .eq("buyer_id", user.id);
      const { data, error: qErr } = purchaseId
        ? await query.eq("id", purchaseId).maybeSingle()
        : await query.eq("stripe_session_id", sessionId!).maybeSingle();

      if (cancelled) return;
      if (qErr) {
        setError(qErr.message);
        setPolling(false);
        return;
      }
      if (!data) {
        if (attempts >= maxAttempts) {
          setError("Could not find your purchase. Contact support if you were charged.");
          setPolling(false);
        }
        return;
      }
      setPurchase(data as PurchaseRow);

      if (data.status === "paid") {
        setPolling(false);
        const table =
          data.item_kind === "media"
            ? "user_media"
            : data.item_kind === "gif"
            ? "living_gifs"
            : "movie_projects";

        // Different tables expose the asset URL under different columns.
        const fields =
          data.item_kind === "media"
            ? "id,title,url,thumbnail_url,media_type,creator_display_name"
            : data.item_kind === "gif"
            ? "id,title,gif_url,preview_mp4_url,thumbnail_url,creator_display_name"
            : "id,title,final_video_url,thumbnail_url,creator_display_name";

        const { data: itemRow } = await supabase
          .from(table)
          .select(fields)
          .eq("id", data.item_id)
          .maybeSingle();

        if (itemRow) {
          const r: any = itemRow;
          setItem({
            id: r.id,
            title: r.title,
            url:
              data.item_kind === "media"
                ? r.url
                : data.item_kind === "gif"
                ? r.gif_url || r.preview_mp4_url
                : r.final_video_url,
            thumbnail_url: r.thumbnail_url,
            media_type:
              data.item_kind === "media"
                ? r.media_type
                : data.item_kind === "gif"
                ? "gif"
                : "video",
            creator_display_name: r.creator_display_name,
          });
        }
      } else if (attempts >= maxAttempts) {
        setPolling(false);
      }
    };

    fetchOnce();
    const id = setInterval(() => {
      if (!cancelled && polling) fetchOnce();
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, purchaseId, sessionId]);

  const handleDownload = async () => {
    if (!item?.url) {
      toast.error("This item has no downloadable file.");
      return;
    }
    setDownloading(true);
    try {
      const ext =
        item.media_type === "video" ? "mp4" : item.media_type === "gif" ? "gif" : "jpg";
      const safe = (item.title || "purchase").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      const result = await downloadFileFromUrl(item.url, `${safe}.${ext}`);
      if (result === "saved") toast.success("Saved to your device.");
      else if (result === "opened") toast.info("Opened in a new tab — long-press to save.");
      else toast.error("Download failed.");
    } finally {
      setDownloading(false);
    }
  };

  const isPaid = purchase?.status === "paid";

  const heading = useMemo(() => {
    if (error) return "Purchase issue";
    if (!isPaid) return "Confirming your purchase…";
    return "Thank you — purchase complete";
  }, [error, isPaid]);

  return (
    <PageShell title="Purchase Success" subtitle="Your item is ready to download">
      <SEO
        title="Purchase Complete — Oracle Lunar"
        description="Download your purchased item from the Oracle Lunar Public Library."
      />

      <Card className="p-6 max-w-2xl mx-auto">
        <div className="flex items-start gap-3 mb-4">
          {error ? (
            <AlertCircle className="w-6 h-6 text-destructive mt-0.5" />
          ) : isPaid ? (
            <CheckCircle2 className="w-6 h-6 text-green-500 mt-0.5" />
          ) : (
            <Loader2 className="w-6 h-6 text-primary animate-spin mt-0.5" />
          )}
          <div>
            <h1 className="text-xl font-semibold">{heading}</h1>
            {purchase && (
              <p className="text-sm text-muted-foreground mt-1">
                Order {purchase.id.slice(0, 8)} · {formatPrice(purchase.amount_cents)} ·{" "}
                <Badge variant="secondary" className="ml-1 capitalize">
                  {purchase.item_kind}
                </Badge>
              </p>
            )}
            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
          </div>
        </div>

        {!isPaid && !error && (
          <p className="text-sm text-muted-foreground">
            Stripe is confirming your payment. This usually takes just a few seconds — please don't
            close this page.
          </p>
        )}

        {isPaid && item && (
          <div className="space-y-4 mt-2">
            <Card className="overflow-hidden bg-muted/40">
              <div className="aspect-video bg-muted flex items-center justify-center">
                {item.media_type === "video" ? (
                  <video
                    src={item.url}
                    poster={item.thumbnail_url || undefined}
                    controls
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img
                    src={item.thumbnail_url || item.url}
                    alt={item.title || "Purchased item"}
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
              <div className="p-3">
                <p className="font-medium truncate">{item.title || "Untitled"}</p>
                <p className="text-xs text-muted-foreground">
                  by {item.creator_display_name || "Member"}
                </p>
              </div>
            </Card>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={handleDownload} disabled={downloading} className="flex-1">
                {downloading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Download now
              </Button>
              <Button variant="outline" asChild className="flex-1">
                <Link to="/library/public">
                  <ShoppingBag className="w-4 h-4 mr-2" /> Back to Library
                </Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              You can re-download this anytime from your purchase history.
            </p>
          </div>
        )}

        {isPaid && !item && (
          <p className="text-sm text-muted-foreground">
            Payment received, but the item file isn't available right now. Try again in a moment or
            contact support.
          </p>
        )}
      </Card>
    </PageShell>
  );
};

export default ShopPurchaseSuccessPage;
