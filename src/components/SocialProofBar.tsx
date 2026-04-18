import { useEffect, useState } from "react";
import { Eye, Zap, Shield, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Live social-proof strip — boosts trust + conversion.
 * Pulls real visitor count from page_views; cycles trust badges.
 */
const SocialProofBar = () => {
  const [visitors, setVisitors] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const { count } = await supabase
          .from("page_views")
          .select("*", { count: "exact", head: true })
          .eq("page", "landing");
        if (!cancelled && typeof count === "number") setVisitors(count);
      } catch { /* silent */ }
    };
    fetchCount();
    const t = window.setInterval(fetchCount, 30_000);
    return () => { cancelled = true; window.clearInterval(t); };
  }, []);

  const badges = [
    { icon: Eye, label: visitors ? `${visitors.toLocaleString()} visitors today` : "Live audience" },
    { icon: Zap, label: "AI-powered · 40+ modules" },
    { icon: Shield, label: "Bank-grade security · 101 AI guards" },
    { icon: Users, label: "Built by users, for users" },
  ];

  return (
    <div className="w-full border-y border-primary/20 bg-card/40 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
        {badges.map(({ icon: Icon, label }) => (
          <div key={label} className="inline-flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 text-primary animate-pulse" />
            <span className="font-medium text-foreground/90">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SocialProofBar;
