import { useState, useEffect, useRef, useCallback } from "react";
import { Clock, Plus, Bell, Trash2, Moon, Sun, X, BellRing, Volume2 } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";

const STORAGE_KEY = "oracle.alarms.v2";
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Alarm {
  id: string;
  time: string;       // "HH:MM" 24h
  label: string;
  days: number[];     // 0..6, empty = once
  enabled: boolean;
  lastFiredKey?: string; // dedupe: "YYYY-MM-DD-HH-MM"
}

const formatDisplay = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const dh = ((h + 11) % 12) + 1;
  return `${dh}:${m.toString().padStart(2, "0")} ${ampm}`;
};

const daysSummary = (days: number[]) => {
  if (days.length === 0) return "Once";
  if (days.length === 7) return "Every day";
  if (days.length === 5 && [1,2,3,4,5].every(d => days.includes(d))) return "Weekdays";
  if (days.length === 2 && [0,6].every(d => days.includes(d))) return "Weekends";
  return days.sort().map(d => DAY_LABELS[d]).join(", ");
};

// Pleasant sine-wave tone via WebAudio (no external file needed)
function startTone(): () => void {
  const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
  if (!Ctx) return () => {};
  const ctx = new Ctx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 880;
  gain.gain.value = 0.0001;
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  // Pulsing envelope
  const pulse = window.setInterval(() => {
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.linearRampToValueAtTime(660, t + 0.5);
  }, 800);
  return () => {
    window.clearInterval(pulse);
    try { osc.stop(); } catch {}
    try { ctx.close(); } catch {}
  };
}

