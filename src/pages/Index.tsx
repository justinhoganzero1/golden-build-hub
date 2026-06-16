import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import SoundSplash from "@/components/SoundSplash";
import IntroSplash from "@/components/IntroSplash";
import SignInPage from "@/components/SignInPage";

type AppStage = "sound" | "intro" | "signin";

const Index = () => {
  const [stage, setStage] = useState<AppStage>("sound");
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();

  // Lovable preview visitors (id-preview--*.lovable.app or ?preview=1)
  // skip the sound→intro→sign-in flow and land directly on the dashboard
  // so they can browse the full app without authenticating.
  const isLovablePreview =
    typeof window !== "undefined" &&
    (window.location.hostname.includes("lovable.app") ||
      new URLSearchParams(window.location.search).get("preview") === "1");

  useEffect(() => {
    if (loading || adminLoading) return;
    if (isLovablePreview) {
      navigate("/dashboard", { replace: true });
      return;
    }
    if (!user) return;
    // All users — including admins — land on the main ORACLE LUNAR dashboard.
    navigate("/dashboard", { replace: true });
  }, [user, loading, isAdmin, adminLoading, navigate, isLovablePreview]);

  if (loading || adminLoading) return null;

  if (loading) return null;

  return (
    <>
      {stage === "sound" && (
        <SoundSplash onEnable={() => setStage("intro")} />
      )}
      {stage === "intro" && (
        <IntroSplash onComplete={() => setStage("signin")} />
      )}
      {stage === "signin" && <SignInPage />}
    </>
  );
};

export default Index;
