import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface VisitorCounterProps {
  page?: string;
}

/**
 * Lightweight live visitor counter for the public landing page.
 * - Records one page view per browser session (sessionStorage guard).
 * - Reads total count from the public.page_views table.
 */
const VisitorCounter = ({ page = "landing" }: VisitorCounterProps) => {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const recordAndFetch = async () => {
      try {
        const sessionKey = `solace-visit-${page}`;
        if (!sessionStorage.getItem(sessionKey)) {
          await supabase.from("page_views").insert({
            page,
            user_agent: navigator.userAgent.slice(0, 200),
          });
          sessionStorage.setItem(sessionKey, "1");
        }
        const { count: total } = await supabase
          .from("page_views")
          .select("*", { count: "exact", head: true })
          .eq("page", page);
        if (!cancelled && typeof total === "number") setCount(total);
      } catch {
        // silent — counter is non-critical
      }
    };

    recordAndFetch();
    const interval = window.setInterval(recordAndFetch, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [page]);

  if (count === null) return null;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/80 backdrop-blur px-3 py-1.5 text-xs text-muted-foreground">
      <Eye className="h-3.5 w-3.5 text-primary" />
      <span className="font-semibold text-foreground">{count.toLocaleString()}</span>
      <span>visitors</span>
    </div>
  );
};

export default VisitorCounter;
