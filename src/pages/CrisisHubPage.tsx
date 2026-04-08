import { useState, useEffect } from "react";
import { Phone, Shield, AlertTriangle, Heart, MapPin, Globe, Loader2, MessageSquare } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";

interface EmergencyNumbers {
  country: string;
  city: string;
  police: string;
  ambulance: string;
  fire: string;
  crisis: string;
  domesticViolence: string;
  poison: string;
}

const COUNTRY_NUMBERS: Record<string, Omit<EmergencyNumbers, "country" | "city">> = {
  US: { police: "911", ambulance: "911", fire: "911", crisis: "988", domesticViolence: "1-800-799-7233", poison: "1-800-222-1222" },
  AU: { police: "000", ambulance: "000", fire: "000", crisis: "13 11 14", domesticViolence: "1800 737 732", poison: "13 11 26" },
  GB: { police: "999", ambulance: "999", fire: "999", crisis: "116 123", domesticViolence: "0808 2000 247", poison: "111" },
  CA: { police: "911", ambulance: "911", fire: "911", crisis: "1-833-456-4566", domesticViolence: "1-800-363-9010", poison: "1-800-222-1222" },
  NZ: { police: "111", ambulance: "111", fire: "111", crisis: "1737", domesticViolence: "0800 456 450", poison: "0800 764 766" },
  IN: { police: "100", ambulance: "102", fire: "101", crisis: "9152987821", domesticViolence: "181", poison: "1800-11-6117" },
  DE: { police: "110", ambulance: "112", fire: "112", crisis: "0800 111 0 111", domesticViolence: "08000 116 016", poison: "030 19240" },
  FR: { police: "17", ambulance: "15", fire: "18", crisis: "3114", domesticViolence: "3919", poison: "01 40 05 48 48" },
  JP: { police: "110", ambulance: "119", fire: "119", crisis: "0570-064-556", domesticViolence: "0120-279-338", poison: "110" },
  DEFAULT: { police: "112", ambulance: "112", fire: "112", crisis: "112", domesticViolence: "112", poison: "112" },
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-chat`;

const CrisisHubPage = () => {
  const [numbers, setNumbers] = useState<EmergencyNumbers>({ country: "", city: "", ...COUNTRY_NUMBERS.DEFAULT });
  const [loading, setLoading] = useState(true);
  const [aiSpeaking, setAiSpeaking] = useState(false);

  useEffect(() => {
    detectLocation();
  }, []);

  const detectLocation = async () => {
    setLoading(true);
    try {
      const resp = await fetch("https://ipapi.co/json/");
      const data = await resp.json();
      const code = data.country_code || "DEFAULT";
      const nums = COUNTRY_NUMBERS[code] || COUNTRY_NUMBERS.DEFAULT;
      setNumbers({ country: data.country_name || "Unknown", city: data.city || "Unknown", ...nums });
    } catch {
      setNumbers({ country: "Unknown", city: "Unknown", ...COUNTRY_NUMBERS.DEFAULT });
    } finally { setLoading(false); }
  };

  const callNumber = (num: string) => {
    window.location.href = `tel:${num.replace(/\s/g, "")}`;
  };

  const aiCallEmergency = async () => {
    setAiSpeaking(true);
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          messages: [
            { role: "system", content: `You are an emergency AI assistant. The user is in ${numbers.city}, ${numbers.country}. Their emergency number is ${numbers.police}. Help them stay calm and prepare information for emergency services. Be very brief and direct.` },
            { role: "user", content: "I need emergency help. What should I tell the operator?" }
          ]
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
      if (content && "speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(cleanTextForSpeech(content));
        u.rate = 1.1; u.volume = 1;
        window.speechSynthesis.speak(u);
      }
      toast.info(content || "Stay calm. Help is on the way.");
    } catch {
      toast.info("Stay calm. Call your local emergency number now.");
    } finally { setAiSpeaking(false); }
  };

  const emergencyContacts = [
    { name: "Police", number: numbers.police, icon: <Shield className="w-5 h-5" />, color: "bg-blue-500/10 text-blue-400" },
    { name: "Ambulance", number: numbers.ambulance, icon: <Heart className="w-5 h-5" />, color: "bg-red-500/10 text-red-400" },
    { name: "Fire Service", number: numbers.fire, icon: <AlertTriangle className="w-5 h-5" />, color: "bg-orange-500/10 text-orange-400" },
    { name: "Crisis Helpline", number: numbers.crisis, icon: <Phone className="w-5 h-5" />, color: "bg-purple-500/10 text-purple-400" },
    { name: "Domestic Violence", number: numbers.domesticViolence, icon: <Shield className="w-5 h-5" />, color: "bg-pink-500/10 text-pink-400" },
    { name: "Poison Control", number: numbers.poison, icon: <AlertTriangle className="w-5 h-5" />, color: "bg-green-500/10 text-green-400" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-destructive/10"><Shield className="w-7 h-7 text-destructive" /></div>
          <div><h1 className="text-xl font-bold text-destructive">Crisis Hub</h1><p className="text-muted-foreground text-xs">Immediate help when you need it</p></div>
        </div>

        {/* Location */}
        <div className="flex items-center gap-2 mb-4 bg-card border border-border rounded-xl px-4 py-3">
          <MapPin className="w-4 h-4 text-primary" />
          {loading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : (
            <div>
              <p className="text-sm text-foreground font-medium">{numbers.city}, {numbers.country}</p>
              <p className="text-[10px] text-muted-foreground">Numbers localized to your region</p>
            </div>
          )}
          <button onClick={detectLocation} className="ml-auto text-xs text-primary"><Globe className="w-4 h-4" /></button>
        </div>

        {/* SOS */}
        <button onClick={() => callNumber(numbers.police)}
          className="w-full py-5 bg-destructive text-destructive-foreground font-bold text-lg rounded-xl mb-2 flex items-center justify-center gap-3 animate-pulse">
          <Phone className="w-6 h-6" /> SOS — Call {numbers.police}
        </button>

        {/* AI Speak to Emergency */}
        <button onClick={aiCallEmergency} disabled={aiSpeaking}
          className="w-full py-3 bg-card border border-destructive/30 text-destructive rounded-xl mb-4 flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50">
          {aiSpeaking ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
          AI Emergency Preparation
        </button>

        <h2 className="text-sm font-semibold text-foreground mb-3">Emergency Contacts</h2>
        <div className="space-y-2 mb-6">
          {emergencyContacts.map(c => (
            <button key={c.name} onClick={() => callNumber(c.number)}
              className="w-full flex items-center gap-4 bg-card border border-border rounded-xl p-4 hover:border-destructive transition-colors text-left">
              <div className={`p-2 rounded-lg ${c.color}`}>{c.icon}</div>
              <div className="flex-1"><h3 className="text-sm font-semibold text-foreground">{c.name}</h3><p className="text-xs text-muted-foreground">{c.number}</p></div>
              <Phone className="w-4 h-4 text-primary" />
            </button>
          ))}
        </div>

        <h2 className="text-sm font-semibold text-foreground mb-3">Crisis Resources</h2>
        <div className="space-y-3">
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground">Talk to Someone Now</h3>
            <p className="text-xs text-muted-foreground mb-3">Connect with a trained counselor 24/7</p>
            <button onClick={() => callNumber(numbers.crisis)} className="px-4 py-2 bg-primary text-primary-foreground text-xs font-medium rounded-lg">Call Now</button>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground">Safety Planning</h3>
            <p className="text-xs text-muted-foreground mb-3">Create your personalized safety plan</p>
            <button className="px-4 py-2 bg-primary text-primary-foreground text-xs font-medium rounded-lg">Start</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrisisHubPage;
