import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Sparkles, Clock, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const SESSION_FLAG = "oracle_byok_reminder_shown_v2";
const TRIAL_DAYS = 7;

// Shows a big positive-then-urgent countdown modal after login when the user
// is inside the final 3 days of their trial AND has not yet added their own
// OpenAI or Gemini key. One appearance per browser session so it never nags.
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
      // How far into the trial is this user?
      const createdIso = (user as any).created_at as string | undefined;
      if (!createdIso) return;
      const createdMs = new Date(createdIso).getTime();
      const elapsedDays = Math.floor((Date.now() - createdMs) / 86_400_000);
      const remaining = Math.max(0, TRIAL_DAYS - elapsedDays);

      // Only bother them in the final 3 days of the trial.
      if (remaining > 3) return;

      const { data } = await supabase
        .from("user_ai_keys")
        .select("openai_key, gemini_key")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      const hasOpenAI = !!(data?.openai_key && data.openai_key.length > 10);
      const hasGemini = !!(data?.gemini_key && data.gemini_key.length > 10);
      if (hasOpenAI && hasGemini) return; // fully set up — silence

      sessionStorage.setItem(SESSION_FLAG, "1");
      setDaysLeft(remaining);
      setMissingProvider(!hasOpenAI && !hasGemini ? "both" : !hasOpenAI ? "openai" : "gemini");
      setOpen(true);
    })();

    return () => { cancelled = true; };
  }, [user]);

  if (!open) return null;

  const urgent = daysLeft <= 1;
  const targetProvider: "openai" | "gemini" = missingProvider === "gemini" ? "gemini" : "openai";
  const targetLabel = targetProvider === "openai" ? "OpenAI (for Nova)" : "Google Gemini (for Lyra)";

  const goWizard = () => { setOpen(false); navigate(`/get-api-key/${targetProvider}`); };
  const later = () => setOpen(false);

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
                Your membership is about to be terminated.
              </h2>
              <p className="mt-3 text-base italic font-semibold text-muted-foreground">
                You must load an API key to keep Nova and Lyra alive.
              </p>
              <p className="mt-2 text-sm italic text-muted-foreground">
                Follow the simple instructions — it takes 2 minutes and it's free.
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
