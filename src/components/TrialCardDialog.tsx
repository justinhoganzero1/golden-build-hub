import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Gift } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CARD_REQUIRED_EVENT } from "@/lib/aiAccessEvents";
import { startTrialCardCheck } from "@/lib/trialCard";

/** Raised when a Free member tries a trial tool before verifying a card. */
const TrialCardDialog = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener(CARD_REQUIRED_EVENT, h);
    return () => window.removeEventListener(CARD_REQUIRED_EVENT, h);
  }, []);

  const verify = async () => {
    setBusy(true);
    try {
      setOpen(false);
      await startTrialCardCheck();
    } catch (e: any) {
      toast.error(e?.message || "The card check isn't available right now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[95vw] max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-primary" />Start your free trial</DialogTitle>
          <DialogDescription>
            Verify a card to unlock <strong>3 pictures and 1 eight-second video</strong> for 7 days.
            <strong> $0.00 is charged today</strong> — the card just makes sure each person gets one trial.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Button size="lg" onClick={verify} disabled={busy}><CreditCard className="mr-2 h-4 w-4" />Verify my card — $0.00</Button>
          <Button variant="outline" onClick={() => { setOpen(false); navigate("/membership"); }}>See plans instead</Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">No automatic upgrade. Nothing is charged unless you choose a plan.</p>
      </DialogContent>
    </Dialog>
  );
};

export default TrialCardDialog;
