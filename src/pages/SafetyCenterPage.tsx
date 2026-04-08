import { Shield, MapPin, Phone, Users, AlertTriangle, Bell } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";

const features = [
  { icon: <MapPin className="w-5 h-5" />, title: "Location Sharing", desc: "Share real-time location with trusted contacts", active: true },
  { icon: <AlertTriangle className="w-5 h-5" />, title: "Panic Button", desc: "Instantly alert your emergency contacts", active: true },
  { icon: <Bell className="w-5 h-5" />, title: "Check-in Reminders", desc: "Scheduled safety check-ins", active: false },
  { icon: <Users className="w-5 h-5" />, title: "Trusted Contacts", desc: "Manage your emergency contact list", active: true },
  { icon: <Phone className="w-5 h-5" />, title: "Fake Call", desc: "Generate a fake incoming call to exit situations", active: true },
];

const SafetyCenterPage = () => (
  <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-primary/10"><Shield className="w-7 h-7 text-primary" /></div>
        <div><h1 className="text-xl font-bold text-primary">Safety Center</h1><p className="text-muted-foreground text-xs">Your personal safety toolkit</p></div>
      </div>
      <button className="w-full py-5 bg-destructive text-destructive-foreground font-bold text-lg rounded-xl mb-6 flex items-center justify-center gap-3">
        <AlertTriangle className="w-6 h-6" /> Emergency SOS
      </button>
      <div className="space-y-3">
        {features.map(f => (
          <div key={f.title} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">{f.icon}</div>
            <div className="flex-1"><h3 className="text-sm font-semibold text-foreground">{f.title}</h3><p className="text-xs text-muted-foreground">{f.desc}</p></div>
            <div className={`w-3 h-3 rounded-full ${f.active ? "bg-[hsl(var(--status-active))]" : "bg-muted"}`} />
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default SafetyCenterPage;
