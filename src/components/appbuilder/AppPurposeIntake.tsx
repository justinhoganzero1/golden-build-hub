import { useState } from "react";
import { Hammer, ShoppingBag, User, X } from "lucide-react";
import {
  INTAKE_QUESTIONS, composeIntakePrompt, intakeComplete,
  type BuildPurpose, type IntakeAnswers,
} from "@/lib/appBuilderPurpose";

interface Props {
  purpose: BuildPurpose | null;
  busy?: boolean;
  onChoosePurpose: (p: BuildPurpose) => void;
  onBuild: (prompt: string) => void;
  onSkip: () => void;
}

/** Oracle's start-up chat card: who is the app for, then a few tailored questions. */
export default function AppPurposeIntake({ purpose, busy, onChoosePurpose, onBuild, onSkip }: Props) {
  const [answers, setAnswers] = useState<IntakeAnswers>({});
  const set = (id: string, v: string | string[]) => setAnswers((a) => ({ ...a, [id]: v }));

  if (!purpose) {
    return (
      <div className="rounded-2xl border border-primary/40 bg-card p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Are you building this app for yourself, or to sell?</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onChoosePurpose("personal")}
            className="rounded-xl border border-primary/50 bg-primary/10 p-3 text-left hover:bg-primary/20">
            <User className="w-5 h-5 text-primary mb-1" />
            <span className="block text-sm font-bold text-foreground">For me</span>
            <span className="block text-[11px] text-muted-foreground">My own app — no prices or adverts</span>
          </button>
          <button type="button" onClick={() => onChoosePurpose("sell")}
            className="rounded-xl border border-border bg-background p-3 text-left hover:border-primary/50">
            <ShoppingBag className="w-5 h-5 text-primary mb-1" />
            <span className="block text-sm font-bold text-foreground">To sell</span>
            <span className="block text-[11px] text-muted-foreground">Pricing, store listing, ready for customers</span>
          </button>
        </div>
        <button type="button" onClick={onSkip} className="text-[11px] text-muted-foreground underline">Skip — I'll just type what I want</button>
      </div>
    );
  }

  const questions = INTAKE_QUESTIONS[purpose];
  const ready = intakeComplete(purpose, answers);
  return (
    <div className="rounded-2xl border border-primary/40 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          {purpose === "personal" ? "Lovely — let's nail down your app." : "Great — let's nail down the app you'll sell."}
        </p>
        <button type="button" onClick={onSkip} aria-label="Close questions" className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>
      {questions.map((q) => (
        <div key={q.id} className="space-y-1.5">
          <label htmlFor={`intake-${q.id}`} className="block text-xs font-semibold text-foreground">{q.question}</label>
          {q.kind === "text" ? (
            <input id={`intake-${q.id}`} value={String(answers[q.id] || "")} onChange={(e) => set(q.id, e.target.value)}
              placeholder={q.placeholder} maxLength={300}
              className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary" />
          ) : (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={q.question}>
              {q.options!.map((o) => {
                const cur = answers[q.id];
                const on = Array.isArray(cur) ? cur.includes(o) : cur === o;
                return (
                  <button key={o} type="button" aria-pressed={on}
                    onClick={() => {
                      if (q.kind === "single") set(q.id, on ? "" : o);
                      else {
                        const list = Array.isArray(cur) ? cur : [];
                        set(q.id, on ? list.filter((x) => x !== o) : [...list, o]);
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] border transition-colors ${on ? "border-primary bg-primary/20 text-primary" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}>
                    {o}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
      <div className="space-y-1.5">
        <label htmlFor="intake-extra" className="block text-xs font-semibold text-foreground">Anything else? (optional)</label>
        <input id="intake-extra" value={String(answers.extra || "")} onChange={(e) => set("extra", e.target.value)} maxLength={400}
          placeholder="Colours you love, features you've seen elsewhere…"
          className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary" />
      </div>
      <button type="button" disabled={!ready || busy} onClick={() => onBuild(composeIntakePrompt(purpose, answers))}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50">
        <Hammer className="w-4 h-4" /> Build my app
      </button>
    </div>
  );
}
