import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Sparkles, Save, Share2, Copy, User, Wand2, Globe2, Lock, ArrowLeft, ShoppingBag, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { generateImage, InsufficientCreditsError } from "@/lib/imageGen";
import ImmersiveFPSViewer from "@/components/ImmersiveFPSViewer";
import SEO from "@/components/SEO";

/**
 * RealmBuilderPage — Phase 1 foundation of the CAD-style Realm Builder.
 *
 * User flow:
 *  1. Describe the realm (text prompt, e.g. "Neon Tokyo rooftop at dusk, 8K photoreal").
 *  2. Oracle generates an 8K equirectangular panoramic skybox via Gemini 3 Pro.
 *  3. Pick or generate an avatar (from user_avatars).
 *  4. Walk inside the realm (FPS controls: WASD + mouse look).
 *  5. Save the realm, optionally publish a public shareable link.
 *
 * Future phases will add: drag-and-drop prop placement, CAD primitives
 * (box/sphere/cylinder + extrude/boolean), Public Library publishing with
 * Stripe Connect payouts (70/30), and multi-user co-walk sessions.
 */

interface Avatar {
  id: string;
  name: string | null;
  image_url: string;
}

interface RealmRow {
  id: string;
  title: string;
  prompt: string | null;
  skybox_url: string | null;
  avatar_url: string | null;
  avatar_id: string | null;
  is_public: boolean;
  share_slug: string | null;
  created_at: string;
}

// Wraps user prompt with maximum-realism panoramic directives for the FPS
// viewer (equirectangular sphere texture). Pushes the model toward
// indistinguishable-from-reality DSLR capture, within legal/safety limits.
function buildSkyboxPrompt(userPrompt: string): string {
  const clean = userPrompt.trim().replace(/\s+/g, " ");
  return (
    `Ultra-photorealistic 8K 360° equirectangular panorama, seamless spherical ` +
    `projection, aspect ratio 2:1, zero distortion at the horizon line. ` +
    `Shot on a full-frame DSLR with a 24mm prime lens, natural real-world ` +
    `lighting, true-to-life color science, accurate white balance, realistic ` +
    `atmospheric haze, subtle lens characteristics (micro-contrast, natural ` +
    `depth of field, faint chromatic aberration at the edges), fine surface ` +
    `micro-detail (skin pores, fabric weave, brick grain, foliage veins), ` +
    `physically based materials, global illumination, soft realistic shadows, ` +
    `high dynamic range. Indistinguishable from a real-world photograph — ` +
    `NOT CGI, NOT 3D render, NOT illustration, NOT painting, NOT stylized, ` +
    `NOT anime, NOT cartoon. Scene: ${clean}. Camera at human eye-level (~1.65m). ` +
    `Family-friendly, safe-for-all-audiences composition suitable for global app stores. ` +
    `Absolutely NO text, letters, numbers, watermarks, logos, captions, ` +
    `signatures, or UI overlays anywhere in the image.`
  );
}

