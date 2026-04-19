import { useEffect, useRef, useState } from "react";
import { Lock, Sparkles, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { usePreviewMode } from "@/hooks/usePreviewMode";
import { hasAccess } from "@/components/PaywallGate";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * LivingAvatar — tiered animated avatar.
 *
 * Tier 1 (FREE): Idle CSS — breathing, blink, head sway. Pure CSS, no cost.
 * Tier 2 (PAID, "monthly"+): Lip-sync — when `speakingAudioUrl` is provided,
 *        avatar lip-syncs to the audio via Replicate wav2lip. ~$0.02/clip.
 * Tier 3 (PAID, "quarterly"+, $1.50 per clip wallet charge): Walking/animated
 *        image-to-video via Runway. Triggered by `enableWalking` + click.
 *
 * Admin & Lifetime bypass tier locks (still wallet-charged for tier 3).
 */

interface LivingAvatarProps {
  imageUrl: string;
  alt?: string;
  className?: string;
  /** Animation intensity for free idle tier */
  intensity?: "subtle" | "normal" | "strong";
  /** Pass an audio URL to trigger lip-sync (tier 2). Requires monthly+. */
  speakingAudioUrl?: string;
  /** Show the "Bring to life" walking-video button (tier 3). Requires quarterly+. */
  enableWalking?: boolean;
  /** Walking prompt hint, e.g. "walking through a forest at dawn" */
  walkingPrompt?: string;
  /** Called when a walking clip is generated */
  onWalkingVideoReady?: (videoUrl: string) => void;
}

const WALKING_TIER = "quarterly";
const LIPSYNC_TIER = "monthly";

const LivingAvatar = ({
  imageUrl,
  alt = "Living avatar",
  className = "",
  intensity = "normal",
  speakingAudioUrl,
  enableWalking = false,
  walkingPrompt = "the person gently moving and gesturing naturally",
  onWalkingVideoReady,
}: LivingAvatarProps) => {
  const navigate = useNavigate();
  const { tier } = useSubscription();
  const { isAdmin } = useIsAdmin();
  const isPreview = usePreviewMode();
  const [walkingVideoUrl, setWalkingVideoUrl] = useState<string | null>(null);
  const [lipsyncUrl, setLipsyncUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState<"lipsync" | "walking" | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const canLipsync = isAdmin || isPreview || hasAccess(tier, LIPSYNC_TIER);
  const canWalk = isAdmin || isPreview || hasAccess(tier, WALKING_TIER);

  // Tier 2: auto lip-sync when audio arrives
  useEffect(() => {
    if (!speakingAudioUrl || !canLipsync) return;
    let cancelled = false;
    (async () => {
      try {
        setGenerating("lipsync");
        const { data, error } = await supabase.functions.invoke("ai-tools", {
          body: {
            tool: "lipsync",
            image_url: imageUrl,
            audio_url: speakingAudioUrl,
          },
        });
        if (cancelled) return;
        if (error) throw error;
        if (data?.video_url) setLipsyncUrl(data.video_url);
      } catch (err: any) {
        console.warn("[LivingAvatar] lipsync failed, falling back to idle:", err?.message);
      } finally {
        if (!cancelled) setGenerating(null);
      }
    })();
    return () => { cancelled = true; };
  }, [speakingAudioUrl, imageUrl, canLipsync]);

  const handleBringToLife = async () => {
    if (!canWalk) {
      toast.info("Walking avatars unlock with the Pro plan ($20+).");
      navigate("/subscribe");
      return;
    }
    try {
      setGenerating("walking");
      toast.info("Bringing your avatar to life… (~30s)");
      const { data, error } = await supabase.functions.invoke("runway-image-to-video", {
        body: {
          image_url: imageUrl,
          prompt: walkingPrompt,
          duration: 5,
        },
      });
      if (error) throw error;
      if (data?.video_url) {
        setWalkingVideoUrl(data.video_url);
        onWalkingVideoReady?.(data.video_url);
        toast.success("Your avatar is alive! 🎬");
      } else {
        throw new Error("No video returned");
      }
    } catch (err: any) {
      const msg = err?.message ?? "Generation failed";
      const lower = msg.toLowerCase();
      if (lower.includes("insufficient") || msg.includes("402")) {
        toast.error("Wallet balance too low. Top up to bring your avatar to life.");
        navigate("/wallet");
      } else if (lower.includes("credit") || lower.includes("runway")) {
        toast.error("Runway video credits are exhausted. The owner needs to top up the Runway account.");
      } else {
        toast.error("Couldn't animate avatar. Try again in a moment.");
      }
    } finally {
      setGenerating(null);
    }
  };

  const intensityClass =
    intensity === "subtle" ? "animate-living-subtle"
    : intensity === "strong" ? "animate-living-strong"
    : "animate-living";

  const activeVideo = walkingVideoUrl ?? lipsyncUrl;

  return (
    <div className={`relative inline-block ${className}`}>
      {activeVideo ? (
        <video
          ref={videoRef}
          src={activeVideo}
          autoPlay
          loop={!!walkingVideoUrl}
          playsInline
          muted={!!walkingVideoUrl}
          className="w-full h-full object-cover rounded-[inherit]"
        />
      ) : (
        <div className={`relative w-full h-full ${intensityClass}`}>
          <img
            src={imageUrl}
            alt={alt}
            className="w-full h-full object-cover rounded-[inherit] select-none"
            draggable={false}
          />
          {/* Subtle blink overlay — hides eyes for ~120ms every ~5s */}
          <div className="absolute inset-x-0 top-[38%] h-[6%] pointer-events-none animate-blink bg-foreground rounded-full mx-[20%]" />
        </div>
      )}

      {generating && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/40 rounded-[inherit] backdrop-blur-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
            <Sparkles className="w-4 h-4 animate-pulse" />
            {generating === "walking" ? "Animating…" : "Lip-syncing…"}
          </div>
        </div>
      )}

      {enableWalking && !walkingVideoUrl && !generating && (
        <button
          type="button"
          onClick={handleBringToLife}
          className="absolute bottom-2 right-2 z-10 flex items-center gap-1 px-2.5 py-1 rounded-full bg-background/80 backdrop-blur border border-primary/40 text-[11px] font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-colors shadow-lg"
          title={canWalk ? "Generate a 5s living-avatar clip (~$1.50)" : "Pro plan required"}
        >
          {canWalk ? <Video className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
          {canWalk ? "Bring to life" : "Pro"}
        </button>
      )}
    </div>
  );
};

export default LivingAvatar;
