// Hands-free "Just keep talking" director. Uses ElevenLabs realtime STT (scribe_v2_realtime)
// to capture a free-form ramble, then feeds the full transcript to oracle-voice-director
// in extract_from_ramble mode. Result is a complete movie brief ready to render.
import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useScribe } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  onBriefReady: (brief: { title: string; logline: string; genre: string; full_script: string; }) => void;
}

export const JustKeepTalkingButton = ({ onBriefReady }: Props) => {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const transcriptRef = useRef<string>("");

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: "vad",
    onCommittedTranscript: (data: any) => {
      transcriptRef.current += " " + (data.text ?? "");
    },
  });

  const start = useCallback(async () => {
    try {
      transcriptRef.current = "";
      const { data, error } = await supabase.functions.invoke("elevenlabs-stt-token");
      if (error || !data?.token) throw new Error(error?.message ?? "no token");

      await navigator.mediaDevices.getUserMedia({ audio: true });
      await scribe.connect({
        token: data.token,
        microphone: { echoCancellation: true, noiseSuppression: true },
      });
      setRecording(true);
      toast.success("Listening… just keep talking. Tap stop when done.");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't start mic");
    }
  }, [scribe]);

  const stop = useCallback(async () => {
    setRecording(false);
    setProcessing(true);
    try {
      await scribe.disconnect();
      const transcript = (transcriptRef.current + " " + (scribe.partialTranscript ?? "")).trim();
      if (!transcript || transcript.length < 20) {
        toast.error("I didn't catch enough — try again");
        setProcessing(false);
        return;
      }

      // Hand off to Oracle director
      const { data, error } = await supabase.functions.invoke("oracle-voice-director", {
        body: { mode: "extract_from_ramble", transcript },
      });
      if (error || !data?.brief) throw new Error(error?.message ?? "Oracle couldn't shape that");
      toast.success("Got it. Movie brief ready.");
      onBriefReady(data.brief);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setProcessing(false);
    }
  }, [scribe, onBriefReady]);

  if (processing) {
    return (
      <Button size="lg" disabled className="w-full h-14">
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        Oracle is shaping your movie…
      </Button>
    );
  }

  return (
    <Button
      onClick={recording ? stop : start}
      size="lg"
      className={`w-full h-14 ${recording ? "bg-destructive hover:bg-destructive/90" : "bg-secondary hover:bg-secondary/80"}`}
    >
      {recording ? <MicOff className="w-5 h-5 mr-2" /> : <Mic className="w-5 h-5 mr-2" />}
      {recording ? "Stop & build" : "🎙️ Just keep talking"}
      {scribe.partialTranscript && recording && (
        <span className="text-[10px] opacity-70 ml-2 truncate max-w-[200px]">
          {scribe.partialTranscript}
        </span>
      )}
    </Button>
  );
};

export default JustKeepTalkingButton;
