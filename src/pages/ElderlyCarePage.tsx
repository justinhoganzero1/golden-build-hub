import { Pill, Heart, Clock, Phone, Bell, Activity } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
const features = [
  { icon: <Pill className="w-5 h-5" />, title: "Medication Reminders", desc: "Never miss a dose", active: true },
  { icon: <Activity className="w-5 h-5" />, title: "Health Monitoring", desc: "Track vitals and symptoms", active: true },
  { icon: <Phone className="w-5 h-5" />, title: "Emergency Contact", desc: "One-tap call to caregivers", active: true },
  { icon: <Clock className="w-5 h-5" />, title: "Daily Routine", desc: "Guided daily activities", active: false },
  { icon: <Bell className="w-5 h-5" />, title: "Fall Detection", desc: "Automatic alert on falls", active: true },
  { icon: <Heart className="w-5 h-5" />, title: "Companionship", desc: "AI companion for conversation", active: true },
];
const ElderlyCarePage = () => (
  <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center gap-3 mb-4"><div className="p-2 rounded-xl bg-primary/10"><Pill className="w-7 h-7 text-primary" /></div><div><h1 className="text-xl font-bold text-primary">Elderly Care</h1><p className="text-muted-foreground text-xs">Senior health & assistance</p></div></div>
      <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-2xl p-5 mb-6 text-center"><p className="text-xs text-muted-foreground mb-1">Next Medication</p><p className="text-2xl font-bold text-primary">2:00 PM</p><p className="text-xs text-foreground mt-1">Aspirin 81mg</p></div>
      <div className="space-y-3">{features.map(f => (<div key={f.title} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4"><div className="p-2 rounded-lg bg-primary/10 text-primary">{f.icon}</div><div className="flex-1"><h3 className="text-sm font-semibold text-foreground">{f.title}</h3><p className="text-xs text-muted-foreground">{f.desc}</p></div><div className={`w-3 h-3 rounded-full ${f.active ? "bg-[hsl(var(--status-active))]" : "bg-muted"}`} /></div>))}</div>
    </div>
  </div>
);
export default ElderlyCarePage;
