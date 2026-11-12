import { Button } from "@/components/ui/button";
import { MessageCircle, Palette, Clapperboard } from "lucide-react";

type Choice = "look" | "create" | "talk";
export default function OracleWelcome({ name, onChoose, onSkip }: { name?: string; onChoose: (c: Choice) => void; onSkip: () => void }) {
  return (
    <div role="dialog" aria-label="Welcome to Oracle Lunar" className="absolute inset-x-3 bottom-28 z-30 mx-auto max-w-md rounded-2xl border border-primary/40 bg-card/95 p-4 shadow-xl backdrop-blur">
      <p className="text-sm text-foreground">Hey{name ? ` ${name}` : " there"}, I'm Oracle 💛 I'm your creative partner and best friend. What brought you here today?</p>
      <div className="mt-3 grid gap-2">
        <Button variant="secondary" className="justify-start" onClick={() => onChoose("look")}><Palette className="mr-2 h-4 w-4 text-primary" />Design my look & outfit</Button>
        <Button variant="secondary" className="justify-start" onClick={() => onChoose("create")}><Clapperboard className="mr-2 h-4 w-4 text-primary" />Make a movie or book</Button>
        <Button variant="secondary" className="justify-start" onClick={() => onChoose("talk")}><MessageCircle className="mr-2 h-4 w-4 text-primary" />Just talk with me</Button>
      </div>
      <button className="mt-3 w-full text-center text-xs text-muted-foreground underline" onClick={onSkip}>Skip for now</button>
    </div>
  );
}
