import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, Save, Trash2, Upload, Megaphone, Plus, Edit3 } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { saveContent, deleteContent, fetchAllContent } from "@/hooks/useSiteContent";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";

/**
 * SOLACE Live Editor — admin-only.
 * Lets the owner change any registered text/image slot, manage the
 * site-wide announcement banner, and upload images to the public bucket.
 */

const REGISTERED_SLOTS: { page: string; slot: string; label: string; kind: "text" | "image"; fallback: string }[] = [
  // Landing page
  { page: "landing", slot: "hero_title", label: "Landing — Hero title", kind: "text", fallback: "SOLACE" },
  { page: "landing", slot: "hero_tagline", label: "Landing — Hero tagline", kind: "text", fallback: "Your personal AI super-app" },
  { page: "landing", slot: "hero_cta", label: "Landing — Primary button", kind: "text", fallback: "Get Started Free" },
  { page: "landing", slot: "free_trial_banner", label: "Landing — Free trial banner", kind: "text", fallback: "🎁 Sign up free — 30 days of full access, no card required" },
  // Dashboard
  { page: "dashboard", slot: "welcome_title", label: "Dashboard — Welcome title", kind: "text", fallback: "Welcome to SOLACE" },
  { page: "dashboard", slot: "welcome_subtitle", label: "Dashboard — Welcome subtitle", kind: "text", fallback: "Your 30 days of full Tier 3 access starts now" },
  // Subscribe
  { page: "subscribe", slot: "headline", label: "Subscribe — Headline", kind: "text", fallback: "Choose your plan" },
  { page: "subscribe", slot: "lifetime_promo", label: "Subscribe — Lifetime promo", kind: "text", fallback: "💎 $900 Lifetime Unlock — every premium feature, forever" },
  // Generic
  { page: "global", slot: "footer_tagline", label: "Footer tagline", kind: "text", fallback: "Built with love. Powered by SOLACE." },
];

