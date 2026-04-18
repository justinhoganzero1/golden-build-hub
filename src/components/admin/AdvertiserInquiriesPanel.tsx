import { useEffect, useState } from "react";
import { Mail, Phone, Globe, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Inquiry = {
  id: string;
  company: string;
  contact_name: string;
  email: string;
  phone: string | null;
  website: string | null;
  budget: string | null;
  ad_type: string | null;
  message: string;
  status: string;
  created_at: string;
};

const STATUSES = ["new", "contacted", "negotiating", "won", "lost"];

export const AdvertiserInquiriesPanel = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("advertiser_inquiries")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast({ title: "Could not load", description: error.message, variant: "destructive" });
      return;
    }
    setItems((data ?? []) as Inquiry[]);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("advertiser_inquiries").update({ status }).eq("id", id);
    if (error) return toast({ title: "Update failed", description: error.message, variant: "destructive" });
    setItems((p) => p.map((i) => (i.id === id ? { ...i, status } : i)));
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this inquiry?")) return;
    const { error } = await supabase.from("advertiser_inquiries").delete().eq("id", id);
    if (error) return toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    setItems((p) => p.filter((i) => i.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Advertiser Inquiries</h2>
          <p className="text-sm text-muted-foreground">Submissions from <code>/advertise</code></p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No advertiser inquiries yet.</div>
      ) : (
        <div className="space-y-3">
          {items.map((i) => (
            <div key={i.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{i.company}</div>
                  <div className="text-sm text-muted-foreground">{i.contact_name} · {new Date(i.created_at).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={i.status}
                    onChange={(e) => updateStatus(i.id, e.target.value)}
                    className="text-xs rounded-md border border-border bg-background px-2 py-1"
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => remove(i.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive" aria-label="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <a href={`mailto:${i.email}`} className="inline-flex items-center gap-1 hover:underline"><Mail className="w-3.5 h-3.5" /> {i.email}</a>
                {i.phone && <a href={`tel:${i.phone}`} className="inline-flex items-center gap-1 hover:underline"><Phone className="w-3.5 h-3.5" /> {i.phone}</a>}
                {i.website && <a href={i.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline"><Globe className="w-3.5 h-3.5" /> {i.website}</a>}
                {i.budget && <span className="text-muted-foreground">Budget: {i.budget}</span>}
                {i.ad_type && <span className="text-muted-foreground">Type: {i.ad_type}</span>}
              </div>
              <p className="mt-2 text-sm whitespace-pre-wrap">{i.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdvertiserInquiriesPanel;
