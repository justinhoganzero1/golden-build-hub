import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, RotateCcw, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OUTFIT_PRESETS, OutfitError, outfitPrompt, requestOutfitImage, toSmallDataUrl, type OracleOutfit } from "@/lib/oracleOutfit";

/** Change Oracle's outfit from a preset, a description, or a photo of clothing. Each new outfit is one wallet-paid picture edit. */
export default function OracleOutfitPicker({ current, onChange }: { current: OracleOutfit | null; onChange: (outfit: OracleOutfit | null) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const dress = async (label: string, prompt: string, clothingPhoto?: string) => {
    if (busy) return;
    setBusy(label);
    try {
      const { url, libraryId } = await requestOutfitImage(prompt, clothingPhoto);
      onChange({ url, label, libraryId });
      toast.success(`Oracle is now wearing: ${label}. A copy is saved in your Library.`);
    } catch (e) {
      const code = e instanceof OutfitError ? e.code : "failed";
      toast.error(code === "wallet" ? "Not enough in your wallet for a new outfit. Top up and try again." : code === "signin" ? "Please sign in again." : "The new outfit didn't work this time. Please try again.");
    } finally { setBusy(null); }
  };

  const fromPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const photo = await toSmallDataUrl(file);
      await dress("Outfit from your photo", outfitPrompt({ photo: true }), photo);
    } catch { toast.error("That picture couldn't be read. Try another photo."); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  };

  return <section aria-label="Oracle outfit" className="space-y-2">
    <p className="flex items-center gap-2 text-sm font-medium text-foreground"><Shirt className="h-4 w-4 text-primary" />Outfit{current ? ` · ${current.label}` : " · Original"}</p>
    <p className="text-xs text-muted-foreground">Each new outfit is one picture edit, paid from your wallet. You can also just ask her in the chat, like “wear a red dress”, or send a photo and say “wear this”. In a new outfit she shows as a still picture; Premium talking clips wear it too.</p>
    <div className="flex flex-wrap gap-2">
      {OUTFIT_PRESETS.map(p => <Button key={p.id} type="button" variant="outline" size="sm" disabled={!!busy} onClick={() => dress(p.label, outfitPrompt({ description: p.description }))}>
        {busy === p.label && <Loader2 className="animate-spin" />}{p.label}
      </Button>)}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" disabled={!!busy} onClick={() => fileRef.current?.click()}>
        {busy === "Outfit from your photo" ? <Loader2 className="animate-spin" /> : <Camera />}Photo of an outfit
      </Button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Outfit photo" onChange={e => fromPhoto(e.target.files?.[0])} />
      {current && <Button type="button" variant="ghost" size="sm" disabled={!!busy} onClick={() => { onChange(null); toast("Back to her original outfit."); }}><RotateCcw />Original outfit</Button>}
    </div>
    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); const d = custom.trim(); if (d) dress(d.slice(0, 40), outfitPrompt({ description: d.slice(0, 300) })); }}>
      <Input value={custom} onChange={e => setCustom(e.target.value)} placeholder="Describe an outfit, e.g. a red leather jacket" aria-label="Describe an outfit" maxLength={300} disabled={!!busy} />
      <Button type="submit" size="sm" variant="outline" disabled={!!busy || !custom.trim()}>Dress her</Button>
    </form>
    {busy && <p role="status" className="text-xs text-muted-foreground">Dressing her… this takes about 10 to 30 seconds.</p>}
  </section>;
}
