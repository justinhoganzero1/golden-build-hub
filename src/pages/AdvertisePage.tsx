import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Megaphone, Send, Loader2, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";

const schema = z.object({
  company: z.string().trim().min(1, "Company is required").max(200),
  contact_name: z.string().trim().min(1, "Your name is required").max(120),
  email: z.string().trim().email("Valid email required").max(255),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  website: z.string().trim().max(300).optional().or(z.literal("")),
  budget: z.string().trim().max(80).optional().or(z.literal("")),
  ad_type: z.string().trim().max(80).optional().or(z.literal("")),
  message: z.string().trim().min(10, "Tell us a little about your campaign").max(2000),
});

const AD_TYPES = ["Banner", "Sponsored Tile", "Newsletter", "In-App Promo", "Partnership", "Other"];
const BUDGETS = ["Under $500", "$500 – $2,000", "$2,000 – $10,000", "$10,000+"];

const AdvertisePage = () => {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    company: "",
    contact_name: "",
    email: "",
    phone: "",
    website: "",
    budget: "",
    ad_type: "",
    message: "",
  });

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Please fix the form", description: parsed.error.issues[0]?.message ?? "Invalid input", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("advertiser_inquiries").insert({
      company: parsed.data.company,
      contact_name: parsed.data.contact_name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      website: parsed.data.website || null,
      budget: parsed.data.budget || null,
      ad_type: parsed.data.ad_type || null,
      message: parsed.data.message,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Could not send", description: error.message, variant: "destructive" });
      return;
    }
    setDone(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="Advertise on ORACLE LUNAR — Reach engaged AI super-app users"
        description="Promote your brand on ORACLE LUNAR. Sponsored tiles, banners, newsletter & in-app promos to a high-intent AI audience."
        path="/advertise"
      />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-primary text-primary-foreground mb-4">
            <Megaphone className="w-7 h-7" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Advertise on ORACLE LUNAR</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Reach a high-intent audience using AI tools every day. Tell us about your campaign and we&apos;ll get back to you within 1 business day.
          </p>
        </div>

        {done ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-3" />
            <h2 className="text-xl font-semibold mb-2">Thanks — we got it.</h2>
            <p className="text-muted-foreground">
              Your inquiry was sent to the ORACLE LUNAR team. We&apos;ll reach out at <span className="text-foreground font-medium">{form.email}</span> shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Company *">
                <input className={inputCls} required value={form.company} onChange={update("company")} />
              </Field>
              <Field label="Your name *">
                <input className={inputCls} required value={form.contact_name} onChange={update("contact_name")} />
              </Field>
              <Field label="Email *">
                <input type="email" className={inputCls} required value={form.email} onChange={update("email")} />
              </Field>
              <Field label="Phone">
                <input className={inputCls} value={form.phone} onChange={update("phone")} />
              </Field>
              <Field label="Website">
                <input className={inputCls} placeholder="https://" value={form.website} onChange={update("website")} />
              </Field>
              <Field label="Monthly budget">
                <select className={inputCls} value={form.budget} onChange={update("budget")}>
                  <option value="">Select…</option>
                  {BUDGETS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </Field>
              <Field label="Ad type" className="md:col-span-2">
                <select className={inputCls} value={form.ad_type} onChange={update("ad_type")}>
                  <option value="">Select…</option>
                  {AD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Tell us about your campaign *">
              <textarea
                className={`${inputCls} min-h-[140px] resize-y`}
                required
                value={form.message}
                onChange={update("message")}
                placeholder="What are you promoting, target audience, timing, creative format…"
              />
            </Field>
            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-primary text-primary-foreground px-6 py-3 font-semibold shadow-lg shadow-primary/30 hover:scale-[1.01] transition-transform disabled:opacity-60"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {submitting ? "Sending…" : "Send inquiry"}
            </button>
            <p className="text-xs text-muted-foreground text-center">
              By submitting you agree to our{" "}
              <Link to="/privacy-policy" className="underline">privacy policy</Link>.
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40";

const Field = ({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) => (
  <label className={`block ${className ?? ""}`}>
    <span className="block text-xs font-medium text-muted-foreground mb-1">{label}</span>
    {children}
  </label>
);

export default AdvertisePage;
