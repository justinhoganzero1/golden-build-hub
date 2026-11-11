import { useState } from "react";
import { toast } from "sonner";
import { Loader2, RotateCcw, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OutfitError, requestOutfitImage } from "@/lib/oracleOutfit";
import { DEFAULT_LOOK, LOOK_OPTIONS, cleanLook, lookLabel, lookPrompt, type OracleLook, type OracleLookChoice } from "@/lib/oracleLook";

const FIELDS: { key: Exclude<keyof OracleLookChoice, "gender">; label: string }[] = [
  { key: "heritage", label: "Race / heritage" },
  { key: "age", label: "Age appearance" },
  { key: "hairColour", label: "Hair colour" },
  { key: "hairLength", label: "Hair length" },
  { key: "eyeColour", label: "Eye colour" },
  { key: "orientation", label: "Sexual orientation" },
];

/** Members design how Oracle looks. Creating the new look is one wallet-paid picture edit. */
export default function OracleLookPicker({ current, onChange }: { current: OracleLook | null; onChange: (look: OracleLook | null) => void }) {
  const [choice, setChoice] = useState<OracleLookChoice>(() => cleanLook(current?.choice || DEFAULT_LOOK));
  const [busy, setBusy] = useState(false);
  const set = (k: keyof OracleLookChoice, v: string) => setChoice(c => cleanLook({ ...c, [k]: v }));

  const create = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { url, libraryId } = await requestOutfitImage(lookPrompt(choice));
      onChange({ url, choice, libraryId });
      toast.success("Oracle's new look is ready. A copy is saved in your Library.");
    } catch (e) {
      const code = e instanceof OutfitError ? e.code : "failed";
      toast.error(code === "wallet" ? "Not enough in your wallet for a new look. Top up and try again." : code === "signin" ? "Please sign in again." : "The new look didn't work this time. Please try again.");
    } finally { setBusy(false); }
  };

  return <section aria-label="Oracle look" className="space-y-3 rounded-lg border border-border p-3">
    <p className="flex items-center gap-2 text-sm font-medium text-foreground"><UserRound className="h-4 w-4 text-primary" />Oracle's look · {current ? lookLabel(current.choice) : "Original"}</p>
    <p className="text-xs text-muted-foreground">Choose how your Oracle looks. Creating a new look is one picture, paid from your wallet. Sexual orientation isn't shown in the picture; it only shapes how Oracle talks about themselves if you ask. Always kind, caring and suitable for all ages.</p>
    <div className="space-y-1.5">
      <Label className="text-xs">Looks like a</Label>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Looks like a">
        {LOOK_OPTIONS.gender.map(g => <Button key={g.id} type="button" size="sm" role="radio" aria-checked={choice.gender === g.id} variant={choice.gender === g.id ? "default" : "outline"} disabled={busy} onClick={() => set("gender", g.id)}>{g.label}</Button>)}
      </div>
    </div>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {FIELDS.map(f => <div key={f.key} className="space-y-1">
        <Label className="text-xs">{f.label}</Label>
        <Select value={choice[f.key]} onValueChange={v => set(f.key, v)} disabled={busy}>
          <SelectTrigger aria-label={f.label}><SelectValue /></SelectTrigger>
          <SelectContent>{(LOOK_OPTIONS[f.key] as readonly string[]).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      </div>)}
    </div>
    {choice.gender === "man" && <p className="text-xs text-muted-foreground">A male look uses a warm male voice (unless you picked your own in Voice Studio), and the stored "talk while thinking" lines are skipped because they're in her voice.</p>}
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" disabled={busy} onClick={create}>{busy ? <Loader2 className="animate-spin" /> : <UserRound />}Create this look</Button>
      {current && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { onChange(null); setChoice(DEFAULT_LOOK); toast("Back to Oracle's original look."); }}><RotateCcw />Original look</Button>}
    </div>
    {busy && <p role="status" className="text-xs text-muted-foreground">Creating the new look… this takes about 10 to 30 seconds.</p>}
  </section>;
}
