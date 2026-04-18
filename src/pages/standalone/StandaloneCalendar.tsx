import { useEffect, useState } from "react";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";

/** Simplified Calendar: list upcoming events + quick add. */
const StandaloneCalendar = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<Array<{ id: string; title: string; event_date: string; start_time: string | null }>>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("calendar_events")
      .select("id, title, event_date, start_time")
      .eq("user_id", user.id)
      .gte("event_date", new Date().toISOString().slice(0, 10))
      .order("event_date")
      .limit(20);
    setEvents(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const add = async () => {
    if (!user || !title.trim() || adding) return;
    setAdding(true);
    await supabase.from("calendar_events").insert({ user_id: user.id, title: title.trim(), event_date: date });
    setTitle("");
    await load();
    setAdding(false);
  };

  const del = async (id: string) => {
    await supabase.from("calendar_events").delete().eq("id", id);
    setEvents((e) => e.filter((x) => x.id !== id));
  };

  if (!user) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-muted-foreground">Sign in to use your calendar.</p>
        <Link to="/sign-in" className="inline-block px-5 py-3 rounded-full bg-primary text-primary-foreground font-medium">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 p-3 bg-card border border-border rounded-2xl">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's the event?" className="flex-1 bg-muted rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/40" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-muted rounded-lg px-3 py-2 outline-none" />
        <button onClick={add} disabled={!title.trim() || adding} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
        </button>
      </div>
      {loading ? (
        <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
      ) : events.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground text-sm">No upcoming events. Add one above ↑</div>
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
              <div className="w-12 text-center">
                <div className="text-xs text-muted-foreground uppercase">{new Date(e.event_date).toLocaleDateString(undefined, { month: "short" })}</div>
                <div className="text-lg font-bold">{new Date(e.event_date).getDate()}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{e.title}</div>
                {e.start_time && <div className="text-xs text-muted-foreground">{e.start_time}</div>}
              </div>
              <button onClick={() => del(e.id)} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StandaloneCalendar;
