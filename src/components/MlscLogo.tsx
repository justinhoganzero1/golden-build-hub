import mlscLogo from "@/assets/mlsc-logo.png";
import { cn } from "@/lib/utils";

interface MlscLogoProps {
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * MLSC — Multi-Layering Super Clarity badge.
 * Rainbow concentric sound-wave logo. App-wide, always-on, free for every user.
 */
export default function MlscLogo({ className, showLabel = false, size = "md" }: MlscLogoProps) {
  const dim = size === "sm" ? "h-6 w-6" : size === "lg" ? "h-10 w-10" : "h-8 w-8";
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <img
        src={mlscLogo}
        alt="MLSC — Multi-Layering Super Clarity"
        className={cn(dim, "drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] animate-pulse")}
        style={{ animationDuration: "3s" }}
      />
      {showLabel && (
        <span className="text-[10px] font-bold tracking-widest bg-gradient-to-r from-red-500 via-yellow-400 via-green-400 via-blue-400 to-violet-500 bg-clip-text text-transparent">
          MLSC
        </span>
      )}
    </div>
  );
}
