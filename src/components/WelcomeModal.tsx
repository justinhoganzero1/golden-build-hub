import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sparkles, Gift, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const WELCOME_KEY_PREFIX = "oracle-lunar-welcome-shown-";

const WelcomeModal = () => {
  // Disabled: visitors and users go straight to the dashboard, no welcome popup.
  return null;
  // eslint-disable-next-line no-unreachable
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const key = WELCOME_KEY_PREFIX + user.id;
    if (!localStorage.getItem(key)) {
      // Slight delay so the dashboard renders first
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [user]);

  const handleClose = () => {
    if (user) localStorage.setItem(WELCOME_KEY_PREFIX + user.id, "1");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md border-primary/40 bg-gradient-to-br from-card via-background to-card text-center">
        <div className="flex justify-center mb-2">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center shadow-[0_0_30px_hsl(var(--primary)/0.6)]">
            <Sparkles className="w-8 h-8 text-primary-foreground" />
          </div>
        </div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-amber-400 bg-clip-text text-transparent">
          Welcome to ORACLE LUNAR
        </h2>
        <p className="text-sm text-muted-foreground">
          Your 30 days of full Tier 3 access starts now — no card, no catch.
        </p>
        <div className="grid grid-cols-2 gap-2 my-3 text-left">
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/30">
            <Gift className="w-4 h-4 text-primary mb-1" />
            <div className="text-xs font-semibold">All AI tools</div>
            <div className="text-[10px] text-muted-foreground">Unlocked</div>
          </div>
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/30">
            <Zap className="w-4 h-4 text-primary mb-1" />
            <div className="text-xs font-semibold">Premium voices</div>
            <div className="text-[10px] text-muted-foreground">Included</div>
          </div>
        </div>
        <Button onClick={handleClose} className="w-full bg-gradient-to-r from-primary to-amber-500 text-primary-foreground font-bold">
          Start Exploring
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default WelcomeModal;
