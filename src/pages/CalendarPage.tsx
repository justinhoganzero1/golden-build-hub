import { useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Plus, Clock } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";

const events = [
  { time: "9:00 AM", title: "Team Standup", color: "bg-primary/10 border-primary/30" },
  { time: "11:30 AM", title: "Doctor Appointment", color: "bg-destructive/10 border-destructive/30" },
  { time: "2:00 PM", title: "Project Review", color: "bg-primary/10 border-primary/30" },
  { time: "5:00 PM", title: "Gym Session", color: "bg-[hsl(var(--status-active))]/10 border-[hsl(var(--status-active))]/30" },
];

const CalendarPage = () => {
  const [selectedDay, setSelectedDay] = useState(8);
  const days = Array.from({ length: 30 }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Calendar className="w-7 h-7 text-primary" /></div>
          <div className="flex-1"><h1 className="text-xl font-bold text-primary">Calendar</h1></div>
          <button className="p-2 rounded-full bg-primary text-primary-foreground"><Plus className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center justify-between mb-3">
          <button className="p-1"><ChevronLeft className="w-5 h-5 text-primary" /></button>
          <h2 className="text-sm font-semibold text-foreground">April 2026</h2>
          <button className="p-1"><ChevronRight className="w-5 h-5 text-primary" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-4 text-center">
          {["S","M","T","W","T","F","S"].map((d, i) => <div key={i} className="text-[10px] text-muted-foreground py-1">{d}</div>)}
          {[0, 0, 0].map((_, i) => <div key={`e${i}`} />)}
          {days.map(d => (
            <button key={d} onClick={() => setSelectedDay(d)}
              className={`w-9 h-9 rounded-full text-xs flex items-center justify-center mx-auto transition-colors ${d === selectedDay ? "bg-primary text-primary-foreground font-bold" : "text-foreground hover:bg-secondary"}`}>{d}</button>
          ))}
        </div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Events — April {selectedDay}</h2>
        <div className="space-y-2">
          {events.map(e => (
            <div key={e.title} className={`flex items-center gap-3 rounded-xl p-3 border ${e.color}`}>
              <Clock className="w-4 h-4 text-muted-foreground" />
              <div><p className="text-sm text-foreground font-medium">{e.title}</p><p className="text-xs text-muted-foreground">{e.time}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
