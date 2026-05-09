import { useEffect, useState } from "react";
import { Trophy, Loader2, Check, Star } from "lucide-react";
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

const FeaturedPhotoPicker = () => {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<PublicPhoto[]>([]);
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
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
        .select("media_id")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setPhotos((photosRes.data as any) || []);
    setActiveMediaId((featuredRes.data as any)?.media_id || null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const pick = async (p: PublicPhoto) => {
    if (!user) return;
    setSavingId(p.id);
    try {
      // Deactivate previous picks
      await supabase.from("featured_photos").update({ active: false }).eq("active", true);
      const { error } = await supabase.from("featured_photos").insert({
        media_id: p.id,
        source_kind: "user_media",
        image_url: p.url,
        title: p.title,
        creator_name: p.creator_display_name,
        active: true,
        created_by: user.id,
      });
      if (error) throw error;
      setActiveMediaId(p.id);
      toast.success("Photo of the Month updated.");
    } catch (e: any) {
      toast.error(e?.message || "Could not set featured photo.");
    } finally {
      setSavingId(null);
    }
  };

  const clear = async () => {
    await supabase.from("featured_photos").update({ active: false }).eq("active", true);
    setActiveMediaId(null);
    toast.success("Featured photo cleared.");
  };

  return (
    <div className="bg-gradient-to-br from-amber-500/10 to-primary/10 border border-amber-500/30 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-foreground">Photo of the Month</h3>
        </div>
        {activeMediaId && (
          <button
            onClick={clear}
            className="text-[11px] text-muted-foreground hover:text-foreground underline"
          >
            Clear pick
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        Tick any user-shared public photo below to feature it on the landing page winner showcase.
      </p>
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
        </div>
      ) : photos.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          No public photos yet. Users need to opt in by toggling "Share to Public Library" on a creation.
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[480px] overflow-y-auto">
          {photos.map((p) => {
            const isActive = activeMediaId === p.id;
            const busy = savingId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => pick(p)}
                disabled={busy}
                className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
                  isActive
                    ? "border-amber-400 shadow-[0_0_20px_hsl(45_100%_50%/0.4)]"
                    : "border-transparent hover:border-amber-400/50"
                }`}
                title={p.title || ""}
              >
                <img
                  src={p.thumbnail_url || p.url}
                  alt={p.title || "Public photo"}
                  loading="lazy"
                  className="w-full aspect-square object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                {isActive && (
                  <div className="absolute top-1 right-1 bg-amber-400 text-amber-950 rounded-full p-1">
                    <Check className="w-3 h-3" />
                  </div>
                )}
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
                {isActive && (
                  <div className="absolute top-1 left-1 bg-amber-400/90 text-amber-950 rounded-full px-1.5 py-0.5 text-[8px] font-bold flex items-center gap-0.5">
                    <Star className="w-2.5 h-2.5 fill-current" /> FEATURED
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
