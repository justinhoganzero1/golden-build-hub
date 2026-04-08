import { useEffect, useState } from "react";
import solaceLogo from "@/assets/solace-logo.png";

interface IntroSplashProps {
  onComplete: () => void;
}

const IntroSplash = ({ onComplete }: IntroSplashProps) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onComplete, 500);
    }, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-40 flex flex-col items-center justify-center bg-background transition-opacity duration-500 cursor-pointer ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={() => {
        setVisible(false);
        setTimeout(onComplete, 500);
      }}
    >
      <div className="flex flex-col items-center animate-fade-in">
        <img
          src={solaceLogo}
          alt="Solace Logo"
          className="w-64 h-64 object-contain drop-shadow-[0_0_40px_hsl(45,100%,50%,0.4)]"
          width={512}
          height={512}
        />
        <h1 className="text-5xl font-bold text-primary tracking-wider mt-[-1rem]" style={{ fontFamily: "'Segoe UI', sans-serif" }}>
          Solace
        </h1>
        <p className="text-foreground text-lg mt-4 font-medium animate-slide-up">
          Solace, your AI companion to do everything!
        </p>
      </div>
    </div>
  );
};

export default IntroSplash;
