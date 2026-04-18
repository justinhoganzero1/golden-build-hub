import { useState } from "react";
import { PhoneCall, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  destination: string;       // E.164, e.g. +611300467875
  destinationLabel: string;  // e.g. "HostPlus"
  trigger: React.ReactNode;
}

const AssistedCallDialog = ({ destination, destinationLabel, trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [estimate, setEstimate] = useState<{ total: number; cpm: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchEstimate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("oracle-place-call", {
        body: { destination, user_phone: phone || "+61400000000", action: "estimate" },
      });
      if (error) throw error;
      setEstimate({ total: data.total_per_minute_cents, cpm: data.twilio_cost_per_minute_cents });
    } catch (e: any) {
      toast.error(e.message ?? "Could not fetch estimate");
    } finally {
      setLoading(false);
    }
  };

  const placeCall = async () => {
    if (!phone || phone.length < 8) {
      toast.error("Enter your phone number (e.g. +61400000000)");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("oracle-place-call", {
        body: { destination, user_phone: phone, action: "place" },
      });
      if (error) throw error;
      if (data?.error === "insufficient_balance") {
        toast.error(data.message ?? "Top up your wallet to start the call");
        return;
      }
      toast.success("Calling you now — pick up to be patched through.");
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Call failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button onClick={() => { setOpen(true); fetchEstimate(); }} className="contents">
        {trigger}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-primary/30 bg-card p-5 relative">
            <button onClick={() => setOpen(false)} className="absolute top-3 right-3 text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-primary font-bold mb-1">
              <PhoneCall className="w-5 h-5" /> Oracle Assisted Call
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Oracle will dial <span className="text-foreground font-medium">{destinationLabel}</span>, navigate the IVR, and patch you through.
            </p>

            <label className="text-xs text-muted-foreground">Your phone (E.164)</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+61400000000"
              className="w-full mt-1 mb-4 px-3 py-2 rounded-lg bg-input border border-border text-sm outline-none"
            />

            {estimate && (
              <div className="rounded-lg bg-secondary/50 border border-border p-3 mb-4 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Twilio cost</span>
                  <span>AU ${(estimate.cpm / 100).toFixed(2)}/min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service fee (+50%)</span>
                  <span>AU ${((estimate.total - estimate.cpm) / 100).toFixed(2)}/min</span>
                </div>
                <div className="flex justify-between font-bold text-primary border-t border-border pt-1 mt-1">
                  <span>You pay</span>
                  <span>AU ${(estimate.total / 100).toFixed(2)}/min</span>
                </div>
              </div>
            )}

            <button
              onClick={placeCall}
              disabled={loading}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneCall className="w-4 h-4" />}
              Place Call Now
            </button>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              Billed per second from your wallet when the call ends.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default AssistedCallDialog;
