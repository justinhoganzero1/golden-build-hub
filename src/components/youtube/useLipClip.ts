// One paid lip-sync clip (host or interview reporter): remembers the job per account,
// resumes polling without a new charge, and loads the finished clip for filming.
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { requireEdgeAuthToken } from "@/lib/edgeAuth";

export interface LipClip { jobId: string; scriptHash: string; url?: string; billedCents?: number }

export const money = (cents: number) => `A$${(cents / 100).toFixed(2)}`;

export async function callLipsync(body: Record<string, unknown>) {
  const token = await requireEdgeAuthToken();
  const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/host-lipsync`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

export function useLipClip(storageKey: string, label: string) {
  const [lip, setLip] = useState<LipClip | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Load the saved job for this account.
  useEffect(() => {
    setLip(null);
    if (!storageKey) return;
    try {
      const l = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (l?.jobId) setLip({ jobId: l.jobId, scriptHash: l.scriptHash });
    } catch { /* ignore */ }
  }, [storageKey]);

  useEffect(() => {
    if (storageKey && lip) try { localStorage.setItem(storageKey, JSON.stringify({ jobId: lip.jobId, scriptHash: lip.scriptHash })); } catch { /* */ }
  }, [lip, storageKey]);

  // Resume a clip that was paid for earlier (no new charge).
  useEffect(() => {
    if (!lip?.jobId || lip.url) return;
    let stop = false;
    const poll = async () => {
      for (let i = 0; i < 120 && !stop; i++) {
        const { ok, data } = await callLipsync({ action: "status", job_id: lip.jobId }).catch(() => ({ ok: false, data: {} as any }));
        if (stop) return;
        if (ok && data.status === "succeeded" && data.url) {
          setLip((cur) => (cur?.jobId === lip.jobId ? { ...cur, url: data.url, billedCents: data.total_billed_cents } : cur));
          setBusy(false);
          toast.success(`${label} lip-sync ready. Charged ${money(data.total_billed_cents ?? 0)}.`);
          return;
        }
        if ((ok && (data.status === "failed" || data.error === "not_found")) || (!ok && data?.error === "not_found")) {
          setBusy(false); setLip(null); try { localStorage.removeItem(storageKey); } catch { /* */ }
          if (data.status === "failed") toast.error(data.message || `${label} lip-sync didn't finish. Nothing was charged.`);
          return;
        }
        await new Promise((r) => setTimeout(r, 5000));
      }
      setBusy(false);
    };
    setBusy(true); void poll();
    return () => { stop = true; };
  }, [lip?.jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the finished clip.
  useEffect(() => {
    setReady(false);
    if (!lip?.url) { videoRef.current = null; return; }
    const v = document.createElement("video");
    v.crossOrigin = "anonymous"; v.src = lip.url; v.playsInline = true; v.preload = "auto"; v.muted = true;
    v.onloadeddata = () => { videoRef.current = v; setReady(true); };
    v.onerror = () => toast.error(`Couldn't open the ${label.toLowerCase()} lip-sync clip. Try again in a moment.`);
    v.load();
  }, [lip?.url]); // eslint-disable-line react-hooks/exhaustive-deps

  return { lip, setLip, busy, setBusy, ready, videoRef };
}
