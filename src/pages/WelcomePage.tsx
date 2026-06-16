import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import SoundSplash from "@/components/SoundSplash";
import IntroSplash from "@/components/IntroSplash";
import SignInPage from "@/components/SignInPage";

type AppStage = "sound" | "intro" | "signin";

/**
 * The original onboarding flow (sound → intro → sign-in).
 * Moved off "/" so the marketing portal can own the root.
 */
const WelcomePage = () => {
  const [stage, setStage] = useState<AppStage>("sound");
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  if (loading) return null;

  return (
    <>
      {stage === "sound" && <SoundSplash onEnable={() => setStage("intro")} />}
      {stage === "intro" && <IntroSplash onComplete={() => setStage("signin")} />}
      {stage === "signin" && <SignInPage />}
    </>
  );
};

export default WelcomePage;
