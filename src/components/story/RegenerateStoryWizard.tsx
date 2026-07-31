import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, Mic, MicOff, RefreshCw, Volume2, X } from "lucide-react";

/**
 * Regenerate-Entire-Story wizard.
 *
 * Flow (fully voice-driven if the user wants — no typing required):
 *   1. "changes"  — 50 tick-box questions + free text (what should change)
 *   2. "warn1"    — Are you sure?
 *   3. "warn2"    — Are you REALLY sure?
 *   4. "warn3"    — Last chance to back out
 *   5. "images"   — Regenerate every illustration, or keep the current ones?
 *   6. "plan"     — AI shows exactly what it is about to do
 *   7. "final"    — Second/final warning right before it runs
 */

export interface RegenPlan {
  changes: string[];
  notes: string;
  regenerateImages: boolean;
}

type Stage = "changes" | "warn1" | "warn2" | "warn3" | "images" | "plan" | "final";

export const REGEN_QUESTIONS: { group: string; items: string[] }[] = [
  {
    group: "Scale of the rewrite",
    items: [
      "Minimal polish only — keep the story almost exactly as it is",
      "Moderate rewrite — same plot, much stronger writing",
      "Heavy rewrite — reshape scenes and structure",
      "Total rewrite — brand new telling of the same premise",
      "Keep every chapter title exactly as it is",
      "Let the AI rename chapters where it improves the book",
    ],
  },
  {
    group: "Characters",
    items: [
      "Change the main character's name",
      "Change the main character's age",
      "Change the main character's gender",
      "Make the main character more likeable",
      "Make the main character more flawed and human",
      "Give the main character a stronger backstory",
      "Add a new supporting character",
      "Remove or merge weak supporting characters",
      "Strengthen the villain / antagonist",
      "Deepen the relationships between characters",
      "Give every character a distinct speaking voice",
      "Add a loyal animal or companion character",
    ],
  },
  {
    group: "Story & plot",
    items: [
      "Keep the same plot exactly",
      "Add a major twist",
      "Add a second subplot",
      "Raise the stakes throughout",
      "Faster pacing — cut the slow parts",
      "Slower, richer pacing with more atmosphere",
      "Change the ending",
      "Make the ending happier",
      "Make the ending darker",
      "Add a cliffhanger for a sequel",
      "Fix plot holes and continuity errors",
      "Add more conflict in the middle chapters",
    ],
  },
  {
    group: "Voice & style",
    items: [
      "Write in first person",
      "Write in third person",
      "Present tense",
      "Past tense",
      "More dialogue, less narration",
      "More description and sensory detail",
      "Add humour",
      "More emotional depth",
      "Simpler, easier reading level",
      "More literary, elevated prose",
      "Shorter sentences and punchier paragraphs",
      "Match a bestselling commercial fiction style",
    ],
  },
  {
    group: "Setting & world",
    items: [
      "Change the location / setting",
      "Change the time period",
      "Add more world-building detail",
      "Make the setting feel more real and researched",
      "Add local culture, food and language flavour",
    ],
  },
  {
    group: "Publishing polish",
    items: [
      "Fix all spelling and grammar",
      "Remove repetition and filler",
      "Make every chapter a similar strong quality",
      "Keep chapters 20,000+ words each",
      "Make it audiobook friendly (clean, readable aloud)",
      "Keep it family friendly",
      "Allow mature themes",
    ],
  },
];

const ALL_QUESTIONS = REGEN_QUESTIONS.flatMap((g) => g.items);

