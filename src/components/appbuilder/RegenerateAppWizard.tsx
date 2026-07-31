import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Mic, MicOff, RefreshCw, Volume2, X, Zap } from "lucide-react";

/**
 * Regenerate-Entire-App wizard for the App Builder.
 *
 * Flow:
 *   1. "changes" — 50 tick-box questions + free text  (OR skip straight to the
 *      warnings with "Skip the questions — just take my chances")
 *   2. "warn1" / "warn2" / "warn3" — three separate are-you-sure gates
 *   3. "style"  — pick the visual style for the rebuilt app
 *   4. "plan"   — shows exactly what it is about to do
 *   5. "final"  — last warning before it runs
 *
 * Fully answerable by voice — say "yes" or "no".
 */

export interface AppRegenPlan {
  changes: string[];
  notes: string;
  styleId: string;
  styleLabel: string;
  bypassedQuestions: boolean;
}

type Stage = "changes" | "warn1" | "warn2" | "warn3" | "style" | "plan" | "final";

/** Visual styles — the App Builder equivalent of Story Writer's art styles. */
export const APP_STYLES: { id: string; label: string; suffix: string }[] = [
  { id: "realistic-4k", label: "4K Realistic", suffix: "4K photorealistic hero imagery, cinematic depth, ray-traced lighting, premium product-shot aesthetic, ultra-crisp typography" },
  { id: "photo-normal", label: "Normal Photo", suffix: "clean natural photography-led design, honest editorial imagery, uncluttered layout, accurate colour" },
  { id: "cartoon", label: "Cartoon", suffix: "playful cartoon UI, bold outlines, vibrant flat colours, rounded shapes, animation-studio charm" },
  { id: "2_5d", label: "2.5D Photoreal", suffix: "2.5D layered interface, painterly depth, soft volumetric shadows, tactile cards floating above the canvas" },
  { id: "anime", label: "Anime", suffix: "anime key-visual styling, cel-shaded accents, crisp line art, expressive character illustrations" },
  { id: "cinematic", label: "Cinematic", suffix: "cinematic dark interface, dramatic lighting, film-grade colour grade, blockbuster poster energy" },
  { id: "fantasy", label: "Fantasy", suffix: "epic fantasy theming, ornate detail, rich painterly textures, gold and arcane accents" },
  { id: "watercolour", label: "Watercolour", suffix: "soft watercolour washes, textured paper background, gentle organic edges, fine-art calm" },
  { id: "minimal", label: "Minimal", suffix: "radical minimalism, generous whitespace, one accent colour, restrained type scale, zero ornament" },
  { id: "neo-brutal", label: "Neo-Brutalist", suffix: "neo-brutalist design, thick black borders, hard offset shadows, loud primary blocks, oversized type" },
  { id: "glass", label: "Glassmorphism", suffix: "frosted glass panels, translucent blur layers, soft gradients behind glass, luminous edges" },
  { id: "retro", label: "Retro / Y2K", suffix: "retro Y2K aesthetic, chrome gradients, pixel accents, nostalgic 90s-2000s web energy" },
];

export const APP_REGEN_QUESTIONS: { group: string; items: string[] }[] = [
  {
    group: "Scale of the rebuild",
    items: [
      "Minimal polish only — keep it almost exactly as it is",
      "Moderate rebuild — same idea, much better execution",
      "Heavy rebuild — restructure the screens and flow",
      "Total rebuild — brand new take on the same idea",
      "Keep the app name exactly as it is",
      "Let the AI rename the app if it can do better",
    ],
  },
  {
    group: "Look & feel",
    items: [
      "Dark theme",
      "Light theme",
      "Bigger, bolder typography",
      "More whitespace and breathing room",
      "More colour and personality",
      "Rounded, friendly shapes",
      "Sharp, serious, corporate look",
      "Add subtle animations and transitions",
      "Add a hero image or illustration",
      "Make it feel premium and expensive",
    ],
  },
  {
    group: "Screens & features",
    items: [
      "Add an onboarding walkthrough",
      "Add a home dashboard",
      "Add user accounts / sign in",
      "Add a settings screen",
      "Add search",
      "Add filters and sorting",
      "Add notifications",
      "Add offline support",
      "Add data export (CSV/PDF)",
      "Add a help / FAQ section",
      "Remove features that nobody uses",
      "Simplify the navigation",
    ],
  },
  {
    group: "Money",
    items: [
      "Keep it completely free",
      "Add a free trial",
      "Add a subscription paywall",
      "Add one-off in-app purchases",
      "Add ads",
      "Remove all ads",
      "Show pricing clearly on the first screen",
    ],
  },
  {
    group: "Audience & tone",
    items: [
      "For complete beginners",
      "For power users",
      "For kids / family friendly",
      "For business and professional use",
      "Friendly and casual tone",
      "Serious and professional tone",
      "Funny and irreverent tone",
    ],
  },
  {
    group: "Quality & shipping",
    items: [
      "Fix everything that felt broken last time",
      "Make it faster",
      "Make it fully mobile-friendly",
      "Improve accessibility (screen readers, contrast)",
      "Add privacy policy and terms",
      "Make it app-store submission ready",
      "Beat the competitor complaints found in market research",
      "Add SEO and social share metadata",
    ],
  },
];

