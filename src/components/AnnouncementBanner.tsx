import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Announcement = {
  id: string;
  message: string;
  cta_label: string | null;
  cta_url: string | null;
  style: string;
};

const DISMISS_KEY = "solace-announcement-dismissed-";

const styleMap: Record<string, string> = {
  info: "bg-primary/15 border-primary/40 text-foreground",
  warning: "bg-amber-500/15 border-amber-500/40 text-foreground",
  success: "bg-emerald-500/15 border-emerald-500/40 text-foreground",
  promo: "bg-gradient-to-r from-primary/30 to-amber-500/30 border-primary/50 text-foreground",
};

export const AnnouncementBanner = () => {
  const [ann, setAnn] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("site_announcements")
      .select("*")
      .eq("active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setAnn((data as Announcement) || null);
    if (data && localStorage.getItem(DISMISS_KEY + (data as Announcement).id)) {
      setDismissed(true);
    } else {
      setDismissed(false);
    }
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("site_announcements_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_announcements" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  if (!ann || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY + ann.id, "1");
    setDismissed(true);
  };

  return (
    <div
      className={`w-full border-b ${styleMap[ann.style] || styleMap.info} px-4 py-2 text-sm flex items-center justify-center gap-3 relative`}
      role="status"
    >
      <span className="font-medium">{ann.message}</span>
      {ann.cta_label && ann.cta_url && (
        <Link
          to={ann.cta_url}
          className="underline font-semibold text-primary hover:opacity-80"
        >
          {ann.cta_label}
        </Link>
      )}
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss announcement"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default AnnouncementBanner;
