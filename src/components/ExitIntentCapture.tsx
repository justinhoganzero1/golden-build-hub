import { forwardRef, useEffect, useState } from "react";
import { Sparkles, Gift, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Exit-intent email capture modal.
 * Triggers when desktop user moves mouse to leave the tab,
 * or after 30s of inactivity on mobile.
 * Logs captured emails to inquiry_leads with source='exit_intent'.
 */
const ExitIntentCapture = forwardRef<HTMLDivElement, Record<string, never>>((_, ref) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (sessionStorage.getItem("solace-exit-shown") === "1") return;

    const trigger = () => {
      if (sessionStorage.getItem("solace-exit-shown") === "1") return;
      sessionStorage.setItem("solace-exit-shown", "1");
      setOpen(true);
    };

    // Desktop: detect mouse leaving viewport top
    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) trigger();
    };

    // Mobile fallback: trigger after 45s if user hasn't installed
    const mobileTimer = window.setTimeout(trigger, 45_000);

    document.addEventListener("mouseleave", onMouseLeave);
    return () => {
      document.removeEventListener("mouseleave", onMouseLeave);
      window.clearTimeout(mobileTimer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await supabase.from("inquiry_leads").insert({
        name: name.trim() || null,
        email: email.trim(),
        message: "Exit-intent capture: requested lifetime free access offer.",
        source: "exit_intent",
        interest: "lifetime_offer",
      });
      toast({
        title: "🎁 You're on the list!",
        description: "Check your email — we'll send your lifetime access link within 24 hours.",
      });
      setOpen(false);
    } catch (err) {
      toast({
        title: "Couldn't save your email",
        description: "Please try again or use the Concierge to reach us.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div ref={ref}>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md border-primary/40 shadow-[0_0_60px_hsl(var(--primary)/0.4)]">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary animate-pulse">
            <Gift className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-center text-2xl">
            Wait — get <span className="text-primary">lifetime free access</span>
          </DialogTitle>
          <DialogDescription className="text-center">
            Drop your email and we'll send you a private link to unlock SOLACE Pro forever.
            No credit card. Limited to first 100 sign-ups.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <Input
            type="text"
            placeholder="Your name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
          />
          <Input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            autoFocus
          />
          <Button
            type="submit"
            size="lg"
            disabled={submitting || !email.trim()}
            className="w-full shadow-[0_0_30px_hsl(var(--primary)/0.5)]"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-5 w-5 mr-2" />
            )}
            Claim my lifetime access
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            We'll never spam you. Unsubscribe anytime.
          </p>
        </form>
        </DialogContent>
      </Dialog>
    </div>
  );
});

ExitIntentCapture.displayName = "ExitIntentCapture";

export default ExitIntentCapture;
