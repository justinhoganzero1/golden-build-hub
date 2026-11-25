import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import portrait from "@/assets/avatars/oracle-studio-portrait.jpg";
import outfit from "@/assets/fitness/oracle-fitness-outfit-green.jpg";
import idleClip from "@/assets/fitness/fitness-idle-light.mp4.asset.json";
import studio from "@/assets/fitness/fitness-studio-empty.jpg";
import { supabase } from "@/integrations/supabase/client";
import { talkingPose, poseTransform } from "@/lib/talkingMotion";
import { EXERCISES, Exercise, formTip, jointAngle, stepReps, RepState } from "@/lib/fitnessForm";

// Oracle's spoken commentary over the muted how-to clip (free device voice).
const COMMENTARY: Record<Exercise, string[]> = {
  squat: ["Watch the monitor. Feet about shoulder width apart.", "See how the hips go back first, like sitting into a chair.", "Chest stays up, knees follow the toes.", "Push through the heels to stand tall. Your turn when you're ready."],
  pushup: ["Watch the monitor. Hands just wider than your shoulders.", "Body in one straight line, from head to heels.", "Lower your chest nice and slow, elbows angled back.", "Press the floor away. Drop to your knees if you need to, that's fine."],
  jumping_jack: ["Watch the monitor. Start tall, arms by your sides.", "Jump the feet out as the arms swing overhead.", "Land softly on the balls of your feet.", "Keep a steady rhythm and keep breathing. Your turn when you're ready."],
};

const say = (t: string) => {
  try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(t)); } catch { /* no device voice */ }
};

