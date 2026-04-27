import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { APP_PRICING, type AppKey } from "@/hooks/useAppUnlock";

const APP_ROUTES: Record<AppKey, string> = {
  app_wrapper: "/web-wrapper",
  app_maker: "/app-builder",
  movie_studio: "/movie-studio-pro",
  photo_templates: "/photography-hub",
};

const UnlockSuccessPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"verifying" | "ok" | "fail">("verifying");
  const [error, setError] = useState("");

  const appKey = params.get("app") as AppKey | null;
  const sessionId = params.get("session_id");

  useEffect(() => {
    (async () => {
      if (!appKey || !sessionId || !APP_PRICING[appKey]) {
        setStatus("fail");
        setError("Missing payment details");
        return;
      }
      const { data, error } = await supabase.functions.invoke("verify-app-unlock", {
        body: { app_key: appKey, session_id: sessionId },
      });
      if (error || !(data as any)?.unlocked) {
        setStatus("fail");
        setError(error?.message ?? (data as any)?.reason ?? "Payment not confirmed");
        return;
      }
      setStatus("ok");
      setTimeout(() => navigate(APP_ROUTES[appKey]), 1500);
    })();
  }, [appKey, sessionId, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        {status === "verifying" && (
          <>
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-semibold">Confirming your payment…</h1>
          </>
        )}
        {status === "ok" && appKey && (
          <>
            <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-1">Unlocked!</h1>
            <p className="text-sm text-muted-foreground">
              Opening {APP_PRICING[appKey].label}…
            </p>
          </>
        )}
        {status === "fail" && (
          <>
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-1">Couldn't confirm payment</h1>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => navigate("/apps")}>Back to apps</Button>
          </>
        )}
      </Card>
    </div>
  );
};

export default UnlockSuccessPage;
