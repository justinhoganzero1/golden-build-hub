import { getEdgeAuthTokenSync } from "@/lib/edgeAuth";
import { useState, useEffect, useRef } from "react";
import {
  Phone, Shield, AlertTriangle, Heart, MapPin, Globe, Loader2,
  MessageSquare, Wind, Users, Share2, Pill, Flame, Activity,
  ShieldCheck, Sparkles, ChevronDown, ChevronUp, Copy, Check, Plus, Trash2,
} from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
import { cleanTextForSpeech } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface EmergencyNumbers {
  country: string;
  city: string;
  region: string;
  countryCode: string;
  police: string;
  ambulance: string;
  fire: string;
  crisis: string;
  domesticViolence: string;
  poison: string;
  childAbuse: string;
}

const COUNTRY_NUMBERS: Record<string, Omit<EmergencyNumbers, "country" | "city" | "region" | "countryCode">> = {
  US: { police: "911", ambulance: "911", fire: "911", crisis: "988", domesticViolence: "1-800-799-7233", poison: "1-800-222-1222", childAbuse: "1-800-422-4453" },
  AU: { police: "000", ambulance: "000", fire: "000", crisis: "13 11 14", domesticViolence: "1800 737 732", poison: "13 11 26", childAbuse: "1800 55 1800" },
  GB: { police: "999", ambulance: "999", fire: "999", crisis: "116 123", domesticViolence: "0808 2000 247", poison: "111", childAbuse: "0800 1111" },
  CA: { police: "911", ambulance: "911", fire: "911", crisis: "1-833-456-4566", domesticViolence: "1-800-363-9010", poison: "1-800-222-1222", childAbuse: "1-800-668-6868" },
  NZ: { police: "111", ambulance: "111", fire: "111", crisis: "1737", domesticViolence: "0800 456 450", poison: "0800 764 766", childAbuse: "0800 543 754" },
  IN: { police: "100", ambulance: "102", fire: "101", crisis: "9152987821", domesticViolence: "181", poison: "1800-11-6117", childAbuse: "1098" },
  DE: { police: "110", ambulance: "112", fire: "112", crisis: "0800 111 0 111", domesticViolence: "08000 116 016", poison: "030 19240", childAbuse: "116 111" },
  FR: { police: "17", ambulance: "15", fire: "18", crisis: "3114", domesticViolence: "3919", poison: "01 40 05 48 48", childAbuse: "119" },
  JP: { police: "110", ambulance: "119", fire: "119", crisis: "0570-064-556", domesticViolence: "0120-279-338", poison: "110", childAbuse: "189" },
  DEFAULT: { police: "112", ambulance: "112", fire: "112", crisis: "112", domesticViolence: "112", poison: "112", childAbuse: "112" },
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-chat`;
const SAFETY_PLAN_KEY = "oracle.crisis.safetyPlan.v2";
const TRUSTED_KEY = "oracle.crisis.trusted.v2";

interface SafetyPlan {
  warningSigns: string;
  copingStrategies: string;
  reasonsToLive: string;
  safePlace: string;
  professionalContact: string;
}

interface TrustedContact { id: string; name: string; phone: string }

const DEFAULT_PLAN: SafetyPlan = { warningSigns: "", copingStrategies: "", reasonsToLive: "", safePlace: "", professionalContact: "" };

const CrisisHubPage = () => {
  const { user } = useAuth();
  const [numbers, setNumbers] = useState<EmergencyNumbers>({
    country: "", city: "", region: "", countryCode: "DEFAULT",
    ...COUNTRY_NUMBERS.DEFAULT,
  });
  const [loading, setLoading] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [aiMessage, setAiMessage] = useState<string>("");

  // Breathing exercise
  const [breathing, setBreathing] = useState(false);
  const [breathPhase, setBreathPhase] = useState<"inhale" | "hold" | "exhale">("inhale");
  const [breathCycle, setBreathCycle] = useState(0);
  const breathRef = useRef<number | null>(null);

  // Safety plan
  const [plan, setPlan] = useState<SafetyPlan>(DEFAULT_PLAN);
  const [planOpen, setPlanOpen] = useState(false);
  const [planSaved, setPlanSaved] = useState(false);

  // Trusted contacts
  const [trusted, setTrusted] = useState<TrustedContact[]>([]);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  // Location share
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    detectLocation();
    try {
      const p = localStorage.getItem(SAFETY_PLAN_KEY);
      if (p) setPlan({ ...DEFAULT_PLAN, ...JSON.parse(p) });
      const t = localStorage.getItem(TRUSTED_KEY);
      if (t) setTrusted(JSON.parse(t));
    } catch {}
    requestGeo();
    return () => { if (breathRef.current) window.clearTimeout(breathRef.current); };
  }, []);

  const requestGeo = () => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {/* silent */},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  };

  const detectLocation = async () => {
    setLoading(true);
    try {
      const resp = await fetch("https://ipapi.co/json/");
      const data = await resp.json();
      const code = data.country_code || "DEFAULT";
      const nums = COUNTRY_NUMBERS[code] || COUNTRY_NUMBERS.DEFAULT;
      setNumbers({
        country: data.country_name || "Unknown",
        city: data.city || "Unknown",
        region: data.region || "",
        countryCode: code,
        ...nums,
      });
    } catch {
      setNumbers({ country: "Unknown", city: "Unknown", region: "", countryCode: "DEFAULT", ...COUNTRY_NUMBERS.DEFAULT });
    } finally { setLoading(false); }
  };

  const callNumber = (num: string) => {
    if (!num) return;
    window.location.href = `tel:${num.replace(/\s/g, "")}`;
  };

  // ───────── AI Calm Coach ─────────
  const aiCallEmergency = async () => {
    setAiSpeaking(true);
    setAiMessage("");
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getEdgeAuthTokenSync()}` },
        body: JSON.stringify({
          messages: [
            { role: "system", content: `You are an emergency calm-coach. The user is in ${numbers.city}, ${numbers.country}. Police/ambulance: ${numbers.police}. Crisis line: ${numbers.crisis}. Speak in short calm sentences. Tell them: 1) take one slow breath, 2) what to say to the operator, 3) where to wait. Keep under 60 words.` },
            { role: "user", content: "I need help right now." },
          ],
        }),
      });
      if (!resp.ok) throw new Error();
      const text = await resp.text();
      let content = "";
      for (const line of text.split("\n")) {
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try { const j = JSON.parse(line.slice(6)); content += j.choices?.[0]?.delta?.content || ""; } catch {}
        }
      }
      setAiMessage(content);
      if (content && "speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(cleanTextForSpeech(content));
        u.rate = 1; u.volume = 1;
        window.speechSynthesis.speak(u);
      }
    } catch {
      const fallback = "Take one slow breath. Call your local emergency number now. Tell them your address and what is happening.";
      setAiMessage(fallback);
      toast.info(fallback);
    } finally { setAiSpeaking(false); }
  };

  // ───────── Breathing exercise (4-7-8) ─────────
  const startBreathing = () => {
    setBreathing(true);
    setBreathCycle(0);
    runBreath("inhale");
  };
  const stopBreathing = () => {
    setBreathing(false);
    if (breathRef.current) window.clearTimeout(breathRef.current);
  };
  const runBreath = (phase: "inhale" | "hold" | "exhale") => {
    setBreathPhase(phase);
    const ms = phase === "inhale" ? 4000 : phase === "hold" ? 7000 : 8000;
    breathRef.current = window.setTimeout(() => {
      if (phase === "inhale") runBreath("hold");
      else if (phase === "hold") runBreath("exhale");
      else { setBreathCycle(c => c + 1); runBreath("inhale"); }
    }, ms);
  };

  // ───────── Safety plan ─────────
  const savePlan = () => {
    try {
      localStorage.setItem(SAFETY_PLAN_KEY, JSON.stringify(plan));
      setPlanSaved(true);
      toast.success("Safety plan saved on this device");
      setTimeout(() => setPlanSaved(false), 1800);
    } catch {
      toast.error("Could not save plan");
    }
  };

  // ───────── Trusted contacts ─────────
  const addTrusted = () => {
    const n = newName.trim(); const p = newPhone.trim();
    if (!n || !p) { toast.error("Name and phone required"); return; }
    const next = [...trusted, { id: crypto.randomUUID(), name: n, phone: p }];
    setTrusted(next);
    localStorage.setItem(TRUSTED_KEY, JSON.stringify(next));
    setNewName(""); setNewPhone("");
  };
  const removeTrusted = (id: string) => {
    const next = trusted.filter(t => t.id !== id);
    setTrusted(next);
    localStorage.setItem(TRUSTED_KEY, JSON.stringify(next));
  };

  // ───────── Share location ─────────
  const shareLocation = async () => {
    let mapLink = `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${numbers.city}, ${numbers.country}`)}`;
    if (coords) mapLink = `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;
    const message = `EMERGENCY — I need help. My location: ${mapLink}`;
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ title: "Emergency", text: message });
      } else {
        await navigator.clipboard.writeText(message);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 1800);
        toast.success("Location copied — paste into a message");
      }
    } catch {
      toast.info("Could not share — copied to clipboard instead");
      try { await navigator.clipboard.writeText(message); } catch {}
    }
  };

  const smsTrusted = (phone: string) => {
    let mapLink = coords ? `https://www.google.com/maps?q=${coords.lat},${coords.lng}` : "";
    const body = encodeURIComponent(`I need help. ${mapLink ? `My location: ${mapLink}` : `I'm in ${numbers.city}.`}`);
    window.location.href = `sms:${phone.replace(/\s/g, "")}?body=${body}`;
  };

  const emergencyContacts = [
    { name: "Police", number: numbers.police, icon: <Shield className="w-5 h-5" />, color: "from-blue-500/30 to-blue-500/5 text-blue-300 border-blue-500/30" },
    { name: "Ambulance", number: numbers.ambulance, icon: <Heart className="w-5 h-5" />, color: "from-red-500/30 to-red-500/5 text-red-300 border-red-500/30" },
    { name: "Fire Service", number: numbers.fire, icon: <Flame className="w-5 h-5" />, color: "from-orange-500/30 to-orange-500/5 text-orange-300 border-orange-500/30" },
    { name: "Crisis Helpline", number: numbers.crisis, icon: <Phone className="w-5 h-5" />, color: "from-purple-500/30 to-purple-500/5 text-purple-300 border-purple-500/30" },
    { name: "Domestic Violence", number: numbers.domesticViolence, icon: <ShieldCheck className="w-5 h-5" />, color: "from-pink-500/30 to-pink-500/5 text-pink-300 border-pink-500/30" },
    { name: "Poison Control", number: numbers.poison, icon: <Pill className="w-5 h-5" />, color: "from-green-500/30 to-green-500/5 text-green-300 border-green-500/30" },
    { name: "Child Helpline", number: numbers.childAbuse, icon: <Users className="w-5 h-5" />, color: "from-amber-500/30 to-amber-500/5 text-amber-300 border-amber-500/30" },
  ];

  const breathLabel = breathPhase === "inhale" ? "Breathe in…" : breathPhase === "hold" ? "Hold…" : "Breathe out…";
  const breathScale = breathPhase === "inhale" ? "scale-110" : breathPhase === "hold" ? "scale-110" : "scale-90";

  return (
    <div className="min-h-screen bg-background pb-20 relative overflow-hidden">
      {/* Holographic backdrop */}
      <div className="absolute inset-0 pointer-events-none opacity-30"
        style={{ background: "radial-gradient(60% 50% at 50% 0%, hsl(0 80% 50% / 0.15), transparent 60%), radial-gradient(40% 40% at 80% 80%, hsl(280 80% 50% / 0.1), transparent 60%)" }} />
      <UniversalBackButton />
      <div className="relative px-4 pt-14 pb-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 holo-card rounded-2xl p-3 border border-destructive/20">
          <div className="p-2 rounded-xl holo-bubble bg-destructive/20"><Shield className="w-7 h-7 text-destructive" /></div>
          <div>
            <h1 className="text-xl font-bold text-destructive">Crisis Hub</h1>
            <p className="text-muted-foreground text-xs">Immediate help, calm tools, and safety planning</p>
          </div>
        </div>

        {/* Location */}
        <div className="flex items-center gap-2 mb-4 holo-card rounded-xl px-4 py-3 border border-border">
          <MapPin className="w-4 h-4 text-primary shrink-0" />
          {loading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : (
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground font-medium truncate">{numbers.city}{numbers.region ? `, ${numbers.region}` : ""}, {numbers.country}</p>
              <p className="text-[10px] text-muted-foreground">Numbers localized · {coords ? "GPS locked" : "city-level only"}</p>
            </div>
          )}
          <button onClick={() => { detectLocation(); requestGeo(); }} className="p-1.5 rounded-md text-primary hover:bg-primary/10" title="Refresh">
            <Globe className="w-4 h-4" />
          </button>
        </div>

        {/* SOS */}
        <button onClick={() => callNumber(numbers.police)}
          className="w-full py-5 bg-destructive text-destructive-foreground font-bold text-lg rounded-2xl mb-2 flex items-center justify-center gap-3 animate-pulse shadow-lg shadow-destructive/30">
          <Phone className="w-6 h-6" /> SOS — Call {numbers.police}
        </button>

        {/* Quick row: AI + Share location */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button onClick={aiCallEmergency} disabled={aiSpeaking}
            className="py-3 holo-card border border-destructive/30 text-destructive rounded-xl flex items-center justify-center gap-2 text-xs font-medium disabled:opacity-50">
            {aiSpeaking ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
            AI Calm Coach
          </button>
          <button onClick={shareLocation}
            className="py-3 holo-card border border-primary/30 text-primary rounded-xl flex items-center justify-center gap-2 text-xs font-medium">
            {shareCopied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            {shareCopied ? "Copied" : "Share My Location"}
          </button>
        </div>

        {aiMessage && (
          <div className="mb-4 p-3 rounded-xl border border-destructive/30 bg-destructive/5 text-sm text-foreground">
            <Sparkles className="w-3 h-3 inline mr-1 text-destructive" />
            {aiMessage}
          </div>
        )}

        {/* Breathing exercise */}
        <div className="holo-card rounded-2xl p-4 mb-5 border border-blue-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/15"><Wind className="w-4 h-4 text-blue-300" /></div>
              <h2 className="text-sm font-semibold text-foreground">Calm Down — 4-7-8 Breathing</h2>
            </div>
            {breathing && <span className="text-[10px] text-muted-foreground">cycle {breathCycle}</span>}
          </div>
          {!breathing ? (
            <button onClick={startBreathing}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500/30 to-cyan-500/20 border border-blue-400/30 text-blue-200 text-sm font-medium">
              Start guided breathing
            </button>
          ) : (
            <div className="flex flex-col items-center py-4">
              <div className={`w-32 h-32 rounded-full bg-gradient-to-br from-blue-400/40 to-purple-500/30 border border-blue-300/40 flex items-center justify-center transition-transform duration-[4000ms] ease-in-out ${breathScale}`}>
                <span className="text-blue-100 text-sm font-medium">{breathLabel}</span>
              </div>
              <button onClick={stopBreathing} className="mt-4 text-xs text-muted-foreground hover:text-foreground">Stop</button>
            </div>
          )}
        </div>

        {/* Trusted contacts */}
        <div className="holo-card rounded-2xl p-4 mb-5 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-amber-500/15"><Users className="w-4 h-4 text-amber-300" /></div>
            <h2 className="text-sm font-semibold text-foreground">My Trusted Circle</h2>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">Saved on this device. Tap to send a help SMS with your location.</p>

          <div className="space-y-2 mb-3">
            {trusted.length === 0 && <p className="text-xs text-muted-foreground italic">No contacts yet — add one below.</p>}
            {trusted.map(t => (
              <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-background/40 border border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{t.phone}</p>
                </div>
                <button onClick={() => smsTrusted(t.phone)} className="px-3 py-1.5 rounded-md bg-amber-500/20 text-amber-200 text-xs font-medium">SMS Help</button>
                <button onClick={() => callNumber(t.phone)} className="p-1.5 rounded-md bg-primary/15 text-primary"><Phone className="w-4 h-4" /></button>
                <button onClick={() => removeTrusted(t.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name"
              className="px-3 py-2 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground" />
            <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Phone" type="tel"
              className="px-3 py-2 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground" />
            <button onClick={addTrusted} className="px-3 rounded-lg bg-amber-500/20 text-amber-200"><Plus className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Emergency contacts */}
        <h2 className="text-sm font-semibold text-foreground mb-3">Emergency Numbers</h2>
        <div className="grid grid-cols-2 gap-2 mb-6">
          {emergencyContacts.map(c => (
            <button key={c.name} onClick={() => callNumber(c.number)}
              className={`flex items-start gap-2 p-3 rounded-xl bg-gradient-to-br border holo-tile text-left ${c.color}`}>
              <div className="p-1.5 rounded-md bg-background/30">{c.icon}</div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-semibold text-foreground truncate">{c.name}</h3>
                <p className="text-[11px] text-muted-foreground truncate">{c.number || "—"}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Safety plan */}
        <div className="holo-card rounded-2xl border border-purple-500/20 mb-5">
          <button onClick={() => setPlanOpen(o => !o)}
            className="w-full p-4 flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-purple-500/15"><Activity className="w-4 h-4 text-purple-300" /></div>
            <div className="flex-1 text-left">
              <h2 className="text-sm font-semibold text-foreground">My Safety Plan</h2>
              <p className="text-[10px] text-muted-foreground">Personal coping plan — saved privately on this device</p>
            </div>
            {planOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {planOpen && (
            <div className="px-4 pb-4 space-y-3">
              {[
                { k: "warningSigns", label: "Warning signs I notice", placeholder: "e.g. trouble sleeping, feeling numb…" },
                { k: "copingStrategies", label: "Things that help me cope", placeholder: "e.g. walk, music, call sister…" },
                { k: "reasonsToLive", label: "Reasons to keep going", placeholder: "e.g. my kids, my dog…" },
                { k: "safePlace", label: "A safe place I can go", placeholder: "e.g. mum's house, library…" },
                { k: "professionalContact", label: "My professional/support person", placeholder: "Name + phone" },
              ].map((f) => (
                <div key={f.k}>
                  <label className="text-[11px] text-muted-foreground">{f.label}</label>
                  <textarea
                    value={(plan as any)[f.k]}
                    onChange={e => setPlan(p => ({ ...p, [f.k]: e.target.value }))}
                    placeholder={f.placeholder}
                    rows={2}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground resize-none"
                  />
                </div>
              ))}
              <button onClick={savePlan}
                className="w-full py-2.5 rounded-lg bg-purple-500/20 border border-purple-400/30 text-purple-200 text-sm font-medium flex items-center justify-center gap-2">
                {planSaved ? <Check className="w-4 h-4" /> : null}
                {planSaved ? "Saved" : "Save Safety Plan"}
              </button>
            </div>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground text-center px-4">
          If you are in immediate danger, call your local emergency number now.
          Oracle Lunar is not a substitute for professional emergency services.
        </p>
      </div>
    </div>
  );
};

export default CrisisHubPage;
