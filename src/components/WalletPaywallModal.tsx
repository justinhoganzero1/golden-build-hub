import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Coins, Loader2, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { WALLET_INSUFFICIENT_EVENT, WalletInsufficientDetail } from "@/lib/walletPaywall";
import { useNavigate } from "react-router-dom";

const COINS_PER_DOLLAR = 5.37;
const packs = [5, 10, 20, 50];

const WalletPaywallModal = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<WalletInsufficientDetail>({});
  const [loading, setLoading] = useState<number | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      setDetail((e as CustomEvent).detail || {});
      setOpen(true);
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
        body: { coinPackDollars: dollars },
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
            <DialogTitle className="text-primary">You've hit the wall</DialogTitle>
          </div>
          <DialogDescription>
            Your coin wallet ran out on your last request. Top up to keep going —
            every user has their own private wallet, and you only pay when you use it.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-card/60 p-3 text-sm mb-3">
          <div className="flex justify-between"><span className="text-muted-foreground">Balance</span><span>${balance.toFixed(2)}</span></div>
          {need > 0 && (
            <div className="flex justify-between mt-1"><span className="text-muted-foreground">Needed</span><span>${need.toFixed(2)}</span></div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {packs.map((d) => (
            <Button
              key={d}
              variant="outline"
              className="h-auto py-3 flex flex-col items-center border-primary/30 hover:bg-primary/10"
              disabled={loading !== null}
              onClick={() => buy(d)}
            >
              {loading === d ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <div className="flex items-center gap-1 text-primary font-semibold">
                    <Coins className="w-4 h-4" /> {(d * COINS_PER_DOLLAR).toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground">${d}</div>
                </>
              )}
            </Button>
          ))}
        </div>

        <div className="flex justify-between mt-3">
          <Button variant="ghost" size="sm" onClick={() => { setOpen(false); nav("/wallet"); }}>
            Full wallet
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Not now</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WalletPaywallModal;
