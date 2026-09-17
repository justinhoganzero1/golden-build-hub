import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Coins, Loader2, Wallet, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { WALLET_INSUFFICIENT_EVENT, WalletInsufficientDetail } from "@/lib/walletPaywall";
import { useNavigate, useLocation } from "react-router-dom";

const COINS_PER_DOLLAR = 5.37;
const DEFAULT_PACK = 10;
const OTHER_PACKS = [5, 20, 50];

const WalletPaywallModal = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<WalletInsufficientDetail>({});
  const [loading, setLoading] = useState<number | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      setOpen((prev) => {
        // Ignore repeat events while the modal is already up (or mid-checkout).
        if (prev) return prev;
        setDetail((e as CustomEvent).detail || {});
        return true;
      });
    };
    window.addEventListener(WALLET_INSUFFICIENT_EVENT, handler);
    return () => window.removeEventListener(WALLET_INSUFFICIENT_EVENT, handler);
  }, []);

  const buy = async (dollars: number) => {
    if (!user) {
      toast.error("Please sign in first.");
      return;
    }
    setLoading(dollars);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { coinPackDollars: dollars, returnTo: location.pathname },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Checkout did not return a payment link.");
      window.location.href = data.url;
    } catch (err: any) {
      toast.error(err?.message || "Could not open checkout.");
      setLoading(null);
    }
  };

  const balance = (detail.balanceCents ?? 0) / 100;
  const need = (detail.requiredCents ?? 0) / 100;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md border-primary/30 bg-background/95 backdrop-blur">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-primary/10">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle className="text-primary">You've hit the cap</DialogTitle>
          </div>
          <DialogDescription>
            Add credit and you're back working in about ten seconds. You only ever pay for what you use.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-card/60 p-3 text-sm mb-3">
          <div className="flex justify-between"><span className="text-muted-foreground">Balance</span><span>${balance.toFixed(2)}</span></div>
          {need > 0 && (
            <div className="flex justify-between mt-1"><span className="text-muted-foreground">Needed</span><span>${need.toFixed(2)}</span></div>
          )}
        </div>

        {/* Primary, front-and-centre action */}
        <Button
          size="lg"
          className="w-full h-16 text-lg font-extrabold rounded-2xl"
          disabled={loading !== null}
          onClick={() => buy(DEFAULT_PACK)}
        >
          {loading === DEFAULT_PACK ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Zap className="w-5 h-5 mr-2" /> Add ${DEFAULT_PACK} to keep going
            </>
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground mt-2">
          {(DEFAULT_PACK * COINS_PER_DOLLAR).toFixed(0)} coins · card payment · instant
        </p>

        <div className="grid grid-cols-3 gap-2 mt-4">
          {OTHER_PACKS.map((d) => (
            <Button
              key={d}
              variant="outline"
              size="sm"
              className="border-primary/20"
              disabled={loading !== null}
              onClick={() => buy(d)}
            >
              {loading === d ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Coins className="w-3 h-3 mr-1" />${d}</>}
            </Button>
          ))}
        </div>

        <div className="mt-4 text-center space-y-1">
          <button
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-primary"
            onClick={() => { setOpen(false); nav("/get-api-key/openai"); }}
          >
            Rather use your own API key? Set one up here
          </button>
          <div className="flex justify-center gap-4 pt-1">
            <button className="text-xs text-muted-foreground hover:text-primary" onClick={() => { setOpen(false); nav("/wallet"); }}>
              Full wallet
            </button>
            <button className="text-xs text-muted-foreground hover:text-primary" onClick={() => setOpen(false)}>
              Not now
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WalletPaywallModal;
