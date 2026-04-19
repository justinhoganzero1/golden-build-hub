// Quality tier picker + Stripe Checkout launcher for a Movie Studio Pro project.
// User picks tier → we call movie-checkout edge function → redirect to Stripe.
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Crown, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MoviePaymentDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  projectTitle: string;
}

const TIERS = [
  { key: "sd",           label: "SD",           resolution: "720p",      price: "$9",   cents: 900,   blurb: "Quick share-ready render. Good for drafts and social clips." },
  { key: "hd",           label: "HD Cinema",    resolution: "1080p",     price: "$29",  cents: 2900,  blurb: "Cinematic 1080p with audio mix. Most popular choice.", popular: true },
  { key: "4k",           label: "4K Pro",       resolution: "3840×2160", price: "$79",  cents: 7900,  blurb: "Real-ESRGAN 4K upscale. Cinema-grade detail.", premium: true },
  { key: "8k_ultimate",  label: "8K Ultimate",  resolution: "7680×4320", price: "$199", cents: 19900, blurb: "Topaz-grade 8K master. Reserved for showcase films.", ultimate: true },
];

export default function MoviePaymentDialog({ open, onOpenChange, projectId, projectTitle }: MoviePaymentDialogProps) {
  const [busy, setBusy] = useState<string | null>(null);

  const pay = async (tier: string) => {
    setBusy(tier);
    try {
      const { data, error } = await supabase.functions.invoke("movie-checkout", {
        body: { project_id: projectId, quality_tier: tier },
      });
      if (error || data?.error) {
        toast.error(error?.message || data?.error || "Checkout failed");
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Unexpected error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose your render quality</DialogTitle>
          <DialogDescription>
            One-time payment for <strong>{projectTitle}</strong>. Rendering begins immediately after checkout.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 mt-4">
          {TIERS.map(t => (
            <Card
              key={t.key}
              className={`p-4 transition-all ${
                t.ultimate ? "border-primary bg-gradient-to-br from-primary/15 via-card to-card" :
                t.popular  ? "border-primary/40 bg-primary/5" :
                "border-border/50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base">{t.label}</h3>
                    <Badge variant="outline" className="text-[10px]">{t.resolution}</Badge>
                    {t.popular && <Badge className="text-[10px]">Most popular</Badge>}
                    {t.ultimate && <Crown className="w-4 h-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{t.blurb}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{t.price}</p>
                  <p className="text-[10px] text-muted-foreground">one-time</p>
                </div>
              </div>
              <Button
                className="w-full mt-3"
                variant={t.ultimate || t.popular ? "default" : "outline"}
                disabled={!!busy}
                onClick={() => pay(t.key)}
              >
                {busy === t.key ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Opening checkout…</>
                ) : (
                  <><Check className="w-4 h-4 mr-2" /> Pay {t.price} & Render</>
                )}
              </Button>
            </Card>
          ))}
        </div>

        <p className="text-[10px] text-center text-muted-foreground mt-4">
          Secure payment by Stripe. You'll receive an email when your movie is ready (typically 5–20 minutes).
        </p>
      </DialogContent>
    </Dialog>
  );
}
