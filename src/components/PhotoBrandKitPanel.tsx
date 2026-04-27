import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Loader2, Sparkles, Save, Upload, Trash2, Lock, Plus, ExternalLink,
  Instagram, Youtube, Facebook, Linkedin, Twitter, Globe2,
} from "lucide-react";

type SocialKey =
  | "instagram" | "tiktok" | "youtube" | "x" | "facebook"
  | "pinterest" | "linkedin" | "snapchat" | "threads" | "reddit";

const SOCIAL_PRESETS: { key: SocialKey; label: string; icon: any; aspect: string }[] = [
  { key: "instagram", label: "Instagram", icon: Instagram, aspect: "1:1" },
  { key: "tiktok", label: "TikTok", icon: Globe2, aspect: "9:16" },
  { key: "youtube", label: "YouTube", icon: Youtube, aspect: "16:9" },
  { key: "x", label: "X / Twitter", icon: Twitter, aspect: "16:9" },
  { key: "facebook", label: "Facebook", icon: Facebook, aspect: "1.91:1" },
  { key: "pinterest", label: "Pinterest", icon: Globe2, aspect: "2:3" },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin, aspect: "1.91:1" },
  { key: "snapchat", label: "Snapchat", icon: Globe2, aspect: "9:16" },
  { key: "threads", label: "Threads", icon: Globe2, aspect: "1:1" },
  { key: "reddit", label: "Reddit", icon: Globe2, aspect: "1:1" },
];

type Watermark = {
  text: string;
  position: "tl" | "tr" | "bl" | "br" | "center";
  opacity: number;
  link: string;
};

type BrandKit = {
  id?: string;
  brand_name: string;
  tagline: string;
  logo_url: string;
  custom_label: string;
  custom_link: string;
  primary_color: string;
  watermarks: Partial<Record<SocialKey, Watermark>>;
  hide_brand_watermark: boolean;
};

const EMPTY_KIT: BrandKit = {
  brand_name: "",
  tagline: "",
  logo_url: "",
  custom_label: "",
  custom_link: "",
  primary_color: "#FFD700",
  watermarks: {},
  hide_brand_watermark: false,
};

const GEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-gen`;

interface Props {
  currentImage: string | null;
  prompt: string;
  filter: string;
  mode: "generate" | "edit";
  onApplyTemplate?: (t: { prompt: string; filter: string; mode: "generate" | "edit"; social?: SocialKey }) => void;
}

const PhotoBrandKitPanel = ({ currentImage, prompt, filter, mode, onApplyTemplate }: Props) => {
  const { user } = useAuth();
  const [tab, setTab] = useState<"brand" | "watermarks" | "templates">("brand");
  const [kit, setKit] = useState<BrandKit>(EMPTY_KIT);
  const [savingKit, setSavingKit] = useState(false);
  const [generatingLogo, setGeneratingLogo] = useState(false);
  const [logoPrompt, setLogoPrompt] = useState("");

  const [templates, setTemplates] = useState<any[]>([]);
  const [quota, setQuota] = useState<{ template_count: number; unlocked: boolean; free_limit: number } | null>(null);
  const [tplName, setTplName] = useState("");
  const [tplSocial, setTplSocial] = useState<SocialKey | "">("");
  const [savingTpl, setSavingTpl] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  // Load brand kit + templates + quota
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [kitRes, tplRes, quotaRes] = await Promise.all([
        supabase.from("user_brand_kits").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("photography_templates").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.rpc("photo_template_quota", { _user_id: user.id }),
      ]);
      if (kitRes.data) setKit({ ...EMPTY_KIT, ...kitRes.data, watermarks: (kitRes.data.watermarks as any) || {} });
      if (tplRes.data) setTemplates(tplRes.data);
      if (quotaRes.data && Array.isArray(quotaRes.data) && quotaRes.data[0]) setQuota(quotaRes.data[0]);
    })();
  }, [user]);

  const refreshQuota = async () => {
    if (!user) return;
    const { data } = await supabase.rpc("photo_template_quota", { _user_id: user.id });
    if (data && Array.isArray(data) && data[0]) setQuota(data[0]);
  };

  const saveKit = async () => {
    if (!user) return;
    setSavingKit(true);
    const payload = { ...kit, user_id: user.id };
    delete (payload as any).id;
    const { error } = await supabase
      .from("user_brand_kits")
      .upsert(payload, { onConflict: "user_id" });
    setSavingKit(false);
    if (error) return toast.error(error.message);
    toast.success("Brand kit saved");
  };

  const generateLogo = async () => {
    if (!logoPrompt.trim() || !user) return;
    setGeneratingLogo(true);
    try {
      const resp = await fetch(GEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          prompt: `Minimalist professional logo, ${logoPrompt}, centered on solid white background, vector style, sharp edges, high contrast, 8K`,
        }),
      });
      const data = await resp.json();
      const url = data.images?.[0]?.image_url?.url;
      if (!url) throw new Error("No logo returned");
      setKit((k) => ({ ...k, logo_url: url }));
      toast.success("Logo generated — don't forget to save");
    } catch (e: any) {
      toast.error(e.message || "Logo generation failed");
    } finally {
      setGeneratingLogo(false);
    }
  };

  const uploadLogo = async (file: File) => {
    if (!user) return;
    const path = `${user.id}/logo-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("photography-assets").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("photography-assets").getPublicUrl(path);
    setKit((k) => ({ ...k, logo_url: data.publicUrl }));
    toast.success("Logo uploaded");
  };

  const updateWatermark = (key: SocialKey, patch: Partial<Watermark>) => {
    setKit((k) => ({
      ...k,
      watermarks: {
        ...k.watermarks,
        [key]: {
          text: kit.brand_name || "@yourbrand",
          position: "br",
          opacity: 0.7,
          link: kit.custom_link || "",
          ...k.watermarks?.[key],
          ...patch,
        },
      },
    }));
  };

  const saveTemplate = async () => {
    if (!user) return;
    if (!tplName.trim()) return toast.error("Template needs a name");
    if (!prompt.trim()) return toast.error("Write a prompt first to template it");
    if (quota && !quota.unlocked && quota.template_count >= quota.free_limit) {
      return toast.error("You've reached your 5 free templates. Unlock unlimited for $1.");
    }
    setSavingTpl(true);
    const { error, data } = await supabase
      .from("photography_templates")
      .insert({
        user_id: user.id,
        name: tplName.trim(),
        prompt,
        filter,
        mode,
        social_platform: tplSocial || null,
        watermark_config: tplSocial ? kit.watermarks?.[tplSocial as SocialKey] || {} : {},
      })
      .select()
      .single();
    setSavingTpl(false);
    if (error) return toast.error(error.message);
    setTemplates((t) => [data, ...t]);
    setTplName("");
    setTplSocial("");
    refreshQuota();
    toast.success("Template saved");
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from("photography_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setTemplates((t) => t.filter((x) => x.id !== id));
    refreshQuota();
  };

  const unlockUnlimited = async () => {
    setUnlocking(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-app-unlock", {
        body: { app_key: "photo_templates" },
      });
      if (error) throw error;
      const url = (data as any)?.url;
      if ((data as any)?.already_unlocked) {
        toast.success("Already unlocked");
        refreshQuota();
        return;
      }
      if (url) window.location.href = url;
    } catch (e: any) {
      toast.error(e.message || "Could not start checkout");
    } finally {
      setUnlocking(false);
    }
  };

  const remaining = quota ? Math.max(0, quota.free_limit - quota.template_count) : 0;
  const reachedLimit = !!quota && !quota.unlocked && quota.template_count >= quota.free_limit;

  return (
    <div className="bg-card border border-border rounded-xl p-3 mb-4">
      <div className="flex gap-2 mb-3">
        {(["brand", "watermarks", "templates"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "brand" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={kit.brand_name}
              onChange={(e) => setKit({ ...kit, brand_name: e.target.value })}
              placeholder="Brand name"
              className="px-3 py-2 rounded-lg bg-input border border-border text-sm"
            />
            <input
              value={kit.tagline}
              onChange={(e) => setKit({ ...kit, tagline: e.target.value })}
              placeholder="Tagline"
              className="px-3 py-2 rounded-lg bg-input border border-border text-sm"
            />
          </div>

          <div className="flex items-center gap-3">
            {kit.logo_url ? (
              <img src={kit.logo_url} alt="logo" className="w-16 h-16 rounded-lg object-contain bg-muted p-1" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                No logo
              </div>
            )}
            <div className="flex-1 space-y-2">
              <label className="block">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
                <span className="cursor-pointer inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-muted text-foreground border border-border">
                  <Upload className="w-3 h-3" /> Upload logo
                </span>
              </label>
            </div>
          </div>

          <div className="bg-muted rounded-lg p-2 space-y-2">
            <input
              value={logoPrompt}
              onChange={(e) => setLogoPrompt(e.target.value)}
              placeholder="Describe your dream logo (e.g. moon + camera)…"
              className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm"
            />
            <button
              onClick={generateLogo}
              disabled={generatingLogo || !logoPrompt.trim()}
              className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {generatingLogo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Generate logo with AI
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              value={kit.custom_label}
              onChange={(e) => setKit({ ...kit, custom_label: e.target.value })}
              placeholder="Custom label (e.g. ©Luna 2026)"
              className="px-3 py-2 rounded-lg bg-input border border-border text-sm"
            />
            <input
              value={kit.custom_link}
              onChange={(e) => setKit({ ...kit, custom_link: e.target.value })}
              placeholder="Link (https://…)"
              className="px-3 py-2 rounded-lg bg-input border border-border text-sm"
            />
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={kit.hide_brand_watermark}
              onChange={(e) => setKit({ ...kit, hide_brand_watermark: e.target.checked })}
              className="mt-0.5 accent-primary"
            />
            <div className="flex-1">
              <div className="text-xs font-semibold text-foreground">Hide major brand watermark</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Removes the large full-screen watermark from your exports. Per-platform watermarks still apply.
              </p>
            </div>
          </label>

          <button
            onClick={saveKit}
            disabled={savingKit}
            className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {savingKit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save brand kit
          </button>
        </div>
      )}

      {tab === "watermarks" && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          <p className="text-[11px] text-muted-foreground">
            Configure a unique watermark for each social network. The link is embedded with the export so viewers can tap back to your site.
          </p>
          {SOCIAL_PRESETS.map(({ key, label, icon: Icon, aspect }) => {
            const w = kit.watermarks?.[key];
            const enabled = !!w;
            return (
              <div key={key} className="border border-border rounded-lg p-2">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium flex-1">{label}</span>
                  <span className="text-[10px] text-muted-foreground">{aspect}</span>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => {
                      if (e.target.checked) {
                        updateWatermark(key, {});
                      } else {
                        const next = { ...kit.watermarks };
                        delete next[key];
                        setKit({ ...kit, watermarks: next });
                      }
                    }}
                  />
                </div>
                {enabled && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={w.text}
                      onChange={(e) => updateWatermark(key, { text: e.target.value })}
                      placeholder="Watermark text"
                      className="px-2 py-1.5 rounded bg-input border border-border text-xs"
                    />
                    <input
                      value={w.link}
                      onChange={(e) => updateWatermark(key, { link: e.target.value })}
                      placeholder="Link URL"
                      className="px-2 py-1.5 rounded bg-input border border-border text-xs"
                    />
                    <select
                      value={w.position}
                      onChange={(e) => updateWatermark(key, { position: e.target.value as Watermark["position"] })}
                      className="px-2 py-1.5 rounded bg-input border border-border text-xs"
                    >
                      <option value="tl">Top left</option>
                      <option value="tr">Top right</option>
                      <option value="bl">Bottom left</option>
                      <option value="br">Bottom right</option>
                      <option value="center">Center</option>
                    </select>
                    <input
                      type="number" min={0.1} max={1} step={0.05}
                      value={w.opacity}
                      onChange={(e) => updateWatermark(key, { opacity: Number(e.target.value) })}
                      className="px-2 py-1.5 rounded bg-input border border-border text-xs"
                    />
                  </div>
                )}
              </div>
            );
          })}
          <button
            onClick={saveKit}
            disabled={savingKit}
            className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
          >
            {savingKit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save watermark settings
          </button>
        </div>
      )}

      {tab === "templates" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {quota?.unlocked
                ? "✨ Unlimited templates unlocked"
                : `${quota?.template_count ?? 0}/${quota?.free_limit ?? 5} free templates used`}
            </span>
            {!quota?.unlocked && (
              <button
                onClick={unlockUnlimited}
                disabled={unlocking}
                className="text-[11px] px-2 py-1 rounded-md bg-gradient-to-r from-primary to-amber-500 text-primary-foreground font-semibold flex items-center gap-1 disabled:opacity-50"
              >
                {unlocking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
                Unlock unlimited $1
              </button>
            )}
          </div>

          {/* Save current as template */}
          <div className="bg-muted rounded-lg p-2 space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Save current setup as template</div>
            <input
              value={tplName}
              onChange={(e) => setTplName(e.target.value)}
              placeholder="Template name"
              className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm"
            />
            <select
              value={tplSocial}
              onChange={(e) => setTplSocial(e.target.value as SocialKey | "")}
              className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm"
            >
              <option value="">No specific platform</option>
              {SOCIAL_PRESETS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <button
              onClick={saveTemplate}
              disabled={savingTpl || reachedLimit}
              className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {savingTpl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {reachedLimit ? "Free limit reached — unlock to add more" : "Save template"}
            </button>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {templates.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-4">No templates yet — save your first one above.</div>
            )}
            {templates.map((t) => (
              <div key={t.id} className="flex items-center gap-2 p-2 border border-border rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {t.social_platform ? `${t.social_platform} · ` : ""}{t.prompt}
                  </div>
                </div>
                <button
                  onClick={() => onApplyTemplate?.({ prompt: t.prompt, filter: t.filter, mode: t.mode, social: t.social_platform })}
                  className="px-2 py-1 rounded-md bg-primary text-primary-foreground text-[11px] font-medium"
                >
                  Use
                </button>
                <button
                  onClick={() => deleteTemplate(t.id)}
                  className="p-1 rounded-md text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {kit.custom_link && (
            <a
              href={kit.custom_link}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1 text-[11px] text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" /> Preview your label link
            </a>
          )}
        </div>
      )}
    </div>
  );
};

export default PhotoBrandKitPanel;
