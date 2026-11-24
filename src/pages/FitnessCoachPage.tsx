import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import portrait from "@/assets/avatars/oracle-futuristic-office.jpg";
import outfit from "@/assets/fitness/oracle-fitness-outfit-green.jpg";
import { EXERCISES, Exercise, formTip, jointAngle, stepReps, RepState } from "@/lib/fitnessForm";

const say = (t: string) => {
  try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(t)); } catch { /* no device voice */ }
};

export default function FitnessCoachPage() {
  const [ex, setEx] = useState<Exercise>("squat");
  const [look, setLook] = useState<"normal" | "fit">("normal");
  const [running, setRunning] = useState(false);
  const [reps, setReps] = useState(0);
  const [tip, setTip] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const stop = useRef<() => void>(() => {});

  useEffect(() => () => stop.current(), []);

  async function start() {
    setLook("fit"); setReps(0); setTip(null); setStatus("Starting camera…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      const v = video.current!; v.srcObject = stream; await v.play();
      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      const files = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
      const pose = await PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task" },
        runningMode: "VIDEO", numPoses: 1,
      });
      let state: RepState = { phase: "up", reps: 0 };
      let lastTip = 0, raf = 0, alive = true;
      const loop = () => {
        if (!alive) return;
        if (v.readyState >= 2) {
          const lm = pose.detectForVideo(v, performance.now()).landmarks?.[0];
          if (lm) {
            const next = stepReps(ex, state, jointAngle(ex, lm));
            if (next.reps !== state.reps) { setReps(next.reps); if (next.reps % 5 === 0) say(`${next.reps}! Great work.`); }
            state = next;
            const t = formTip(ex, lm);
            setTip(t);
            if (t && performance.now() - lastTip > 6000) { lastTip = performance.now(); say(t); }
            setStatus("");
          } else setStatus("Step back so I can see your whole body.");
        }
        raf = requestAnimationFrame(loop);
      };
      stop.current = () => { alive = false; cancelAnimationFrame(raf); stream.getTracks().forEach((t) => t.stop()); pose.close(); };
      setRunning(true); setStatus(""); say(`Let's do ${EXERCISES[ex].label}. I'll count for you.`);
      loop();
    } catch {
      setStatus("Camera couldn't start. Please allow camera access and try again.");
      setLook("normal");
    }
  }

  function finish() {
    stop.current(); setRunning(false);
    say(`Well done! ${reps} reps. I'm just going to get changed.`);
    setTimeout(() => setLook("normal"), 2000);
  }

  const info = EXERCISES[ex];
  return (
    <main className="min-h-screen p-4 max-w-5xl mx-auto space-y-4 text-foreground">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Oracle Fitness Coach</h1>
        <Link to="/oracle" className="text-sm text-muted-foreground underline">Back to Oracle</Link>
      </header>
      <div className="grid md:grid-cols-2 gap-4">
        <section className="rounded-2xl overflow-hidden bg-card/60 backdrop-blur border border-border">
          <img src={look === "fit" ? outfit : portrait} alt={look === "fit" ? "Oracle in her workout outfit" : "Oracle"} className="w-full h-[420px] object-cover object-top transition-opacity duration-500" />
        </section>
        <section className="rounded-2xl overflow-hidden bg-card/60 backdrop-blur border border-border relative">
          <video ref={video} muted playsInline className="w-full h-[420px] object-cover -scale-x-100 bg-muted" />
          <div className="absolute top-3 left-3 rounded-xl bg-background/80 px-4 py-2 text-3xl font-bold">{reps}</div>
          {(tip || status) && <div className="absolute bottom-3 inset-x-3 rounded-xl bg-background/85 px-3 py-2 text-sm">{tip || status}</div>}
          {!running && <p className="absolute inset-0 grid place-items-center text-muted-foreground text-sm px-6 text-center">Your camera stays on your device. Nothing is recorded or sent.</p>}
        </section>
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(EXERCISES) as Exercise[]).map((k) => (
          <Button key={k} variant={k === ex ? "default" : "outline"} disabled={running} onClick={() => setEx(k)}>{EXERCISES[k].label}</Button>
        ))}
        {running ? <Button variant="destructive" onClick={finish}>Finish workout</Button> : <Button onClick={start}>Start workout</Button>}
      </div>
      <section className="space-y-2">
        <h2 className="font-semibold">How to do {info.label.toLowerCase()} properly</h2>
        <div className="aspect-video rounded-2xl overflow-hidden border border-border">
          <iframe className="w-full h-full" src={`https://www.youtube-nocookie.com/embed/${info.youtube}?cc_load_policy=0`} title={`${info.label} tutorial`} allow="encrypted-media; picture-in-picture" allowFullScreen />
        </div>
      </section>
    </main>
  );
}
