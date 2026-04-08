import { useState } from "react";
import { Clock, Plus, Bell, Trash2, Moon, Sun } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";

const defaultAlarms = [
  { id: 1, time: "6:30 AM", label: "Wake Up", days: "Mon-Fri", enabled: true },
  { id: 2, time: "7:00 AM", label: "Morning Routine", days: "Every day", enabled: true },
  { id: 3, time: "9:00 PM", label: "Wind Down", days: "Every day", enabled: false },
];

const AlarmClockPage = () => {
  const [alarms, setAlarms] = useState(defaultAlarms);
  const toggle = (id: number) => setAlarms(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-primary/10"><Clock className="w-7 h-7 text-primary" /></div>
          <div className="flex-1"><h1 className="text-xl font-bold text-primary">Alarm Clock</h1></div>
          <button className="p-2 rounded-full bg-primary text-primary-foreground"><Plus className="w-4 h-4" /></button>
        </div>
        {/* Current Time */}
        <div className="text-center mb-8">
          <p className="text-5xl font-bold text-primary tracking-wider">10:08</p>
          <p className="text-sm text-muted-foreground mt-1">Tuesday, April 8</p>
        </div>
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Bell className="w-4 h-4 text-primary" />Your Alarms</h2>
        <div className="space-y-3">
          {alarms.map(a => (
            <div key={a.id} className={`bg-card border rounded-xl p-4 transition-colors ${a.enabled ? "border-primary/30" : "border-border opacity-60"}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {parseInt(a.time) < 12 ? <Sun className="w-4 h-4 text-primary" /> : <Moon className="w-4 h-4 text-primary" />}
                  <h3 className="text-2xl font-bold text-foreground">{a.time}</h3>
                </div>
                <button onClick={() => toggle(a.id)}
                  className={`w-12 h-7 rounded-full transition-colors relative ${a.enabled ? "bg-primary" : "bg-muted"}`}>
                  <div className={`w-5 h-5 rounded-full bg-primary-foreground absolute top-1 transition-transform ${a.enabled ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{a.label} • {a.days}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AlarmClockPage;
