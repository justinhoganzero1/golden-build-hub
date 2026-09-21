import { useState } from "react";
import { Loader2, BookPlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  sourceTitle: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (notes: string) => void;
}

const QUICK_DIRECTIONS = [
  "More James Bond — gadgets, casinos, exotic locations",
  "More Jason Statham — brutal close-quarters action",
  "Cliffhanger at the end of every chapter",
  "Longer than the original",
  "A bigger, deadlier villain behind the first one",
  "Same hero, higher stakes",
];

const SequelDialog = ({ open, sourceTitle, busy, onClose, onConfirm }: Props) => {
  const [notes, setNotes] = useState("");
  if (!open) return null;

  const toggle = (chip: string) => {
    setNotes((n) => {
      const parts = n.split("\n").map((p) => p.trim()).filter(Boolean);
      return parts.includes(chip) ? parts.filter((p) => p !== chip).join("\n") : [...parts, chip].join("\n");
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={busy ? undefined : onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-primary/30 bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1">
          <BookPlus className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-primary">Write a sequel</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Continuing <span className="font-semibold text-foreground">“{sourceTitle}”</span> — the sequel keeps your
          hero, world and characters. Tell the writer how the new book should feel.
        </p>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {QUICK_DIRECTIONS.map((chip) => {
            const active = notes.includes(chip);
            return (
              <button
                key={chip}
                type="button"
                onClick={() => toggle(chip)}
                className={`text-[11px] rounded-full border px-2.5 py-1 transition-colors ${
                  active
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50"
                }`}
              >
                {chip}
              </button>
            );
          })}
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder={"Anything else the sequel must do…\ne.g. The syndicate’s boss comes for Juzzy; a Monaco casino heist; a betrayer inside his own crew."}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => onConfirm(notes.trim())} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
            {busy ? "Creating sequel…" : "Create sequel"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SequelDialog;