const AdminEditorPage = () => {
  const { isAdmin, loading } = useIsAdmin();
  const { toast } = useToast();
  const [tab, setTab] = useState<"content" | "announcement" | "images">("content");
  const [values, setValues] = useState<Record<string, string>>({});
  const [savingSlot, setSavingSlot] = useState<string | null>(null);

  // Announcement state
  const [annMessage, setAnnMessage] = useState("");
  const [annCtaLabel, setAnnCtaLabel] = useState("");
  const [annCtaUrl, setAnnCtaUrl] = useState("");
  const [annStyle, setAnnStyle] = useState("info");
  const [annActive, setAnnActive] = useState(false);
  const [annId, setAnnId] = useState<string | null>(null);

  // Images
  const [uploadedImages, setUploadedImages] = useState<{ name: string; url: string }[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const rows = await fetchAllContent();
      const map: Record<string, string> = {};
      rows.forEach((r: any) => {
        map[`${r.page}::${r.slot}`] = r.value;
      });
      setValues(map);

      const { data: ann } = await supabase
        .from("site_announcements")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ann) {
        setAnnId(ann.id);
        setAnnMessage(ann.message);
        setAnnCtaLabel(ann.cta_label || "");
        setAnnCtaUrl(ann.cta_url || "");
        setAnnStyle(ann.style);
        setAnnActive(ann.active);
      }

      const { data: files } = await supabase.storage.from("site-assets").list("", { limit: 100 });
      const list = (files || []).map((f) => {
        const { data } = supabase.storage.from("site-assets").getPublicUrl(f.name);
        return { name: f.name, url: data.publicUrl };
      });
      setUploadedImages(list);
    })();
  }, [isAdmin]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const handleSave = async (page: string, slot: string, kind: "text" | "image") => {
    const k = `${page}::${slot}`;
    setSavingSlot(k);
    try {
      await saveContent(page, slot, values[k] ?? "", kind);
      toast({ title: "Saved", description: `${page} → ${slot} updated live.` });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSavingSlot(null);
    }
  };

  const handleReset = async (page: string, slot: string, fallback: string) => {
    await deleteContent(page, slot);
    setValues((v) => ({ ...v, [`${page}::${slot}`]: fallback }));
    toast({ title: "Reset", description: "Reverted to default." });
  };

  const saveAnnouncement = async () => {
    const payload = {
      message: annMessage,
      cta_label: annCtaLabel || null,
      cta_url: annCtaUrl || null,
      style: annStyle,
      active: annActive,
    };
    if (annId) {
      const { error } = await supabase.from("site_announcements").update(payload).eq("id", annId);
      if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      const { data, error } = await supabase.from("site_announcements").insert(payload).select().single();
      if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
      if (data) setAnnId(data.id);
    }
    toast({ title: "Banner updated", description: annActive ? "Live for all visitors." : "Saved (inactive)." });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = `${Date.now()}-${file.name.replace(/[^a-z0-9.-]/gi, "_")}`;
    const { error } = await supabase.storage.from("site-assets").upload(fileName, file, { upsert: false });
    if (error) return toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    const { data } = supabase.storage.from("site-assets").getPublicUrl(fileName);
    setUploadedImages((imgs) => [{ name: fileName, url: data.publicUrl }, ...imgs]);
    toast({ title: "Uploaded", description: "Copy the URL and paste it into any image slot." });
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: "Copied", description: "Image URL copied." });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO title="SOLACE Live Editor — Admin" description="Edit site content live" />
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-bold text-lg flex items-center gap-2">
          <Edit3 className="w-5 h-5 text-primary" /> Live Editor
        </h1>
        <span className="ml-auto text-[11px] text-muted-foreground">Changes go live instantly</span>
      </header>

      <div className="px-4 py-3 flex gap-2 border-b border-border overflow-x-auto">
        {(["content", "announcement", "images"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-sm capitalize whitespace-nowrap ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {tab === "content" && (
          <>
            <p className="text-xs text-muted-foreground">
              Edit any text on the site. Saves are instant for all visitors and installed apps.
            </p>
            {REGISTERED_SLOTS.map((s) => {
              const k = `${s.page}::${s.slot}`;
              const current = values[k] ?? s.fallback;
              return (
                <div key={k} className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold">{s.label}</label>
                    <span className="text-[10px] text-muted-foreground">{s.page}/{s.slot}</span>
                  </div>
                  <textarea
                    value={current}
                    onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
                    className="w-full rounded-lg bg-background border border-border p-2 text-sm min-h-[60px]"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSave(s.page, s.slot, s.kind)}
                      disabled={savingSlot === k}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
                    >
                      <Save className="w-3 h-3" /> {savingSlot === k ? "Saving…" : "Save live"}
                    </button>
                    <button
                      onClick={() => handleReset(s.page, s.slot, s.fallback)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs"
                    >
                      <Trash2 className="w-3 h-3" /> Reset to default
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {tab === "announcement" && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary" />
              <h2 className="font-semibold">Site-wide announcement banner</h2>
            </div>
            <input
              value={annMessage}
              onChange={(e) => setAnnMessage(e.target.value)}
              placeholder="Banner message"
              className="w-full rounded-lg bg-background border border-border p-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={annCtaLabel}
                onChange={(e) => setAnnCtaLabel(e.target.value)}
                placeholder="Button label (optional)"
                className="rounded-lg bg-background border border-border p-2 text-sm"
              />
              <input
                value={annCtaUrl}
                onChange={(e) => setAnnCtaUrl(e.target.value)}
                placeholder="Button link e.g. /subscribe"
                className="rounded-lg bg-background border border-border p-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={annStyle}
                onChange={(e) => setAnnStyle(e.target.value)}
                className="rounded-lg bg-background border border-border p-2 text-sm"
              >
                <option value="info">Info (blue)</option>
                <option value="success">Success (green)</option>
                <option value="warning">Warning (amber)</option>
                <option value="promo">Promo (gradient)</option>
              </select>
              <label className="flex items-center gap-2 text-sm ml-auto">
                <input
                  type="checkbox"
                  checked={annActive}
                  onChange={(e) => setAnnActive(e.target.checked)}
                />
                Active (show to everyone)
              </label>
            </div>
            <button
              onClick={saveAnnouncement}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm"
            >
              Save banner
            </button>
          </div>
        )}

        {tab === "images" && (
          <div className="space-y-3">
            <label className="block rounded-xl border-2 border-dashed border-primary/50 bg-card p-6 text-center cursor-pointer">
              <Upload className="w-6 h-6 text-primary mx-auto mb-2" />
              <span className="text-sm">Upload image to site assets</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              {uploadedImages.map((img) => (
                <div key={img.name} className="rounded-lg border border-border bg-card p-2 space-y-1">
                  <img src={img.url} alt={img.name} className="w-full h-24 object-cover rounded" />
                  <button
                    onClick={() => copyUrl(img.url)}
                    className="w-full text-[10px] px-2 py-1 rounded bg-muted hover:bg-muted/80"
                  >
                    Copy URL
                  </button>
                </div>
              ))}
              {uploadedImages.length === 0 && (
                <p className="col-span-2 text-xs text-muted-foreground text-center py-6">
                  No images uploaded yet.
                </p>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              💡 Paste any copied URL into a text/image slot in the Content tab to swap an image live.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminEditorPage;
