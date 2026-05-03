import { getEdgeAuthTokenSync } from "@/lib/edgeAuth";
import { useState, useRef, useCallback, useEffect } from "react";
import SEO from "@/components/SEO";
import { Eye, Camera, Scan, Zap, Info, Loader2, X, Save, SwitchCamera, Car, Mic, MicOff, Video, VideoOff, Sparkles, Target, ShieldCheck, FileSearch, Hash } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
import { useSaveMedia } from "@/hooks/useUserAvatars";
import { useAuth } from "@/contexts/AuthContext";
import { cleanTextForSpeech } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import PaywallGate from "@/components/PaywallGate";

const VISION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/live-vision`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;

type AnalysisMode = "scene" | "text" | "objects" | "driving" | "parking" | "companion" | "watch" | "shopping" | "bodycam" | "investigation";
type Tab = "general" | "investigations";
type EvidenceLog = { ts: string; note: string; frame?: string; mode: AnalysisMode };

const LiveVisionPage = () => {
  const { user } = useAuth();
  const saveMedia = useSaveMedia();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const drivingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const companionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchStartRef = useRef<number>(0);
  const watchObservationsRef = useRef<string[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const lastSpokenRef = useRef<string>("");

  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("scene");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [drivingActive, setDrivingActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [recording, setRecording] = useState(false);
  const [livefeed, setLiveFeed] = useState<string[]>([]);
  const [companionActive, setCompanionActive] = useState(false);
  const [watchTarget, setWatchTarget] = useState<string>("");
  const [watchActive, setWatchActive] = useState(false);
  const [watchPromptOpen, setWatchPromptOpen] = useState(false);
  const [watchSummary, setWatchSummary] = useState<string | null>(null);

  // ─── Investigations tab ───
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [isInvestigator, setIsInvestigator] = useState(false);
  const [bodyCamActive, setBodyCamActive] = useState(false);
  const [investigationActive, setInvestigationActive] = useState(false);
  const [evidenceLog, setEvidenceLog] = useState<EvidenceLog[]>([]);
  const [caseId, setCaseId] = useState<string>("");
  const bodyCamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const investigationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const evidenceHistoryRef = useRef<string[]>([]);

  // Check role
  useEffect(() => {
    if (!user) { setIsInvestigator(false); return; }
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const roles = (data || []).map((r: any) => r.role);
      setIsInvestigator(roles.includes("investigator") || roles.includes("admin"));
    })();
  }, [user]);

  // ─── Camera control ───
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
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
    stopDriving();
    stopCompanion();
    stopWatch();
    stopBodyCam();
    stopInvestigation();
    stopListening();
    stopRecording();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video.videoWidth || !video.videoHeight || video.readyState < 2) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    const url = canvas.toDataURL("image/jpeg", 0.7);
    if (!url || url.length < 200 || url === "data:,") return null;
    return url;
  }, []);

  // ─── Vision analysis ───
  const callVision = async (image: string, mode: AnalysisMode, opts?: { target?: string; history?: string[] }): Promise<string | null> => {
    const apiMode = mode === "driving" || mode === "parking" ? "scene" : mode;
    const resp = await fetch(VISION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getEdgeAuthTokenSync()}` },
      body: JSON.stringify({ image, mode: apiMode === "scene" && (mode === "driving" || mode === "parking") ? mode : apiMode, target: opts?.target, history: opts?.history }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.analysis || null;
  };

  const analyzeFrame = async () => {
    const frame = capturedImage || captureFrame();
    if (!frame) { toast.error("No image to analyze"); return; }
    if (!capturedImage) setCapturedImage(frame);
    setIsAnalyzing(true);
    setAnalysis(null);
    try {
      const result = await callVision(frame, analysisMode);
      if (result) setAnalysis(result);
      else toast.error("Analysis failed");
    } catch (e) { console.error(e); toast.error("Analysis failed"); }
    finally { setIsAnalyzing(false); }
  };

  // ─── TTS via ElevenLabs ───
  const speak = useCallback(async (text: string) => {
    const clean = cleanTextForSpeech(text);
    if (!clean || clean === lastSpokenRef.current) return;
    lastSpokenRef.current = clean;
    try {
      const r = await fetch(TTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getEdgeAuthTokenSync()}` },
        body: JSON.stringify({ text: clean.slice(0, 400), voiceId: "nPczCjzI2devNBz1zQrb" }),
      });
      if (r.ok) {
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.volume = 1;
        await audio.play();
        audio.onended = () => URL.revokeObjectURL(url);
        return;
      }
    } catch {}
    // fallback
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 1; u.volume = 1;
    window.speechSynthesis.speak(u);
  }, []);

  // ─── Driving Mode: continuous capture + narrate ───
  const startDriving = useCallback(async () => {
    if (!cameraActive) await startCamera();
    setAnalysisMode("driving");
    setDrivingActive(true);
    setLiveFeed([]);
    speak("Driving mode activated. I'll watch the road and tell you what I see. Just talk to me.");
    startListening();

    const tick = async () => {
      const frame = captureFrame();
      if (!frame) return;
      const result = await callVision(frame,
        // alternate between scene + parking watch every other tick
        Math.random() > 0.5 ? "driving" : "parking"
      );
      if (result) {
        setLiveFeed(prev => [result, ...prev].slice(0, 8));
        // Only speak if it sounds important (parking, danger, sign, exit, hazard, vehicle)
        if (/park|space|exit|sign|hazard|danger|stop|red light|pedestrian|turn|lane|warning/i.test(result)) {
          speak(result);
        }
      }
    };
    tick();
    drivingTimerRef.current = setInterval(tick, 7000);
  }, [cameraActive, startCamera, captureFrame, speak]);

  const stopDriving = useCallback(() => {
    setDrivingActive(false);
    if (drivingTimerRef.current) {
      clearInterval(drivingTimerRef.current);
      drivingTimerRef.current = null;
    }
  }, []);

  // ─── Companion Mode: Oracle is walking with the user ───
  const startCompanion = useCallback(async () => {
    if (!cameraActive) await startCamera();
    setCompanionActive(true);
    setLiveFeed([]);
    speak("I'm with you. I'll keep an eye out and chat as we go. Just ask me anything you see.");
    startListening();

    const recent: string[] = [];
    const tick = async () => {
      const frame = captureFrame();
      if (!frame) return;
      const result = await callVision(frame, "companion", { history: recent });
      if (result && result.trim().toUpperCase() !== "QUIET") {
        recent.push(result);
        if (recent.length > 6) recent.shift();
        setLiveFeed(prev => [result, ...prev].slice(0, 8));
        speak(result);
      }
    };
    tick();
    companionTimerRef.current = setInterval(tick, 9000);
  }, [cameraActive, startCamera, captureFrame, speak]);

  const stopCompanion = useCallback(() => {
    setCompanionActive(false);
    if (companionTimerRef.current) { clearInterval(companionTimerRef.current); companionTimerRef.current = null; }
  }, []);

  // ─── Watch-For Mode: track a target over time ───
  const finishWatch = useCallback(() => {
    if (watchTimerRef.current) { clearInterval(watchTimerRef.current); watchTimerRef.current = null; }
    const obs = watchObservationsRef.current;
    if (obs.length === 0) {
      const summary = `I watched for "${watchTarget}" and didn't see it.`;
      setWatchSummary(summary);
      speak(summary);
    } else {
      const found = obs.filter(o => /^FOUND/i.test(o)).length;
      const summary = `Watch report for "${watchTarget}": ${obs.length} relevant observations, ${found} confirmed sightings. Most recent: ${obs[obs.length - 1]}`;
      setWatchSummary(summary);
      speak(summary);
    }
    setWatchActive(false);
  }, [watchTarget, speak]);

  const startWatch = useCallback(async (target: string, durationMs: number = 10 * 60 * 1000) => {
    if (!target.trim()) { toast.error("Tell me what to watch for"); return; }
    if (!cameraActive) await startCamera();
    setWatchTarget(target);
    setWatchActive(true);
    setWatchSummary(null);
    setLiveFeed([]);
    watchObservationsRef.current = [];
    watchStartRef.current = Date.now();
    const isShoppingLike = /aisle|shelf|grocery|store|item|product|find|where.*is|brand/i.test(target);
    const mode: AnalysisMode = isShoppingLike ? "shopping" : "watch";
    speak(`Watching for ${target}. I'll let you know when I see something.`);
    startListening();

    const tick = async () => {
      if (Date.now() - watchStartRef.current > durationMs) { finishWatch(); return; }
      const frame = captureFrame();
      if (!frame) return;
      const result = await callVision(frame, mode, { target, history: watchObservationsRef.current });
      if (!result) return;
      const upper = result.trim().toUpperCase();
      if (upper === "NOT YET" || upper.startsWith("NOT YET")) return;
      watchObservationsRef.current.push(result);
      setLiveFeed(prev => [result, ...prev].slice(0, 12));
      if (/^FOUND/i.test(result)) speak(result);
      else if (/^AISLE|^MAYBE/i.test(result) && watchObservationsRef.current.length % 2 === 1) speak(result);
    };
    tick();
    watchTimerRef.current = setInterval(tick, 6000);
  }, [cameraActive, startCamera, captureFrame, speak, finishWatch]);

  const stopWatch = useCallback(() => {
    if (watchActive) finishWatch();
    else {
      if (watchTimerRef.current) { clearInterval(watchTimerRef.current); watchTimerRef.current = null; }
      setWatchActive(false);
    }
  }, [watchActive, finishWatch]);

  // ─── Body-cam Mode (continuous officer log + recording) ───
  const startBodyCam = useCallback(async () => {
    if (!isInvestigator) { toast.error("Investigator role required"); return; }
    if (!cameraActive) await startCamera();
    const newCase = caseId || `CASE-${Date.now().toString(36).toUpperCase()}`;
    setCaseId(newCase);
    setBodyCamActive(true);
    setEvidenceLog([]);
    evidenceHistoryRef.current = [];
    speak(`Body cam active. Case ${newCase}. Recording started.`);
    // Auto-start video recording
    setTimeout(() => startRecording(), 400);
    startListening();

    const tick = async () => {
      const frame = captureFrame();
      if (!frame) return;
      const result = await callVision(frame, "bodycam", { history: evidenceHistoryRef.current });
      if (result && result.trim().toUpperCase() !== "QUIET") {
        evidenceHistoryRef.current.push(result);
        if (evidenceHistoryRef.current.length > 8) evidenceHistoryRef.current.shift();
        setEvidenceLog(prev => [{ ts: new Date().toISOString(), note: result, mode: "bodycam" as AnalysisMode }, ...prev].slice(0, 50));
      }
    };
    tick();
    bodyCamTimerRef.current = setInterval(tick, 5000);
  }, [isInvestigator, cameraActive, startCamera, captureFrame, speak, caseId]);

  const stopBodyCam = useCallback(() => {
    setBodyCamActive(false);
    if (bodyCamTimerRef.current) { clearInterval(bodyCamTimerRef.current); bodyCamTimerRef.current = null; }
    if (recorderRef.current && recorderRef.current.state !== "inactive") stopRecording();
  }, []);

  // ─── Crime-Scene Investigation Mode (forensic, evidence catalogue) ───
  const startInvestigation = useCallback(async () => {
    if (!isInvestigator) { toast.error("Investigator role required"); return; }
    if (!cameraActive) await startCamera();
    const newCase = caseId || `CASE-${Date.now().toString(36).toUpperCase()}`;
    setCaseId(newCase);
    setInvestigationActive(true);
    setEvidenceLog([]);
    evidenceHistoryRef.current = [];
    speak(`Crime scene investigation mode. Case ${newCase}. Cataloguing evidence.`);
    startListening();

    const tick = async () => {
      const frame = captureFrame();
      if (!frame) return;
      const result = await callVision(frame, "investigation", { history: evidenceHistoryRef.current });
      if (result) {
        evidenceHistoryRef.current.push(result);
        if (evidenceHistoryRef.current.length > 6) evidenceHistoryRef.current.shift();
        setEvidenceLog(prev => [{ ts: new Date().toISOString(), note: result, frame, mode: "investigation" as AnalysisMode }, ...prev].slice(0, 30));
      }
    };
    tick();
    investigationTimerRef.current = setInterval(tick, 8000);
  }, [isInvestigator, cameraActive, startCamera, captureFrame, speak, caseId]);

  const stopInvestigation = useCallback(() => {
    setInvestigationActive(false);
    if (investigationTimerRef.current) { clearInterval(investigationTimerRef.current); investigationTimerRef.current = null; }
  }, []);

  const exportEvidenceLog = useCallback(() => {
    if (evidenceLog.length === 0) { toast.error("No evidence logged"); return; }
    const header = `EVIDENCE LOG\nCase: ${caseId}\nOfficer: ${user?.email || "unknown"}\nGenerated: ${new Date().toISOString()}\n${"=".repeat(60)}\n\n`;
    const body = evidenceLog.slice().reverse().map((e, i) =>
      `#${String(i + 1).padStart(3, "0")} [${e.ts}] (${e.mode})\n${e.note}\n`
    ).join("\n");
    const text = header + body;
    if (user) {
      saveMedia.mutate({
        media_type: "image",
        title: `Evidence Log ${caseId}`,
        url: `data:text/plain;base64,${btoa(unescape(encodeURIComponent(text)))}`,
        source_page: "live-vision-investigation",
        metadata: { case_id: caseId, entries: evidenceLog.length },
      }, { onSuccess: () => toast.success("Evidence log saved to Library") });
    }
    // Also trigger download
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${caseId}-evidence.txt`;
    a.click();
  }, [evidenceLog, caseId, user, saveMedia]);

  // ─── Voice commands ───
  const startListening = useCallback(() => {
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) { toast.error("Voice recognition not supported"); return; }
    const recog = new SR();
    recog.continuous = true;
    recog.interimResults = false;
    recog.lang = "en-US";
    recog.onresult = async (ev: any) => {
      const last = ev.results[ev.results.length - 1];
      const heard = last[0].transcript.trim().toLowerCase();
      if (!heard) return;
      // Voice command routing
      if (/stop driving|exit|end driving|stop mode/i.test(heard)) { stopDriving(); speak("Driving mode off."); return; }
      if (/stop watching|stop watch|end watch|finish watch/i.test(heard)) { stopWatch(); return; }
      if (/stop companion|end companion/i.test(heard)) { stopCompanion(); speak("Companion mode off."); return; }
      const watchMatch = heard.match(/(?:watch for|look out for|tell me when you see|find me|look for|help me find)\s+(.+)/i);
      if (watchMatch) { startWatch(watchMatch[1].trim()); return; }
      if (/take.*photo|capture|snapshot/i.test(heard)) {
        const f = captureFrame();
        if (f) { setCapturedImage(f); saveSnapshotAuto(f); speak("Photo saved."); }
        return;
      }
      if (/record.*video|start recording/i.test(heard)) { startRecording(); return; }
      if (/stop recording/i.test(heard)) { stopRecording(); return; }
      if (/find.*park|car park|parking/i.test(heard)) {
        const f = captureFrame();
        if (f) {
          speak("Looking for a park.");
          const r = await callVision(f, "parking");
          if (r) { setAnalysis(r); speak(r); }
        }
        return;
      }
      // General question about what is seen
      const f = captureFrame();
      if (f) {
        speak("Let me look.");
        const r = await callVision(f, "scene");
        if (r) { setAnalysis(r); speak(r); }
      }
    };
    recog.onerror = () => { setListening(false); };
    recog.onend = () => { if (drivingActive || companionActive || watchActive) { try { recog.start(); } catch {} } };
    try { recog.start(); recognitionRef.current = recog; setListening(true); } catch {}
  }, [captureFrame, speak, drivingActive, companionActive, watchActive, stopDriving, stopWatch, stopCompanion, startWatch]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} recognitionRef.current = null; }
    setListening(false);
  }, []);

  // ─── Audio + video recording ───
  const startRecording = useCallback(() => {
    if (!streamRef.current) { toast.error("Camera not active"); return; }
    try {
      chunksRef.current = [];
      const rec = new MediaRecorder(streamRef.current, { mimeType: "video/webm;codecs=vp8,opus" });
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const dataUrl = await new Promise<string>((res, rej) => {
          const fr = new FileReader(); fr.onloadend = () => res(fr.result as string); fr.onerror = rej; fr.readAsDataURL(blob);
        });
        if (user) {
          saveMedia.mutate({
            media_type: "video",
            title: `Live Vision Clip - ${new Date().toLocaleString()}`,
            url: dataUrl, source_page: "live-vision",
            metadata: { kind: "drive-clip" },
          }, { onSuccess: () => toast.success("Video saved to Library") });
        }
        speak("Video saved.");
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      speak("Recording.");
    } catch (e) { console.error(e); toast.error("Recording failed"); }
  }, [user, saveMedia, speak]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch {}
    }
    setRecording(false);
  }, []);

  const saveSnapshotAuto = (frame: string) => {
    if (!user) return;
    saveMedia.mutate({
      media_type: "image",
      title: `Vision Snapshot - ${new Date().toLocaleString()}`,
      url: frame, source_page: "live-vision",
      metadata: { mode: analysisMode },
    });
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

  const switchCamera = async () => setFacingMode(prev => prev === "user" ? "environment" : "user");

  useEffect(() => { if (cameraActive) startCamera(); }, [facingMode]);

  const modes: { value: AnalysisMode; icon: React.ReactNode; label: string }[] = [
    { value: "scene", icon: <Zap className="w-4 h-4" />, label: "Scene" },
    { value: "text", icon: <Info className="w-4 h-4" />, label: "Text" },
    { value: "objects", icon: <Scan className="w-4 h-4" />, label: "Objects" },
    { value: "parking", icon: <Car className="w-4 h-4" />, label: "Parking" },
  ];

  return (
    <PaywallGate requiredTier="monthly" featureName="Live Vision (real-time AI camera)">
    <>
    <SEO
      title="Live Vision — Real-Time AI Camera Analysis"
      description="ORACLE LUNAR Live Vision: point your camera, get instant AI analysis — text extraction, object ID, scene description, watch alerts."
      path="/live-vision"
    />
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <canvas ref={canvasRef} className="hidden" />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Eye className="w-7 h-7 text-primary" /></div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-primary">Live Vision</h1>
            <p className="text-muted-foreground text-xs">AI-powered camera + driving mode</p>
          </div>
        </div>

        {/* Tabs (Investigations only visible to investigators/admins) */}
        {isInvestigator && (
          <div className="flex gap-2 mb-4 p-1 bg-card border border-border rounded-xl">
            <button onClick={() => setActiveTab("general")}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === "general" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              <Eye className="w-3.5 h-3.5 inline mr-1" /> General
            </button>
            <button onClick={() => setActiveTab("investigations")}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 ${activeTab === "investigations" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              <ShieldCheck className="w-3.5 h-3.5" /> Investigations
            </button>
          </div>
        )}

        {/* Camera / Capture View */}
        <div className="aspect-[4/3] bg-card border border-border rounded-2xl overflow-hidden mb-4 relative">
          {cameraActive && !capturedImage ? (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <button onClick={switchCamera}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/50 backdrop-blur">
                <SwitchCamera className="w-5 h-5 text-white" />
              </button>
              {drivingActive && (
                <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-primary/90 text-primary-foreground text-xs font-bold flex items-center gap-1.5 animate-pulse">
                  <Car className="w-3.5 h-3.5" /> DRIVING MODE
                </div>
              )}
              {recording && (
                <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center gap-1.5 animate-pulse">
                  <Video className="w-3.5 h-3.5" /> REC
                </div>
              )}
              {listening && (
                <div className="absolute bottom-3 right-3 p-2 rounded-full bg-primary/80">
                  <Mic className="w-4 h-4 text-primary-foreground animate-pulse" />
                </div>
              )}
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

        {/* Investigations Tab Panel */}
        {isInvestigator && activeTab === "investigations" && (
          <div className="space-y-3 mb-4">
            <div className="bg-card border border-primary/40 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <Hash className="w-4 h-4 text-primary" />
                <input
                  value={caseId}
                  onChange={e => setCaseId(e.target.value.toUpperCase())}
                  placeholder="Case ID (auto-generated)"
                  className="flex-1 bg-background border border-border rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-primary"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Officer: {user?.email || "—"}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={bodyCamActive ? stopBodyCam : startBodyCam}
                className={`py-3 rounded-xl font-semibold flex items-center justify-center gap-2 text-sm ${
                  bodyCamActive ? "bg-destructive text-destructive-foreground" : "bg-gradient-to-br from-primary to-accent text-primary-foreground"
                }`}>
                <ShieldCheck className="w-4 h-4" />
                {bodyCamActive ? "Stop Body Cam" : "Body Cam"}
              </button>
              <button onClick={investigationActive ? stopInvestigation : startInvestigation}
                className={`py-3 rounded-xl font-semibold flex items-center justify-center gap-2 text-sm ${
                  investigationActive ? "bg-destructive text-destructive-foreground" : "bg-card border border-accent text-accent"
                }`}>
                <FileSearch className="w-4 h-4" />
                {investigationActive ? "Stop Scan" : "Crime Scene"}
              </button>
            </div>

            {evidenceLog.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <FileSearch className="w-3.5 h-3.5" /> Evidence Log ({evidenceLog.length})
                  </h3>
                  <button onClick={exportEvidenceLog}
                    className="text-[10px] px-2 py-1 rounded bg-primary/10 text-primary font-semibold">
                    Export
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {evidenceLog.map((e, i) => (
                    <div key={i} className="text-xs border-l-2 border-primary/40 pl-2">
                      <p className="text-[10px] text-muted-foreground font-mono">
                        #{String(evidenceLog.length - i).padStart(3, "0")} • {new Date(e.ts).toLocaleTimeString()} • {e.mode}
                      </p>
                      <p className="text-foreground whitespace-pre-wrap leading-relaxed">{e.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-accent/10 border border-accent/30 rounded-xl p-3 text-[11px] text-foreground">
              <p className="font-semibold mb-1">⚖️ Evidence integrity</p>
              <p className="text-muted-foreground">All observations are AI-assisted and must be corroborated by the officer. Logs include timestamps and case ID for chain-of-custody.</p>
            </div>
          </div>
        )}

        {/* Mode banners */}
        {cameraActive && activeTab === "general" && (
          <div className="grid grid-cols-1 gap-2 mb-3">
            <button onClick={drivingActive ? stopDriving : startDriving}
              className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                drivingActive ? "bg-destructive text-destructive-foreground" : "bg-gradient-to-r from-primary to-accent text-primary-foreground"
              }`}>
              <Car className="w-5 h-5" />
              {drivingActive ? "Stop Driving Mode" : "🚗 Driving Mode (hands-free)"}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={companionActive ? stopCompanion : startCompanion}
                className={`py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all text-sm ${
                  companionActive ? "bg-destructive text-destructive-foreground" : "bg-card border border-primary/40 text-primary"
                }`}>
                <Sparkles className="w-4 h-4" />
                {companionActive ? "Stop Companion" : "Companion Mode"}
              </button>
              <button onClick={() => watchActive ? stopWatch() : setWatchPromptOpen(true)}
                className={`py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all text-sm ${
                  watchActive ? "bg-destructive text-destructive-foreground" : "bg-card border border-accent/40 text-accent"
                }`}>
                <Target className="w-4 h-4" />
                {watchActive ? `Stop Watching` : "Watch For…"}
              </button>
            </div>
            {watchActive && (
              <div className="text-xs text-center text-muted-foreground">
                Watching for: <span className="text-foreground font-medium">{watchTarget}</span>
              </div>
            )}
          </div>
        )}

        {/* Watch-For prompt */}
        {watchPromptOpen && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-center justify-center p-4" onClick={() => setWatchPromptOpen(false)}>
            <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-primary mb-2 flex items-center gap-2">
                <Target className="w-5 h-5" /> What should I watch for?
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Examples: "milk on the shelves", "the green exit sign", "a free table", "someone wearing red". I'll watch for up to 10 minutes and tell you when I see it.
              </p>
              <input
                autoFocus
                value={watchTarget}
                onChange={e => setWatchTarget(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && watchTarget.trim()) { setWatchPromptOpen(false); startWatch(watchTarget); } }}
                placeholder="Describe what to watch for…"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm mb-3 outline-none focus:border-primary"
              />
              <div className="flex gap-2">
                <button onClick={() => setWatchPromptOpen(false)}
                  className="flex-1 py-2 rounded-lg bg-muted text-muted-foreground text-sm font-medium">Cancel</button>
                <button onClick={() => { if (watchTarget.trim()) { setWatchPromptOpen(false); startWatch(watchTarget); } }}
                  className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Start Watching</button>
              </div>
            </div>
          </div>
        )}

        {watchSummary && !watchActive && (
          <div className="bg-card border border-accent/40 rounded-xl p-3 mb-3">
            <h3 className="text-xs font-bold text-accent mb-1 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" /> Watch Report
            </h3>
            <p className="text-sm text-foreground leading-relaxed">{watchSummary}</p>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {!cameraActive ? (
            <button onClick={startCamera}
              className="flex-1 py-4 bg-primary text-primary-foreground font-semibold rounded-xl flex items-center justify-center gap-2">
              <Camera className="w-5 h-5" /> Start Camera
            </button>
          ) : (
            <>
              <button onClick={() => { setCapturedImage(captureFrame()); }}
                disabled={!!capturedImage}
                className="flex-1 min-w-[80px] py-3 bg-primary text-primary-foreground font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                <Camera className="w-5 h-5" /> Capture
              </button>
              <button onClick={analyzeFrame} disabled={isAnalyzing}
                className="flex-1 min-w-[80px] py-3 bg-accent text-accent-foreground font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Scan className="w-5 h-5" />}
                {isAnalyzing ? "..." : "Analyze"}
              </button>
              <button onClick={recording ? stopRecording : startRecording}
                className={`py-3 px-3 rounded-xl ${recording ? "bg-destructive text-destructive-foreground" : "bg-card border border-border text-foreground"}`}>
                {recording ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>
              <button onClick={listening ? stopListening : startListening}
                className={`py-3 px-3 rounded-xl ${listening ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground"}`}>
                {listening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>
              <button onClick={stopCamera}
                className="py-3 px-3 bg-destructive text-destructive-foreground rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Mode selector */}
        <h2 className="text-sm font-semibold text-foreground mb-2">Analysis Mode</h2>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {modes.map(m => (
            <button key={m.value} onClick={() => setAnalysisMode(m.value)}
              className={`py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-1 transition-colors ${analysisMode === m.value ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {/* Driving live feed */}
        {(drivingActive || companionActive || watchActive) && livefeed.length > 0 && (
          <div className="bg-card border border-primary/30 rounded-xl p-3 mb-4">
            <h3 className="text-xs font-bold text-primary mb-2 flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5" /> Live Drive Feed
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {livefeed.map((entry, i) => (
                <p key={i} className={`text-xs leading-relaxed ${i === 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {entry}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Analysis Results */}
        {analysis && !drivingActive && (
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

        {/* Voice tips when driving */}
        {drivingActive && (
          <div className="bg-accent/10 border border-accent/30 rounded-xl p-3 text-xs text-foreground">
            <p className="font-semibold mb-1">🎙️ Voice commands while driving:</p>
            <ul className="space-y-0.5 text-muted-foreground">
              <li>• "Find a park" / "Where can I park?"</li>
              <li>• "Take a photo" / "Capture"</li>
              <li>• "Start recording" / "Stop recording"</li>
              <li>• "What do you see?" — or ask anything</li>
              <li>• "Stop driving" to exit</li>
            </ul>
          </div>
        )}
      </div>
    </div>
    </>
    </PaywallGate>
  );
};

export default LiveVisionPage;
