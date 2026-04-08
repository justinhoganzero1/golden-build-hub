import { useState, useEffect } from "react";
import { Gift, Calendar, Heart, PartyPopper, Cake, Star, Plus, Trash2, X } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "birthday", label: "Birthday", icon: "🎂" },
  { value: "anniversary", label: "Anniversary", icon: "💍" },
  { value: "holiday", label: "Holiday", icon: "🎄" },
  { value: "graduation", label: "Graduation", icon: "🎓" },
  { value: "wedding", label: "Wedding", icon: "💒" },
  { value: "memorial", label: "Memorial", icon: "🕯️" },
  { value: "other", label: "Other", icon: "⭐" },
];

interface Occasion { id: string; title: string; occasion_date: string; category: string; notes: string | null; remind_days_before: number; icon: string; }

const SpecialOccasionsPage = () => {
  const { user } = useAuth();
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("birthday");
  const [notes, setNotes] = useState("");
  const [remindDays, setRemindDays] = useState(7);

  const loadOccasions = async () => {
    if (!user) return;
    const { data } = await supabase.from("special_occasions").select("*").eq("user_id", user.id).order("occasion_date", { ascending: true });
    if (data) setOccasions(data as Occasion[]);
  };

  useEffect(() => { loadOccasions(); }, [user]);

  const addOccasion = async () => {
    if (!user || !title.trim() || !date) { toast.error("Please fill in title and date"); return; }
    const cat = CATEGORIES.find(c => c.value === category);
    const { error } = await supabase.from("special_occasions").insert({ user_id: user.id, title: title.trim(), occasion_date: date, category, notes: notes.trim() || null, remind_days_before: remindDays, icon: cat?.icon || "⭐" });
    if (error) { toast.error("Failed to add occasion"); return; }
    toast.success("Occasion added! 🎉");
    setTitle(""); setDate(""); setNotes(""); setCategory("birthday"); setRemindDays(7); setShowAdd(false);
    loadOccasions();
  };

  const deleteOccasion = async (id: string) => {
    await supabase.from("special_occasions").delete().eq("id", id);
    toast.success("Deleted");
    loadOccasions();
  };

  const getDaysUntil = (dateStr: string) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + "T00:00:00"); 
    // If date has passed this year, calculate for next year
    if (target < today) target.setFullYear(target.getFullYear() + 1);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Gift className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">Special Occasions</h1><p className="text-muted-foreground text-xs">Never forget an important event</p></div>
        </div>

        <button onClick={() => setShowAdd(!showAdd)} className="w-full bg-primary text-primary-foreground rounded-xl p-4 flex items-center justify-center gap-3 font-semibold mb-6">
          {showAdd ? <><X className="w-5 h-5" /> Cancel</> : <><Plus className="w-5 h-5" /> Add Occasion</>}
        </button>

        {showAdd && (
          <div className="bg-card border border-border rounded-xl p-4 mb-6 space-y-3">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Occasion name" className="w-full px-4 py-3 bg-input border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-3 bg-input border border-border rounded-xl text-sm text-foreground outline-none focus:border-primary" />
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button key={c.value} onClick={() => setCategory(c.value)} className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 ${category === c.value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2} className="w-full px-4 py-3 bg-input border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary resize-none" />
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Remind me</span>
              <select value={remindDays} onChange={e => setRemindDays(Number(e.target.value))} className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none">
                <option value={1}>1 day before</option><option value={3}>3 days before</option><option value={7}>1 week before</option><option value={14}>2 weeks before</option><option value={30}>1 month before</option>
              </select>
            </div>
            <button onClick={addOccasion} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm">Save Occasion</button>
          </div>
        )}

        <h2 className="text-sm font-semibold text-foreground mb-3">Upcoming</h2>
        {occasions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground"><Gift className="w-10 h-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No occasions yet</p><p className="text-xs">Add your first special occasion above!</p></div>
        ) : (
          <div className="space-y-3">
            {occasions.map(o => {
              const days = getDaysUntil(o.occasion_date);
              return (
                <div key={o.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                  <span className="text-2xl">{o.icon}</span>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-foreground">{o.title}</h3>
                    <p className="text-xs text-muted-foreground">{new Date(o.occasion_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                    {o.notes && <p className="text-[10px] text-muted-foreground mt-1">{o.notes}</p>}
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${days <= 7 ? "bg-destructive/20 text-destructive" : "bg-primary/10 text-primary"}`}>{days}d</span>
                  <button onClick={() => deleteOccasion(o.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
export default SpecialOccasionsPage;
