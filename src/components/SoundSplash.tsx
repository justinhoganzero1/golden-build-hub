import { Headphones, Volume2 } from "lucide-react";

interface SoundSplashProps {
  onEnable: () => void;
  onSkip?: () => void;
}

const SoundSplash = ({ onEnable, onSkip }: SoundSplashProps) => {

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-2 border-primary flex items-center justify-center">
            <Headphones className="w-10 h-10 text-primary" />
          </div>
          <div className="absolute inset-0 w-20 h-20 rounded-full border-2 border-primary animate-pulse-ring" />
        </div>

        <h2 className="text-xl font-bold text-foreground" style={{ color: 'white' }}>Enable Sound</h2>
        <p className="text-muted-foreground text-sm">
          ORACLE LUNAR features immersive audio. Tap to enable.
        </p>

        <button
          onClick={onEnable}
          className="flex items-center gap-3 px-12 py-4 bg-primary text-primary-foreground font-bold text-sm tracking-widest rounded-lg hover:brightness-110 transition-all animate-glow-pulse"
        >
          <Volume2 className="w-5 h-5" />
          TAP TO ENABLE SOUND
        </button>

        <p className="text-muted-foreground text-xs flex items-center gap-1">
          🔊 Remembered for 30 days
        </p>

        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="mt-2 text-[11px] uppercase tracking-widest text-primary/90 hover:text-primary underline underline-offset-4"
          >
            Press S to skip → Sign in
          </button>
        )}

      </div>
    </div>
  );
};

export default SoundSplash;
