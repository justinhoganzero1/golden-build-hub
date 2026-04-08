import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface MuteContextType {
  isMuted: boolean;
  toggleMute: () => void;
  setMuted: (m: boolean) => void;
}

const MuteContext = createContext<MuteContextType>({ isMuted: false, toggleMute: () => {}, setMuted: () => {} });

export const useMute = () => useContext(MuteContext);

export const MuteProvider = ({ children }: { children: ReactNode }) => {
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem("app_muted") === "true");

  useEffect(() => {
    localStorage.setItem("app_muted", String(isMuted));
    // Mute all audio/video elements globally
    document.querySelectorAll("audio, video").forEach((el) => {
      (el as HTMLMediaElement).muted = isMuted;
    });
    // Also suppress Web Speech API
    if (isMuted) {
      window.speechSynthesis?.cancel();
    }
  }, [isMuted]);

  // Observe new media elements
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (isMuted) {
        document.querySelectorAll("audio, video").forEach((el) => {
          (el as HTMLMediaElement).muted = true;
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isMuted]);

  const toggleMute = () => setIsMuted(p => !p);
  const setMuted = (m: boolean) => setIsMuted(m);

  return <MuteContext.Provider value={{ isMuted, toggleMute, setMuted }}>{children}</MuteContext.Provider>;
};
