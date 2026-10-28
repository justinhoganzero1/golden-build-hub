import { useEffect, useRef, useState } from "react";
import { choosePresenterClip, presenterHistory, type PresenterClip, type PresenterState } from "@/lib/oracleClipSelection";
import portrait from "@/assets/avatars/oracle-futuristic-office.jpg";
import listeningClip from "@/assets/avatars/oracle-office-portrait-silent.webm.asset.json";

// Advertising footage is deliberately not approved as conversational footage.
const approvedClips: PresenterClip[] = [{ id: "office-listening-1", url: listeningClipUrl, states: ["idle", "listening", "thinking", "speaking"], approved: true, silent: true }];
export default function OraclePresenterStage({ state, image, userId }: { state: PresenterState; image?: string; userId?: string }) {
  const [clip, setClip] = useState<PresenterClip | null>(null);
  const recent = useRef<string[]>([]);
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const choose = () => {
    const next = image ? null : choosePresenterClip(approvedClips, state, recent.current);
    if (next) recent.current = presenterHistory(recent.current, next.id);
    setClip(current => current?.id === next?.id ? current : next); setFailed(false);
  };
  useEffect(() => { recent.current = []; choose(); }, [userId, image]);
  useEffect(() => { choose(); }, [state]);
  useEffect(() => () => { video.current?.pause(); }, []);
  return <div className="absolute inset-0" data-testid="oracle-presenter-stage">
    <img src={image || portrait} alt="Oracle AI presenter" className="h-full w-full object-cover object-center" />
    {clip && !failed && <video ref={video} key={clip.id} src={clip.url} muted autoPlay loop playsInline preload="auto" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden" />}
    <div className="absolute inset-0 oracle-stage-shade" />
    <span className="sr-only">{clip && !failed ? "AI presenter using prerecorded footage" : "AI presenter portrait; live video is not active"}</span>
  </div>;
}