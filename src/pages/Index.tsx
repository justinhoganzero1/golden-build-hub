import { useState } from "react";
import SoundSplash from "@/components/SoundSplash";
import IntroSplash from "@/components/IntroSplash";
import SignInPage from "@/components/SignInPage";

type AppStage = "sound" | "intro" | "signin";

const Index = () => {
  const [stage, setStage] = useState<AppStage>("sound");

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
