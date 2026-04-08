import { useState, useEffect, useCallback } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock, BookOpen, Trash2, X, Send } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CalEvent {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  color: string;
  category: string;
}

interface DiaryEntry {
  id: string;
  entry_date: string;
  title?: string;
  content: string;
  mood?: string;
  category: string;
  created_at: string;
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MOODS = ["😊","😐","😢","😡","🤩","😴","🤔","💪"];
const COLORS = ["primary","destructive","[hsl(var(--status-active))]","[hsl(var(--accent-foreground))]"];

const CalendarPage = () => {
  const { user } = useAuth();
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [showDayModal, setShowDayModal] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showAddDiary, setShowAddDiary] = useState(false);

  // Add event form
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime, setNewEndTime] = useState("10:00");
  const [newColor, setNewColor] = useState("primary");
  const [newCategory, setNewCategory] = useState("general");

  // Diary form
  const [diaryContent, setDiaryContent] = useState("");
  const [diaryTitle, setDiaryTitle] = useState("");
  const [diaryMood, setDiaryMood] = useState("");
  const [diaryCategory, setDiaryCategory] = useState("personal");

  const dateKey = (d: Date) => d.toISOString().split("T")[0];

  const loadData = useCallback(async () => {
    if (!user) return;
    const startDate = new Date(currentYear, currentMonth, 1);
    const endDate = new Date(currentYear, currentMonth + 1, 0);

    const [evRes, diRes] = await Promise.all([
      supabase.from("calendar_events").select("*").eq("user_id", user.id)
        .gte("event_date", dateKey(startDate)).lte("event_date", dateKey(endDate)),
      supabase.from("diary_entries").select("*").eq("user_id", user.id)
        .gte("entry_date", dateKey(startDate)).lte("entry_date", dateKey(endDate))
        .order("created_at", { ascending: false }),
    ]);
    if (evRes.data) setEvents(evRes.data as CalEvent[]);
    if (diRes.data) setDiaryEntries(diRes.data as DiaryEntry[]);
  }, [user, currentMonth, currentYear]);

  useEffect(() => { loadData(); }, [loadData]);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const eventsForDate = (d: Date) => events.filter(e => e.event_date === dateKey(d));
  const diaryForDate = (d: Date) => diaryEntries.filter(e => e.entry_date === dateKey(d));

  const handleDateClick = (day: number) => {
    const d = new Date(currentYear, currentMonth, day);
    setSelectedDate(d);
    setShowDayModal(true);
  };

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  const addEvent = async () => {
    if (!user || !newTitle.trim()) { toast.error("Title required"); return; }
    const { error } = await supabase.from("calendar_events").insert({
      user_id: user.id,
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      event_date: dateKey(selectedDate),
      start_time: newStartTime || null,
      end_time: newEndTime || null,
      color: newColor,
      category: newCategory,
    });
    if (error) { toast.error("Failed to add event"); return; }
    toast.success("Event added!");
    setNewTitle(""); setNewDesc(""); setShowAddEvent(false);
    loadData();
  };

  const addDiary = async () => {
    if (!user || !diaryContent.trim()) { toast.error("Content required"); return; }
    const { error } = await supabase.from("diary_entries").insert({
      user_id: user.id,
      entry_date: dateKey(selectedDate),
      title: diaryTitle.trim() || null,
      content: diaryContent.trim(),
      mood: diaryMood || null,
      category: diaryCategory,
    });
    if (error) { toast.error("Failed to save diary entry"); return; }
    toast.success("Diary entry saved!");
    setDiaryContent(""); setDiaryTitle(""); setDiaryMood(""); setShowAddDiary(false);
    loadData();
  };

  const deleteEvent = async (id: string) => {
    await supabase.from("calendar_events").delete().eq("id", id);
    toast.success("Event deleted");
    loadData();
  };

  const deleteDiary = async (id: string) => {
    await supabase.from("diary_entries").delete().eq("id", id);
    toast.success("Entry deleted");
    loadData();
  };

  const selectedEvents = eventsForDate(selectedDate);
  const selectedDiary = diaryForDate(selectedDate);

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><CalendarIcon className="w-7 h-7 text-primary" /></div>
          <div className="flex-1"><h1 className="text-xl font-bold text-primary">Calendar & Diary</h1><p className="text-xs text-muted-foreground">Your life organizer</p></div>
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-secondary"><ChevronLeft className="w-5 h-5 text-primary" /></button>
          <h2 className="text-sm font-semibold text-foreground">{MONTHS[currentMonth]} {currentYear}</h2>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-secondary"><ChevronRight className="w-5 h-5 text-primary" /></button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1 text-center">
          {DAYS.map(d => <div key={d} className="text-[10px] text-muted-foreground font-medium py-1">{d}</div>)}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e${i}`} />)}
          {days.map(d => {
            const dt = new Date(currentYear, currentMonth, d);
            const isToday = dateKey(dt) === dateKey(today);
            const isSelected = dateKey(dt) === dateKey(selectedDate);
            const hasEvents = eventsForDate(dt).length > 0;
            const hasDiary = diaryForDate(dt).length > 0;
            return (
              <button key={d} onClick={() => handleDateClick(d)}
                className={`relative w-full aspect-square rounded-xl text-xs flex flex-col items-center justify-center transition-all
                  ${isSelected ? "bg-primary text-primary-foreground font-bold ring-2 ring-primary/50 scale-105" : isToday ? "bg-accent text-accent-foreground font-semibold" : "text-foreground hover:bg-secondary"}`}>
                {d}
                {(hasEvents || hasDiary) && (
                  <div className="flex gap-0.5 mt-0.5">
                    {hasEvents && <span className="w-1 h-1 rounded-full bg-destructive" />}
                    {hasDiary && <span className="w-1 h-1 rounded-full bg-primary" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick view of selected date */}
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">
              {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </h3>
            <div className="flex gap-2">
              <button onClick={() => { setShowDayModal(true); }} className="p-1.5 rounded-lg bg-primary text-primary-foreground"><Plus className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          {selectedEvents.length === 0 && selectedDiary.length === 0 ? (
            <p className="text-xs text-muted-foreground">No events or diary entries. Tap + to add.</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.slice(0, 3).map(e => (
                <div key={e.id} className="flex items-center gap-2 text-xs">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-foreground font-medium">{e.title}</span>
                  {e.start_time && <span className="text-muted-foreground">{e.start_time.slice(0, 5)}</span>}
                </div>
              ))}
              {selectedDiary.slice(0, 2).map(d => (
                <div key={d.id} className="flex items-center gap-2 text-xs">
                  <BookOpen className="w-3 h-3 text-muted-foreground" />
                  <span className="text-foreground">{d.title || d.content.slice(0, 40)}...</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Day detail modal */}
      <Dialog open={showDayModal} onOpenChange={setShowDayModal}>
        <DialogContent className="max-w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="events" className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="events" className="flex-1 text-xs">Events ({selectedEvents.length})</TabsTrigger>
              <TabsTrigger value="diary" className="flex-1 text-xs">Diary ({selectedDiary.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="events" className="space-y-3 mt-3">
              <button onClick={() => setShowAddEvent(true)} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Add Event
              </button>
              {selectedEvents.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No events for this day</p>}
              {selectedEvents.map(ev => (
                <div key={ev.id} className={`rounded-xl p-3 border bg-${ev.color}/5 border-${ev.color}/20`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{ev.title}</p>
                      {ev.description && <p className="text-xs text-muted-foreground mt-1">{ev.description}</p>}
                      <div className="flex items-center gap-2 mt-1.5">
                        {ev.start_time && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{ev.start_time.slice(0, 5)}{ev.end_time ? ` - ${ev.end_time.slice(0, 5)}` : ""}</span>}
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{ev.category}</span>
                      </div>
                    </div>
                    <button onClick={() => deleteEvent(ev.id)} className="p-1 text-destructive/50 hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="diary" className="space-y-3 mt-3">
              <button onClick={() => setShowAddDiary(true)} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center gap-2">
                <BookOpen className="w-4 h-4" /> Add Diary Entry
              </button>
              {selectedDiary.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No diary entries for this day</p>}
              {selectedDiary.map(d => (
                <div key={d.id} className="rounded-xl p-3 border border-border bg-card">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {d.mood && <span className="text-base">{d.mood}</span>}
                        <p className="text-sm font-semibold text-foreground">{d.title || "Diary Entry"}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{d.content}</p>
                      <span className="text-[10px] text-muted-foreground mt-1 block">{new Date(d.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <button onClick={() => deleteDiary(d.id)} className="p-1 text-destructive/50 hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Add Event Dialog */}
      <Dialog open={showAddEvent} onOpenChange={setShowAddEvent}>
        <DialogContent className="max-w-[95vw]">
          <DialogHeader><DialogTitle className="text-base">New Event</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Event title..." className="w-full px-3 py-2.5 bg-secondary border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none" />
            <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)..." rows={2} className="w-full px-3 py-2.5 bg-secondary border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none" />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground mb-1 block">Start</label>
                <input type="time" value={newStartTime} onChange={e => setNewStartTime(e.target.value)} className="w-full px-3 py-2 bg-secondary border border-border rounded-xl text-xs text-foreground" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground mb-1 block">End</label>
                <input type="time" value={newEndTime} onChange={e => setNewEndTime(e.target.value)} className="w-full px-3 py-2 bg-secondary border border-border rounded-xl text-xs text-foreground" />
              </div>
            </div>
            <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="w-full px-3 py-2.5 bg-secondary border border-border rounded-xl text-xs text-foreground">
              <option value="general">General</option>
              <option value="work">Work</option>
              <option value="personal">Personal</option>
              <option value="health">Health</option>
              <option value="social">Social</option>
              <option value="investigation">Investigation</option>
            </select>
            <button onClick={addEvent} className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">Add Event</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Diary Dialog */}
      <Dialog open={showAddDiary} onOpenChange={setShowAddDiary}>
        <DialogContent className="max-w-[95vw]">
          <DialogHeader><DialogTitle className="text-base">Diary Entry</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <input value={diaryTitle} onChange={e => setDiaryTitle(e.target.value)} placeholder="Title (optional)..." className="w-full px-3 py-2.5 bg-secondary border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none" />
            <div>
              <label className="text-[10px] text-muted-foreground mb-1.5 block">How are you feeling?</label>
              <div className="flex gap-2 flex-wrap">
                {MOODS.map(m => (
                  <button key={m} onClick={() => setDiaryMood(m === diaryMood ? "" : m)} className={`text-xl p-1.5 rounded-lg transition-all ${diaryMood === m ? "bg-primary/20 scale-110" : "hover:bg-secondary"}`}>{m}</button>
                ))}
              </div>
            </div>
            <textarea value={diaryContent} onChange={e => setDiaryContent(e.target.value)} placeholder="Write your thoughts..." rows={5} className="w-full px-3 py-2.5 bg-secondary border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none" />
            <select value={diaryCategory} onChange={e => setDiaryCategory(e.target.value)} className="w-full px-3 py-2.5 bg-secondary border border-border rounded-xl text-xs text-foreground">
              <option value="personal">Personal</option>
              <option value="work">Work Notes</option>
              <option value="investigation">Investigation</option>
              <option value="health">Health</option>
              <option value="gratitude">Gratitude</option>
              <option value="ideas">Ideas</option>
            </select>
            <button onClick={addDiary} className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">Save Entry</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarPage;