const AlarmClockPage = () => {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [now, setNow] = useState(new Date());
  const [editing, setEditing] = useState<Alarm | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [ringing, setRinging] = useState<Alarm | null>(null);
  const stopToneRef = useRef<(() => void) | null>(null);

  // Load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setAlarms(JSON.parse(raw));
    } catch {}
  }, []);

  // Persist
  const persist = useCallback((next: Alarm[]) => {
    setAlarms(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }, []);

  // Tick
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  // Fire check
  useEffect(() => {
    if (ringing) return;
    const hh = now.getHours().toString().padStart(2, "0");
    const mm = now.getMinutes().toString().padStart(2, "0");
    const dow = now.getDay();
    const dayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${hh}-${mm}`;
    const due = alarms.find(a =>
      a.enabled &&
      a.time === `${hh}:${mm}` &&
      (a.days.length === 0 || a.days.includes(dow)) &&
      a.lastFiredKey !== dayKey
    );
    if (due) {
      const updated = alarms.map(a => a.id === due.id ? { ...a, lastFiredKey: dayKey, enabled: due.days.length === 0 ? false : a.enabled } : a);
      persist(updated);
      setRinging(due);
      stopToneRef.current = startTone();
      if ("vibrate" in navigator) {
        try { (navigator as any).vibrate?.([400, 200, 400, 200, 400]); } catch {}
      }
      toast.success(`⏰ ${due.label || "Alarm"}`);
    }
  }, [now, alarms, ringing, persist]);

  const dismissRing = () => {
    stopToneRef.current?.();
    stopToneRef.current = null;
    setRinging(null);
  };

  useEffect(() => () => stopToneRef.current?.(), []);

  const toggle = (id: string) => persist(alarms.map(a => a.id === id ? { ...a, enabled: !a.enabled, lastFiredKey: undefined } : a));
  const remove = (id: string) => persist(alarms.filter(a => a.id !== id));

  const openNew = () => {
    setEditing({ id: crypto.randomUUID(), time: "07:00", label: "", days: [1,2,3,4,5], enabled: true });
    setShowEditor(true);
  };
  const openEdit = (a: Alarm) => { setEditing({ ...a }); setShowEditor(true); };

  const saveEditing = () => {
    if (!editing) return;
    const exists = alarms.some(a => a.id === editing.id);
    const next = exists ? alarms.map(a => a.id === editing.id ? editing : a) : [...alarms, editing];
    persist(next);
    setShowEditor(false);
    setEditing(null);
    toast.success(exists ? "Alarm updated" : "Alarm added");
  };

  const currentDisplay = `${((now.getHours() + 11) % 12) + 1}:${now.getMinutes().toString().padStart(2, "0")}`;
  const ampm = now.getHours() >= 12 ? "PM" : "AM";
  const dateLine = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen bg-background pb-20 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-30"
        style={{ background: "radial-gradient(60% 50% at 50% 0%, hsl(45 80% 50% / 0.12), transparent 60%)" }} />
      <UniversalBackButton />
      <div className="relative px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-6 holo-card rounded-2xl p-3 border border-primary/20">
          <div className="p-2 rounded-xl holo-bubble bg-primary/10"><Clock className="w-7 h-7 text-primary" /></div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-primary">Alarm Clock</h1>
            <p className="text-muted-foreground text-xs">Stays running while the app is open</p>
          </div>
          <button onClick={openNew} className="p-2 rounded-full bg-primary text-primary-foreground"><Plus className="w-4 h-4" /></button>
        </div>

        {/* Current time */}
        <div className="text-center mb-8 holo-card rounded-2xl p-6 border border-primary/20">
          <p className="text-6xl font-bold text-primary tracking-wider">
            {currentDisplay}
            <span className="text-2xl ml-2 text-muted-foreground">{ampm}</span>
          </p>
          <p className="text-sm text-muted-foreground mt-2">{dateLine}</p>
        </div>

        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />Your Alarms ({alarms.length})
        </h2>

        {alarms.length === 0 && (
          <div className="text-center py-10 holo-card rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground mb-3">No alarms yet</p>
            <button onClick={openNew} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs">Add your first alarm</button>
          </div>
        )}

        <div className="space-y-3">
          {alarms.map(a => {
            const [h] = a.time.split(":").map(Number);
            const isMorning = h < 12;
            return (
              <div key={a.id} className={`holo-tile rounded-xl p-4 border transition ${a.enabled ? "border-primary/30" : "border-border opacity-60"}`}>
                <div className="flex items-center justify-between mb-1">
                  <button onClick={() => openEdit(a)} className="flex items-center gap-2 text-left flex-1 min-w-0">
                    {isMorning ? <Sun className="w-4 h-4 text-primary" /> : <Moon className="w-4 h-4 text-primary" />}
                    <h3 className="text-2xl font-bold text-foreground">{formatDisplay(a.time)}</h3>
                  </button>
                  <button onClick={() => toggle(a.id)}
                    className={`w-12 h-7 rounded-full transition-colors relative ${a.enabled ? "bg-primary" : "bg-muted"}`}>
                    <div className={`w-5 h-5 rounded-full bg-primary-foreground absolute top-1 transition-transform ${a.enabled ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                  <button onClick={() => remove(a.id)} className="ml-2 p-1.5 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">{a.label || "Alarm"} • {daysSummary(a.days)}</p>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-muted-foreground/70 text-center mt-6 px-4">
          Note: alarms only ring while Oracle Lunar is open in the foreground. Keep this tab/app active to be woken up on time.
        </p>
      </div>

      {/* Editor modal */}
      {showEditor && editing && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md holo-card rounded-2xl p-5 border border-primary/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-foreground">{alarms.some(a => a.id === editing.id) ? "Edit alarm" : "New alarm"}</h3>
              <button onClick={() => { setShowEditor(false); setEditing(null); }} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>

            <label className="text-[11px] text-muted-foreground">Time</label>
            <input type="time" value={editing.time}
              onChange={e => setEditing(p => p && ({ ...p, time: e.target.value }))}
              className="w-full mt-1 mb-4 px-4 py-3 rounded-lg bg-input border border-border text-2xl text-foreground" />

            <label className="text-[11px] text-muted-foreground">Label</label>
            <input value={editing.label} placeholder="e.g. Wake up"
              onChange={e => setEditing(p => p && ({ ...p, label: e.target.value }))}
              className="w-full mt-1 mb-4 px-3 py-2 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground" />

            <label className="text-[11px] text-muted-foreground">Repeat</label>
            <div className="flex gap-1 mt-1 mb-4">
              {DAY_LABELS.map((d, i) => {
                const on = editing.days.includes(i);
                return (
                  <button key={i} onClick={() => setEditing(p => p && ({ ...p, days: on ? p.days.filter(x => x !== i) : [...p.days, i] }))}
                    className={`flex-1 py-2 rounded-lg text-[11px] font-medium transition ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {d}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 mb-5 text-[11px]">
              <button onClick={() => setEditing(p => p && ({ ...p, days: [] }))} className="px-2 py-1 rounded-md bg-muted text-muted-foreground">Once</button>
              <button onClick={() => setEditing(p => p && ({ ...p, days: [1,2,3,4,5] }))} className="px-2 py-1 rounded-md bg-muted text-muted-foreground">Weekdays</button>
              <button onClick={() => setEditing(p => p && ({ ...p, days: [0,6] }))} className="px-2 py-1 rounded-md bg-muted text-muted-foreground">Weekends</button>
              <button onClick={() => setEditing(p => p && ({ ...p, days: [0,1,2,3,4,5,6] }))} className="px-2 py-1 rounded-md bg-muted text-muted-foreground">Every day</button>
            </div>

            <button onClick={saveEditing} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm">
              Save alarm
            </button>
          </div>
        </div>
      )}

      {/* Ringing modal */}
      {ringing && (
        <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur flex items-center justify-center p-4 animate-in fade-in">
          <div className="text-center">
            <div className="mx-auto w-32 h-32 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center mb-6 animate-pulse">
              <BellRing className="w-16 h-16 text-primary" />
            </div>
            <p className="text-3xl font-bold text-primary mb-1">{formatDisplay(ringing.time)}</p>
            <p className="text-base text-foreground mb-1">{ringing.label || "Alarm"}</p>
            <p className="text-xs text-muted-foreground mb-6 flex items-center justify-center gap-1">
              <Volume2 className="w-3 h-3" /> Ringing
            </p>
            <button onClick={dismissRing}
              className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm">
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlarmClockPage;
