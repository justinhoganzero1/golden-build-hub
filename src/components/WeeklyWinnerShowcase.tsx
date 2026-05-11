import { useEffect, useState } from "react";
import winnerPhoto from "@/assets/winner-photo-week.jpg";
import { Trophy, Sparkles, Medal, Image as ImageIcon, BookOpen, Video, Palette } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Featured {
  image_url: string;
  title: string | null;
  creator_name: string | null;
  rank: number;
  category: string;
}

type Category = "photo" | "story" | "video" | "art" | "general";

const CATEGORIES: { id: Category; label: string; icon: LucideIcon }[] = [
  { id: "photo",   label: "Photo",   icon: ImageIcon },
  { id: "story",   label: "Story",   icon: BookOpen },
  { id: "video",   label: "Video",   icon: Video },
  { id: "art",     label: "Art",     icon: Palette },
  { id: "general", label: "General", icon: Sparkles },
];

const cinematic = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&h=760&q=90`;

const DEMO_PODIUM: Record<Category, Record<number, Featured>> = {
  photo: {
    1: { image_url: winnerPhoto, title: "Moonlit Empress", creator_name: "Aurora Vex", rank: 1, category: "photo" },
    2: { image_url: cinematic("1531746020798-e6953c6e8e04"), title: "Velvet Saint", creator_name: "Kiyan Mori", rank: 2, category: "photo" },
    3: { image_url: cinematic("1524504388940-b1c1722653e1"), title: "Golden Aura", creator_name: "Lumi Park", rank: 3, category: "photo" },
  },
  story: {
    1: { image_url: cinematic("1419242902214-272b3f66ee7a"), title: "The Gilded Comet", creator_name: "Nyx Rivers", rank: 1, category: "story" },
    2: { image_url: cinematic("1448375240586-882707db888b"), title: "Hymn of the Wolf", creator_name: "Sable Quinn", rank: 2, category: "story" },
    3: { image_url: cinematic("1528360983277-13d401cdc186"), title: "Paper Lanterns", creator_name: "Ren Iwata", rank: 3, category: "story" },
  },
  video: {
    1: { image_url: cinematic("1451187580459-43490279c0fa"), title: "Echoes of Mars", creator_name: "Dax Halberg", rank: 1, category: "video" },
    2: { image_url: cinematic("1493514789931-586cb221d7a7"), title: "Last Light", creator_name: "Mira Solé", rank: 2, category: "video" },
    3: { image_url: cinematic("1518972559570-7cc1309f3229"), title: "Neon Rain", creator_name: "Jonas Vrij", rank: 3, category: "video" },
  },
  art: {
    1: { image_url: cinematic("1495103033382-fe343886b671"), title: "Phoenix Bloom", creator_name: "Iris Vohr", rank: 1, category: "art" },
    2: { image_url: cinematic("1465146344425-f00d5f5c8f07"), title: "Glass Garden", creator_name: "Theo Rask", rank: 2, category: "art" },
    3: { image_url: cinematic("1522383225653-ed111181a951"), title: "Neon Sakura", creator_name: "Coco Ling", rank: 3, category: "art" },
  },
  general: {
    1: { image_url: cinematic("1488426862026-3ee34a7d66df"), title: "Solar Empress", creator_name: "Vega Kade", rank: 1, category: "general" },
    2: { image_url: cinematic("1495474472287-4d71bcdd2085"), title: "Halo Coffee", creator_name: "Jules Aren", rank: 2, category: "general" },
    3: { image_url: cinematic("1517292987719-0369a794ec0f"), title: "Pocket Habit Tracker", creator_name: "Mako Kira", rank: 3, category: "general" },
  },
};

const WeeklyWinnerShowcase = () => {
  const [byCat, setByCat] = useState<Record<Category, Record<number, Featured>>>({
    photo: {}, story: {}, video: {}, art: {}, general: {},
  });
  const [category, setCategory] = useState<Category>("photo");

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("featured_photos")
      .select("image_url, title, creator_name, rank, category")
      .eq("active", true)
      .order("rank", { ascending: true })
      .then(({ data }) => {
        if (cancelled || !data) return;
        const map: Record<Category, Record<number, Featured>> = {
          photo: {}, story: {}, video: {}, art: {}, general: {},
        };
        (data as Featured[]).forEach((row) => {
          const cat = (row?.category || "photo") as Category;
          if (row?.rank && map[cat]) map[cat][row.rank] = row as Featured;
        });
        setByCat(map);
      });
    return () => { cancelled = true; };
  }, []);

  const podium = { ...DEMO_PODIUM[category], ...byCat[category] };
  const first = podium[1];
  const second = podium[2];
  const third = podium[3];
  const imageSrc = first?.image_url || winnerPhoto;
  const winnerName = first?.creator_name || "Oracle Lunar Creator";
  const winnerTitle = first?.title;
  const catLabel = CATEGORIES.find((c) => c.id === category)!.label;

  return (
    <section className="max-w-5xl mx-auto px-4 py-16">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary mb-3">
          <Trophy className="h-3.5 w-3.5" /> Yearly Creative Competition
        </div>
        <h2 className="text-3xl md:text-4xl font-bold">
          This Month's <span className="text-primary">{catLabel}</span> Champion
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          12 monthly winners per category earn discounted paywalls all year.
          The grand yearly champion in each category wins
          <span className="text-primary font-semibold"> lifetime free studio access — no paywalls, forever.</span>
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex justify-center gap-1.5 mb-6 flex-wrap">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const active = category === c.id;
              const filled = Object.keys({ ...DEMO_PODIUM[c.id], ...byCat[c.id] }).length > 0;
          return (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-all flex items-center gap-1.5 ${
                active
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {c.label}
              {filled && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
            </button>
          );
        })}
      </div>

      {/* Futuristic Laptop */}
      <div className="relative mx-auto" style={{ maxWidth: 760 }}>
        <div
          aria-hidden="true"
          className="absolute -inset-10 blur-3xl opacity-60 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, hsl(var(--primary) / 0.35) 0%, transparent 70%)",
          }}
        />
        <div
          className="relative rounded-t-2xl p-3 border border-primary/40 shadow-[0_0_40px_hsl(var(--primary)/0.4)]"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)",
          }}
        >
          <div className="flex justify-center mb-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary/60" />
          </div>

          <div className="relative aspect-[16/10] rounded-lg overflow-hidden border border-primary/30 bg-black">
            <img
              src={imageSrc}
              alt={winnerTitle || `This month's winning ${catLabel.toLowerCase()} by an Oracle Lunar member`}
              loading="lazy"
              width={1024}
              height={640}
              className="absolute inset-0 w-full h-full object-contain bg-black"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none opacity-10 mix-blend-overlay"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 3px)",
              }}
            />
          </div>

          <div className="mt-3 rounded-lg border border-primary/40 bg-gradient-to-r from-primary/15 via-amber-500/15 to-primary/15 px-3 py-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.25em] text-foreground">
                  {catLabel} · Monthly Winner · Discounted Paywalls
                </span>
              </div>
              <span className="text-[10px] md:text-xs font-bold text-primary">
                · Yearly Champion: Lifetime Free ·
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] uppercase tracking-widest text-primary/80 font-bold shrink-0">🏆</span>
                <span className="text-xs md:text-sm font-bold text-foreground truncate">
                  {winnerName}
                </span>
              </div>
              <div className="text-[10px] md:text-xs font-bold text-primary">
                Discounted studio access this month
              </div>
            </div>
          </div>
        </div>

        <div
          className="mx-auto h-3 rounded-b-2xl border-x border-b border-primary/30"
          style={{
            width: "108%",
            marginLeft: "-4%",
            background:
              "linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--muted)) 100%)",
          }}
        />
        <div
          className="mx-auto h-1 rounded-b-full bg-primary/20"
          style={{ width: "30%" }}
        />
      </div>

      {(second || third) && (
        <div className="max-w-3xl mx-auto mt-8 grid grid-cols-2 gap-4">
          {[
            { row: second, rank: 2, label: "2nd", color: "text-zinc-200", border: "border-zinc-300/60" },
            { row: third, rank: 3, label: "3rd", color: "text-orange-300", border: "border-orange-400/60" },
          ].map(({ row, rank, label, color, border }) => (
            <div key={rank} className={`rounded-xl overflow-hidden border ${border} bg-card/60 backdrop-blur-sm`}>
              <div className="aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
                {row ? (
                  <img
                    src={row.image_url}
                    alt={row.title || `${label} place ${catLabel} winner`}
                    loading="lazy"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground italic">Awaiting pick</span>
                )}
              </div>
              <div className="px-3 py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Medal className={`h-4 w-4 shrink-0 ${color}`} />
                  <span className={`text-xs font-bold uppercase tracking-widest ${color}`}>{label}</span>
                  <span className="text-xs text-foreground truncate ml-1">
                    {row?.creator_name || "—"}
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-primary whitespace-nowrap">
                  Discounted paywalls
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default WeeklyWinnerShowcase;
