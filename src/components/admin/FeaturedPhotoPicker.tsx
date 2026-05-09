import { useEffect, useState } from "react";
import { Trophy, Loader2, Check, Medal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface PublicPhoto {
  id: string;
  title: string | null;
  url: string;
  thumbnail_url: string | null;
  creator_display_name: string | null;
}

type Rank = 1 | 2 | 3;

const RANK_META: Record<Rank, { label: string; color: string; ring: string; chip: string }> = {
  1: { label: "1st", color: "text-amber-300", ring: "border-amber-400 shadow-[0_0_20px_hsl(45_100%_50%/0.5)]", chip: "bg-amber-400 text-amber-950" },
  2: { label: "2nd", color: "text-zinc-200", ring: "border-zinc-300 shadow-[0_0_18px_hsl(0_0%_85%/0.4)]", chip: "bg-zinc-200 text-zinc-900" },
  3: { label: "3rd", color: "text-orange-300", ring: "border-orange-400 shadow-[0_0_18px_hsl(25_90%_55%/0.4)]", chip: "bg-orange-400 text-orange-950" },
};

const FeaturedPhotoPicker = () => {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<PublicPhoto[]>([]);
  /** mediaId -> rank (1/2/3) */
  const [activeByRank, setActiveByRank] = useState<Record<number, string>>({});
  const [selectedRank, setSelectedRank] = useState<Rank>(1);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [photosRes, featuredRes] = await Promise.all([
      supabase
        .from("user_media")
        .select("id, title, url, thumbnail_url, creator_display_name")
        .eq("is_public", true)
        .in("media_type", ["image", "photo"])
        .order("created_at", { ascending: false })
        .limit(120),
      supabase
        .from("featured_photos")
        .select("media_id, rank")
        .eq("active", true),
    ]);
    setPhotos((photosRes.data as any) || []);
    const map: Record<number, string> = {};
    ((featuredRes.data as any[]) || []).forEach((r) => {
      if (r?.rank && r?.media_id) map[r.rank] = r.media_id;
    });
    setActiveByRank(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const pick = async (p: PublicPhoto) => {
    if (!user) return;
    setSavingId(p.id);
    try {
      // Deactivate any previous pick for THIS rank only
      await supabase
        .from("featured_photos")
        .update({ active: false })
        .eq("active", true)
        .eq("rank", selectedRank);

      const { error } = await supabase.from("featured_photos").insert({
        media_id: p.id,
        source_kind: "user_media",
        image_url: p.url,
        title: p.title,
        creator_name: p.creator_display_name,
        active: true,
        rank: selectedRank,
        created_by: user.id,
      } as any);
      if (error) throw error;
      setActiveByRank((prev) => ({ ...prev, [selectedRank]: p.id }));
      toast.success(`${RANK_META[selectedRank].label} place set.`);
    } catch (e: any) {
      toast.error(e?.message || "Could not set winner.");
    } finally {
      setSavingId(null);
    }
  };

  const clearRank = async (r: Rank) => {
    await supabase
      .from("featured_photos")
      .update({ active: false })
      .eq("active", true)
      .eq("rank", r);
    setActiveByRank((prev) => {
      const next = { ...prev };
      delete next[r];
      return next;
    });
    toast.success(`${RANK_META[r].label} place cleared.`);
  };

  const rankForPhoto = (id: string): Rank | null => {
    if (activeByRank[1] === id) return 1;
    if (activeByRank[2] === id) return 2;
    if (activeByRank[3] === id) return 3;
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-amber-500/10 to-primary/10 border border-amber-500/30 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-foreground">Monthly Podium · 1st / 2nd / 3rd</h3>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mb-3">
        Pick the prize tier, then tap a public user photo to award it. The 1st-place winner is the
        feature; 2nd & 3rd appear on the podium below.
      </p>

      {/* Rank selector */}
      <div className="flex gap-2 mb-3">
        {([1, 2, 3] as Rank[]).map((r) => {
          const m = RANK_META[r];
          const active = selectedRank === r;
          const filled = !!activeByRank[r];
          return (
            <button
              key={r}
              onClick={() => setSelectedRank(r)}
              className={`flex-1 px-3 py-2 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                active
                  ? "border-amber-400 bg-amber-400/15 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <Medal className={`w-3.5 h-3.5 ${m.color}`} />
              {m.label}
              {filled && <Check className="w-3 h-3 text-emerald-400" />}
            </button>
          );
        })}
      </div>

      {/* Current podium */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {([1, 2, 3] as Rank[]).map((r) => {
          const id = activeByRank[r];
          const photo = photos.find((p) => p.id === id);
          const m = RANK_META[r];
          return (
            <div
              key={r}
              className="rounded-lg border border-border bg-card/50 p-2 flex flex-col items-center gap-1 min-h-[88px]"
            >
              <span className={`text-[10px] font-bold uppercase tracking-widest ${m.color}`}>
                {m.label}
              </span>
              {photo ? (
                <>
                  <img
                    src={photo.thumbnail_url || photo.url}
                    alt={photo.title || ""}
                    className="w-full aspect-square rounded object-cover"
                  />
                  <button
                    onClick={() => clearRank(r)}
                    className="text-[10px] text-muted-foreground hover:text-destructive underline"
                  >
                    Clear
                  </button>
                </>
              ) : (
                <span className="text-[10px] text-muted-foreground italic flex-1 flex items-center">
                  Empty
                </span>
              )}
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
        </div>
      ) : photos.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          No public photos yet. Users opt in by ticking "Share publicly" when they create a photo.
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[480px] overflow-y-auto">
          {photos.map((p) => {
            const r = rankForPhoto(p.id);
            const busy = savingId === p.id;
            const m = r ? RANK_META[r] : null;
            return (
              <button
                key={p.id}
                onClick={() => pick(p)}
                disabled={busy}
                className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
                  m ? m.ring : "border-transparent hover:border-amber-400/50"
                }`}
                title={`Tap to award ${RANK_META[selectedRank].label} place`}
              >
                <img
                  src={p.thumbnail_url || p.url}
                  alt={p.title || "Public photo"}
                  loading="lazy"
                  className="w-full aspect-square object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                {busy && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                  <p className="text-[9px] text-white truncate">
                    {p.creator_display_name || "Member"}
                  </p>
                </div>
                {m && (
                  <div className={`absolute top-1 left-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold flex items-center gap-0.5 ${m.chip}`}>
                    <Medal className="w-2.5 h-2.5" /> {m.label}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FeaturedPhotoPicker;
