import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Download, TrendingUp } from "lucide-react";

/**
 * Real social proof bar. Pulls live counts from page_views and install_events.
 * No fake numbers — only displays real data, with graceful fallback if empty.
 */
export default function RealSocialProof() {
  const [visitors24h, setVisitors24h] = useState<number | null>(null);
  const [installs7d, setInstalls7d] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [pv, ie] = await Promise.all([
        supabase.from("page_views").select("id", { count: "exact", head: true }).gte("created_at", since24h),
        supabase.from("install_events").select("id", { count: "exact", head: true }).eq("event_type", "installed").gte("created_at", since7d),
      ]);
      setVisitors24h(pv.count ?? 0);
      setInstalls7d(ie.count ?? 0);
    })();
  }, []);

  if (visitors24h === null) return null;
  // Only render if we have real signal
  if (visitors24h < 3 && installs7d! < 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
      {visitors24h >= 3 && (
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border">
          <Users className="w-3.5 h-3.5 text-primary" />
          <b className="text-foreground">{visitors24h.toLocaleString()}</b> visitors today
        </span>
      )}
      {installs7d! >= 1 && (
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border">
          <Download className="w-3.5 h-3.5 text-primary" />
          <b className="text-foreground">{installs7d!.toLocaleString()}</b> installs this week
        </span>
      )}
      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border">
        <TrendingUp className="w-3.5 h-3.5 text-primary" />
        Live data
      </span>
    </div>
  );
}