const ALL_APP_QUESTIONS = APP_REGEN_QUESTIONS.flatMap(g => g.items);

function speak(text: string) {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

function useVoiceAnswer(enabled: boolean, onYes: () => void, onNo: () => void) {
  const recRef = useRef<any>(null);
  useEffect(() => {
    if (!enabled) return;
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-AU";
    rec.onresult = (ev: any) => {
      const said = String(ev.results[ev.results.length - 1][0].transcript || "").toLowerCase();
      if (/\b(yes|yeah|yep|sure|go ahead|do it|confirm|continue)\b/.test(said)) onYes();
      else if (/\b(no|nope|stop|cancel|don't|dont)\b/.test(said)) onNo();
    };
    rec.onerror = () => {};
    try { rec.start(); } catch { /* ignore */ }
    recRef.current = rec;
    return () => { try { rec.stop(); } catch { /* ignore */ } };
  }, [enabled, onYes, onNo]);
}

interface Props {
  open: boolean;
  appName: string;
  defaultStyleId?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (plan: AppRegenPlan) => void;
}

const RegenerateAppWizard = ({ open, appName, defaultStyleId = "realistic-4k", busy, onCancel, onConfirm }: Props) => {
  const [stage, setStage] = useState<Stage>("changes");
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [styleId, setStyleId] = useState(defaultStyleId);
  const [bypassed, setBypassed] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);

  useEffect(() => {
    if (open) {
      setStage("changes");
      setSelected([]);
      setNotes("");
      setBypassed(false);
      setStyleId(defaultStyleId);
    }
  }, [open, defaultStyleId]);

  const toggle = (q: string) =>
    setSelected(s => (s.includes(q) ? s.filter(x => x !== q) : [...s, q]));

  const style = APP_STYLES.find(s => s.id === styleId) || APP_STYLES[0];

  const plan: AppRegenPlan = useMemo(
    () => ({ changes: selected, notes: notes.trim(), styleId: style.id, styleLabel: style.label, bypassedQuestions: bypassed }),
    [selected, notes, style, bypassed],
  );

  const confirmCopy: Record<string, { title: string; body: string; yes: string }> = {
    warn1: {
      title: "Are you sure?",
      body: `This will rebuild “${appName || "your app"}” from scratch. The current version will be replaced.`,
      yes: "Yes — rebuild my app",
    },
    warn2: {
      title: "Are you REALLY sure?",
      body: "Second check. There is no undo once the rebuild finishes. Download the current build first if you want to keep it.",
      yes: "Yes — I'm really sure",
    },
    warn3: {
      title: "Last chance to stop",
      body: "Third and final check before we pick the look of the new build. Say YES to keep going, or NO to cancel.",
      yes: "Yes — keep going",
    },
    final: {
      title: "Final confirmation",
      body: "This is the very last warning. Press START and the builder begins immediately.",
      yes: "START the rebuild now",
    },
  };

  const advance = () =>
    setStage(s => (s === "warn1" ? "warn2" : s === "warn2" ? "warn3" : s === "warn3" ? "style" : "plan"));

  const isConfirmStage = stage === "warn1" || stage === "warn2" || stage === "warn3" || stage === "final";

  useVoiceAnswer(
    open && voiceOn && isConfirmStage && !busy,
    () => (stage === "final" ? onConfirm(plan) : advance()),
    () => onCancel(),
  );

  useEffect(() => {
    if (!open || !voiceOn) return;
    const copy = confirmCopy[stage];
    if (copy) speak(`${copy.title}. ${copy.body}. Say yes or no.`);
    if (stage === "style") speak("What style should your app look like?");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, open, voiceOn]);

  if (!open) return null;

  const planLines = [
    `Rebuild “${appName || "your app"}” end-to-end: market recon → architecture → backend → frontend → copy → assets → smoke test → ship-ready pass.`,
    `Visual style: ${style.label} — ${style.suffix}`,
    ...(bypassed
      ? ["You skipped the questions — the AI will make every design and feature call itself and build what it believes you want."]
      : selected.length
        ? selected.map(s => `Apply: ${s}`)
        : ["No specific changes ticked — improve everything while keeping the idea."]),
    ...(notes ? [`Your extra instructions: "${notes}"`] : []),
  ];

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-card">
          <p className="font-bold text-foreground flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-primary" /> Regenerate entire app
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setVoiceOn(v => !v)}
              className={`text-[11px] px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                voiceOn ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground"
              }`}
              title="Answer with your voice — just say yes or no"
            >
              {voiceOn ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />} Voice {voiceOn ? "on" : "off"}
            </button>
            <button onClick={onCancel} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {stage === "changes" && (
            <>
              <div>
                <p className="text-sm font-semibold text-foreground">What should change in the new build?</p>
                <p className="text-xs text-muted-foreground">
                  Tick anything you like — {ALL_APP_QUESTIONS.length} quick questions, no writing required. Or skip them entirely and let the AI take its best shot.
                </p>
              </div>

              <button
                type="button"
                onClick={() => { setBypassed(true); setSelected([]); setStage("warn1"); }}
                className="w-full py-3 rounded-xl border border-amber-500/50 bg-amber-500/10 text-amber-200 font-bold text-sm flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" /> Skip the 50 questions — take my chances
              </button>

              <div className="space-y-3">
                {APP_REGEN_QUESTIONS.map(g => (
                  <div key={g.group} className="rounded-xl border border-border bg-background/50 p-3">
                    <p className="text-xs font-bold text-primary mb-2">{g.group}</p>
                    <div className="grid sm:grid-cols-2 gap-1.5">
                      {g.items.map(q => {
                        const on = selected.includes(q);
                        return (
                          <button
                            key={q}
                            type="button"
                            onClick={() => toggle(q)}
                            className={`text-left text-[12px] px-2.5 py-2 rounded-lg border flex items-start gap-2 transition-colors ${
                              on ? "border-primary bg-primary/15 text-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/40"
                            }`}
                          >
                            <span className={`mt-0.5 w-4 h-4 shrink-0 rounded border flex items-center justify-center ${on ? "bg-primary border-primary" : "border-border"}`}>
                              {on && <Check className="w-3 h-3 text-primary-foreground" />}
                            </span>
                            {q}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Anything else? Tell the builder in plain English — e.g. 'make it for dog groomers in Brisbane with online bookings'."
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none"
              />

              <button
                onClick={() => setStage("warn1")}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-amber-500 text-primary-foreground font-bold text-sm"
              >
                Continue →
              </button>
            </>
          )}

          {isConfirmStage && (
            <div className="text-center space-y-4 py-4">
              <AlertTriangle className="w-10 h-10 mx-auto text-amber-400" />
              <p className="text-xl font-black italic text-foreground">{confirmCopy[stage].title}</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">{confirmCopy[stage].body}</p>
              {voiceOn && (
                <p className="text-[11px] text-primary flex items-center justify-center gap-1">
                  <Volume2 className="w-3 h-3" /> Listening — just say “yes” or “no”.
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                <button onClick={onCancel} disabled={busy} className="px-5 py-3 rounded-xl border border-border text-foreground font-semibold text-sm">
                  No — cancel
                </button>
                <button
                  onClick={() => (stage === "final" ? onConfirm(plan) : advance())}
                  disabled={busy}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-primary to-amber-500 text-primary-foreground font-bold text-sm"
                >
                  {confirmCopy[stage].yes}
                </button>
              </div>
            </div>
          )}

          {stage === "style" && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">What style should your app be?</p>
              <p className="text-xs text-muted-foreground">This drives the entire look — layout, colour, imagery and typography.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {APP_STYLES.map(s => {
                  const on = s.id === styleId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStyleId(s.id)}
                      className={`text-left px-3 py-2 rounded-xl border text-[12px] transition-colors ${
                        on ? "border-primary bg-primary/15 text-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      <span className="font-semibold block">{s.label}</span>
                      <span className="text-[10px] line-clamp-2">{s.suffix}</span>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setStage("plan")} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm">
                Use {style.label} →
              </button>
            </div>
          )}

          {stage === "plan" && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Here's exactly what I'm about to do:</p>
              <ul className="space-y-1.5">
                {planLines.map((l, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-muted-foreground">
                    <Check className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" /> {l}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button onClick={() => setStage("changes")} className="px-5 py-3 rounded-xl border border-border text-foreground font-semibold text-sm">
                  ← Change my answers
                </button>
                <button onClick={() => setStage("final")} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary to-amber-500 text-primary-foreground font-bold text-sm">
                  That's right — continue
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegenerateAppWizard;
