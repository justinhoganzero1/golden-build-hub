// Oracle's one emergency rule: a confirmed nuclear missile launch (several outlets) is announced to every
// signed-in member straight away, on any page. Checked every minute; the newsroom refreshes headlines every 10.
import { useEffect, useRef, useState } from "react";
import { Siren, ExternalLink, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { chooseOracleDeviceVoice } from "@/lib/oracleDeviceVoice";

type Alert = { id: string; headline: string; sources: Array<{ publisher: string; title: string; url: string }>; confirmed_at: string };
const SEEN_KEY = "oracle-emergency-seen";
const POLL_MS = 60_000;

export function emergencySpeech(a: Pick<Alert, "headline" | "sources">): string {
  const who = a.sources.map((s) => s.publisher).filter(Boolean).slice(0, 3).join(", ");
  return `This is Oracle with an emergency alert. ${who || "Several news outlets"} are reporting a confirmed nuclear missile launch: ${a.headline}. Please stay calm and follow official emergency instructions from your local authorities. If you are in danger, call triple zero. I'll keep you updated.`;
}

const EmergencyNewsAlert = () => {
  const { user } = useAuth();
  const [alert, setAlert] = useState<Alert | null>(null);
  const spokeFor = useRef<string | null>(null);

  const speak = (a: Alert) => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(emergencySpeech(a));
    const v = chooseOracleDeviceVoice(synth.getVoices());
    if (v) u.voice = v as SpeechSynthesisVoice;
    u.lang = v?.lang || "en-AU"; u.rate = 0.95;
    synth.speak(u);
  };

  useEffect(() => {
    if (!user) return;
    let stop = false;
    const check = async () => {
      const { data } = await supabase.from("news_alerts").select("id,headline,sources,confirmed_at").gt("expires_at", new Date().toISOString()).order("confirmed_at", { ascending: false }).limit(1);
      const a = data?.[0] as unknown as Alert | undefined;
      if (stop || !a) return;
      const seen = (() => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]") as string[]; } catch { return []; } })();
      if (seen.includes(a.id)) return;
      setAlert({ ...a, sources: Array.isArray(a.sources) ? a.sources : [] });
    };
    void check();
    const t = setInterval(() => void check(), POLL_MS);
    const onVis = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { stop = true; clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [user]);

  // Oracle says it out loud straight away (phones may need one tap first — the button below covers that).
  useEffect(() => { if (alert && spokeFor.current !== alert.id) { spokeFor.current = alert.id; speak(alert); } }, [alert]);

  const close = () => {
    if (!alert) return;
    try {
      const seen = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]") as string[];
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, alert.id].slice(-20)));
    } catch { /* ignore */ }
    window.speechSynthesis?.cancel();
    setAlert(null);
  };

  if (!alert) return null;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="border-destructive max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive"><Siren className="w-6 h-6" /> Emergency alert from Oracle</DialogTitle>
          <DialogDescription className="text-foreground text-base font-semibold">{alert.headline}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p>Several news outlets are reporting a confirmed nuclear missile launch. Stay calm and follow official instructions from your local authorities. If you are in danger, call <strong>000</strong>. In Australia, tune in to ABC Emergency radio or your state emergency service.</p>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Reported by:</p>
            {alert.sources.map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="flex items-start gap-1 text-xs text-primary"><ExternalLink className="w-3 h-3 mt-0.5 shrink-0" />{s.publisher}: {s.title}</a>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Oracle checks the news every few minutes. This alert only appears when at least three outlets (or two, including an official source) report a real launch.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => speak(alert)}><Volume2 className="w-4 h-4 mr-1" /> Hear Oracle</Button>
            <Button variant="destructive" onClick={close}>I understand</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmergencyNewsAlert;