function speak(text: string) {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

/** Simple yes/no voice listener used on every confirmation step. */
function useVoiceAnswer(enabled: boolean, onYes: () => void, onNo: () => void) {
  const recRef = useRef<any>(null);
  useEffect(() => {
    if (!enabled) return;
    const SR: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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
  chapterCount: number;
  imageCount: number;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (plan: RegenPlan) => void;
}

const RegenerateStoryWizard = ({
  open,
  chapterCount,
  imageCount,
  busy,
  onCancel,
  onConfirm,
}: Props) => {
  const [stage, setStage] = useState<Stage>("changes");
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [regenerateImages, setRegenerateImages] = useState(true);
  const [voiceOn, setVoiceOn] = useState(false);

  useEffect(() => {
    if (open) {
      setStage("changes");
      setSelected([]);
      setNotes("");
      setRegenerateImages(true);
    }
  }, [open]);

  const toggle = (q: string) =>
    setSelected((s) => (s.includes(q) ? s.filter((x) => x !== q) : [...s, q]));

  const plan: RegenPlan = useMemo(
    () => ({ changes: selected, notes: notes.trim(), regenerateImages }),
    [selected, notes, regenerateImages],
  );

  const confirmCopy: Record<string, { title: string; body: string; yes: string }> = {
    warn1: {
      title: "Are you sure?",
      body: `This will re-write your ENTIRE story — all ${chapterCount} chapter${chapterCount === 1 ? "" : "s"}. Your current text will be replaced.`,
      yes: "Yes — rewrite my whole story",
    },
    warn2: {
      title: "Are you REALLY sure?",
      body: "Second check. There is no undo once the rewrite finishes. If you want to keep a copy, cancel now and export your book first.",
      yes: "Yes — I'm really sure",
    },
    warn3: {
      title: "Last chance to stop",
      body: "Third and final check before we choose what happens to your artwork. Say YES to keep going, or NO to cancel.",
      yes: "Yes — keep going",
    },
    final: {
      title: "Final confirmation",
      body: "This is the very last warning. Press START and the AI begins immediately.",
      yes: "START the rewrite now",
    },
  };

  const advance = () => {
    setStage((s) =>
      s === "warn1" ? "warn2" : s === "warn2" ? "warn3" : s === "warn3" ? "images" : "plan",
    );
  };

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
    if (stage === "images") speak("Would you like me to regenerate all illustrations as well, or keep the same images?");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, open, voiceOn]);

  if (!open) return null;

  const planLines = [
    `Rewrite all ${chapterCount} chapter${chapterCount === 1 ? "" : "s"} of your book from the top.`,
    ...(selected.length ? selected.map((s) => `Apply: ${s}`) : ["No specific changes ticked — improve the writing while keeping the story."]),
    ...(notes ? [`Your extra instructions: "${notes}"`] : []),
    regenerateImages
      ? `Regenerate every illustration (${imageCount} existing image${imageCount === 1 ? "" : "s"} will be replaced with fresh, all-different artwork).`
      : `Keep your current ${imageCount} illustration${imageCount === 1 ? "" : "s"} exactly as they are.`,
  ];

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-card">
          <p className="font-bold text-foreground flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-primary" />
            Regenerate entire story
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setVoiceOn((v) => !v)}
              className={`text-[11px] px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                voiceOn ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground"
              }`}
              title="Answer with your voice — just say yes or no"
            >
              {voiceOn ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
              Voice {voiceOn ? "on" : "off"}
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
                <p className="text-sm font-semibold text-foreground">
                  What would you like changed in the new version?
                </p>
                <p className="text-xs text-muted-foreground">
                  Tick anything you like — or tick nothing and just talk to the AI in the box below. {ALL_QUESTIONS.length} quick questions, no writing required.
                </p>
              </div>
              <div className="space-y-3">
                {REGEN_QUESTIONS.map((g) => (
                  <div key={g.group} className="rounded-xl border border-border bg-background/50 p-3">
                    <p className="text-xs font-bold text-primary mb-2">{g.group}</p>
                    <div className="grid sm:grid-cols-2 gap-1.5">
                      {g.items.map((q) => {
                        const on = selected.includes(q);
                        return (
                          <button
                            key={q}
                            type="button"
                            onClick={() => toggle(q)}
                            className={`text-left text-[12px] px-2.5 py-2 rounded-lg border flex items-start gap-2 transition-colors ${
                              on
                                ? "border-primary bg-primary/15 text-foreground"
                                : "border-border bg-card text-muted-foreground hover:border-primary/40"
                            }`}
                          >
                            <span
                              className={`mt-0.5 w-4 h-4 shrink-0 rounded border flex items-center justify-center ${
                                on ? "bg-primary border-primary" : "border-border"
                              }`}
                            >
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
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Anything else? Tell the AI in plain English — e.g. 'make it set in Brisbane and give Alex a sister'."
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
                <button
                  onClick={onCancel}
                  disabled={busy}
                  className="px-5 py-3 rounded-xl border border-border text-foreground font-semibold text-sm"
                >
                  No — cancel
                </button>
                <button
                  onClick={() => (stage === "final" ? onConfirm(plan) : advance())}
                  disabled={busy}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-primary to-amber-500 text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  {confirmCopy[stage].yes}
                </button>
              </div>
            </div>
          )}

          {stage === "images" && (
            <div className="space-y-4 py-2">
              <p className="text-lg font-black italic text-foreground text-center">
                Would you like all the illustrations regenerated too?
              </p>
              <p className="text-xs text-muted-foreground text-center">
                You currently have {imageCount} image{imageCount === 1 ? "" : "s"} in this book.
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                <button
                  onClick={() => { setRegenerateImages(true); setStage("plan"); }}
                  className="p-4 rounded-xl border border-primary bg-primary/15 text-left"
                >
                  <p className="font-bold text-foreground text-sm">Yes — regenerate every image</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Fresh, all-different artwork matched to the new text. Takes longer.
                  </p>
                </button>
                <button
                  onClick={() => { setRegenerateImages(false); setStage("plan"); }}
                  className="p-4 rounded-xl border border-border bg-background text-left"
                >
                  <p className="font-bold text-foreground text-sm">No — keep my current images</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Only the words are rewritten. Much faster.
                  </p>
                </button>
              </div>
            </div>
          )}

          {stage === "plan" && (
            <div className="space-y-4 py-2">
              <p className="text-lg font-black italic text-foreground">Here’s exactly what I’m about to do:</p>
              <ul className="space-y-1.5">
                {planLines.map((l, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {l}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-border font-semibold text-sm">
                  Cancel
                </button>
                <button
                  onClick={() => setStage("final")}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary to-amber-500 text-primary-foreground font-bold text-sm"
                >
                  That’s right — continue
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegenerateStoryWizard;
