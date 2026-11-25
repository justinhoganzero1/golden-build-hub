import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import portrait from "@/assets/avatars/oracle-studio-portrait.jpg";
import outfit from "@/assets/fitness/oracle-fitness-outfit-green.jpg";
import idleClip from "@/assets/fitness/fitness-idle-long.mp4.asset.json";
import studio from "@/assets/fitness/fitness-studio-empty.jpg";
import { supabase } from "@/integrations/supabase/client";
import { talkingPose, poseTransform } from "@/lib/talkingMotion";
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

  // Chat during the workout: the how-to video pauses, Oracle stands and answers.
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [answering, setAnswering] = useState(false);
  const [tutorialKey, setTutorialKey] = useState(0);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = body.current;
    if (!el || !answering) return;
    let f = 0; const t0 = performance.now();
    const tick = (n: number) => { el.style.transform = poseTransform(talkingPose((n - t0) / 1000)); f = requestAnimationFrame(tick); };
    f = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(f); el.style.transform = ""; };
  }, [answering]);

  async function ask() {
    const text = question.trim();
    if (!text || answering) return;
    setQuestion(""); setAnswer(""); setAnswering(true); setTutorialKey((k) => k + 1); // reload stops the video
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Please sign in to chat with Oracle.");
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: [{ role: "user", content: `(I'm doing ${EXERCISES[ex].label} with you as my fitness coach.) ${text}` }] }),
      });
      if (!resp.ok || !resp.body) throw new Error("Oracle couldn't answer right now.");
      const reader = resp.body.getReader(); const dec = new TextDecoder();
      let buf = "", full = "";
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() || "";
        for (const l of lines) {
          if (!l.startsWith("data: ") || l.includes("[DONE]")) continue;
          try { const c = JSON.parse(l.slice(6)).choices?.[0]?.delta?.content; if (c) { full += c; setAnswer(full); } } catch { /* partial line */ }
        }
      }
      const clean = full.replace(/\[\[[^\]]*\]\]/g, "").trim();
      setAnswer(clean);
      await new Promise<void>((res) => {
        try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(clean); u.onend = () => res(); u.onerror = () => res(); speechSynthesis.speak(u); } catch { res(); }
      });
    } catch (e) {
      setAnswer(e instanceof Error ? e.message : "Oracle couldn't answer right now.");
    } finally { setAnswering(false); }
  }

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
    <main className="min-h-screen bg-cover bg-center bg-fixed text-foreground" style={{ backgroundImage: `linear-gradient(hsl(var(--background) / .55), hsl(var(--background) / .8)), url(${studio})` }}>
     <div className="p-4 max-w-5xl mx-auto space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Oracle Fitness Coach</h1>
        <Link to="/oracle" className="text-sm text-muted-foreground underline">Back to Oracle</Link>
      </header>
      <div className="grid md:grid-cols-2 gap-4">
        <section className="rounded-2xl overflow-hidden bg-card/60 backdrop-blur border border-border">
          <div ref={body} className="h-[420px] origin-[50%_65%] will-change-transform">
            {look === "fit" && !answering
              ? <video src={idleClip.url} poster={outfit} autoPlay muted loop playsInline aria-label="Oracle waiting in her workout outfit" className="w-full h-full object-cover object-top" />
              : <img src={look === "fit" ? outfit : portrait} alt={answering ? "Oracle answering you" : "Oracle"} className="w-full h-full object-cover object-top" />}
          </div>
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
      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <div className="flex gap-2">
          <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask Oracle anything during your workout…" className="flex-1 rounded-xl border border-border bg-background/80 px-3 py-2 text-sm" />
          <Button type="submit" disabled={answering || !question.trim()}>{answering ? "Answering…" : "Ask"}</Button>
        </div>
        {answer && <p className="rounded-xl bg-card/80 backdrop-blur border border-border px-3 py-2 text-sm">{answer}</p>}
      </form>
      <section className="space-y-2">
        <h2 className="font-semibold">How to do {info.label.toLowerCase()} properly</h2>
        <div className="aspect-video rounded-2xl overflow-hidden border border-border">
          <iframe key={tutorialKey} className="w-full h-full" src={`https://www.youtube-nocookie.com/embed/${info.youtube}?cc_load_policy=0`} title={`${info.label} tutorial`} allow="encrypted-media; picture-in-picture" allowFullScreen />
        </div>
      </section>
     </div>
    </main>
  );
}
