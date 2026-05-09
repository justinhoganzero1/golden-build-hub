import { useEffect, useState } from "react";
import winnerPhoto from "@/assets/winner-photo-week.jpg";
import { Trophy, Sparkles, Medal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Featured {
  image_url: string;
  title: string | null;
  creator_name: string | null;
  rank: number;
}

/**
 * Futuristic laptop screen displaying the admin-picked monthly podium
 * (1st = featured big, 2nd & 3rd shown below).
 */
const WeeklyWinnerShowcase = () => {
  const [podium, setPodium] = useState<Record<number, Featured>>({});

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("featured_photos")
      .select("image_url, title, creator_name, rank")
      .eq("active", true)
      .order("rank", { ascending: true })
      .then(({ data }) => {
        if (cancelled || !data) return;
        const map: Record<number, Featured> = {};
        (data as any[]).forEach((row) => {
          if (row?.rank) map[row.rank] = row as Featured;
        });
        setPodium(map);
      });
    return () => { cancelled = true; };
  }, []);

  const first = podium[1];
  const second = podium[2];
  const third = podium[3];
  const imageSrc = first?.image_url || winnerPhoto;
  const winnerName = first?.creator_name || 'Zephyrina "MoonQuill" Vexbloom';
  const winnerTitle = first?.title;


  return (
    <section className="max-w-5xl mx-auto px-4 py-16">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary mb-3">
          <Trophy className="h-3.5 w-3.5" /> Yearly Photo Competition
        </div>
        <h2 className="text-3xl md:text-4xl font-bold">
          This Month's <span className="text-primary">Creative Photo</span> Champion
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          12 monthly winners earn discounted paywalls all year. The grand yearly champion wins
          <span className="text-primary font-semibold"> lifetime free studio access — no paywalls, forever.</span>
        </p>
      </div>

      {/* Futuristic Laptop */}
      <div className="relative mx-auto" style={{ maxWidth: 760 }}>
        {/* Ambient glow */}
        <div
          aria-hidden="true"
          className="absolute -inset-10 blur-3xl opacity-60 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, hsl(var(--primary) / 0.35) 0%, transparent 70%)",
          }}
        />

        {/* Laptop screen bezel */}
        <div
          className="relative rounded-t-2xl p-3 border border-primary/40 shadow-[0_0_40px_hsl(var(--primary)/0.4)]"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)",
          }}
        >
          {/* Webcam dot */}
          <div className="flex justify-center mb-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary/60" />
          </div>

          {/* Screen */}
          <div className="relative aspect-[16/10] rounded-lg overflow-hidden border border-primary/30 bg-black">
            <img
              src={imageSrc}
              alt={winnerTitle || "This month's winning creative photo by an Oracle Lunar member"}
              loading="lazy"
              width={1024}
              height={640}
              className="absolute inset-0 w-full h-full object-contain bg-black"
            />

            {/* Scanline overlay (subtle, doesn't hide image) */}
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none opacity-10 mix-blend-overlay"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 3px)",
              }}
            />
          </div>

          {/* Banner — under the photo */}
          <div className="mt-3 rounded-lg border border-primary/40 bg-gradient-to-r from-primary/15 via-amber-500/15 to-primary/15 px-3 py-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.25em] text-foreground">
                  Monthly Winner · Discounted Paywalls
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

        {/* Laptop base */}
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

      {/* 2nd & 3rd place podium */}
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
                    alt={row.title || `${label} place winner`}
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
