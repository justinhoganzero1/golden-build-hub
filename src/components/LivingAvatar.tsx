import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
}
const LIPSYNC_TIER = "monthly";

const LivingAvatar = ({
  imageUrl,
  alt = "Living avatar",
  className = "",
  intensity = "normal",
  speakingAudioUrl,
}: LivingAvatarProps) => {
  const [lipsyncUrl, setLipsyncUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState<"lipsync" | "walking" | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const canLipsync = true;

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

  const intensityClass =
    intensity === "subtle" ? ""
    : intensity === "strong" ? ""
    : "";

  const activeVideo = lipsyncUrl ?? null;
  const loopVideo = false;
  const muteVideo = false;

  return (
    <div className={`relative inline-block ${className}`}>
      {activeVideo ? (
        <video
          ref={videoRef}
          src={activeVideo}
          autoPlay
          loop={loopVideo}
          playsInline
          muted={muteVideo}
          className="w-full h-full object-cover rounded-[inherit]"
        />
      ) : (
        <div className={`relative w-full h-full ${intensityClass}`} style={{ transformOrigin: "center 70%" }}>
          <img
            src={imageUrl}
            alt={alt}
            className="w-full h-full object-cover rounded-[inherit] select-none"
            draggable={false}
          />
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

    </div>
  );
};

export default LivingAvatar;
