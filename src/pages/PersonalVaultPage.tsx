import { useEffect, useState } from "react";
import { Shield, Lock, Save, FileText, User, Briefcase, Stethoscope, Building2, CreditCard, Eye, EyeOff } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type ClaimRow = {
  id?: string;
  full_name?: string | null;
  date_of_birth?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  bank_account?: string | null;
  super_member_number?: string | null;
  member_number?: string | null;
  workcover_claim_number?: string | null;
  employer?: string | null;
  job_title?: string | null;
  employment_start?: string | null;
  income_amount?: string | null;
  last_worked_date?: string | null;
  injury_date?: string | null;
  injury_description?: string | null;
  body_parts?: string | null;
  hospital?: string | null;
  doctor_name?: string | null;
  doctor_phone?: string | null;
  notes?: string | null;
  provider?: string;
  claim_type?: string;
};

const SECTIONS = [
  {
    key: "identity",
    label: "Identity",
    icon: User,
    fields: [
      ["full_name", "Full legal name", "text"],
      ["date_of_birth", "Date of birth", "date"],
      ["email", "Email", "email"],
      ["phone", "Phone", "tel"],
      ["address", "Residential address", "text"],
    ],
  },
  {
    key: "finance",
    label: "Finance",
    icon: CreditCard,
    sensitive: true,
    fields: [
      ["bank_account", "Bank account (BSB / Acc)", "text"],
      ["income_amount", "Pre-injury income (weekly)", "text"],
    ],
  },
  {
    key: "super",
    label: "Super / Insurer",
    icon: Building2,
    sensitive: true,
    fields: [
      ["super_member_number", "HostPlus member number", "text"],
      ["member_number", "Other insurer member #", "text"],
      ["workcover_claim_number", "WorkCover QLD claim #", "text"],
    ],
  },
  {
    key: "work",
    label: "Employment",
    icon: Briefcase,
    fields: [
      ["employer", "Employer", "text"],
      ["job_title", "Job title", "text"],
      ["employment_start", "Employment start date", "date"],
      ["last_worked_date", "Last day worked", "date"],
    ],
  },
  {
    key: "medical",
    label: "Medical",
    icon: Stethoscope,
    sensitive: true,
    fields: [
      ["injury_date", "Injury date", "date"],
      ["injury_description", "Injury description", "textarea"],
      ["body_parts", "Body parts affected", "text"],
      ["hospital", "Hospital / clinic", "text"],
      ["doctor_name", "Treating doctor", "text"],
      ["doctor_phone", "Doctor phone", "tel"],
    ],
  },
] as const;

const PersonalVaultPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<ClaimRow>({ provider: "hostplus", claim_type: "income_protection" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const { data: rows } = await supabase
        .from("user_claims")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (rows && rows[0]) setData(rows[0] as ClaimRow);
      setLoading(false);
    })();
  }, [user]);

  const update = (k: keyof ClaimRow, v: string) => setData((d) => ({ ...d, [k]: v }));

  const save = async () => {
    if (!user) { toast.error("Sign in required"); return; }
    setSaving(true);
    try {
      const payload = { ...data, user_id: user.id, provider: data.provider || "hostplus", claim_type: data.claim_type || "income_protection" };
      if (data.id) {
        const { error } = await supabase.from("user_claims").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { data: ins, error } = await supabase.from("user_claims").insert(payload).select().single();
        if (error) throw error;
        if (ins) setData(ins as ClaimRow);
      }
      toast.success("Saved securely to your private vault");
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <UniversalBackButton />

      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-primary/10">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-primary">Personal Vault</h1>
            <p className="text-muted-foreground text-xs">Private claim & identity details — encrypted, private to you</p>
          </div>
          <button
            onClick={() => setRevealed((r) => !r)}
            className="p-2 rounded-lg bg-card border border-border text-muted-foreground"
            aria-label={revealed ? "Hide" : "Reveal"}
          >
            {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border mt-3">
          <Lock className="w-3 h-3 text-primary" />
          <span className="text-xs text-muted-foreground">RLS encrypted • Used by Oracle to auto-fill claims & calls</span>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.key} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{section.label}</h3>
                {("sensitive" in section && section.sensitive) ? (
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">Sensitive</span>
                ) : null}
              </div>
              <div className="space-y-2">
                {section.fields.map(([key, label, type]) => {
                  const k = key as keyof ClaimRow;
                  const value = (data[k] as string) || "";
                  const masked = "sensitive" in section && section.sensitive && !revealed && value;
                  if (type === "textarea") {
                    return (
                      <div key={key}>
                        <label className="text-[11px] text-muted-foreground">{label}</label>
                        <textarea
                          value={value}
                          onChange={(e) => update(k, e.target.value)}
                          rows={3}
                          className="w-full mt-1 px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm outline-none"
                        />
                      </div>
                    );
                  }
                  return (
                    <div key={key}>
                      <label className="text-[11px] text-muted-foreground">{label}</label>
                      <input
                        type={type as string}
                        value={masked ? "••••••••" : value}
                        onChange={(e) => update(k, e.target.value)}
                        onFocus={(e) => { if (masked) e.currentTarget.value = value; }}
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm outline-none"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Notes</h3>
          </div>
          <textarea
            value={data.notes || ""}
            onChange={(e) => update("notes", e.target.value)}
            rows={3}
            placeholder="Anything else Oracle should know about your claim…"
            className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="py-3 rounded-lg bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Vault"}
          </button>
          <button
            onClick={() => navigate("/claims-assistant")}
            className="py-3 rounded-lg bg-card border border-border text-foreground font-bold text-sm"
          >
            Open Claims Assistant
          </button>
        </div>
      </div>
    </div>
  );
};

export default PersonalVaultPage;