export default function FitnessCoachPage() {
  const [ex, setEx] = useState<Exercise>("squat");
  const [look, setLook] = useState<"normal" | "fit">("fit");
  // Template prompt: zoomed in on Oracle asking what to do; returns after each how-to video.
  const [prompt, setPrompt] = useState<string | null>("What would you like to do?");
  useEffect(() => { const t = window.setTimeout(() => say("What would you like to do?"), 600); return () => clearTimeout(t); }, []);
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
    // Camera sway removed: the rocking motion made members seasick.
    if (!el || !answering || true) return;
    let f = 0; const t0 = performance.now();
    const tick = (n: number) => { el.style.transform = poseTransform(talkingPose((n - t0) / 1000)); f = requestAnimationFrame(tick); };
    f = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(f); el.style.transform = ""; };
  }, [answering]);

  // How-to monitor: every clip is cued (loaded, muted) in the background, then the
  // monitor behind Oracle zooms in to fill her window while she commentates.
  const [monitor, setMonitor] = useState<"off" | "back" | "zoom">("off");
  const talkTimers = useRef<number[]>([]);
  const clearTalk = () => { talkTimers.current.forEach(clearTimeout); talkTimers.current = []; };
  useEffect(() => () => clearTalk(), []);
  function showHow(pick: Exercise = ex) {
    setEx(pick); setPrompt(null); const exNow = pick;
    clearTalk(); setTutorialKey((k) => k + 1); setMonitor("back");
    body.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    talkTimers.current.push(window.setTimeout(() => setMonitor("zoom"), 1200));
    COMMENTARY[exNow].forEach((line, i) => talkTimers.current.push(window.setTimeout(() => say(line), 1600 + i * 6500)));
  }
  // When the YouTube clip ends, zoom back to Oracle and ask what's next.
  const monitorRef = useRef(monitor); monitorRef.current = monitor;
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!/youtube\.com$/.test(new URL(e.origin || "http://x").hostname)) return;
      let d: { event?: string; info?: unknown } | null = null;
      try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
      const st = d?.event === "onStateChange" ? d.info : d?.event === "infoDelivery" ? (d.info as { playerState?: number } | null)?.playerState : undefined;
      if (st === 0 && monitorRef.current !== "off") {
        clearTalk(); setMonitor("off"); setPrompt("OK, what's next?"); say("OK, what's next?");
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);
  function closeHow() { clearTalk(); try { speechSynthesis.cancel(); } catch { /* none */ } setMonitor("off"); }

  async function ask() {
    const text = question.trim();
    if (!text || answering) return;
    closeHow(); setQuestion(""); setAnswer(""); setAnswering(true); setTutorialKey((k) => k + 1); // reload stops the video
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

  return (
    <main className="min-h-screen bg-cover bg-center bg-fixed text-foreground" style={{ backgroundImage: `linear-gradient(hsl(var(--background) / .55), hsl(var(--background) / .8)), url(${studio})` }}>
     <div className="p-4 max-w-5xl mx-auto space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Oracle Fitness Coach</h1>
        <Link to="/oracle" className="text-sm text-muted-foreground underline">Back to Oracle</Link>
      </header>
      <div className="grid md:grid-cols-2 gap-4">
        <section className="rounded-2xl overflow-hidden bg-card/60 backdrop-blur border border-border">
          <div ref={body} className="relative h-[420px] overflow-hidden">
            {look === "fit" && !answering
              ? <video src={idleClip.url} poster={outfit} autoPlay muted loop playsInline aria-label="Oracle waiting in her workout outfit" className={`w-full h-full object-cover object-top transition-transform duration-700 ${prompt ? "scale-125" : ""}`} />
              : <img src={look === "fit" ? outfit : portrait} alt={answering ? "Oracle answering you" : "Oracle"} className="w-full h-full object-cover object-top" />}
            {/* Studio monitor: all clips stay cued muted; the chosen one shows and zooms in. */}
            <div data-testid="fitness-monitor" data-state={monitor}
              className={`absolute transition-all duration-1000 ease-in-out rounded-lg overflow-hidden border-4 border-border bg-background shadow-2xl ${monitor === "zoom" ? "inset-0 rounded-none border-0" : "top-4 right-4 w-[42%] aspect-video"} ${monitor === "off" ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
              {(Object.keys(EXERCISES) as Exercise[]).map((k) => {
                const id = EXERCISES[k].youtube;
                const live = monitor !== "off" && k === ex;
                return <iframe key={k + (live ? tutorialKey : "cued")} title={`${EXERCISES[k].label} how-to`} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen
                  onLoad={(e) => { try { e.currentTarget.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: k }), "*"); } catch { /* none */ } }}
                  className={`absolute inset-0 w-full h-full ${live && monitor === "zoom" ? "" : "pointer-events-none"} ${live ? "" : "invisible"}`}
                  src={`https://www.youtube.com/embed/${id}?autoplay=${live ? 1 : 0}&mute=1&controls=1&fs=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}&cc_load_policy=0&iv_load_policy=3&modestbranding=1&playsinline=1&rel=0`} />;
              })}
            </div>
            {prompt && monitor === "off" && !answering && (
              <div data-testid="fitness-prompt" className="absolute inset-x-3 bottom-3 z-10 rounded-xl bg-background/85 backdrop-blur border border-border p-3 space-y-2">
                <p className="font-semibold">{prompt}</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(EXERCISES) as Exercise[]).map((k) => <Button key={k} size="sm" variant="outline" onClick={() => showHow(k)}>Learn {EXERCISES[k].label}</Button>)}
                  <Button size="sm" onClick={() => { setPrompt(null); start(); }}>Start workout</Button>
                </div>
              </div>
            )}
            {monitor !== "off" && <Button size="sm" variant="secondary" className="absolute bottom-3 left-3 z-10" onClick={closeHow}>Back to Oracle</Button>}
            {monitor === "zoom" && <Button size="sm" variant="secondary" className="absolute bottom-3 right-3 z-10" asChild><a href={`https://www.youtube.com/watch?v=${EXERCISES[ex].youtube}`} target="_blank" rel="noopener noreferrer">Full screen on YouTube</a></Button>}
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
        <Button variant="secondary" onClick={() => showHow()}>Show me how</Button>
        {running ? <Button variant="destructive" onClick={finish}>Finish workout</Button> : <Button onClick={start}>Start workout</Button>}
      </div>
      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <div className="flex gap-2">
          <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask Oracle anything during your workout…" className="flex-1 rounded-xl border border-border bg-background/80 px-3 py-2 text-sm" />
          <Button type="submit" disabled={answering || !question.trim()}>{answering ? "Answering…" : "Ask"}</Button>
        </div>
        {answer && <p className="rounded-xl bg-card/80 backdrop-blur border border-border px-3 py-2 text-sm">{answer}</p>}
      </form>
     </div>
    </main>
  );
}
