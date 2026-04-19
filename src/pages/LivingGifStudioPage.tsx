import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Sparkles, Wand2, Check, Trash2, Loader2, Crown, Download, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useUserAvatars } from "@/hooks/useUserAvatars";
import {
  useLivingGifs,
  useSetActiveGif,
  useDeleteGif,
} from "@/hooks/useLivingGifs";
import { supabase } from "@/integrations/supabase/client";
import { MASTER_AI_AVATAR } from "@/assets/master-ai-avatar";

const PRICE_LABEL = "$4.00";

const LivingGifStudioPage = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: avatars = [] } = useUserAvatars();
  const { data: gifs = [], refetch } = useLivingGifs();
  const setActive = useSetActiveGif();
  const del = useDeleteGif();

  const avatarOptions = useMemo(
    () => [
      { id: "master", name: "Oracle Lunar (default)", image_url: MASTER_AI_AVATAR },
      ...avatars
        .filter((a) => a.image_url)
        .map((a) => ({ id: a.id, name: a.name, image_url: a.image_url! })),
    ],
    [avatars],
  );

  const [pickedId, setPickedId] = useState<string>("master");
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const picked = avatarOptions.find((a) => a.id === pickedId) ?? avatarOptions[0];

  // After Stripe redirect, finalize generation
  useEffect(() => {
    const paid = params.get("paid");
    const gifId = params.get("gif_id");
    const sessionId = params.get("session_id");
    if (paid === "1" && gifId && sessionId && !verifying) {
      setVerifying(true);
      toast.info("Payment received. Rendering your 8K GIF (~60-90s)…");
      supabase.functions
        .invoke("generate-living-gif", { body: { gif_id: gifId, session_id: sessionId } })
        .then(({ error }) => {
          if (error) throw error;
          toast.success("Your Living GIF is ready! 🎬");
          refetch();
        })
        .catch((e) => {
          console.error(e);
          toast.error("Generation failed. We'll keep retrying — check back shortly.");
        })
        .finally(() => {
          setVerifying(false);
          params.delete("paid");
          params.delete("gif_id");
          params.delete("session_id");
          setParams(params, { replace: true });
        });
    } else if (params.get("canceled") === "1") {
      toast.info("Payment canceled. Your draft was discarded.");
      params.delete("canceled");
      params.delete("gif_id");
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = async () => {
    if (!picked) return toast.error("Pick an avatar first");
    if (prompt.trim().length < 6) {
      return toast.error("Describe what your avatar should be doing (min 6 chars)");
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-gif-checkout", {
        body: {
          source_avatar_id: pickedId === "master" ? null : pickedId,
          source_image_url: picked.image_url,
          prompt: prompt.trim(),
          title: title.trim() || null,
        },
      });
      if (error) throw error;

      // Admin bypass — generate directly, no Stripe
      if (data?.admin_bypass && data?.gif_id) {
        toast.success("Admin bypass — rendering free 8K GIF (~60–90s)…");
        setVerifying(true);
        const { error: genErr } = await supabase.functions.invoke("generate-living-gif", {
          body: { gif_id: data.gif_id },
        });
        setVerifying(false);
        if (genErr) throw genErr;
        toast.success("Your Living GIF is ready! 🎬");
        setPrompt("");
        setTitle("");
        refetch();
        return;
      }

      if (!data?.url) throw new Error("No checkout URL");
      window.location.href = data.url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Couldn't generate: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Living GIF Studio — 20s 8K Animated Avatars"
        description="Generate 20-second 8K animated avatar GIFs of your Oracle. Bank unlimited GIFs forever, set any one as your active Oracle face."
      />
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <header className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-xs font-bold text-primary">
            <Crown className="w-3 h-3" /> PREMIUM • {PRICE_LABEL} per GIF
          </div>
          <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent">
            Living GIF Studio
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
            Generate 20-second 8K animated GIFs of any avatar doing anything you describe.
            Bank unlimited GIFs forever — set any one as your active Oracle face.
          </p>
        </header>

        {/* Generator */}
        <Card className="p-5 space-y-4 border-primary/30 bg-gradient-to-br from-card to-card/70">
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              1. Choose source avatar
            </label>
            <div className="mt-2 flex gap-3 overflow-x-auto pb-2">
              {avatarOptions.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setPickedId(a.id)}
                  className={`shrink-0 relative rounded-xl overflow-hidden border-2 transition-all ${
                    pickedId === a.id
                      ? "border-primary shadow-[0_0_20px_hsl(var(--primary)/0.5)]"
                      : "border-border hover:border-primary/50"
                  }`}
                  style={{ width: 90, height: 90 }}
                >
                  <img
                    src={a.image_url}
                    alt={a.name}
                    className="w-full h-full object-cover"
                  />
                  {pickedId === a.id && (
                    <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              2. What should the avatar be doing? (20 seconds)
            </label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. walking through a misty forest at sunrise, smiling and turning to look at the camera"
              rows={3}
              maxLength={800}
              className="mt-2"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              {prompt.length}/800 — be specific about action, mood, lighting, camera move.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              3. Title (optional)
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Forest walk at dawn"
              maxLength={120}
              className="mt-2"
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={busy || verifying}
            className="w-full h-12 text-base font-bold bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
          >
            {busy ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Opening checkout…
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5 mr-2" /> Generate Living GIF — {PRICE_LABEL}
              </>
            )}
          </Button>
          <p className="text-[11px] text-center text-muted-foreground">
            One-time payment. GIF is yours forever, stays in your bank, can be set as Oracle face anytime.
          </p>
        </Card>

        {verifying && (
          <Card className="p-4 flex items-center gap-3 bg-primary/5 border-primary/30">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <div className="text-sm">
              <p className="font-bold">Rendering your 8K GIF…</p>
              <p className="text-xs text-muted-foreground">
                This takes 60–90 seconds. You can leave this page — it'll appear in your bank when ready.
              </p>
            </div>
          </Card>
        )}

        {/* Bank */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Your GIF Bank ({gifs.length})
            </h2>
            {gifs.some((g) => g.is_active_oracle) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActive.mutate(null)}
              >
                Reset Oracle face
              </Button>
            )}
          </div>

          {gifs.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">
              No Living GIFs yet. Generate your first one above — it'll live here forever.
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {gifs.map((g) => (
                <Card
                  key={g.id}
                  className={`overflow-hidden group relative ${
                    g.is_active_oracle ? "ring-2 ring-primary shadow-[0_0_30px_hsl(var(--primary)/0.3)]" : ""
                  }`}
                >
                  <div className="aspect-square bg-muted relative">
                    {g.status === "ready" && g.gif_url ? (
                      <video
                        src={g.gif_url}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : g.thumbnail_url || g.source_image_url ? (
                      <img
                        src={g.thumbnail_url ?? g.source_image_url}
                        alt={g.title ?? g.prompt}
                        className="w-full h-full object-cover opacity-60"
                      />
                    ) : null}

                    {g.status !== "ready" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
                        <div className="text-center text-xs">
                          {g.status === "generating" && (
                            <>
                              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-1 text-primary" />
                              Rendering 8K…
                            </>
                          )}
                          {g.status === "pending_payment" && "Awaiting payment"}
                          {g.status === "failed" && (
                            <span className="text-destructive">Failed</span>
                          )}
                        </div>
                      </div>
                    )}

                    {g.is_active_oracle && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center gap-1">
                        <Crown className="w-3 h-3" /> ACTIVE
                      </div>
                    )}
                  </div>
                  <div className="p-2 space-y-1.5">
                    <p className="text-xs font-semibold truncate">
                      {g.title ?? g.prompt}
                    </p>
                    {g.status === "ready" && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={g.is_active_oracle ? "secondary" : "default"}
                          className="flex-1 h-7 text-[11px]"
                          disabled={setActive.isPending}
                          onClick={() =>
                            setActive.mutate(g.is_active_oracle ? null : g.id)
                          }
                        >
                          {g.is_active_oracle ? "Active" : "Set as Oracle"}
                        </Button>
                        {g.gif_url && (
                          <a
                            href={g.gif_url}
                            download={`living-gif-${g.id}.mp4`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Button size="sm" variant="ghost" className="h-7 px-2">
                              <Download className="w-3 h-3" />
                            </Button>
                          </a>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-destructive"
                          onClick={() => {
                            if (confirm("Delete this GIF forever?")) del.mutate(g.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
};

export default LivingGifStudioPage;
