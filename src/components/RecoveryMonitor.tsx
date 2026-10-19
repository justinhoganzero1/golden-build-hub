import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Alerts contain category-only data; no prompts, tokens or private manuscript text. */
export default function RecoveryMonitor() {
  useEffect(() => {
    const syncFailure = () => toast.warning("Account sync paused. This device’s saved conversation is retained.");
    window.addEventListener("oracle:sync-failed", syncFailure);
    const seen = new Set<string>();
    let stopped = false;
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || stopped) return;
      const { data: admin } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
      if (admin !== true || stopped) return;
      const { data: incidents } = await supabase.from("system_incidents").select("id,summary").is("acknowledged_at", null).order("created_at", { ascending: false }).limit(10);
      for (const incident of incidents ?? []) {
        if (stopped || seen.has(incident.id)) continue;
        seen.add(incident.id);
        toast.warning(incident.summary, { duration: 10000, action: { label: "Review", onClick: () => window.location.assign("/diagnostics") } });
      }
    };
    void check().catch(() => undefined);
    const timer = window.setInterval(() => { void check().catch(() => undefined); }, 60000);
    return () => { stopped = true; clearInterval(timer); window.removeEventListener("oracle:sync-failed", syncFailure); };
  }, []);
  return null;
}