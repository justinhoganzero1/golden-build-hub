import { useEffect, useMemo, useRef, useState } from "react";
import SEO from "@/components/SEO";
import UniversalBackButton from "@/components/UniversalBackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Gamepad2, ListChecks, CalendarDays, Droplet, Smile, Trash2 } from "lucide-react";

/* ---------- tiny storage helper (device only, free forever) ---------- */
function useStored<T>(key: string, init: T) {
  const [v, setV] = useState<T>(() => {
    try { const s = localStorage.getItem("fz." + key); return s ? JSON.parse(s) : init; } catch { return init; }
  });
  useEffect(() => { try { localStorage.setItem("fz." + key, JSON.stringify(v)); } catch {} }, [key, v]);
  return [v, setV] as const;
}
const today = () => new Date().toISOString().slice(0, 10);
const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-card p-4 space-y-3">{children}</div>
);

/* ------------------------------- GAMES ------------------------------- */
const TicTacToe = () => {
  const [b, setB] = useState<(string | null)[]>(Array(9).fill(null));
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const win = (bd: (string | null)[]) => lines.find(([a, c, d]) => bd[a] && bd[a] === bd[c] && bd[a] === bd[d]);
  const w = win(b);
  const play = (i: number) => {
    if (b[i] || w) return;
    const n = [...b]; n[i] = "X";
    if (!win(n)) {
      const free = n.map((x, j) => (x ? -1 : j)).filter((j) => j >= 0);
      const pick = free.find((j) => { const t = [...n]; t[j] = "O"; return win(t); })
        ?? free.find((j) => { const t = [...n]; t[j] = "X"; return win(t); })
        ?? (n[4] ? free[Math.floor(Math.random() * free.length)] : 4);
      if (pick !== undefined) n[pick] = "O";
    }
    setB(n);
  };
  const status = w ? (b[w[0]] === "X" ? "You win!" : "Oracle wins!") : b.every(Boolean) ? "Draw" : "Your turn (X)";
  return (
    <Card>
      <p className="text-sm font-semibold text-foreground">{status}</p>
      <div className="grid grid-cols-3 gap-2 w-60">
        {b.map((c, i) => (
          <button key={i} onClick={() => play(i)} className="h-20 rounded-xl bg-muted text-3xl font-bold text-primary">{c}</button>
        ))}
      </div>
      <Button variant="outline" onClick={() => setB(Array(9).fill(null))}>New game</Button>
    </Card>
  );
};

const MemoryMatch = () => {
  const icons = ["🌙", "⭐", "🔮", "🪐", "☄️", "🌞", "🌈", "⚡"];
  const deal = () => [...icons, ...icons].sort(() => Math.random() - 0.5);
  const [cards, setCards] = useState(deal);
  const [open, setOpen] = useState<number[]>([]);
  const [done, setDone] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const flip = (i: number) => {
    if (open.includes(i) || done.includes(i) || open.length === 2) return;
    const o = [...open, i]; setOpen(o);
    if (o.length === 2) {
      setMoves((m) => m + 1);
      setTimeout(() => {
        if (cards[o[0]] === cards[o[1]]) setDone((d) => [...d, ...o]);
        setOpen([]);
      }, 600);
    }
  };
  return (
    <Card>
      <p className="text-sm text-foreground">Moves: {moves} {done.length === 16 && "— all matched!"}</p>
      <div className="grid grid-cols-4 gap-2 w-72">
        {cards.map((c, i) => (
          <button key={i} onClick={() => flip(i)} className="h-16 rounded-xl bg-muted text-2xl">
            {open.includes(i) || done.includes(i) ? c : "?"}
          </button>
        ))}
      </div>
      <Button variant="outline" onClick={() => { setCards(deal()); setOpen([]); setDone([]); setMoves(0); }}>Shuffle</Button>
    </Card>
  );
};

