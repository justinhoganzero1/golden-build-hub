import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUp, Mic, Paperclip, Settings2, Square, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OraclePromptBoxProps {
  input: string;
  onInput: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  listening: boolean;
  muted: boolean;
  uploading: boolean;
  onMic: () => void;
  onSpeaker: () => void;
  onAttach: () => void;
  onSettings: () => void;
  tools: ReactNode;
}

export default function OraclePromptBox(props: OraclePromptBoxProps) {
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!field.current) return;
    field.current.style.height = "auto";
    field.current.style.height = `${Math.min(field.current.scrollHeight, 120)}px`;
  }, [props.input]);
  return <form data-testid="oracle-composer" className="oracle-prompt" onSubmit={event => { event.preventDefault(); if (!props.busy) props.onSend(); }}>
    <textarea ref={field} aria-label="Ask Oracle" value={props.input} onChange={event => props.onInput(event.target.value)}
      onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!props.busy) props.onSend(); } }}
      placeholder="What’s on your mind?" rows={1} spellCheck autoCapitalize="sentences"
      className="oracle-prompt-field" />
    <div className="flex items-center gap-1">
      <Button type="button" variant="ghost" size="icon" className="oracle-control" aria-label="Attach photo or file" title="Attach photo or file" disabled={props.uploading} onClick={props.onAttach}><Paperclip className={props.uploading ? "animate-pulse" : ""} /></Button>
      {props.tools}
      <Button type="button" variant="ghost" size="icon" className="oracle-control" aria-label="Voice and agent settings" title="Voice and agent settings" onClick={props.onSettings}><Settings2 /></Button>
      <Button type="button" variant="ghost" size="icon" className="oracle-control" aria-label={props.muted ? "Unmute Oracle speaker" : "Mute Oracle speaker"} title={props.muted ? "Enable speaker" : "Mute speaker"} aria-pressed={!props.muted} onClick={props.onSpeaker}>{props.muted ? <VolumeX /> : <Volume2 />}</Button>
      <div className="flex-1" />
      <Button type="button" variant="ghost" size="icon" className={`oracle-control ${props.listening ? "oracle-mic-active" : ""}`} aria-label="Toggle Oracle microphone" title={props.listening ? "Stop microphone" : "Talk to Oracle"} aria-pressed={props.listening} onClick={props.onMic}><Mic /></Button>
      {props.busy
        ? <Button type="button" variant="outline" size="icon" className="oracle-control" aria-label="Stop Oracle conversation" title="Stop Oracle" onClick={props.onStop}><Square /></Button>
        : <Button type="submit" size="icon" className="oracle-send" disabled={!props.input.trim()} aria-label="Send message" title="Send message"><ArrowUp /></Button>}
    </div>
  </form>;
}