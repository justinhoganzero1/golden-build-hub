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

  useEffect(() => {
    if (loading || adminLoading) return;
    if (!user) return;
    // Admins land on the Owner Dashboard; everyone else on the SOLACE dashboard
    navigate(isAdmin ? "/owner" : "/dashboard", { replace: true });
  }, [user, loading, isAdmin, adminLoading, navigate]);

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
