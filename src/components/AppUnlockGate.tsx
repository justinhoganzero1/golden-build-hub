import { ReactNode, useState } from "react";
import { Lock, Sparkles, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppUnlock, APP_PRICING, type AppKey } from "@/hooks/useAppUnlock";

interface Props {
  appKey: AppKey;
  children: ReactNode;
}

/**
 * Hard paywall for one-time unlock apps (App Wrapper, App Maker, Movie Studio).
 * Renders children only if the signed-in user has paid for this app's lifetime
 * unlock. Otherwise shows a Stripe checkout CTA. Admins bypass automatically.
 */
const AppUnlockGate = ({ appKey, children }: Props) => {
  const { unlocked, loading } = useAppUnlock(appKey);
  const [paying, setPaying] = useState(false);
  const navigate = useNavigate();
  const meta = APP_PRICING[appKey];

  const startCheckout = async () => {
    setPaying(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-app-unlock", {
        body: { app_key: appKey },
      });
      if (error) throw error;
      if ((data as any)?.already_unlocked) {
        toast.success("You already own this — refreshing.");
        window.location.reload();
        return;
      }
      const url = (data as any)?.url;
      if (!url) throw new Error("No checkout URL");
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't start checkout");
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center bg-card border-primary/30 shadow-[0_0_60px_hsl(var(--primary)/0.2)]">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/15 border border-primary/40 flex items-center justify-center mb-5">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Unlock {meta.label}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          One-time payment of <span className="text-primary font-semibold">{meta.price}</span> — lifetime
          access on this account. No subscription, no recurring charges.
        </p>
        <Button
          size="lg"
          onClick={startCheckout}
          disabled={paying}
          className="w-full shadow-[0_0_30px_hsl(var(--primary)/0.4)]"
        >
          {paying ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5 mr-2" />
          )}
          {paying ? "Opening checkout…" : `Unlock for ${meta.price}`}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/apps")}
          className="mt-4 text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to apps
        </Button>
      </Card>
    </div>
  );
};

export default AppUnlockGate;
