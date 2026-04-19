import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  Brain, Shield, Heart, MessageCircle, Video, Camera, Music,
  Wallet, Calendar, Clock, Settings, User, Sparkles, Phone,
  BookOpen, Users, Zap, Globe, Star, Lightbulb, Film,
  Eye, Mic, ShoppingCart, Palette, GraduationCap, Home,
  Bell, Map, Smartphone, CreditCard, BarChart3,
  Pill, Gift, Share2, Wrench, TrendingUp, Code, Lock
} from "lucide-react";
import oracle-lunarBanner from "@/assets/oracle-lunar-banner.jpg";
import SecurityShield from "@/components/SecurityShield";
import ShareDialog from "@/components/ShareDialog";
import PartyBanner from "@/components/PartyBanner";
import WelcomeModal from "@/components/WelcomeModal";
import { toast } from "sonner";

interface AppTile {
  label: string;
  icon: React.ReactNode;
  path: string;
  /** Minimum tier needed. null = free */
  tier: string | null;
}

// FREE: Oracle, Subscribe, Settings, Profile, Suggestion Box, Referral, About/Legal
// STARTER: Most features
// MONTHLY: Premium features  
// GOLDEN: Ultra premium
const tiles: AppTile[] = [
  { label: "Oracle AI", icon: <MessageCircle className="w-6 h-6" />, path: "/oracle", tier: null },
  { label: "Mind Hub", icon: <Brain className="w-6 h-6" />, path: "/mind-hub", tier: "starter" },
  { label: "Crisis Hub", icon: <Shield className="w-6 h-6" />, path: "/crisis-hub", tier: null },
  { label: "Audio Filter", icon: <Shield className="w-6 h-6" />, path: "/audio-filter", tier: null },
  { label: "Vault", icon: <CreditCard className="w-6 h-6" />, path: "/vault", tier: "starter" },
  { label: "Wallet", icon: <Wallet className="w-6 h-6" />, path: "/wallet", tier: "starter" },
  
  { label: "Video Editor", icon: <Video className="w-6 h-6" />, path: "/video-editor", tier: "monthly" },
  { label: "YT Show Studio", icon: <Film className="w-6 h-6" />, path: "/youtube-show-studio", tier: "monthly" },
  { label: "Media Library", icon: <Camera className="w-6 h-6" />, path: "/media-library", tier: "starter" },
  { label: "Live Vision", icon: <Eye className="w-6 h-6" />, path: "/live-vision", tier: "monthly" },
  { label: "Voice Studio", icon: <Music className="w-6 h-6" />, path: "/voice-studio", tier: "monthly" },
  { label: "Photo Studio", icon: <Camera className="w-6 h-6" />, path: "/photography-hub", tier: "monthly" },
  { label: "Assistant", icon: <Sparkles className="w-6 h-6" />, path: "/personal-assistant", tier: "starter" },
  { label: "Claims", icon: <Shield className="w-6 h-6" />, path: "/claims-assistant", tier: null },
  { label: "AI Tutor", icon: <GraduationCap className="w-6 h-6" />, path: "/ai-tutor", tier: "starter" },
  { label: "Interpreter", icon: <Globe className="w-6 h-6" />, path: "/interpreter", tier: "starter" },
  { label: "Inventor", icon: <Lightbulb className="w-6 h-6" />, path: "/inventor", tier: "monthly" },
  { label: "Calendar", icon: <Calendar className="w-6 h-6" />, path: "/calendar", tier: "starter" },
  { label: "Alarm Clock", icon: <Clock className="w-6 h-6" />, path: "/alarm-clock", tier: "starter" },
  { label: "Safety Center", icon: <Shield className="w-6 h-6" />, path: "/safety-center", tier: null },
  { label: "Diagnostics", icon: <Heart className="w-6 h-6" />, path: "/diagnostics", tier: "starter" },
  { label: "Elderly Care", icon: <Pill className="w-6 h-6" />, path: "/elderly-care", tier: "starter" },
  { label: "Avatar Gen", icon: <Palette className="w-6 h-6" />, path: "/avatar-generator", tier: "starter" },
  { label: "Pro Hub", icon: <BarChart3 className="w-6 h-6" />, path: "/professional-hub", tier: "monthly" },
  { label: "Family Hub", icon: <Home className="w-6 h-6" />, path: "/family-hub", tier: "starter" },
  { label: "Magic Hub", icon: <Star className="w-6 h-6" />, path: "/magic-hub", tier: "starter" },
  
  { label: "Occasions", icon: <Gift className="w-6 h-6" />, path: "/special-occasions", tier: "starter" },
  { label: "Suggestions", icon: <Bell className="w-6 h-6" />, path: "/suggestion-box", tier: null },
  { label: "Referral", icon: <Share2 className="w-6 h-6" />, path: "/referral", tier: null },
  { label: "Subscribe", icon: <Star className="w-6 h-6" />, path: "/subscribe", tier: null },
  { label: "App Builder", icon: <Wrench className="w-6 h-6" />, path: "/app-builder", tier: "quarterly" },
  { label: "POS Learn", icon: <BookOpen className="w-6 h-6" />, path: "/pos-learn", tier: "starter" },
  { label: "Story Writer", icon: <BookOpen className="w-6 h-6" />, path: "/story-writer", tier: "starter" },
  { label: "Settings", icon: <Settings className="w-6 h-6" />, path: "/settings", tier: null },
  { label: "Profile", icon: <User className="w-6 h-6" />, path: "/profile", tier: null },
  { label: "Companion", icon: <Heart className="w-6 h-6" />, path: "/ai-companion", tier: "monthly" },
  { label: "Investor", icon: <TrendingUp className="w-6 h-6" />, path: "/investor", tier: null },
  { label: "Creators", icon: <Code className="w-6 h-6" />, path: "/creators", tier: null },
];

