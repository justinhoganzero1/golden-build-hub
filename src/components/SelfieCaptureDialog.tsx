import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, RefreshCw, Sparkles, Loader2, Check, X, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateAvatar, useSaveMedia } from "@/hooks/useUserAvatars";

interface SelfieCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when user accepts a final image (raw or AI-edited) */
  onCapture: (dataUrl: string) => void;
  /** Show the "Add as avatar" quick action (default true) */
  showAvatarAction?: boolean;
  title?: string;
}

const GEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-gen`;

const AI_PRESETS = [
  { id: "studio", label: "📸 Pro Headshot", prompt: "Transform into an ultra-realistic 8K professional studio headshot. Sharp focus on face, soft rim lighting, neutral background, magazine quality. Keep the person's identity and features identical." },
  { id: "cinematic", label: "🎬 Cinematic", prompt: "Cinematic film still, dramatic golden-hour lighting, shallow depth of field, color graded like a Hollywood movie. Preserve the person's exact face and identity." },
  { id: "anime", label: "🎨 Anime Hero", prompt: "Convert into stylized anime art keeping facial features recognizable. Detailed eyes, vibrant colors, clean line art." },
  { id: "fantasy", label: "🧙 Fantasy", prompt: "Reimagine as an epic fantasy character with magical armor and glowing aura. Keep the same face and identity." },
  { id: "cyberpunk", label: "🌃 Cyberpunk", prompt: "Cyberpunk neon-lit portrait, futuristic augmentations, rain-slicked street background. Keep the person's exact face." },
  { id: "vintage", label: "📷 Vintage Film", prompt: "Vintage 1970s film photograph aesthetic, warm grain, faded colors, retro fashion. Keep the same face." },
];

const SelfieCaptureDialog = ({ open, onOpenChange, onCapture, showAvatarAction = true, title = "Take a Selfie" }: SelfieCaptureDialogProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { user } = useAuth();
  const createAvatar = useCreateAvatar();
  const saveMedia = useSaveMedia();

  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [stage, setStage] = useState<"camera" | "review" | "edited">("camera");
  const [rawShot, setRawShot] = useState<string | null>(null);
  const [editedShot, setEditedShot] = useState<string | null>(null);
  const [permError, setPermError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [editingPreset, setEditingPreset] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async (mode: "user" | "environment") => {
    setStarting(true);
    setPermError(null);
    stopStream();
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPermError("Camera not supported on this device/browser.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for metadata so dimensions are correct before play
        await new Promise<void>((resolve) => {
          const v = videoRef.current!;
          if (v.readyState >= 1) return resolve();
          v.onloadedmetadata = () => resolve();
        });
        try { await videoRef.current.play(); } catch { /* ignored */ }
      }
    } catch (err: any) {
      console.error("camera error", err);
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setPermError("Camera permission denied. Allow camera access in your browser settings and try again.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setPermError("No camera found. Try switching front/back camera.");
      } else if (name === "NotReadableError") {
        setPermError("Camera is in use by another app. Close other apps and retry.");
      } else {
        setPermError(err?.message || "Could not start camera.");
      }
    } finally {
      setStarting(false);
    }
  }, [stopStream]);

  // Open / close lifecycle
  useEffect(() => {
    if (open) {
      setStage("camera");
      setRawShot(null);
      setEditedShot(null);
      setEditingPreset(null);
      startCamera(facing);
    } else {
      stopStream();
    }
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Switch camera
  const flipCamera = () => {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    startCamera(next);
  };

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) {
      toast.error("Camera not ready yet");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror front-camera capture to match preview
    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/png");
    setRawShot(url);
    setEditedShot(null);
    setStage("review");
    stopStream();
  };

  const retake = () => {
    setRawShot(null);
    setEditedShot(null);
    setStage("camera");
    setEditingPreset(null);
    startCamera(facing);
  };

  const aiEdit = async (preset: typeof AI_PRESETS[number]) => {
    const source = editedShot || rawShot;
    if (!source) return;
    setEditingPreset(preset.id);
    try {
      const resp = await fetch(GEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ prompt: preset.prompt, inputImage: source }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Edit failed" }));
        toast.error(err.error || "AI edit failed");
        return;
      }
      const data = await resp.json();
      const url = data.images?.[0]?.image_url?.url;
      if (!url) { toast.error("No image returned"); return; }
      setEditedShot(url);
      setStage("edited");
      toast.success(`Applied ${preset.label}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "AI edit failed");
    } finally {
      setEditingPreset(null);
    }
  };

  const finalImage = editedShot || rawShot;

  const accept = () => {
    if (!finalImage) return;
    onCapture(finalImage);
    onOpenChange(false);
  };

  const saveAsAvatar = () => {
    if (!finalImage) return;
    if (!user) { toast.error("Sign in to save avatar"); return; }
    createAvatar.mutate({
      name: "My Selfie Avatar",
      purpose: "profile",
      voice_style: "Warm & Friendly",
      personality: "Sweet & Caring",
      image_url: finalImage,
      art_style: editedShot ? "ai-edited-selfie" : "selfie",
      description: "Captured from camera",
      is_default: false,
    }, {
      onSuccess: () => {
        toast.success("Saved as profile avatar!");
        // Also persist to media library
        saveMedia.mutate({
          media_type: "image",
          title: "Selfie Avatar",
          url: finalImage,
          source_page: "Selfie Capture",
        });
        onCapture(finalImage);
        onOpenChange(false);
      },
      onError: () => toast.error("Failed to save avatar"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-4 h-4" /> {title}
          </DialogTitle>
        </DialogHeader>

        {stage === "camera" && (
          <>
            <div className="relative aspect-[3/4] bg-black rounded-xl overflow-hidden flex items-center justify-center">
              {permError ? (
                <div className="p-4 text-center text-sm text-destructive-foreground bg-destructive/20 m-3 rounded-lg">
                  {permError}
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                    style={{ transform: facing === "user" ? "scaleX(-1)" : "none" }}
                  />
                  {starting && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                  )}
                  <button
                    onClick={flipCamera}
                    className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-black/80"
                    aria-label="Flip camera"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
            <div className="flex gap-2">
              {permError ? (
                <button onClick={() => startCamera(facing)}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Retry Camera
                </button>
              ) : (
                <button onClick={capture} disabled={starting || !!permError}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                  <Camera className="w-5 h-5" /> Capture
                </button>
              )}
            </div>
          </>
        )}

        {(stage === "review" || stage === "edited") && finalImage && (
          <>
            <div className="relative aspect-[3/4] bg-black rounded-xl overflow-hidden">
              <img src={finalImage} alt="Captured" className="w-full h-full object-cover" />
              {editingPreset && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 backdrop-blur-sm">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  <p className="text-xs text-white">Mixing with AI…</p>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Mix with AI
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {AI_PRESETS.map(p => (
                  <button key={p.id} onClick={() => aiEdit(p)} disabled={!!editingPreset}
                    className="px-2 py-2 rounded-lg bg-muted text-foreground text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50 text-left">
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button onClick={accept}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Use this photo
              </button>
              {showAvatarAction && (
                <button onClick={saveAsAvatar} disabled={createAvatar.isPending}
                  className="w-full py-2.5 rounded-xl border border-border text-foreground text-sm flex items-center justify-center gap-2 hover:bg-accent disabled:opacity-50">
                  {createAvatar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Save as Profile Avatar
                </button>
              )}
              <button onClick={retake}
                className="w-full py-2.5 rounded-xl border border-border text-muted-foreground text-sm flex items-center justify-center gap-2 hover:bg-accent">
                <X className="w-4 h-4" /> Retake
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SelfieCaptureDialog;
