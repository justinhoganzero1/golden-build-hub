import { useState, useEffect } from "react";
import { Radar, MapPin, Navigation, Search, Layers, AlertTriangle } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";

interface Place { name: string; type: string; distance: string; lat: number; lng: number; }

const RadarDemoPage = () => {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(loc);
          // Generate nearby places based on real location
          const types = ["Restaurant", "Cafe", "Hospital", "Police", "Gas Station", "Park", "School", "Pharmacy", "Gym", "Bank", "Library", "Shopping"];
          const generated: Place[] = types.map((type, i) => ({
            name: `${type} near you`,
            type,
            distance: `${(0.1 + Math.random() * 2).toFixed(1)} mi`,
            lat: loc.lat + (Math.random() - 0.5) * 0.02,
            lng: loc.lng + (Math.random() - 0.5) * 0.02,
          }));
          setPlaces(generated);
          setLoading(false);
        },
        () => {
          toast.error("Location access needed for Radar");
          setLoading(false);
        }
      );
    }
  }, []);

  const filtered = filter === "all" ? places : places.filter(p => p.type.toLowerCase().includes(filter));

  const openInMaps = (p: Place) => {
    window.open(`https://www.google.com/maps/search/${encodeURIComponent(p.type)}/@${p.lat},${p.lng},15z`, "_blank");
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Radar className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">Radar</h1><p className="text-muted-foreground text-xs">Live map & nearby discovery</p></div>
        </div>

        {/* Map */}
        {location ? (
          <div className="rounded-xl overflow-hidden border border-border mb-4 relative">
            <iframe
              src={`https://www.google.com/maps?q=${location.lat},${location.lng}&z=15&output=embed`}
              className="w-full h-48"
              loading="lazy"
              title="Your Location"
            />
            <div className="absolute top-2 right-2 bg-card/90 px-2 py-1 rounded-lg border border-border">
              <p className="text-[9px] text-primary flex items-center gap-1"><Navigation className="w-3 h-3" /> {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>
            </div>
          </div>
        ) : (
          <div className="h-48 bg-card border border-border rounded-xl flex items-center justify-center mb-4">
            {loading ? <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <p className="text-sm text-muted-foreground">Enable location access</p>}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {["all", "restaurant", "hospital", "police", "pharmacy", "gas"].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${filter === f ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Radar Animation */}
        <div className="w-32 h-32 mx-auto rounded-full border-2 border-primary/30 flex items-center justify-center mb-4 relative">
          <div className="w-20 h-20 rounded-full border border-primary/20 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border border-primary/10 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-primary animate-ping" />
            </div>
          </div>
          {places.slice(0, 4).map((_, i) => (
            <div key={i} className={`absolute w-2 h-2 rounded-full bg-[hsl(var(--status-active))]`}
              style={{ top: `${15 + i * 15}%`, left: `${20 + i * 18}%` }} />
          ))}
        </div>

        {/* Nearby List */}
        <h2 className="text-sm font-semibold text-foreground mb-3">Nearby ({filtered.length})</h2>
        <div className="space-y-2">
          {filtered.map((p, i) => (
            <button key={i} onClick={() => openInMaps(p)} className="w-full flex items-center gap-3 bg-card border border-border rounded-xl p-4 text-left hover:border-primary transition-colors">
              <div className="p-2 rounded-lg bg-primary/10"><MapPin className="w-4 h-4 text-primary" /></div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.type}</p>
              </div>
              <span className="text-xs text-primary">{p.distance}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
export default RadarDemoPage;
