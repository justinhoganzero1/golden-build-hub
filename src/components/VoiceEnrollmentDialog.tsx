import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mic, Loader2, CheckCircle2 } from "lucide-react";
import { enrollVoice, loadVoicePrint } from "@/lib/audioFilter";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onComplete?: () => void;
}

export default function VoiceEnrollmentDialog({ open, onOpenChange, onComplete }: Props) {
  const [phase, setPhase] = useState<"intro" | "recording" | "done" | "error">("intro");
  const [error, setError] = useState<string>("");
  const existing = loadVoicePrint();

  const start = async () => {
    setPhase("recording");
    setError("");
    try {
      await enrollVoice(5000);
      setPhase("done");
      toast.success("Voice profile saved. Oracle will now focus on you.");
      setTimeout(() => {
        onOpenChange(false);
        onComplete?.();
      }, 1200);
    } catch (e: any) {
      setError(e?.message || "Enrollment failed");
      setPhase("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-primary/30">
        <DialogHeader>
          <DialogTitle className="text-primary flex items-center gap-2">
            <Mic className="h-5 w-5" /> Sync Your Voice
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Oracle will record 5 seconds of your voice so it can isolate you in noisy rooms (sirens, TV, traffic, flatmates). Used locally only.
          </DialogDescription>
        </DialogHeader>

        {phase === "intro" && (
          <div className="space-y-4 py-4">
            {existing && (
              <p className="text-xs text-muted-foreground">
                Existing profile detected ({existing.samples} samples). Re-enroll to replace.
              </p>
            )}
            <div className="rounded-lg bg-muted/40 p-4 text-sm">
              When you tap <strong>Start</strong>, please say clearly:
              <p className="mt-2 italic text-primary">"Hello Oracle, this is my voice."</p>
            </div>
            <Button onClick={start} className="w-full bg-primary text-primary-foreground">
              <Mic className="mr-2 h-4 w-4" /> Start 5-second recording
            </Button>
          </div>
        )}

        {phase === "recording" && (
          <div className="space-y-4 py-8 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 animate-pulse">
              <Mic className="h-10 w-10 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Listening… speak now</p>
          </div>
        )}

        {phase === "done" && (
          <div className="space-y-4 py-8 text-center">
            <CheckCircle2 className="mx-auto h-16 w-16 text-primary" />
            <p className="text-primary font-semibold">Voice profile saved</p>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-4 py-4 text-center">
            <p className="text-destructive text-sm">{error}</p>
            <Button onClick={() => setPhase("intro")} variant="outline">Try again</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
