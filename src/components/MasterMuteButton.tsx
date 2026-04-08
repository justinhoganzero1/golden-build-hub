import { Volume2, VolumeX } from "lucide-react";
import { useMute } from "@/contexts/MuteContext";

const MasterMuteButton = () => {
  const { isMuted, toggleMute } = useMute();

  return (
    <button
      onClick={toggleMute}
      className="fixed bottom-20 right-4 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
      aria-label={isMuted ? "Unmute" : "Mute"}
    >
      {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
    </button>
  );
};

export default MasterMuteButton;
