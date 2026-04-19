import { useEffect, useRef, useState, useCallback } from "react";
import { AudioFilterPipeline, type AudioFilterStatus, type FilterTier, subscriptionToFilterTier, loadVoicePrint } from "@/lib/audioFilter";
import { useSubscription } from "@/hooks/useSubscription";

interface UseAudioFilterOpts {
  /** Auto-start pipeline when this is true. */
  enabled: boolean;
  /** Forced mode override. */
  forcedMode?: "quiet" | "normal" | "street" | "chaos";
}

/**
 * React wrapper around AudioFilterPipeline.
 * Returns the filtered MediaStream + live status + helpers.
 */
export function useAudioFilter({ enabled, forcedMode }: UseAudioFilterOpts) {
  const { effectiveTier } = useSubscription();
  const tier: FilterTier = subscriptionToFilterTier(effectiveTier);
  const pipelineRef = useRef<AudioFilterPipeline | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<AudioFilterStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsEnrollment, setNeedsEnrollment] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setError(null);

    // Layer 3 prompt: ask for enrollment first time on starter+ tier
    if (tier !== "free" && !loadVoicePrint()) {
      setNeedsEnrollment(true);
    }

    const pipeline = new AudioFilterPipeline({
      tier,
      forcedMode,
      onStatus: (s) => { if (!cancelled) setStatus(s); },
    });
    pipelineRef.current = pipeline;

    pipeline.start()
      .then((s) => { if (!cancelled) setStream(s); })
      .catch((e) => { if (!cancelled) setError(e?.message || "Mic failed"); });

    return () => {
      cancelled = true;
      pipeline.stop();
      pipelineRef.current = null;
      setStream(null);
      setStatus(null);
    };
  }, [enabled, tier, forcedMode]);

  const setOracleSpeaking = useCallback((v: boolean) => {
    pipelineRef.current?.setOracleSpeaking(v);
  }, []);

  return { stream, status, tier, error, needsEnrollment, setNeedsEnrollment, setOracleSpeaking };
}
