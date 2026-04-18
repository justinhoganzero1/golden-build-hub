import { useEffect, useState } from "react";
import { Shield, Loader2, Phone, FileText, Save, Download, Sparkles } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jsPDF from "jspdf";

type Provider = "hostplus" | "workcover_qld";

interface ClaimData {
  id?: string;
  provider: Provider;
  claim_type: string;
  full_name?: string;
  date_of_birth?: string;
  address?: string;
  phone?: string;
  email?: string;
  member_number?: string;
  employer?: string;
  job_title?: string;
  employment_start?: string;
  injury_date?: string;
  injury_description?: string;
  body_parts?: string;
  doctor_name?: string;
  doctor_phone?: string;
  hospital?: string;
  workcover_claim_number?: string;
  last_worked_date?: string;
  income_amount?: string;
  super_member_number?: string;
  notes?: string;
  ai_draft?: string;
  ai_research?: any;
}

const PROVIDERS: Record<Provider, { label: string; phone: string; type: string }> = {
  hostplus: { label: "HostPlus (Income Protection)", phone: "1300 467 875", type: "income_protection" },
  workcover_qld: { label: "WorkCover Queensland", phone: "1300 362 128", type: "workers_compensation" },
};

const FIELDS: { key: keyof ClaimData; label: string; type?: string; full?: boolean }[] = [
  { key: "full_name", label: "Full legal name" },
  { key: "date_of_birth", label: "Date of birth", type: "date" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email", type: "email" },
  { key: "address", label: "Home address", full: true },
  { key: "member_number", label: "Member / policy number" },
  { key: "employer", label: "Employer" },
  { key: "job_title", label: "Job title" },
  { key: "employment_start", label: "Employment start", type: "date" },
  { key: "injury_date", label: "Injury date", type: "date" },
  { key: "last_worked_date", label: "Last day worked", type: "date" },
  { key: "body_parts", label: "Body parts injured" },
  { key: "injury_description", label: "How the injury happened", full: true },
  { key: "doctor_name", label: "Treating doctor" },
  { key: "doctor_phone", label: "Doctor phone" },
  { key: "hospital", label: "Hospital / clinic" },
  { key: "workcover_claim_number", label: "WorkCover claim # (if any)" },
  { key: "income_amount", label: "Pre-injury weekly income" },
  { key: "super_member_number", label: "Super member #" },
];

export default function ClaimsAssistantPage() {
  const [provider, setProvider] = useState<Provider>("hostplus");
  const [claim, setClaim] = useState<ClaimData>({ provider: "hostplus", claim_type: "income_protection" });
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState<string | null>(null);

  useEffect(() => { load(provider); }, [provider]);

  const load = async (p: Provider) => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase.from("user_claims").select("*").eq("user_id", user.id).eq("provider", p).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (data) setClaim(data as ClaimData);
    else setClaim({ provider: p, claim_type: PROVIDERS[p].type });
    setLoading(false);
  };

  const setField = (k: keyof ClaimData, v: string) => setClaim(c => ({ ...c, [k]: v }));

  const save = async () => {
    setWorking("save");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Sign in first"); setWorking(null); return; }
    const payload = { ...claim, user_id: user.id, provider, claim_type: PROVIDERS[provider].type };
    const { data, error } = claim.id
      ? await supabase.from("user_claims").update(payload).eq("id", claim.id).select().single()
      : await supabase.from("user_claims").insert(payload).select().single();
    if (error) toast.error(error.message); else { setClaim(data as ClaimData); toast.success("Saved"); }
    setWorking(null);
  };

  const callAi = async (action: "research" | "draft") => {
    setWorking(action);
    try {
      if (!claim.id && action === "draft") await save();
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claims-assistant`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ action, provider, claim_id: claim.id, claim_data: claim }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (action === "draft") {
        setClaim(c => ({ ...c, ai_draft: data.draft, ai_research: data.research }));
        toast.success("Draft generated");
      } else {
        setClaim(c => ({ ...c, ai_research: data }));
        toast.success(`Found ${data.links?.length || 0} resources`);
      }
    } catch (e: any) { toast.error(e.message); }
    setWorking(null);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    const margin = 15;
    let y = margin;
    doc.setFontSize(16);
    doc.text(`${PROVIDERS[provider].label} — Claim`, margin, y); y += 10;
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y); y += 10;

    doc.setFontSize(12); doc.text("Claimant details", margin, y); y += 6;
    doc.setFontSize(10);
    FIELDS.forEach(f => {
      const v = (claim as any)[f.key] || "[TO CONFIRM]";
      const line = `${f.label}: ${v}`;
      const split = doc.splitTextToSize(line, 180);
      if (y + split.length * 5 > 280) { doc.addPage(); y = margin; }
      doc.text(split, margin, y); y += split.length * 5 + 1;
    });

    if (claim.ai_draft) {
      doc.addPage(); y = margin;
      doc.setFontSize(14); doc.text("Claim letter", margin, y); y += 8;
      doc.setFontSize(10);
      const split = doc.splitTextToSize(claim.ai_draft, 180);
      split.forEach((line: string) => {
        if (y > 280) { doc.addPage(); y = margin; }
        doc.text(line, margin, y); y += 5;
      });
    }
    doc.save(`${provider}-claim.pdf`);
    toast.success("PDF downloaded");
  };

  const callProvider = async () => {
    const phone = PROVIDERS[provider].phone.replace(/\s/g, "");
    window.location.href = `tel:${phone}`;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Shield className="w-7 h-7 text-primary" /></div>
          <div>
            <h1 className="text-xl font-bold text-primary">Claims Assistant</h1>
            <p className="text-muted-foreground text-xs">HostPlus + WorkCover QLD pay protection</p>
          </div>
        </div>

        {/* Provider tabs */}
        <div className="flex gap-2 mb-4">
          {(Object.keys(PROVIDERS) as Provider[]).map(p => (
            <button key={p} onClick={() => setProvider(p)}
              className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold border ${provider === p ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground"}`}>
              {PROVIDERS[p].label}
            </button>
          ))}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button onClick={callProvider} className="bg-card border border-border rounded-xl p-3 flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-primary" /> Call {PROVIDERS[provider].phone}
          </button>
          <button onClick={() => callAi("research")} disabled={!!working} className="bg-card border border-border rounded-xl p-3 flex items-center gap-2 text-sm disabled:opacity-50">
            {working === "research" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-primary" />} Research forms
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Form */}
            <div className="bg-card border border-border rounded-xl p-4 mb-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Your details (encrypted, only you see this)</h3>
              <div className="grid grid-cols-2 gap-2">
                {FIELDS.map(f => (
                  <div key={f.key} className={f.full ? "col-span-2" : ""}>
                    <label className="text-[10px] text-muted-foreground">{f.label}</label>
                    <input
                      type={f.type || "text"}
                      value={(claim as any)[f.key] || ""}
                      onChange={e => setField(f.key, e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-input border border-border text-foreground text-xs outline-none focus:border-primary"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Research results */}
            {claim.ai_research?.links?.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4 mb-4">
                <h3 className="text-sm font-semibold text-foreground mb-2">Official resources</h3>
                <ul className="space-y-1">
                  {claim.ai_research.links.map((l: any, i: number) => (
                    <li key={i}><a href={l.url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">{l.title}</a></li>
                  ))}
                </ul>
              </div>
            )}

            {/* Draft */}
            {claim.ai_draft && (
              <div className="bg-card border border-border rounded-xl p-4 mb-4">
                <h3 className="text-sm font-semibold text-foreground mb-2">AI-drafted claim letter</h3>
                <textarea
                  value={claim.ai_draft}
                  onChange={e => setField("ai_draft", e.target.value)}
                  className="w-full h-64 px-3 py-2 rounded-lg bg-input border border-border text-foreground text-xs outline-none focus:border-primary font-mono"
                />
              </div>
            )}

            {/* Bottom actions */}
            <div className="grid grid-cols-3 gap-2">
              <button onClick={save} disabled={!!working} className="bg-card border border-border rounded-xl p-3 flex flex-col items-center gap-1 text-xs disabled:opacity-50">
                {working === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-primary" />} Save
              </button>
              <button onClick={() => callAi("draft")} disabled={!!working} className="bg-primary text-primary-foreground rounded-xl p-3 flex flex-col items-center gap-1 text-xs font-semibold disabled:opacity-50">
                {working === "draft" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Draft letter
              </button>
              <button onClick={exportPdf} disabled={!claim.ai_draft && !claim.full_name} className="bg-card border border-border rounded-xl p-3 flex flex-col items-center gap-1 text-xs disabled:opacity-50">
                <Download className="w-4 h-4 text-primary" /> Export PDF
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
