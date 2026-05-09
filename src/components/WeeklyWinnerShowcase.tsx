import { useEffect, useState } from "react";
import winnerPhoto from "@/assets/winner-photo-week.jpg";
import { Trophy, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Featured {
  image_url: string;
  title: string | null;
  creator_name: string | null;
}

/**
 * Futuristic laptop screen displaying the admin-picked Photo of the Month
 * (falls back to the default winner asset).
 */
const WeeklyWinnerShowcase = () => {
  const [featured, setFeatured] = useState<Featured | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("featured_photos")
      .select("image_url, title, creator_name")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setFeatured(data as Featured);
      });
    return () => { cancelled = true; };
  }, []);

  const imageSrc = featured?.image_url || winnerPhoto;
  const winnerName = featured?.creator_name || 'Zephyrina "MoonQuill" Vexbloom';
  const winnerTitle = featured?.title;

  return (
    <section className="max-w-5xl mx-auto px-4 py-16">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary mb-3">
          <Trophy className="h-3.5 w-3.5" /> Winner of the Week
        </div>
        <h2 className="text-3xl md:text-4xl font-bold">
          This Week's <span className="text-primary">Creative Photo</span> Champion
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Every week one creator wins lifetime free studio access. No paywalls. Forever.
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
              alt={winnerTitle || "This week's winning creative photo by an Oracle Lunar member"}
              loading="lazy"
              width={1024}
              height={640}
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Scanline overlay */}
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none opacity-20 mix-blend-overlay"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 3px)",
              }}
            />

            {/* HUD corners */}
            <div className="absolute top-2 left-2 text-[10px] font-mono text-primary/80 tracking-widest">
              ◉ LIVE · WEEK 19
            </div>
            <div className="absolute top-2 right-2 text-[10px] font-mono text-primary/80 tracking-widest">
              ORACLE://STUDIO
            </div>

            {/* Diagonal Ribbon */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div
                className="absolute top-8 -right-16 rotate-[28deg] px-20 py-2 text-center shadow-2xl border-y-2 border-amber-300"
                style={{
                  background:
                    "linear-gradient(90deg, hsl(var(--primary)) 0%, #f5c542 50%, hsl(var(--primary)) 100%)",
                }}
              >
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-background flex items-center justify-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Lifetime Free Photo Studio
                  <Sparkles className="h-3 w-3" />
                </div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-background/90">
                  · No Paywalls · Forever ·
                </div>
              </div>
            </div>

            {/* Winner card overlay (bottom) */}
            <div className="absolute bottom-0 left-0 right-0 backdrop-blur-md bg-background/70 border-t border-primary/40 p-3 md:p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-primary/80 font-bold">
                    🏆 Congratulations
                  </div>
                  <div className="text-base md:text-lg font-bold text-foreground">
                    Zephyrina "MoonQuill" Vexbloom
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    z█████████a@█████.com
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Prize
                  </div>
                  <div className="text-sm font-bold text-primary">
                    Lifetime Studio · $0 forever
                  </div>
                </div>
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

      <p className="text-center text-[11px] text-muted-foreground mt-6 italic">
        Winner's email partially hidden to protect their privacy.
      </p>
    </section>
  );
};

export default WeeklyWinnerShowcase;
