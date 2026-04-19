import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildFingerprint, fingerprintSimilarity, type SoundSignature } from "@/lib/audioFilter";

const MATCH_THRESHOLD = 0.86;
const SAMPLE_WINDOW_MS = 600;
const COMMIT_COOLDOWN_MS = 4000;

interface LoadedSignature extends SoundSignature {
  id: string;
  source: "user" | "global";
}

interface UseNoiseLearningOpts {
  /** AnalyserNode from the audio pipeline — pass `null` until ready. */
  analyser: AnalyserNode | null;
  /** Whether to actively classify and commit. */
  active: boolean;
}

/**
 * MLSC noise-learning hook.
 * - Loads user's private + global pool of sound signatures.
 * - Classifies the live spectrum every tick against known fingerprints.
 * - Commits new high-confidence unknowns to DB so the Oracle gets faster
 *   and smarter at recognising the user's environment over time.
 *
 * Reusable across Audio Filter, Live Vision, Oracle, etc.
 */
export function useNoiseLearning({ analyser, active }: UseNoiseLearningOpts) {
  const [signatures, setSignatures] = useState<LoadedSignature[]>([]);
  const [currentMatch, setCurrentMatch] = useState<LoadedSignature | null>(null);
  const [unknownCount, setUnknownCount] = useState(0);
  const lastCommitRef = useRef(0);
  const sampleStartRef = useRef(0);
  const sampleAccRef = useRef<number[] | null>(null);
  const sampleNRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Load signatures (user + global) once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const [userRes, globalRes] = await Promise.all([
        user ? supabase.from("sound_signatures").select("*").eq("user_id", user.id).limit(500) : Promise.resolve({ data: [] as any[] }),
        supabase.from("global_sound_signatures").select("*").limit(500),
      ]);
      if (cancelled) return;
      const merged: LoadedSignature[] = [
        ...((userRes.data || []) as any[]).map((r) => ({
          id: r.id, label: r.label, category: r.category,
          fingerprint: r.fingerprint || [], centroidHz: Number(r.centroid_hz) || 0,
          bandwidthHz: Number(r.bandwidth_hz) || 0, peakHz: Number(r.peak_hz) || 0,
          durationMs: r.duration_ms || 0, loudnessDb: Number(r.loudness_db) || 0,
          isTransient: !!r.is_transient, isContinuous: !!r.is_continuous,
          action: r.action || "suppress", source: "user" as const,
        })),
        ...((globalRes.data || []) as any[]).map((r) => ({
          id: r.id, label: r.label, category: r.category,
          fingerprint: r.fingerprint || [], centroidHz: Number(r.centroid_hz) || 0,
          bandwidthHz: Number(r.bandwidth_hz) || 0, peakHz: Number(r.peak_hz) || 0,
          durationMs: r.duration_ms || 0, loudnessDb: 0,
          isTransient: !!r.is_transient, isContinuous: !!r.is_continuous,
          action: r.action || "suppress", source: "global" as const,
        })),
      ];
      setSignatures(merged);
    })();
    return () => { cancelled = true; };
  }, []);

  const commitUnknown = useCallback(async (fingerprint: number[], peakHz: number, loudnessDb: number, isTransient: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke("noise-learn", {
        body: { fingerprint, peakHz, loudnessDb, isTransient },
      });
      if (!error && data?.signature) {
        setSignatures((prev) => [...prev, { ...data.signature, source: "user" }]);
      }
    } catch { /* offline / edge fn down — non-fatal */ }
  }, []);

  // Live classification loop.
  useEffect(() => {
    if (!active || !analyser) return;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(buf);
      const fp = buildFingerprint(buf);

      // Only consider frames with meaningful energy
      const energy = fp.reduce((a, b) => a + b, 0) / fp.length;
      if (energy > 0.08) {
        // accumulate to detect ~600ms event
        if (!sampleAccRef.current) { sampleAccRef.current = fp.slice(); sampleNRef.current = 1; sampleStartRef.current = performance.now(); }
        else { for (let i = 0; i < fp.length; i++) sampleAccRef.current[i] += fp[i]; sampleNRef.current++; }

        // Match against known
        let best: LoadedSignature | null = null;
        let bestSim = 0;
        for (const s of signatures) {
          if (!s.fingerprint?.length) continue;
          const sim = fingerprintSimilarity(fp, s.fingerprint);
          if (sim > bestSim) { bestSim = sim; best = s; }
        }
        setCurrentMatch(bestSim >= MATCH_THRESHOLD ? best : null);

        // After window, decide commit
        const elapsed = performance.now() - sampleStartRef.current;
        if (elapsed >= SAMPLE_WINDOW_MS && sampleAccRef.current) {
          const avg = sampleAccRef.current.map((v) => v / sampleNRef.current);
          const isUnknown = bestSim < MATCH_THRESHOLD;
          const sinceCommit = performance.now() - lastCommitRef.current;
          if (isUnknown && sinceCommit > COMMIT_COOLDOWN_MS) {
            lastCommitRef.current = performance.now();
            setUnknownCount((c) => c + 1);
            // peak bin → Hz
            let peakIdx = 0, peakVal = 0;
            for (let i = 0; i < avg.length; i++) if (avg[i] > peakVal) { peakVal = avg[i]; peakIdx = i; }
            const sr = (analyser.context as AudioContext).sampleRate;
            const peakHz = (peakIdx / avg.length) * (sr / 2);
            const loudness = 20 * Math.log10(energy + 1e-6);
            commitUnknown(avg, peakHz, loudness, elapsed < 300);
          }
          sampleAccRef.current = null;
          sampleNRef.current = 0;
        }
      } else {
        sampleAccRef.current = null;
        sampleNRef.current = 0;
        setCurrentMatch(null);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active, analyser, signatures, commitUnknown]);

  return { signatures, currentMatch, unknownCount, learnedCount: signatures.length };
}
