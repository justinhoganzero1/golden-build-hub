import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ExternalLink, Loader2, Plus, Store } from "lucide-react";

interface AccountStatus {
  hasAccount: boolean;
  accountId?: string;
  displayName?: string;
  contactEmail?: string;
  readyToProcessPayments?: boolean;
  onboardingComplete?: boolean;
  requirementsStatus?: string | null;
  cardPaymentsStatus?: string | null;
}

/**
 * StripeConnectPanel — drop-in panel for the Creators Page (and reused on the
 * Owner Dashboard). Walks the user through:
 *   1. Create a V2 connected account
 *   2. Open hosted onboarding
 *   3. View live status
 *   4. Create demo products on their connected account
 *   5. Visit their public storefront
 */
export default function StripeConnectPanel() {
  const { user, isReady, accessToken } = useAuthReady();
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [linking, setLinking] = useState(false);

  // New product form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceUsd, setPriceUsd] = useState("9.99");
  const [submittingProduct, setSubmittingProduct] = useState(false);

  const refreshStatus = async () => {
    if (!isReady || !user || !accessToken) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("connect-account", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: { action: "status" },
      });
      if (error) throw error;
      setStatus(data as AccountStatus);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load Connect status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isReady || !user || !accessToken) return;
    refreshStatus();
    // Re-fetch when returning from Stripe-hosted onboarding
    const params = new URLSearchParams(window.location.search);
    if (params.get("connect") === "return") {
      toast.success("Welcome back! Refreshing onboarding status…");
    }
  }, [isReady, user?.id, accessToken]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("connect-account", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: {
          action: "create",
          displayName: user?.email?.split("@")[0],
          contactEmail: user?.email,
        },
      });
      if (error) throw error;
      toast.success(
        data?.existed ? "Account already exists" : "Connect account created"
      );
      await refreshStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create account");
    } finally {
      setCreating(false);
    }
  };

  const handleOnboard = async () => {
    setLinking(true);
    try {
      const { data, error } = await supabase.functions.invoke("connect-account", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: { action: "link" },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start onboarding");
    } finally {
      setLinking(false);
    }
  };

  const handleCreateProduct = async () => {
    const cents = Math.round(Number.parseFloat(priceUsd) * 100);
    if (!name.trim() || !Number.isFinite(cents) || cents < 50) {
      toast.error("Enter a name and a price of at least $0.50");
      return;
    }
    setSubmittingProduct(true);
    try {
      const { data, error } = await supabase.functions.invoke("connect-products", {
        body: {
          action: "create",
          name: name.trim(),
          description: description.trim() || undefined,
          priceCents: cents,
          currency: "usd",
        },
      });
      if (error) throw error;
      toast.success(`Product created: ${data?.productId}`);
      setName("");
      setDescription("");
      setPriceUsd("9.99");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create product");
    } finally {
      setSubmittingProduct(false);
    }
  };

  if (!user) {
    return (
      <Card className="p-6 border-amber-500/20 bg-card/60">
        <p className="text-sm text-muted-foreground">
          Sign in to test Stripe Connect onboarding.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-amber-500/20 bg-card/60 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Store className="w-5 h-5 text-amber-400" />
            Stripe Connect (Demo)
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Onboard yourself as a creator, list products, and accept payments.
            ORACLE LUNAR keeps a 10% application fee.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshStatus}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
        </Button>
      </header>

      {/* Step 1 — create */}
      {!status?.hasAccount && (
        <div className="space-y-2">
          <p className="text-sm">Step 1: Create your Stripe Connect account.</p>
          <Button onClick={handleCreate} disabled={creating}>
            {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Create Connect account
          </Button>
        </div>
      )}

      {/* Step 2+ — onboard / status */}
      {status?.hasAccount && (
        <div className="space-y-3">
          <div className="text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Account:</span>{" "}
              <code className="text-xs">{status.accountId}</code>
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant={status.onboardingComplete ? "default" : "secondary"}>
                {status.onboardingComplete ? "Onboarding complete" : "Onboarding incomplete"}
              </Badge>
              <Badge variant={status.readyToProcessPayments ? "default" : "secondary"}>
                Card payments: {status.cardPaymentsStatus ?? "—"}
              </Badge>
              {status.requirementsStatus && (
                <Badge variant="outline">
                  Requirements: {status.requirementsStatus}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleOnboard} disabled={linking} variant="default">
              {linking && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {status.onboardingComplete ? "Update onboarding" : "Continue onboarding"}
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
            <Button asChild variant="outline">
              <a href={`/store/${status.accountId}`} target="_blank" rel="noreferrer">
                View public storefront <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </div>
        </div>
      )}

      {/* Product creator (only useful once you've onboarded) */}
      {status?.hasAccount && (
        <div className="space-y-3 border-t border-amber-500/10 pt-4">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create a product
          </h4>
          <label htmlFor="stripe-product-name" className="sr-only">Product name</label>
          <Input
            id="stripe-product-name"
            name="productName"
            placeholder="Product name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label htmlFor="stripe-product-description" className="sr-only">Product description</label>
          <Textarea
            id="stripe-product-description"
            name="productDescription"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
          <label htmlFor="stripe-product-price" className="sr-only">Product price in USD</label>
          <Input
            id="stripe-product-price"
            name="productPrice"
            type="number"
            step="0.01"
            min="0.50"
            placeholder="Price (USD)"
            value={priceUsd}
            onChange={(e) => setPriceUsd(e.target.value)}
          />
          <Button onClick={handleCreateProduct} disabled={submittingProduct}>
            {submittingProduct && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Create product on my Connect account
          </Button>
        </div>
      )}
    </Card>
  );
}
