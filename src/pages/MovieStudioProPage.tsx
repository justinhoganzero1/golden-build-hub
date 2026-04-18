import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Film, Wallet, Lock, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PageShell from "@/components/PageShell";
import MovieStudio from "@/components/MovieStudio";

const MIN_BALANCE_CENTS = 25;

const MovieStudioProPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [studioOpen, setStudioOpen] = useState(false);

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
            Each export is charged from your wallet at <strong>compute cost + 50% service fee</strong>.
            Pricing: <strong>~$0.12 per scene</strong> + $0.15 HD + $0.05 captions. Minimum $0.25/render.
          </p>
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
          onClick={() => setStudioOpen(true)}
          size="lg"
          className="w-full h-16 text-base font-bold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground"
        >
          <Film className="w-6 h-6 mr-3" /> Open Movie Studio Pro
        </Button>

        <p className="text-[10px] text-center text-muted-foreground">
          Pricing is transparent. You see the exact charge before every export — no surprise fees.
        </p>
      </div>

      <MovieStudio
        open={studioOpen}
        onOpenChange={(o) => { setStudioOpen(o); if (!o) refreshBalance(); }}
      />
    </PageShell>
  );
};

export default MovieStudioProPage;
