import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Sparkles, Clock, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { decideApiKeyReminder } from "@/lib/apiKeyReminderLogic";
import { trackEvent } from "@/lib/analytics";

const SESSION_FLAG = "oracle_byok_reminder_shown_v2";

// Shows a positive-then-urgent countdown modal when the user is inside the
// final 3 days of their trial AND has not yet added their own OpenAI/Gemini
// key. Skipped entirely for owner / unlimited-AI / reward-holder accounts.
// See src/lib/apiKeyReminderLogic.ts for the (unit-tested) decision function.
const ApiKeyReminder = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number>(0);
  const [missingProvider, setMissingProvider] = useState<"openai" | "gemini" | "both">("both");

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_FLAG)) return;

    let cancelled = false;
    (async () => {
      const [ownerRes, unlimitedRes, rewardRes, keysRes] = await Promise.all([
        supabase.rpc("is_owner"),
        supabase.rpc("has_unlimited_ai"),
        supabase.rpc("has_active_reward", { _user_id: user.id }),
        supabase.from("user_ai_keys").select("openai_key, gemini_key").eq("user_id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;

      const decision = decideApiKeyReminder({
        createdAtIso: (user as { created_at?: string }).created_at,
        isOwner: ownerRes.data === true,
        hasUnlimitedAi: unlimitedRes.data === true,
        hasActiveReward: rewardRes.data === true,
        hasOpenAI: !!(keysRes.data?.openai_key && keysRes.data.openai_key.length > 10),
        hasGemini: !!(keysRes.data?.gemini_key && keysRes.data.gemini_key.length > 10),
      });

      if (!decision.show) return;

      sessionStorage.setItem(SESSION_FLAG, "1");
      setDaysLeft(decision.daysLeft);
      setMissingProvider(decision.missingProvider);
      setOpen(true);
      void trackEvent("api_key_reminder_shown", {
        detail: `days_left=${decision.daysLeft}`,
        source: decision.urgent ? "urgent" : "friendly",
        medium: decision.missingProvider,
      });
    })();

    return () => { cancelled = true; };
  }, [user]);

  if (!open) return null;

  const urgent = daysLeft <= 1;
  const targetProvider: "openai" | "gemini" = missingProvider === "gemini" ? "gemini" : "openai";
  const targetLabel = targetProvider === "openai" ? "OpenAI (for Nova)" : "Google Gemini (for Lyra)";

  const goWizard = () => {
    void trackEvent("api_key_reminder_cta_clicked", { medium: targetProvider });
    setOpen(false);
    navigate(`/get-api-key/${targetProvider}`);
  };
  const later = () => {
    void trackEvent("api_key_reminder_dismissed", { source: urgent ? "urgent" : "friendly" });
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border-2 border-primary/40 rounded-3xl shadow-2xl shadow-primary/20 p-6 relative animate-in fade-in zoom-in duration-300">
        <button
          onClick={later}
          className="absolute top-3 right-3 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center">
          {urgent ? (
            <div className="mx-auto w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          ) : (
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center mb-4">
              <Clock className="w-8 h-8 text-amber-400" />
            </div>
          )}

          {urgent ? (
            <>
              <h2 className="text-2xl sm:text-3xl font-extrabold italic text-foreground leading-tight">
                Your free trial is almost up.
              </h2>
              <p className="mt-3 text-base italic font-semibold text-muted-foreground">
                Add your own {targetLabel} key to keep using Nova and Lyra for free forever — or top up your wallet to keep going with pay‑per‑use.
              </p>
              <p className="mt-2 text-sm italic text-muted-foreground">
                Takes about 2 minutes. Your account stays active either way.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl sm:text-3xl font-extrabold italic text-foreground leading-tight">
                Your membership will expire in
              </h2>
              <div className="mt-4 flex items-baseline justify-center gap-2">
                <span className="text-7xl font-extrabold italic text-primary tabular-nums">{daysLeft}</span>
                <span className="text-2xl italic font-semibold text-foreground">
                  {daysLeft === 1 ? "day" : "days"}
                </span>
              </div>
              <p className="mt-4 text-sm italic text-muted-foreground">
                Good news — you can keep everything free forever by loading your own {targetLabel} key. Follow the simple instructions.
              </p>
            </>
          )}

          <button
            onClick={goWizard}
            className="mt-8 w-full h-16 rounded-2xl bg-amber-500 text-black text-lg font-extrabold italic hover:bg-amber-400 active:scale-95 transition shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5" /> SHOW ME HOW (2 MIN)
          </button>
          <button
            onClick={later}
            className="mt-3 w-full h-12 rounded-2xl border border-border bg-card text-sm italic font-semibold text-muted-foreground hover:bg-secondary transition"
          >
            {urgent ? "Not now" : "Remind me tomorrow"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyReminder;
