import { useEffect, useState } from "react";
import {
  Activity, RefreshCw, Calendar, CreditCard, AlertTriangle,
  CheckCircle2, XCircle, ArrowRightLeft, PauseCircle, PlayCircle, Clock,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import OracleMoonHeader from "@/components/OracleMoonHeader";

interface TimelineEvent {
  id: string;
  type: string;
  kind: string;
  title: string;
  detail: string;
  created: number;
  created_iso: string;
}
interface TimelineData {
  customer: { id: string; email: string } | null;
  events: TimelineEvent[];
}

const ICON: Record<string, JSX.Element> = {
  created: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  canceled: <XCircle className="h-4 w-4 text-rose-400" />,
  cancel_scheduled: <AlertTriangle className="h-4 w-4 text-amber-400" />,
  cancel_reverted: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  plan_switch: <ArrowRightLeft className="h-4 w-4 text-amber-400" />,
  status_change: <Activity className="h-4 w-4 text-amber-400" />,
  trial_ending: <Clock className="h-4 w-4 text-amber-400" />,
  paused: <PauseCircle className="h-4 w-4 text-amber-400" />,
  resumed: <PlayCircle className="h-4 w-4 text-emerald-400" />,
  renewed: <CreditCard className="h-4 w-4 text-emerald-400" />,
  payment_failed: <AlertTriangle className="h-4 w-4 text-rose-400" />,
  checkout: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  other: <Activity className="h-4 w-4 text-muted-foreground" />,
};

export default function SubscriptionTimelinePage() {
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("subscription-timeline");
      if (error) throw error;
      setData(res as TimelineData);
    } catch (e) {
      toast.error("Could not load timeline", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <>
      <SEO
        title="Subscription Timeline | Oracle Lunar"
        description="Chronological view of your subscription: plan switches, renewals and cancellations."
      />
      <OracleMoonHeader />
      <main className="min-h-screen bg-background pt-24 pb-16 px-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Activity className="h-7 w-7 text-amber-400" /> Subscription Timeline
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Plan switches, renewals and cancellations from Stripe.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/subscription"><CreditCard className="h-4 w-4 mr-1" />Status</Link>
              </Button>
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {loading && !data && (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
              Loading timeline…
            </div>
          )}

          {!loading && data && data.events.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium">No subscription events yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                {data.customer
                  ? "We'll show plan changes and renewals here as they happen."
                  : "No Stripe customer linked to your account yet."}
              </p>
            </div>
          )}

          {data && data.events.length > 0 && (
            <ol className="relative border-l border-border ml-3 space-y-5">
              {data.events.map((ev) => (
                <li key={ev.id} className="ml-6">
                  <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-card border border-border">
                    {ICON[ev.kind] ?? ICON.other}
                  </span>
                  <div className="rounded-lg border border-border bg-card/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-medium">{ev.title}</h3>
                      <time className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(ev.created_iso).toLocaleString()}
                      </time>
                    </div>
                    {ev.detail && (
                      <p className="text-sm text-muted-foreground mt-1">{ev.detail}</p>
                    )}
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mt-2">
                      {ev.type}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </main>
    </>
  );
}
