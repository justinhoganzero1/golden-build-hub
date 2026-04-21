import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Mic, Volume2, ShieldCheck, X } from "lucide-react";

export type AudioIntent = "permissions" | "recording" | "playback" | "cancel";

interface Props {
  open: boolean;
  fragment: string;
  onResolve: (intent: AudioIntent) => void;
}

/**
 * Quick clarification surfaced when the Oracle detects a truncated audio-related
 * message (e.g. "udio on my device"). The user picks the intent and we feed a
 * cleaned-up prompt back into the chat instead of sending the malformed text.
 */
const AudioClarifyDialog = ({ open, fragment, onResolve }: Props) => (
  <Dialog open={open} onOpenChange={(v) => { if (!v) onResolve("cancel"); }}>
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle className="text-base">Did your message get cut off?</DialogTitle>
        <DialogDescription className="text-xs">
          We received <span className="font-mono text-foreground">"{fragment}"</span>. Tap what you meant so the Oracle can help:
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2 mt-2">
        <button
          onClick={() => onResolve("permissions")}
          className="flex items-center gap-3 p-3 rounded-lg bg-secondary hover:bg-secondary/70 text-left"
        >
          <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">Audio permissions</p>
            <p className="text-[11px] text-muted-foreground">My mic isn't allowed or stays blocked</p>
          </div>
        </button>

        <button
          onClick={() => onResolve("recording")}
          className="flex items-center gap-3 p-3 rounded-lg bg-secondary hover:bg-secondary/70 text-left"
        >
          <Mic className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">Recording / mic test</p>
            <p className="text-[11px] text-muted-foreground">Check that my mic is being heard</p>
          </div>
        </button>

        <button
          onClick={() => onResolve("playback")}
          className="flex items-center gap-3 p-3 rounded-lg bg-secondary hover:bg-secondary/70 text-left"
        >
          <Volume2 className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">Playback / speakers</p>
            <p className="text-[11px] text-muted-foreground">I can't hear the Oracle / sound output</p>
          </div>
        </button>

        <button
          onClick={() => onResolve("cancel")}
          className="flex items-center justify-center gap-2 p-2 mt-1 rounded-lg text-muted-foreground hover:text-foreground text-xs"
        >
          <X className="w-3 h-3" /> None of these — send my message anyway
        </button>
      </div>
    </DialogContent>
  </Dialog>
);

export default AudioClarifyDialog;

/** Build a clean, model-friendly prompt from the chosen intent. */
export function intentToPrompt(intent: AudioIntent, fragment: string): string {
  switch (intent) {
    case "permissions":
      return "My audio permissions might be blocked on this device. Walk me through enabling microphone access for this app.";
    case "recording":
      return "I want to test that my microphone is recording properly. Open the Audio Diagnostics page and explain how to test it.";
    case "playback":
      return "I can't hear sound / playback isn't working. Help me troubleshoot speaker output and verify audio playback.";
    case "cancel":
    default:
      return fragment;
  }
}