const NumberGuess = () => {
  const [target, setTarget] = useState(() => 1 + Math.floor(Math.random() * 100));
  const [guess, setGuess] = useState("");
  const [msg, setMsg] = useState("I'm thinking of a number from 1 to 100.");
  const [tries, setTries] = useState(0);
  const go = () => {
    const g = Number(guess); if (!g) return;
    const t = tries + 1; setTries(t);
    setMsg(g === target ? `Got it in ${t} tries!` : g < target ? "Higher ↑" : "Lower ↓");
    setGuess("");
  };
  return (
    <Card>
      <p className="text-sm text-foreground">{msg}</p>
      <div className="flex gap-2 max-w-xs">
        <Input type="number" value={guess} onChange={(e) => setGuess(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} />
        <Button onClick={go}>Guess</Button>
      </div>
      <Button variant="outline" onClick={() => { setTarget(1 + Math.floor(Math.random() * 100)); setTries(0); setMsg("New number chosen."); }}>Restart</Button>
    </Card>
  );
};

const ReactionTimer = () => {
  const [state, setState] = useState<"idle" | "wait" | "go" | "done" | "early">("idle");
  const [ms, setMs] = useState(0);
  const [best, setBest] = useStored<number | null>("reaction.best", null);
  const start = useRef(0); const timer = useRef<number>();
  const click = () => {
    if (state === "idle" || state === "done" || state === "early") {
      setState("wait");
      timer.current = window.setTimeout(() => { start.current = performance.now(); setState("go"); }, 1200 + Math.random() * 2500);
    } else if (state === "wait") { clearTimeout(timer.current); setState("early"); }
    else if (state === "go") {
      const t = Math.round(performance.now() - start.current); setMs(t); setState("done");
      if (!best || t < best) setBest(t);
    }
  };
  const label = { idle: "Tap to start", wait: "Wait for it…", go: "TAP NOW!", done: `${ms} ms — tap to retry`, early: "Too early! Tap to retry" }[state];
  return (
    <Card>
      <button onClick={click} className={`w-full h-40 rounded-2xl text-xl font-bold ${state === "go" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>{label}</button>
      <p className="text-xs text-muted-foreground">Best: {best ? `${best} ms` : "—"}</p>
    </Card>
  );
};

const RockPaperScissors = () => {
  const opts = ["🪨", "📄", "✂️"];
  const [score, setScore] = useState({ you: 0, me: 0 });
  const [last, setLast] = useState("");
  const play = (i: number) => {
    const o = Math.floor(Math.random() * 3);
    const r = (i - o + 3) % 3;
    if (r === 1) setScore((s) => ({ ...s, you: s.you + 1 }));
    if (r === 2) setScore((s) => ({ ...s, me: s.me + 1 }));
    setLast(`You ${opts[i]} vs Oracle ${opts[o]} — ${r === 0 ? "draw" : r === 1 ? "you win" : "Oracle wins"}`);
  };
  return (
    <Card>
      <p className="text-sm text-foreground">You {score.you} : {score.me} Oracle</p>
      <div className="flex gap-3">{opts.map((o, i) => <button key={o} onClick={() => play(i)} className="text-4xl h-20 w-20 rounded-xl bg-muted">{o}</button>)}</div>
      <p className="text-xs text-muted-foreground">{last}</p>
    </Card>
  );
};

const WORDS = ["ORACLE", "LUNAR", "PLANET", "GALAXY", "ROCKET", "COMET", "ORBIT", "NEBULA", "METEOR", "ECLIPSE"];
const Hangman = () => {
  const [word, setWord] = useState(() => WORDS[Math.floor(Math.random() * WORDS.length)]);
  const [guessed, setGuessed] = useState<string[]>([]);
  const wrong = guessed.filter((g) => !word.includes(g)).length;
  const won = word.split("").every((c) => guessed.includes(c));
  const lost = wrong >= 6;
  return (
    <Card>
      <p className="text-2xl tracking-[0.4em] font-mono text-foreground">{word.split("").map((c) => (guessed.includes(c) || lost ? c : "_")).join("")}</p>
      <p className="text-xs text-muted-foreground">Lives left: {6 - wrong} {won && "— you win!"} {lost && "— out of lives"}</p>
      <div className="flex flex-wrap gap-1">
        {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => (
          <button key={l} disabled={guessed.includes(l) || won || lost} onClick={() => setGuessed([...guessed, l])} className="w-8 h-8 rounded bg-muted text-sm disabled:opacity-30 text-foreground">{l}</button>
        ))}
      </div>
      <Button variant="outline" onClick={() => { setWord(WORDS[Math.floor(Math.random() * WORDS.length)]); setGuessed([]); }}>New word</Button>
    </Card>
  );
};

const MathSprint = () => {
  const mk = () => { const a = 1 + Math.floor(Math.random() * 12), b = 1 + Math.floor(Math.random() * 12); return { a, b }; };
  const [q, setQ] = useState(mk); const [ans, setAns] = useState(""); const [score, setScore] = useState(0);
  const [left, setLeft] = useState(0);
  useEffect(() => { if (left <= 0) return; const t = setTimeout(() => setLeft(left - 1), 1000); return () => clearTimeout(t); }, [left]);
  const submit = () => { if (Number(ans) === q.a * q.b) setScore(score + 1); setQ(mk()); setAns(""); };
  return (
    <Card>
      {left > 0 ? (
        <>
          <p className="text-sm text-foreground">{left}s · score {score}</p>
          <p className="text-3xl font-bold text-primary">{q.a} × {q.b}</p>
          <Input autoFocus type="number" className="max-w-xs" value={ans} onChange={(e) => setAns(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        </>
      ) : (
        <>
          <p className="text-sm text-foreground">{score ? `Final score: ${score}` : "Answer as many times tables as you can in 30 seconds."}</p>
          <Button onClick={() => { setScore(0); setLeft(30); setQ(mk()); }}>Start</Button>
        </>
      )}
    </Card>
  );
};

const SimonSays = () => {
  const colours = ["bg-primary", "bg-destructive", "bg-accent", "bg-secondary"];
  const [seq, setSeq] = useState<number[]>([]); const [step, setStep] = useState(0);
  const [lit, setLit] = useState<number | null>(null); const [msg, setMsg] = useState("Tap start");
  const show = async (s: number[]) => {
    for (const c of s) { await new Promise((r) => setTimeout(r, 300)); setLit(c); await new Promise((r) => setTimeout(r, 450)); setLit(null); }
  };
  const next = (s: number[]) => { const n = [...s, Math.floor(Math.random() * 4)]; setSeq(n); setStep(0); setMsg(`Round ${n.length}`); void show(n); };
  const tap = (i: number) => {
    if (!seq.length) return;
    if (seq[step] !== i) { setMsg(`Game over — reached round ${seq.length}`); setSeq([]); return; }
    if (step + 1 === seq.length) next(seq); else setStep(step + 1);
  };
  return (
    <Card>
      <p className="text-sm text-foreground">{msg}</p>
      <div className="grid grid-cols-2 gap-2 w-56">
        {colours.map((c, i) => <button key={i} onClick={() => tap(i)} className={`h-24 rounded-xl ${c} ${lit === i ? "opacity-100 ring-4 ring-foreground" : "opacity-50"}`} aria-label={`Pad ${i + 1}`} />)}
      </div>
      <Button variant="outline" onClick={() => next([])}>Start</Button>
    </Card>
  );
};

/* ------------------------- PLANNERS & TRACKERS ------------------------ */
const HabitTracker = () => {
  const [habits, setHabits] = useStored<{ name: string; days: string[] }[]>("habits", []);
  const [name, setName] = useState("");
  const last7 = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return d.toISOString().slice(0, 10); }), []);
  const toggle = (h: number, d: string) => setHabits(habits.map((x, i) => i !== h ? x : { ...x, days: x.days.includes(d) ? x.days.filter((y) => y !== d) : [...x.days, d] }));
  return (
    <Card>
      <div className="flex gap-2"><Input placeholder="New habit, e.g. Walk 20 min" value={name} onChange={(e) => setName(e.target.value)} />
        <Button onClick={() => { if (name.trim()) { setHabits([...habits, { name: name.trim(), days: [] }]); setName(""); } }}>Add</Button></div>
      {habits.map((h, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="flex-1 text-sm text-foreground truncate">{h.name}</span>
          {last7.map((d) => <button key={d} onClick={() => toggle(i, d)} title={d} className={`w-7 h-7 rounded ${h.days.includes(d) ? "bg-primary" : "bg-muted"}`} />)}
          <button onClick={() => setHabits(habits.filter((_, j) => j !== i))} aria-label="Delete habit"><Trash2 className="w-4 h-4 text-muted-foreground" /></button>
        </div>
      ))}
      {!habits.length && <p className="text-xs text-muted-foreground">Add a habit and tick each day you do it (last 7 days shown).</p>}
    </Card>
  );
};

const DailyPlanner = () => {
  const [date, setDate] = useState(today());
  const [plans, setPlans] = useStored<Record<string, { text: string; done: boolean }[]>>("planner", {});
  const [text, setText] = useState("");
  const list = plans[date] ?? [];
  const save = (l: typeof list) => setPlans({ ...plans, [date]: l });
  return (
    <Card>
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-xs" />
      <div className="flex gap-2"><Input placeholder="Add a task" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) { save([...list, { text: text.trim(), done: false }]); setText(""); } }} />
        <Button onClick={() => { if (text.trim()) { save([...list, { text: text.trim(), done: false }]); setText(""); } }}>Add</Button></div>
      {list.map((t, i) => (
        <label key={i} className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={t.done} onChange={() => save(list.map((x, j) => j === i ? { ...x, done: !x.done } : x))} />
          <span className={`flex-1 ${t.done ? "line-through text-muted-foreground" : ""}`}>{t.text}</span>
          <button onClick={() => save(list.filter((_, j) => j !== i))} aria-label="Delete task"><Trash2 className="w-4 h-4 text-muted-foreground" /></button>
        </label>
      ))}
    </Card>
  );
};

const WaterTracker = () => {
  const [log, setLog] = useStored<Record<string, number>>("water", {});
  const n = log[today()] ?? 0;
  return (
    <Card>
      <p className="text-3xl font-bold text-primary">{n} / 8 glasses</p>
      <div className="flex gap-1">{Array.from({ length: 8 }, (_, i) => <Droplet key={i} className={`w-6 h-6 ${i < n ? "text-primary" : "text-muted-foreground"}`} />)}</div>
      <div className="flex gap-2"><Button onClick={() => setLog({ ...log, [today()]: n + 1 })}>+1 glass</Button><Button variant="outline" onClick={() => setLog({ ...log, [today()]: Math.max(0, n - 1) })}>−1</Button></div>
    </Card>
  );
};

const MoodTracker = () => {
  const moods = ["😢", "😕", "😐", "🙂", "😄"];
  const [log, setLog] = useStored<Record<string, number>>("mood", {});
  const days = Object.keys(log).sort().slice(-14);
  return (
    <Card>
      <p className="text-sm text-foreground">How are you today?</p>
      <div className="flex gap-2">{moods.map((m, i) => <button key={m} onClick={() => setLog({ ...log, [today()]: i })} className={`text-3xl rounded-xl p-2 ${log[today()] === i ? "bg-primary/20" : "bg-muted"}`}>{m}</button>)}</div>
      <div className="flex gap-1 flex-wrap">{days.map((d) => <span key={d} title={d} className="text-xl">{moods[log[d]]}</span>)}</div>
      {!days.length && <p className="text-xs text-muted-foreground">Your last 14 days will show here.</p>}
    </Card>
  );
};

/* ------------------------------ registry ------------------------------ */
type Item = { id: string; name: string; blurb: string; kind: "game" | "tool"; C: () => JSX.Element };
const ITEMS: Item[] = [
  { id: "ttt", name: "Tic-Tac-Toe", blurb: "Beat Oracle at noughts & crosses", kind: "game", C: TicTacToe },
  { id: "memory", name: "Memory Match", blurb: "Find all the cosmic pairs", kind: "game", C: MemoryMatch },
  { id: "guess", name: "Number Guess", blurb: "1 to 100 — fewest tries wins", kind: "game", C: NumberGuess },
  { id: "reaction", name: "Reaction Timer", blurb: "How fast are your reflexes?", kind: "game", C: ReactionTimer },
  { id: "rps", name: "Rock Paper Scissors", blurb: "Best of as many as you like", kind: "game", C: RockPaperScissors },
  { id: "hangman", name: "Space Hangman", blurb: "Guess the space word", kind: "game", C: Hangman },
  { id: "math", name: "Times-Table Sprint", blurb: "30 seconds of quick maths", kind: "game", C: MathSprint },
  { id: "simon", name: "Simon Says", blurb: "Repeat the colour pattern", kind: "game", C: SimonSays },
  { id: "habits", name: "Habit Tracker", blurb: "Tick off daily habits", kind: "tool", C: HabitTracker },
  { id: "planner", name: "Daily Planner", blurb: "Tasks for any day", kind: "tool", C: DailyPlanner },
  { id: "water", name: "Water Tracker", blurb: "8 glasses a day", kind: "tool", C: WaterTracker },
  { id: "mood", name: "Mood Tracker", blurb: "One tap a day", kind: "tool", C: MoodTracker },
];

const FreeZonePage = () => {
  const [open, setOpen] = useState<Item | null>(null);
  return (
    <div className="min-h-screen bg-background pb-20">
      <SEO title="Free Zone — Oracle Lunar" description="Free games, planners and trackers. Never costs coins." path="/free-zone" />
      <UniversalBackButton />
      <div className="px-4 pt-14 max-w-4xl mx-auto space-y-5">
        {open ? (
          <>
            <button onClick={() => setOpen(null)} className="flex items-center gap-1 text-sm text-primary"><ArrowLeft className="w-4 h-4" /> All free things</button>
            <h1 className="text-2xl font-bold text-primary">{open.name}</h1>
            <open.C />
          </>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-bold text-primary">Free Zone</h1>
              <p className="text-sm text-muted-foreground">Everything here is free forever — no coins, no AI. Saved on your device.</p>
              <a href="/module-shop" className="inline-block mt-2 text-sm font-semibold text-primary underline">Module Shop — make, share or sell your own games & trackers →</a>
            </div>
            {(["game", "tool"] as const).map((k) => (
              <section key={k} className="space-y-2">
                <h2 className="font-bold text-foreground flex items-center gap-2">
                  {k === "game" ? <><Gamepad2 className="w-4 h-4 text-primary" /> Games</> : <><ListChecks className="w-4 h-4 text-primary" /> Planners & trackers</>}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {ITEMS.filter((i) => i.kind === k).map((i) => (
                    <button key={i.id} onClick={() => setOpen(i)} className="rounded-2xl border border-border bg-card p-4 text-left hover:border-primary/50">
                      {k === "game" ? <Gamepad2 className="w-5 h-5 text-primary mb-2" /> : i.id === "planner" ? <CalendarDays className="w-5 h-5 text-primary mb-2" /> : i.id === "mood" ? <Smile className="w-5 h-5 text-primary mb-2" /> : <ListChecks className="w-5 h-5 text-primary mb-2" />}
                      <p className="font-bold text-sm text-foreground">{i.name}</p>
                      <p className="text-[11px] text-muted-foreground">{i.blurb}</p>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default FreeZonePage;
