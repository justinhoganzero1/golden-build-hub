// Success landing for Movie Studio Pro Stripe Checkout.
// Verifies payment, kicks off rendering pipeline, redirects to /movie-studio-pro.
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SEO from "@/components/SEO";

export default function MoviePaymentSuccessPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your payment…");

  useEffect(() => {
    const sessionId = params.get("session_id");
    const projectId = params.get("project_id");
    if (!sessionId || !projectId) {
      setStatus("error");
      setMessage("Missing payment details. Please return to the studio.");
      return;
    }
    (async () => {
      const { data, error } = await supabase.functions.invoke("verify-movie-payment", {
        body: { session_id: sessionId, project_id: projectId },
      });
      if (error || data?.error) {
        setStatus("error");
        setMessage(error?.message || data?.error || "Payment verification failed.");
        return;
      }
      if (!data?.paid) {
        setStatus("error");
        setMessage(`Payment status: ${data?.status ?? "unknown"}. Please try again.`);
        return;
      }
      setStatus("success");
      setMessage("Payment confirmed! Your movie is now rendering. Redirecting…");
      toast.success("Movie payment successful — rendering started!");
      setTimeout(() => navigate("/movie-studio-pro"), 2500);
    })();
  }, [params, navigate]);

  return (
    <>
      <SEO title="Payment Success — Movie Studio Pro" path="/movie-payment-success" />
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full p-8 text-center">
          {status === "loading" && (
            <>
              <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary mb-4" />
              <h1 className="text-xl font-bold mb-2">Processing payment</h1>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="w-12 h-12 mx-auto text-primary mb-4" />
              <h1 className="text-xl font-bold mb-2">🎬 Payment confirmed!</h1>
            </>
          )}
          {status === "error" && (
            <>
              <AlertTriangle className="w-12 h-12 mx-auto text-destructive mb-4" />
              <h1 className="text-xl font-bold mb-2">Verification issue</h1>
            </>
          )}
          <p className="text-sm text-muted-foreground mb-4">{message}</p>
          {status === "error" && (
            <Button onClick={() => navigate("/movie-studio-pro")}>Back to Studio</Button>
          )}
        </Card>
      </div>
    </>
  );
}