const TIER_RANK: Record<string, number> = {
  free: 0, starter: 1, monthly: 2, quarterly: 3, biannual: 4, annual: 5, golden: 6,
};

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tier, loading: subLoading } = useSubscription();
  const [shareOpen, setShareOpen] = useState(false);
  const { isAdmin } = useIsAdmin();

  const [layout, setLayout] = useState(() => {
    try {
      const saved = localStorage.getItem("oracle-lunar-layout");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  useEffect(() => {
    const handler = (e: Event) => setLayout((e as CustomEvent).detail);
    window.addEventListener("oracle-lunar-layout-change", handler);
    return () => window.removeEventListener("oracle-lunar-layout-change", handler);
  }, []);

  const gridCols = layout?.gridCols || 4;
  const iconSize = layout?.iconSize || "w-6 h-6";
  const labelSize = layout?.fontSize || "text-[10px]";
  const gridGap = layout?.gap || "gap-3";
  const tileBR = layout?.borderRadius || "rounded-xl";

  const handleTileClick = (tile: AppTile) => {
    if (!tile.tier || isAdmin) {
      navigate(tile.path);
      return;
    }
    const userRank = TIER_RANK[tier] ?? 0;
    const requiredRank = TIER_RANK[tile.tier] ?? 0;
    if (userRank >= requiredRank) {
      navigate(tile.path);
    } else {
      toast("🔒 Premium Feature", {
        description: `${tile.label} requires a paid plan. Upgrade now or submit a winning idea for FREE lifetime access!`,
        action: {
          label: "Upgrade",
          onClick: () => navigate("/subscribe"),
        },
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <WelcomeModal />
      {/* Banner */}
      <div className="w-full overflow-hidden">
        <img src={oracle-lunarBanner} alt="Oracle Lunar Banner" className="w-full h-40 object-cover" />
      </div>

      {/* Welcome + Security Shield + Share */}
      <div className="px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">Welcome to Oracle Lunar</h1>
          <p className="text-muted-foreground text-sm">Your AI companion to do everything</p>
          {(tier === "lifetime" || isAdmin) && (
            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-primary to-amber-500 text-primary-foreground shadow-sm">
              ✨ Lifetime Member
            </span>
          )}
          {isAdmin && (
            <button
              onClick={() => navigate("/admin/editor")}
              className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full text-[11px] font-bold bg-primary/15 border border-primary/40 text-primary hover:bg-primary/25 transition"
            >
              ✏️ Live Editor
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShareOpen(true)} className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
            <Share2 className="w-5 h-5" />
          </button>
          <SecurityShield />
        </div>
      </div>

      {/* Lifetime Birthday Party banner */}
      {tier !== "lifetime" && !isAdmin && (
        <div className="mx-4 mb-3 space-y-2">
          <PartyBanner variant="free-14-days" />
          <PartyBanner variant="lifetime-birthday" />
        </div>
      )}

      {/* Free lifetime promo banner */}
      {tier === "free" && !isAdmin && (
        <div className="mx-4 mb-4 p-3 rounded-xl bg-gradient-to-r from-primary/20 to-amber-500/20 border border-primary/30">
          <p className="text-xs text-foreground text-center">
            💡 <span className="font-bold text-primary">FREE Lifetime Membership!</span> Submit a winning idea in the{" "}
            <button onClick={() => navigate("/suggestion-box")} className="underline text-primary font-semibold">Suggestion Box</button>
            {" "}— if we build it, you get unlimited access forever! ✨
          </p>
        </div>
      )}

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        title="Oracle Lunar App"
        url="https://golden-vault-builder.lovable.app"
        description="Check out Oracle Lunar — your AI companion to do everything! Download it now."
      />

      {/* App Grid */}
      <div className={`grid ${gridGap} px-4 pb-24`} style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
        {tiles.map((tile) => {
          const locked = tile.tier && !isAdmin && (TIER_RANK[tier] ?? 0) < (TIER_RANK[tile.tier] ?? 0);
          return (
            <button
              key={tile.path + tile.label}
              onClick={() => handleTileClick(tile)}
              className={`holo-tile flex flex-col items-center gap-2 p-3 ${tileBR} relative ${locked ? "opacity-70" : ""}`}
            >
              {locked && (
                <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary/80 flex items-center justify-center z-10">
                  <Lock className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
              <div className={`holo-icon text-primary [&>svg]:${iconSize}`}>{tile.icon}</div>
              <span className={`${labelSize} text-foreground font-medium text-center leading-tight`}>
                {tile.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-md border-t border-border flex justify-around py-3">
        <button onClick={() => navigate("/dashboard")} className="flex flex-col items-center gap-1 text-primary">
          <div className="holo-icon"><Home className="w-5 h-5" /></div>
          <span className="text-[10px]">Home</span>
        </button>
        <button onClick={() => navigate("/oracle")} className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
          <div className="holo-icon"><MessageCircle className="w-5 h-5" /></div>
          <span className="text-[10px]">Oracle</span>
        </button>
        <button onClick={() => navigate("/vault")} className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
          <div className="holo-icon"><Shield className="w-5 h-5" /></div>
          <span className="text-[10px]">Vault</span>
        </button>
        <button onClick={() => navigate("/settings")} className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
          <div className="holo-icon"><Settings className="w-5 h-5" /></div>
          <span className="text-[10px]">Settings</span>
        </button>
        <button onClick={() => navigate("/profile")} className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
          <div className="holo-icon"><User className="w-5 h-5" /></div>
          <span className="text-[10px]">Profile</span>
        </button>
      </div>
    </div>
  );
};

export default DashboardPage;
