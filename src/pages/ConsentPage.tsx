import { useState } from "react";
import { FileText, Shield, Check } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
const consents = [
  { id: "data", title: "Data Collection", desc: "Allow us to collect usage data to improve the app" },
  { id: "analytics", title: "Analytics", desc: "Help us understand how you use the app" },
  { id: "notifications", title: "Push Notifications", desc: "Receive important updates and reminders" },
  { id: "location", title: "Location Services", desc: "Enable location-based features" },
  { id: "ai", title: "AI Processing", desc: "Allow AI models to process your conversations" },
];
const ConsentPage = () => {
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const toggle = (id: string) => setAccepted(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4"><div className="p-2 rounded-xl bg-primary/10"><FileText className="w-7 h-7 text-primary" /></div><div><h1 className="text-xl font-bold text-primary">Privacy Consent</h1><p className="text-muted-foreground text-xs">Manage your data preferences</p></div></div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border mb-4"><Shield className="w-4 h-4 text-[hsl(var(--status-active))]" /><span className="text-xs text-muted-foreground">Your data is encrypted and secure</span></div>
        <div className="space-y-3 mb-6">
          {consents.map(c => (
            <button key={c.id} onClick={() => toggle(c.id)} className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-4 text-left hover:border-primary transition-colors">
              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${accepted.has(c.id) ? "bg-primary border-primary" : "border-border"}`}>{accepted.has(c.id) && <Check className="w-4 h-4 text-primary-foreground" />}</div>
              <div><h3 className="text-sm font-semibold text-foreground">{c.title}</h3><p className="text-xs text-muted-foreground">{c.desc}</p></div>
            </button>
          ))}
        </div>
        <button onClick={() => { consents.forEach(c => setAccepted(prev => new Set(prev).add(c.id))); }} className="w-full py-3 bg-secondary text-foreground rounded-xl text-sm font-medium border border-border mb-3">Accept All</button>
        <button onClick={() => { toast.success("Preferences saved"); navigate("/settings"); }} className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold">Save Preferences</button>
      </div>
    </div>
  );
};
export default ConsentPage;
