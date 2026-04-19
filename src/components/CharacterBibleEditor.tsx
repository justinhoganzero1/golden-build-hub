// Character Bible editor — preview, swap, clone voices for each character before rendering.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Volume2, Check } from "lucide-react";
import { toast } from "sonner";

interface Character {
  id: string;
  name: string;
  description: string | null;
  voice_id: string | null;
  voice_name: string | null;
  personality: string | null;
}

interface Voice { voice_id: string; name: string; }

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export const CharacterBibleEditor = ({ projectId, open, onOpenChange }: Props) => {
  const [chars, setChars] = useState<Character[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const [charRes, voiceRes] = await Promise.all([
        supabase.from("movie_character_bible").select("*").eq("project_id", projectId).order("name"),
        supabase.functions.invoke("elevenlabs-voices"),
      ]);
      setChars((charRes.data ?? []) as Character[]);
      setVoices(((voiceRes.data?.voices ?? []) as any[]).slice(0, 30));
      setLoading(false);
    })();
  }, [open, projectId]);

  const setVoice = async (charId: string, voice: Voice) => {
    const { error } = await supabase.from("movie_character_bible")
      .update({ voice_id: voice.voice_id, voice_name: voice.name })
      .eq("id", charId);
    if (error) { toast.error(error.message); return; }
    setChars(cs => cs.map(c => c.id === charId ? { ...c, voice_id: voice.voice_id, voice_name: voice.name } : c));
    toast.success(`Voice set to ${voice.name}`);
  };

  const preview = async (voice: Voice) => {
    setPreviewing(voice.voice_id);
    try {
      const { data } = await supabase.functions.invoke("elevenlabs-tts", {
        body: { text: `Hi, I'm ${voice.name}. This is what I sound like.`, voice_id: voice.voice_id },
      });
      if (data?.audioContent) {
        const audio = new Audio(`data:audio/mpeg;base64,${data.audioContent}`);
        audio.onended = () => setPreviewing(null);
        await audio.play();
      } else setPreviewing(null);
    } catch {
      setPreviewing(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>🎭 Character Bible — Voice Casting</DialogTitle></DialogHeader>
        {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto my-8" /> : (
          <div className="space-y-3">
            {chars.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Characters appear after the script chunker runs. Come back in a moment.
              </p>
            )}
            {chars.map(c => (
              <Card key={c.id} className="p-3 space-y-2">
                <div>
                  <p className="font-bold text-sm">{c.name}</p>
                  {c.description && <p className="text-[11px] text-muted-foreground">{c.description}</p>}
                </div>
                <div className="text-[11px]">
                  Voice: <span className="font-bold text-primary">{c.voice_name ?? "Not set"}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                  {voices.map(v => (
                    <div key={v.voice_id} className="flex gap-1">
                      <Button size="sm" variant={c.voice_id === v.voice_id ? "default" : "outline"}
                        className="flex-1 h-7 text-[10px]" onClick={() => setVoice(c.id, v)}>
                        {c.voice_id === v.voice_id && <Check className="w-2.5 h-2.5 mr-1" />}
                        {v.name}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                        onClick={() => preview(v)} disabled={previewing === v.voice_id}>
                        {previewing === v.voice_id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Volume2 className="w-3 h-3" />}
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CharacterBibleEditor;
