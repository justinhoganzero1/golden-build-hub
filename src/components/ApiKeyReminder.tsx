import { useEffect } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const SESSION_FLAG = "oracle_byok_reminder_shown_v1";

// Once per browser session, if the logged-in user has NEITHER an OpenAI nor
// a Gemini key saved, show a friendly reminder that Nova/Lyra can run on
// their own free provider account.
const ApiKeyReminder = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_FLAG)) return;

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_ai_keys")
        .select("openai_key, gemini_key")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      const hasOpenAI = !!(data?.openai_key && data.openai_key.length > 10);
      const hasGemini = !!(data?.gemini_key && data.gemini_key.length > 10);
      if (hasOpenAI && hasGemini) {
        sessionStorage.setItem(SESSION_FLAG, "1");
        return;
      }

      sessionStorage.setItem(SESSION_FLAG, "1");

      // Two soft reminders — one per missing provider — with a giant one-tap action.
      setTimeout(() => {
        if (!hasOpenAI) {
          toast("Get your own OpenAI key for Nova", {
            description: "Free trial reminder — set it up once (2 minutes) and Nova runs on YOUR account.",
            duration: 12000,
            action: { label: "GET MY KEY", onClick: () => navigate("/get-api-key/openai") },
          });
        }
      }, 1500);
      setTimeout(() => {
        if (!hasGemini) {
          toast("Get your own Gemini key for Lyra", {
            description: "Free trial reminder — Google gives it free. One tap to start.",
            duration: 12000,
            action: { label: "GET MY KEY", onClick: () => navigate("/get-api-key/gemini") },
          });
        }
      }, 3500);
    })();

    return () => { cancelled = true; };
  }, [user, navigate]);

  return null;
};

export default ApiKeyReminder;
