import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, CameraOff } from "lucide-react";

const URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/live-vision`;

/** Simplified Live Vision: camera feed + on-demand AI describe. */
const StandaloneVision = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => {
    const s = videoRef.current?.srcObject as MediaStream | null;
    s?.getTracks().forEach((t) => t.stop());
  }, []);

  const start = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
    } catch {
      setError("Camera access denied. Allow camera permission and retry.");
    }
  };

  const stop = () => {
    const s = videoRef.current?.srcObject as MediaStream | null;
    s?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreaming(false);
  };

  const analyze = async () => {
    if (!videoRef.current || loading) return;
    setLoading(true);
    setAnalysis("");
    try {
      const v = videoRef.current;
      const c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext("2d")!.drawImage(v, 0, 0);
      const dataUrl = c.toDataURL("image/jpeg", 0.8);
      const resp = await fetch(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ image: dataUrl, prompt: "Describe what you see clearly and concisely." }),
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.error || "Failed");
      setAnalysis(j.description || j.text || j.message || "No description returned.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to analyze");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="aspect-video bg-black rounded-2xl overflow-hidden relative">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        {!streaming && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <Camera className="w-10 h-10" />
          </div>
        )}
      </div>
      <div className="flex gap-2">
        {!streaming ? (
          <button onClick={start} className="flex-1 py-3 rounded-full bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2">
            <Camera className="w-4 h-4" /> Start camera
          </button>
        ) : (
          <>
            <button onClick={analyze} disabled={loading} className="flex-1 py-3 rounded-full bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />} What is this?
            </button>
            <button onClick={stop} className="px-4 py-3 rounded-full border border-border"><CameraOff className="w-4 h-4" /></button>
          </>
        )}
      </div>
      {error && <div className="text-sm text-destructive text-center">{error}</div>}
      {analysis && (
        <div className="bg-card border border-border rounded-2xl p-4 text-sm">{analysis}</div>
      )}
    </div>
  );
};

export default StandaloneVision;