function makeSlug(title: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${base || "realm"}-${rand}`;
}

export default function RealmBuilderPage() {
  const { user } = useAuth();
  const [title, setTitle] = useState("My First Realm");
  const [prompt, setPrompt] = useState("A moonlit oceanside cliff at golden hour, waves crashing on rocks, cinematic 8K");
  const [skyboxUrl, setSkyboxUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);
  const [walkMode, setWalkMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [shopEnabled, setShopEnabled] = useState(false);
  const [priceUsd, setPriceUsd] = useState<string>("2.99");
  const [tagsInput, setTagsInput] = useState<string>("");
  const [savedRealm, setSavedRealm] = useState<RealmRow | null>(null);
  const [myRealms, setMyRealms] = useState<RealmRow[]>([]);

  // Load user's avatars
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("user_avatars")
        .select("id, name, image_url")
        .eq("user_id", user.id)
        .not("image_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(24);
      const list = (data as Avatar[] | null) ?? [];
      setAvatars(list);
      if (list.length > 0) setSelectedAvatar(list[0]);
    })();
  }, [user?.id]);

  // Load user's saved realms
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("user_realms")
        .select("id, title, prompt, skybox_url, avatar_url, avatar_id, is_public, share_slug, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(12);
      setMyRealms((data as RealmRow[] | null) ?? []);
    })();
  }, [user?.id, savedRealm?.id]);

  const shareUrl = useMemo(() => {
    if (!savedRealm?.share_slug) return null;
    return `${window.location.origin}/realm/${savedRealm.share_slug}`;
  }, [savedRealm?.share_slug]);

  async function handleGenerate() {
    if (!prompt.trim()) {
      toast.error("Describe your realm first");
      return;
    }
    setGenerating(true);
    setWalkMode(false);
    try {
      const res = await generateImage({
        prompt: buildSkyboxPrompt(prompt),
        tier: "premium",
        noCache: false,
      });
      setSkyboxUrl(res.url);
      toast.success("Realm generated — click 'Walk in' to explore");
    } catch (e: any) {
      if (e instanceof InsufficientCreditsError) {
        toast.error("Out of credits", { description: "Top up your wallet to keep building realms." });
      } else {
        toast.error("Generation failed", { description: e?.message ?? "Try again in a moment." });
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!user?.id) {
      toast.error("Sign in to save your realm");
      return;
    }
    if (!skyboxUrl) {
      toast.error("Generate a realm before saving");
      return;
    }
    setSaving(true);
    try {
      const slug = isPublic ? makeSlug(title) : null;
      const priceCents = shopEnabled && isPublic
        ? Math.max(0, Math.round(parseFloat(priceUsd || "0") * 100))
        : 0;
      const { data, error } = await supabase
        .from("user_realms")
        .insert({
          user_id: user.id,
          title: title.trim() || "Untitled Realm",
          prompt: prompt.trim(),
          skybox_url: skyboxUrl,
          avatar_id: selectedAvatar?.id ?? null,
          avatar_url: selectedAvatar?.image_url ?? null,
          is_public: isPublic,
          share_slug: slug,
          shop_enabled: shopEnabled && isPublic && priceCents > 0,
          shop_price_cents: priceCents,
          props: [],
          metadata: { phase: 4, source: "realm-builder" },
        })
        .select("*")
        .single();
      if (error) throw error;
      setSavedRealm(data as RealmRow);
      toast.success(
        shopEnabled && isPublic && priceCents > 0
          ? "Realm listed in the Public Library"
          : isPublic ? "Realm saved + published" : "Realm saved to your library"
      );
    } catch (e: any) {
      toast.error("Save failed", { description: e?.message });
    } finally {
      setSaving(false);
    }
  }

  function copyShareLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-neutral-950 to-black text-white">
      <SEO
        title="Realm Builder — Oracle Lunar"
        description="Build 8K photoreal 3D realms with AI. Walk inside your creation, drop in your avatar, and share it."
      />

      <header className="border-b border-white/10 bg-black/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button asChild size="sm" variant="ghost" className="text-white/70 hover:text-white">
            <Link to="/dashboard"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-amber-400" />
              Realm Builder
              <span className="text-[10px] uppercase tracking-wider text-amber-400/70 border border-amber-400/30 px-2 py-0.5 rounded-full">Phase 4</span>
            </h1>
            <p className="text-xs text-white/50">Describe → 8K photoreal realm → walk inside → publish & earn</p>
          </div>
          <Button asChild size="sm" variant="ghost" className="text-amber-400 hover:text-amber-300">
            <Link to="/realms"><Globe2 className="w-4 h-4 mr-1" /> Public Library</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Controls */}
        <div className="space-y-4">
          <Card className="p-4 bg-neutral-900/70 border-white/10 space-y-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-white/60">Realm title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 bg-black/40 border-white/10"
                placeholder="e.g. Neon Tokyo Rooftop"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-white/60">Describe your realm</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="mt-1 bg-black/40 border-white/10 text-sm"
                placeholder="A moonlit oceanside cliff at golden hour, cinematic 8K..."
              />
              <p className="text-[10px] text-white/40 mt-1">
                Auto-wrapped as an 8K photoreal 360° panorama. Content stays within Google Play / M-rating safety rules.
              </p>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold"
            >
              {generating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Rendering 8K realm…</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Generate 8K Realm</>
              )}
            </Button>
          </Card>

          <Card className="p-4 bg-neutral-900/70 border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-wider text-white/60 flex items-center gap-2">
                <User className="w-3.5 h-3.5" /> Your avatar
              </div>
              <Button asChild size="sm" variant="ghost" className="h-7 text-xs text-amber-400 hover:text-amber-300">
                <Link to="/avatar-generator">+ New avatar</Link>
              </Button>
            </div>
            {avatars.length === 0 ? (
              <p className="text-xs text-white/50">
                No avatars yet. <Link to="/avatar-generator" className="text-amber-400 underline">Create one</Link> and it'll appear here.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                {avatars.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAvatar(a)}
                    className={`relative rounded-lg overflow-hidden aspect-square border-2 transition ${
                      selectedAvatar?.id === a.id ? "border-amber-400 ring-2 ring-amber-400/40" : "border-white/10 hover:border-white/30"
                    }`}
                    title={a.name ?? "Avatar"}
                  >
                    <img src={a.image_url} alt={a.name ?? "Avatar"} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4 bg-neutral-900/70 border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-white/60 flex items-center gap-2">
                {isPublic ? <Globe2 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                {isPublic ? "Public — anyone with the link" : "Private — only you"}
              </span>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>

            {isPublic && (
              <div className="rounded-md border border-white/10 bg-black/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-white/60 flex items-center gap-2">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    List in Public Library
                  </span>
                  <Switch checked={shopEnabled} onCheckedChange={setShopEnabled} />
                </div>
                {shopEnabled && (
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/50">Price (USD)</label>
                    <div className="mt-1 flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                      <Input
                        type="number"
                        step="0.01"
                        min="0.99"
                        value={priceUsd}
                        onChange={(e) => setPriceUsd(e.target.value)}
                        className="bg-black/40 border-white/10 h-8"
                      />
                    </div>
                    <p className="text-[10px] text-white/40 mt-1">
                      You keep 70% ({(parseFloat(priceUsd || "0") * 0.7).toFixed(2)} USD). Platform fee 30% via Stripe Connect.
                    </p>
                  </div>
                )}
              </div>
            )}
            <Button
              onClick={handleSave}
              disabled={saving || !skyboxUrl}
              className="w-full bg-white/10 hover:bg-white/20 border border-white/20"
              variant="secondary"
            >
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : <><Save className="w-4 h-4 mr-2" /> Save realm</>}
            </Button>
            {shareUrl && (
              <div className="rounded-md bg-black/40 border border-amber-400/30 p-2 text-xs flex items-center gap-2">
                <Share2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <code className="truncate flex-1 text-amber-100">{shareUrl}</code>
                <Button size="sm" variant="ghost" className="h-6 px-2" onClick={copyShareLink}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            )}
          </Card>

          {myRealms.length > 0 && (
            <Card className="p-4 bg-neutral-900/70 border-white/10 space-y-2">
              <div className="text-xs uppercase tracking-wider text-white/60">My realms</div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {myRealms.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSkyboxUrl(r.skybox_url);
                      setTitle(r.title);
                      setPrompt(r.prompt ?? "");
                      setIsPublic(r.is_public);
                      setSavedRealm(r);
                      const a = avatars.find((x) => x.id === r.avatar_id);
                      if (a) setSelectedAvatar(a);
                    }}
                    className="w-full text-left flex items-center gap-2 p-1.5 rounded hover:bg-white/5"
                  >
                    {r.skybox_url && <img src={r.skybox_url} alt="" className="w-10 h-10 rounded object-cover" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{r.title}</div>
                      <div className="text-[10px] text-white/40">{r.is_public ? "Public" : "Private"}</div>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Preview / Walk */}
        <div className="space-y-3">
          <Card className="aspect-video bg-black border-white/10 overflow-hidden relative">
            {skyboxUrl ? (
              walkMode ? (
                <ImmersiveFPSViewer imageUrl={skyboxUrl} onExit={() => setWalkMode(false)} />
              ) : (
                <div className="relative w-full h-full">
                  <img src={skyboxUrl} alt="Realm preview" className="w-full h-full object-cover" />
                  {selectedAvatar && (
                    <img
                      src={selectedAvatar.image_url}
                      alt="Avatar"
                      className="absolute bottom-4 right-4 w-24 h-24 rounded-full object-cover border-2 border-amber-400 shadow-2xl shadow-amber-500/30"
                    />
                  )}
                  <div className="absolute inset-0 flex items-end justify-center pb-6">
                    <Button
                      onClick={() => setWalkMode(true)}
                      className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
                    >
                      Walk into this realm →
                    </Button>
                  </div>
                </div>
              )
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-white/40 gap-2">
                <Wand2 className="w-10 h-10" />
                <p className="text-sm">Your 8K photoreal realm will appear here</p>
                <p className="text-xs">Describe a place → hit Generate</p>
              </div>
            )}
          </Card>
          <div className="text-xs text-white/50 leading-relaxed">
            <strong className="text-white/80">Phase 4 live:</strong>{" "}
            Toggle <em>Public</em> then <em>List in Public Library</em> to sell your realm.
            Buyers unlock walk-in access via Stripe checkout; you keep 70% (paid straight to your Stripe Connect account).
            Browse the <Link to="/realms" className="text-amber-400 underline">Public Library</Link> to walk through community realms.
          </div>
        </div>
      </main>
    </div>
  );
}
