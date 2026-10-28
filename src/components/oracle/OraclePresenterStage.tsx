import { useEffect, useRef, useState } from "react";
import portrait from "@/assets/avatars/oracle-futuristic-office.jpg";
import listeningClipUrl from "@/assets/avatars/oracle-office-listening-silent.webm";
import greetingClipUrl from "@/assets/avatars/oracle-clip-greeting.webm";
import thinkingClipUrl from "@/assets/avatars/oracle-clip-thinking.webm";
import talkingClipUrl from "@/assets/avatars/oracle-clip-talking.webm";
import doneClipUrl from "@/assets/avatars/oracle-clip-done.webm";

export type PresenterState = "idle" | "listening" | "thinking" | "speaking";
/** One-shot spoken clips with real lip-sync and their own audio. */
export type PresenterCue = "greeting" | "done" | null;

interface ClipPlan {
  url: string;
  /** Clips with real speech play their own audio; loops stay muted. */
  audible: boolean;
  loop: boolean;
}

const CUE_CLIPS: Record<Exclude<PresenterCue, null>, ClipPlan> = {
  greeting: { url: greetingClipUrl, audible: true, loop: false },
  done: { url: doneClipUrl, audible: true, loop: false },
};
const THINKING_CLIP: ClipPlan = { url: thinkingClipUrl, audible: true, loop: false };
const TALKING_CLIP: ClipPlan = { url: talkingClipUrl, audible: false, loop: true };
const LISTENING_CLIP: ClipPlan = { url: listeningClipUrl, audible: false, loop: true };

/**
 * Full-bleed presenter. Picks prerecorded clips by state and one-shot cues:
 * greeting/done clips carry real lip-synced speech, "thinking" plays once per
 * request, and a muted talking loop sits under device speech so her mouth
 * moves while answers are spoken. Footage is prerecorded — never presented
 * as a live camera feed.
 */
export default function OraclePresenterStage({ state, image, userId, cue, onCueDone }: {
  state: PresenterState;
  image?: string;
  userId?: string;
  cue?: PresenterCue;
  onCueDone?: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [thinkingPlayed, setThinkingPlayed] = useState(false);

  // Reset the one-shot thinking clip each time a new request starts.
  useEffect(() => { if (state !== "thinking") setThinkingPlayed(false); }, [state]);
  useEffect(() => () => { video.current?.pause(); }, []);

  const plan: ClipPlan | null = image
    ? null
    : cue
      ? CUE_CLIPS[cue]
      : state === "thinking" && !thinkingPlayed
        ? THINKING_CLIP
        : state === "speaking"
          ? TALKING_CLIP
          : LISTENING_CLIP;

  // Audible clips need a play() attempt with sound; if the browser blocks
  // unmuted autoplay (no gesture yet), fall back to muted so she still moves.
  useEffect(() => {
    const v = video.current;
    if (!v || !plan) return;
    v.muted = !plan.audible;
    const tryPlay = () => v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
    if (v.readyState >= 2) tryPlay();
    else v.addEventListener("canplay", tryPlay, { once: true });
    return () => v.removeEventListener("canplay", tryPlay);
  }, [plan?.url]);

  const handleEnded = () => {
    if (cue) onCueDone?.();
    else if (state === "thinking") setThinkingPlayed(true);
  };

  return <div className="absolute inset-0" data-testid="oracle-presenter-stage">
    <img src={image || portrait} alt="Oracle AI presenter" className="h-full w-full object-cover object-center" />
    {plan && !failed && (
      <video
        ref={video}
        key={plan.url + (cue ?? "")}
        src={plan.url}
        muted={!plan.audible}
        autoPlay
        loop={plan.loop}
        playsInline
        preload="auto"
        onEnded={plan.loop ? undefined : handleEnded}
        onError={() => setFailed(true)}
        className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
      />
    )}
    <div className="absolute inset-0 oracle-stage-shade" />
    <span className="sr-only">{plan && !failed ? "AI presenter using prerecorded footage" : "AI presenter portrait; video is not active"}</span>
  </div>;
}
