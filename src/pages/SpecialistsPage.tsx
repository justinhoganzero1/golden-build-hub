import { HeartHandshake, Star, Calendar, MessageCircle } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";

const specialists = [
  { name: "Dr. Sarah Chen", specialty: "Psychologist", rating: 4.9, available: true },
  { name: "Dr. James Wilson", specialty: "Life Coach", rating: 4.8, available: true },
  { name: "Dr. Maria Garcia", specialty: "Nutritionist", rating: 4.7, available: false },
  { name: "Dr. Alex Kim", specialty: "Therapist", rating: 4.9, available: true },
];

const SpecialistsPage = () => (
  <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-primary/10"><HeartHandshake className="w-7 h-7 text-primary" /></div>
        <div><h1 className="text-xl font-bold text-primary">Specialists</h1><p className="text-muted-foreground text-xs">Connect with professionals</p></div>
      </div>
      <div className="space-y-3">
        {specialists.map(s => (
          <div key={s.name} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">{s.name.split(" ").map(n => n[0]).join("")}</div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">{s.name}</h3>
                <p className="text-xs text-muted-foreground">{s.specialty}</p>
                <div className="flex items-center gap-1 mt-1"><Star className="w-3 h-3 text-primary fill-primary" /><span className="text-xs text-muted-foreground">{s.rating}</span></div>
              </div>
              <div className={`w-3 h-3 rounded-full ${s.available ? "bg-[hsl(var(--status-active))]" : "bg-muted"}`} />
            </div>
            <div className="flex gap-2">
              <button className="flex-1 py-2 bg-primary text-primary-foreground text-xs rounded-lg flex items-center justify-center gap-1"><MessageCircle className="w-3 h-3" /> Chat</button>
              <button className="flex-1 py-2 bg-secondary text-foreground text-xs rounded-lg flex items-center justify-center gap-1 border border-border"><Calendar className="w-3 h-3" /> Book</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default SpecialistsPage;
