import { useState, useRef, useCallback, useEffect } from "react";
import { Eye, Camera, Scan, Zap, Info, Loader2, X, Save, SwitchCamera } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
import { useSaveMedia } from "@/hooks/useUserAvatars";
import { useAuth } from "@/contexts/AuthContext";

const VISION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/live-vision`;

type AnalysisMode = "scene" | "text" | "objects";

const LiveVisionPage = () => {
  const { user } = useAuth();
  const saveMedia = useSaveMedia();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("scene");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setAnalysis(null);
      setCapturedImage(null);
    } catch (e) {
      console.error("Camera error:", e);
      toast.error("Could not access camera. Please grant permission.");
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => { stopCamera(); };
  }, [stopCamera]);

  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.8);
  }, []);

  const analyzeFrame = async () => {
    const frame = capturedImage || captureFrame();
    if (!frame) { toast.error("No image to analyze"); return; }
    if (!capturedImage) setCapturedImage(frame);
    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const resp = await fetch(VISION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ image: frame, mode: analysisMode }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Failed" }));
        toast.error(err.error || "Analysis failed");
        return;
      }
      const data = await resp.json();
      setAnalysis(data.analysis);
    } catch (e) {
      console.error(e);
      toast.error("Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveSnapshot = () => {
    if (!capturedImage || !user) { toast.error("Nothing to save"); return; }
    saveMedia.mutate({
      media_type: "image",
      title: `Vision Snapshot - ${new Date().toLocaleString()}`,
      url: capturedImage,
      source_page: "live-vision",
      metadata: { analysis: analysis || undefined, mode: analysisMode },
    }, {
      onSuccess: () => toast.success("Saved to Media Library!"),
      onError: () => toast.error("Failed to save"),
    });
  };

  const switchCamera = async () => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  };

  useEffect(() => {
    if (cameraActive) startCamera();
  }, [facingMode]);

  const modes: { value: AnalysisMode; icon: React.ReactNode; label: string }[] = [
    { value: "scene", icon: <Zap className="w-4 h-4" />, label: "Scene" },
    { value: "text", icon: <Info className="w-4 h-4" />, label: "Text (OCR)" },
    { value: "objects", icon: <Scan className="w-4 h-4" />, label: "Objects" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <canvas ref={canvasRef} className="hidden" />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Eye className="w-7 h-7 text-primary" /></div>
          <div>
            <h1 className="text-xl font-bold text-primary">Live Vision</h1>
            <p className="text-muted-foreground text-xs">AI-powered camera analysis</p>
          </div>
        </div>

        {/* Camera / Capture View */}
        <div className="aspect-[4/3] bg-card border border-border rounded-2xl overflow-hidden mb-4 relative">
          {cameraActive && !capturedImage ? (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <button onClick={switchCamera}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/50 backdrop-blur">
                <SwitchCamera className="w-5 h-5 text-white" />
              </button>
            </>
          ) : capturedImage ? (
            <>
              <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
              <button onClick={() => { setCapturedImage(null); setAnalysis(null); }}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/50 backdrop-blur">
                <X className="w-5 h-5 text-white" />
              </button>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <Camera className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Tap below to activate camera</p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-2 mb-4">
          {!cameraActive ? (
            <button onClick={startCamera}
              className="flex-1 py-4 bg-primary text-primary-foreground font-semibold rounded-xl flex items-center justify-center gap-2">
              <Camera className="w-5 h-5" /> Start Camera
            </button>
          ) : (
            <>
              <button onClick={() => { setCapturedImage(captureFrame()); }}
                disabled={!!capturedImage}
                className="flex-1 py-3 bg-primary text-primary-foreground font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                <Camera className="w-5 h-5" /> Capture
              </button>
              <button onClick={analyzeFrame} disabled={isAnalyzing}
                className="flex-1 py-3 bg-accent text-accent-foreground font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Scan className="w-5 h-5" />}
                {isAnalyzing ? "Analyzing..." : "Analyze"}
              </button>
              <button onClick={stopCamera}
                className="py-3 px-4 bg-destructive text-destructive-foreground rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Mode selector */}
        <h2 className="text-sm font-semibold text-foreground mb-2">Analysis Mode</h2>
        <div className="flex gap-2 mb-4">
          {modes.map(m => (
            <button key={m.value} onClick={() => setAnalysisMode(m.value)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${analysisMode === m.value ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {/* Analysis Results */}
        {analysis && (
          <div className="bg-card border border-primary/30 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-primary">AI Analysis</h3>
              {capturedImage && user && (
                <button onClick={saveSnapshot}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium">
                  <Save className="w-3 h-3" /> Save
                </button>
              )}
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{analysis}</p>
          </div>
        )}

        {isAnalyzing && !analysis && (
          <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center gap-3 mb-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">AI is analyzing the image...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveVisionPage;
