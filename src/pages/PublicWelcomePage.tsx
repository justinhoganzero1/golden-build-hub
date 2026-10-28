import { useState } from "react";
import { Link } from "react-router-dom";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import portrait from "@/assets/avatars/oracle-futuristic-office.jpg";
import listeningClip from "@/assets/avatars/oracle-office-listening-silent.webm";
import greetingClip from "@/assets/avatars/oracle-clip-greeting.webm";

/**
 * Public front door for signed-out visitors: they meet the Oracle presenter
 * and read the pitch before any sign-in wall. Signed-in users never see this
 * (the root route redirects them to /oracle). Features stay membership-gated;
 * this page is marketing only. Footage is AI-generated and labelled as such.
 */
export default function PublicWelcomePage() {
  const [soundOn, setSoundOn] = useState(false);
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <img src={portrait} alt="Oracle, your AI companion" className="absolute inset-0 h-full w-full object-cover object-center" />
      <video
        key={soundOn ? "greeting" : "listening"}
        src={soundOn ? greetingClip : listeningClip}
        autoPlay
        muted={!soundOn}
        loop={!soundOn}
        playsInline
        preload="auto"
        onEnded={() => setSoundOn(false)}
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-background/15" />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-end px-6 pb-14 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Meet <span className="text-primary">Oracle</span>
        </h1>
        <p className="mt-3 max-w-md text-lg text-muted-foreground">
          Your AI best friend, always here for you. Chat, write stories, make videos, build apps and more — all in one place.
        </p>
        <div className="mt-8 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="text-base">
            <Link to="/sign-in">Get started</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="text-base">
            <Link to="/sign-in">Sign in</Link>
          </Button>
        </div>
        <div className="mt-4 flex items-center gap-5 text-sm">
          <button
            type="button"
            onClick={() => setSoundOn(true)}
            className="inline-flex items-center gap-1.5 text-primary hover:underline"
          >
            <Volume2 className="h-4 w-4" />Hear her say hello
          </button>
          <Link to="/ad" className="text-muted-foreground hover:underline">Watch the ad</Link>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">Oracle is an AI. Presenter footage is AI-generated.</p>
      </div>
    </div>
  );
}
