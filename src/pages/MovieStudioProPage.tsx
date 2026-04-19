import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import { useNavigate } from "react-router-dom";
import { Film, Wallet, Lock, Sparkles, Loader2, Wand2, Crown, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PageShell from "@/components/PageShell";
import MovieStudio from "@/components/MovieStudio";
import OracleMovieDirector, { type MovieDirectorResult } from "@/components/OracleMovieDirector";
import { useSubscription } from "@/hooks/useSubscription";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAppUnlock } from "@/hooks/useAppUnlock";
import { getMovieLimits } from "@/lib/moviePaywall";

const MIN_BALANCE_CENTS = 25;

const MovieStudioProPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { effectiveTier } = useSubscription();
  const { isAdmin } = useIsAdmin();
  const { unlocked: ownsMovieStudio } = useAppUnlock("movie_studio");
  const limits = getMovieLimits(effectiveTier, isAdmin, ownsMovieStudio);
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [studioOpen, setStudioOpen] = useState(false);
  const [directorOpen, setDirectorOpen] = useState(false);

  const handleDirectorComplete = (result: MovieDirectorResult) => {
    sessionStorage.setItem("oracle_movie_brief", JSON.stringify(result));
    setStudioOpen(true);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/sign-in?redirect=/movie-studio-pro"); return; }
    refreshBalance();
  }, [user, authLoading]);

  const refreshBalance = async () => {
    if (!user) return;
    setLoadingBalance(true);
    const { data } = await supabase
      .from("wallet_balances")
      .select("balance_cents")
      .eq("user_id", user.id)
      .maybeSingle();
    setBalance(data?.balance_cents ?? 0);
    setLoadingBalance(false);
  };

  const canRender = (balance ?? 0) >= MIN_BALANCE_CENTS;
  const balanceFmt = `$${((balance ?? 0) / 100).toFixed(2)}`;

  return (
    <>
    <SEO
      title="Movie Studio Pro — AI Cinematic Video Editor"
      description="SOLACE Movie Studio Pro: script→scenes, 8K AI frames, voiceover, music, SFX, captions, HD export. Build films with AI."
      path="/movie-studio-pro"
    />
    <PageShell title="🎬 Movie Studio Pro" subtitle="Full cinematic editor — script→scenes, VO, music, SFX, captions, HD export">
      <div className="max-w-4xl mx-auto p-4 space-y-4">

        {/* Wallet status */}
        <Card className="p-4 bg-gradient-to-br from-primary/10 via-card to-card border-primary/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Render Wallet Balance</p>
                <p className="text-lg font-bold">
                  {loadingBalance ? <Loader2 className="w-4 h-4 animate-spin inline" /> : balanceFmt}
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate("/wallet")}>
              Top up
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
            <Lock className="w-3 h-3 inline mr-1" />
            Every export is billed at <strong>provider cost + 5% platform fee</strong> (Runway video, ElevenLabs voiceover) plus a small Lovable compute charge. Minimum $0.25/render. You see the exact total before exporting — no surprise fees.
          </p>
        </Card>

        {/* Tier matrix — drives upsells */}
        <Card className="p-4 bg-card border-primary/20">
          <div className="flex items-center justify-between mb-3 gap-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Crown className="w-4 h-4 text-primary" /> Your plan: {limits.label}
            </h3>
            {!ownsMovieStudio && !isAdmin && (
              <Button size="sm" variant="outline" onClick={() => navigate("/subscribe")}>
                Upgrade
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <FeatureRow ok label={`Up to ${limits.maxDurationMin} min`} />
            <FeatureRow ok={limits.allowHD} label="HD 1080p export" />
            <FeatureRow ok={limits.allowCaptions} label="Burn-in captions" />
            <FeatureRow ok={limits.allowUpscale4K} label="4K/8K upscale" />
            <FeatureRow ok={limits.allowYouTubeOAuth} label="1-click YouTube" />
            <FeatureRow ok label="Download MP4" />
            <FeatureRow ok label="22-Q Oracle director" />
            <FeatureRow ok label="Wallet pay-per-render" />
          </div>
          {!ownsMovieStudio && !isAdmin && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                💎 <strong className="text-primary">$1 Movie Studio Lifetime Unlock</strong> lifts every cap on this app forever — long films, HD, 4K upscale, 1-click YouTube. Per-render wallet charges still apply (we have to pay Runway + ElevenLabs).{" "}
                <button onClick={() => navigate("/subscribe")} className="text-primary underline">See plans</button>
              </p>
            </div>
          )}
        </Card>

        {/* Pricing breakdown */}
        <Card className="p-4">
          <h3 className="text-sm font-bold mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> What you get</h3>
          <ul className="text-xs space-y-1.5 text-muted-foreground">
            <li>• <strong className="text-foreground">Script → Scenes:</strong> AI writes, generates 8K cinematic frames, voices each line</li>
            <li>• <strong className="text-foreground">Multi-track timeline:</strong> video, voiceover, music, SFX, text overlays</li>
            <li>• <strong className="text-foreground">120+ ElevenLabs voices</strong> + custom voice cloning</li>
            <li>• <strong className="text-foreground">AI music & SFX</strong> auto-mixed under dialogue</li>
            <li>• <strong className="text-foreground">Auto-captions</strong> burned into the final MP4</li>
            <li>• <strong className="text-foreground">HD 1080p export</strong> with cinematic colour grade, grain, and light leaks</li>
          </ul>
        </Card>

        {!canRender && (
          <Card className="p-4 border-destructive/50 bg-destructive/5">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold text-destructive">Wallet empty</p>
                <p className="text-xs text-muted-foreground mt-1">
                  You need at least <strong>$0.25</strong> in your wallet to export a movie.
                  You can still build, preview, and edit your timeline — you'll just be charged when you tap Export.
                </p>
                <Button onClick={() => navigate("/wallet")} size="sm" className="mt-3">
                  <Wallet className="w-4 h-4 mr-2" /> Top up wallet
                </Button>
              </div>
            </div>
          </Card>
        )}

        <Button
          onClick={() => setDirectorOpen(true)}
          size="lg"
          className="w-full h-16 text-base font-bold bg-gradient-to-r from-primary via-primary/80 to-primary hover:opacity-90 text-primary-foreground shadow-[0_0_30px_hsl(var(--primary)/0.4)]"
        >
          <Wand2 className="w-6 h-6 mr-3" /> Tell Oracle Your Movie (recommended)
        </Button>

        <Button
          onClick={() => setStudioOpen(true)}
          size="lg"
          variant="outline"
          className="w-full h-12 text-sm"
        >
          <Film className="w-5 h-5 mr-2" /> Or open the studio manually
        </Button>

        <p className="text-[10px] text-center text-muted-foreground">
          Pricing is transparent. You see the exact charge before every export — no surprise fees.
        </p>
      </div>

      <OracleMovieDirector
        open={directorOpen}
        onOpenChange={setDirectorOpen}
        onComplete={handleDirectorComplete}
      />

      <MovieStudio
        open={studioOpen}
        onOpenChange={(o) => { setStudioOpen(o); if (!o) refreshBalance(); }}
      />
    </PageShell>
    </>
  );
};

const FeatureRow = ({ ok, label }: { ok: boolean; label: string }) => (
  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${ok ? "bg-primary/10" : "bg-muted/40 opacity-60"}`}>
    {ok ? <Check className="w-3 h-3 text-primary shrink-0" /> : <X className="w-3 h-3 text-muted-foreground shrink-0" />}
    <span className={ok ? "text-foreground" : "text-muted-foreground line-through"}>{label}</span>
  </div>
);

export default MovieStudioProPage;
