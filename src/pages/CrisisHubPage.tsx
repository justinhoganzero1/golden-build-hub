import { Phone, Shield, AlertTriangle, Heart } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";

const emergencyContacts = [
  { name: "Emergency Services", number: "911", icon: <Phone className="w-5 h-5" /> },
  { name: "Crisis Helpline", number: "988", icon: <Heart className="w-5 h-5" /> },
  { name: "Domestic Violence", number: "1-800-799-7233", icon: <Shield className="w-5 h-5" /> },
  { name: "Poison Control", number: "1-800-222-1222", icon: <AlertTriangle className="w-5 h-5" /> },
];

const resources = [
  { title: "Talk to Someone Now", desc: "Connect with a trained counselor 24/7", action: "Chat Now" },
  { title: "Safety Planning", desc: "Create your personalized safety plan", action: "Start" },
  { title: "Find Local Help", desc: "Locate nearby crisis centers and shelters", action: "Search" },
];

const CrisisHubPage = () => (
  <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-destructive/10"><Shield className="w-7 h-7 text-destructive" /></div>
        <div><h1 className="text-xl font-bold text-destructive">Crisis Hub</h1><p className="text-muted-foreground text-xs">Immediate help when you need it</p></div>
      </div>
      <button className="w-full py-5 bg-destructive text-destructive-foreground font-bold text-lg rounded-xl mb-4 flex items-center justify-center gap-3 animate-pulse">
        <Phone className="w-6 h-6" /> SOS — Call Emergency
      </button>
      <h2 className="text-sm font-semibold text-foreground mb-3">Emergency Contacts</h2>
      <div className="space-y-2 mb-6">
        {emergencyContacts.map(c => (
          <a key={c.number} href={`tel:${c.number}`} className="flex items-center gap-4 bg-card border border-border rounded-xl p-4 hover:border-destructive transition-colors">
            <div className="p-2 rounded-lg bg-destructive/10 text-destructive">{c.icon}</div>
            <div className="flex-1"><h3 className="text-sm font-semibold text-foreground">{c.name}</h3><p className="text-xs text-muted-foreground">{c.number}</p></div>
            <Phone className="w-4 h-4 text-primary" />
          </a>
        ))}
      </div>
      <h2 className="text-sm font-semibold text-foreground mb-3">Crisis Resources</h2>
      <div className="space-y-3">
        {resources.map(r => (
          <div key={r.title} className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground">{r.title}</h3>
            <p className="text-xs text-muted-foreground mb-3">{r.desc}</p>
            <button className="px-4 py-2 bg-primary text-primary-foreground text-xs font-medium rounded-lg">{r.action}</button>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default CrisisHubPage;
