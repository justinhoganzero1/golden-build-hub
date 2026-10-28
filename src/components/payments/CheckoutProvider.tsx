import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CheckoutRequest {
  /** Edge function that creates the checkout session (returns { clientSecret }). */
  functionName: string;
  /** Body sent to the function — environment is added automatically. */
  body?: Record<string, unknown>;
  /** Title shown above the payment form. */
  title?: string;
  /** Called with the function's full response (e.g. gif_id) before the form opens. */
  onResponse?: (data: Record<string, unknown>) => void;
}

interface CheckoutContextValue {
  openCheckout: (req: CheckoutRequest) => Promise<void>;
  closeCheckout: () => void;
  isOpen: boolean;
}

const CheckoutContext = createContext<CheckoutContextValue | null>(null);

export function useCheckout(): CheckoutContextValue {
  const ctx = useContext(CheckoutContext);
  if (!ctx) throw new Error("useCheckout must be used inside <CheckoutProvider>");
  return ctx;
}

// Global opener so any existing button can start checkout without a hook.
let globalOpen: ((req: CheckoutRequest) => Promise<void>) | null = null;

export function openCheckoutGlobal(req: CheckoutRequest): Promise<void> {
  if (!globalOpen) {
    toast.error("Checkout is not ready yet — please try again in a moment.");
    return Promise.reject(new Error("Checkout provider not mounted"));
  }
  return globalOpen(req);
}

const FRIENDLY_ERRORS: Record<string, string> = {
  founder_seats_gone: "All 500 founder seats are taken.",
  already_founder: "You already own a founder seat.",
  auth_required: "Please sign in first.",
};

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<CheckoutRequest | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const closeCheckout = useCallback(() => {
    setRequest(null);
    setClientSecret(null);
    setLoading(false);
  }, []);

  const openCheckout = useCallback(async (req: CheckoutRequest) => {
    setLoading(true);
    setRequest(req);
    setClientSecret(null);
    try {
      const { data, error } = await supabase.functions.invoke(req.functionName, {
        body: { ...(req.body ?? {}), environment: getStripeEnvironment() },
      });
      if (error) throw new Error(error.message || "Checkout failed to start");
      if (data?.error) throw new Error(FRIENDLY_ERRORS[data.error] ?? data.error);
      req.onResponse?.(data ?? {});
      if (data?.already_unlocked || data?.admin_bypass) {
        // Nothing to pay — the caller's onResponse handles it.
        closeCheckout();
        return;
      }
      if (!data?.clientSecret) throw new Error("No payment session returned");
      setClientSecret(data.clientSecret);
    } catch (e) {
      console.error("[checkout]", e);
      toast.error(e instanceof Error ? e.message : "Checkout failed to start");
      closeCheckout();
    } finally {
      setLoading(false);
    }
  }, [closeCheckout]);

  useEffect(() => {
    globalOpen = openCheckout;
    return () => { globalOpen = null; };
  }, [openCheckout]);

  return (
    <CheckoutContext.Provider value={{ openCheckout, closeCheckout, isOpen: !!request }}>
      {children}
      <Dialog open={!!request} onOpenChange={(open) => { if (!open) closeCheckout(); }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>{request?.title ?? "Secure checkout"}</DialogTitle>
          </DialogHeader>
          <div className="px-2 pb-4 min-h-[300px]">
            {loading && (
              <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
                Preparing secure checkout…
              </div>
            )}
            {clientSecret && (
              <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </CheckoutContext.Provider>
  );
}
