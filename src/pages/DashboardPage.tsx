import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Brain, Shield, Heart, MessageCircle, Video, Camera, Music,
  Wallet, Calendar, Clock, Settings, User, Sparkles, Phone,
  BookOpen, Users, Zap, Globe, Star, Lightbulb, Film,
  Eye, Mic, ShoppingCart, Palette, GraduationCap, Home,
  Bell, Map, Smartphone, CreditCard, BarChart3,
  Pill, Gift, Share2, Wrench, TrendingUp, Code
} from "lucide-react";
import solaceBanner from "@/assets/solace-banner.jpg";
import SecurityShield from "@/components/SecurityShield";
import ShareDialog from "@/components/ShareDialog";

interface AppTile {
  label: string;
  icon: React.ReactNode;
  path: string;
  color?: string;
}

const tiles: AppTile[] = [
  { label: "Oracle AI", icon: <MessageCircle className="w-6 h-6" />, path: "/oracle" },
  { label: "Mind Hub", icon: <Brain className="w-6 h-6" />, path: "/mind-hub" },
  { label: "Crisis Hub", icon: <Shield className="w-6 h-6" />, path: "/crisis-hub" },
  { label: "Vault", icon: <CreditCard className="w-6 h-6" />, path: "/vault" },
  { label: "Wallet", icon: <Wallet className="w-6 h-6" />, path: "/wallet" },
  { label: "AI Studio", icon: <Sparkles className="w-6 h-6" />, path: "/ai-studio" },
  { label: "Video Editor", icon: <Video className="w-6 h-6" />, path: "/video-editor" },
  
  
  { label: "Media Library", icon: <Camera className="w-6 h-6" />, path: "/media-library" },
  { label: "Live Vision", icon: <Eye className="w-6 h-6" />, path: "/live-vision" },
  { label: "Voice Studio", icon: <Music className="w-6 h-6" />, path: "/voice-studio" },
  { label: "Photo Studio", icon: <Camera className="w-6 h-6" />, path: "/photography-hub" },
  { label: "Assistant", icon: <Sparkles className="w-6 h-6" />, path: "/personal-assistant" },
  { label: "AI Tutor", icon: <GraduationCap className="w-6 h-6" />, path: "/ai-tutor" },
  
  { label: "Interpreter", icon: <Globe className="w-6 h-6" />, path: "/interpreter" },
  { label: "Inventor", icon: <Lightbulb className="w-6 h-6" />, path: "/inventor" },
  { label: "Calendar", icon: <Calendar className="w-6 h-6" />, path: "/calendar" },
  { label: "Alarm Clock", icon: <Clock className="w-6 h-6" />, path: "/alarm-clock" },
  { label: "Safety Center", icon: <Shield className="w-6 h-6" />, path: "/safety-center" },
  { label: "Diagnostics", icon: <Heart className="w-6 h-6" />, path: "/diagnostics" },
  { label: "Elderly Care", icon: <Pill className="w-6 h-6" />, path: "/elderly-care" },
  
  { label: "Avatar Gen", icon: <Palette className="w-6 h-6" />, path: "/avatar-generator" },
  { label: "Pro Hub", icon: <BarChart3 className="w-6 h-6" />, path: "/professional-hub" },
  { label: "Family Hub", icon: <Home className="w-6 h-6" />, path: "/family-hub" },
  { label: "Magic Hub", icon: <Star className="w-6 h-6" />, path: "/magic-hub" },
  { label: "Marketing", icon: <Share2 className="w-6 h-6" />, path: "/marketing-hub" },
  { label: "Occasions", icon: <Gift className="w-6 h-6" />, path: "/special-occasions" },
  { label: "Suggestions", icon: <Bell className="w-6 h-6" />, path: "/suggestion-box" },
  
  { label: "Referral", icon: <Share2 className="w-6 h-6" />, path: "/referral" },
  { label: "Subscribe", icon: <Star className="w-6 h-6" />, path: "/subscribe" },
  { label: "App Builder", icon: <Wrench className="w-6 h-6" />, path: "/app-builder" },
  { label: "POS Learn", icon: <BookOpen className="w-6 h-6" />, path: "/pos-learn" },
  
  
  
  { label: "Settings", icon: <Settings className="w-6 h-6" />, path: "/settings" },
  { label: "Profile", icon: <User className="w-6 h-6" />, path: "/profile" },
  { label: "Companion", icon: <Heart className="w-6 h-6" />, path: "/ai-companion" },
  { label: "Investor", icon: <TrendingUp className="w-6 h-6" />, path: "/investor" },
  { label: "Creators", icon: <Code className="w-6 h-6" />, path: "/creators" },
];

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [shareOpen, setShareOpen] = useState(false);

  const [layout, setLayout] = useState(() => {
    try {
      const saved = localStorage.getItem("solace-layout");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  useEffect(() => {
    const handler = (e: Event) => setLayout((e as CustomEvent).detail);
    window.addEventListener("solace-layout-change", handler);
    return () => window.removeEventListener("solace-layout-change", handler);
  }, []);

  const gridCols = layout?.gridCols || 4;
  const iconSize = layout?.iconSize || "w-6 h-6";
  const labelSize = layout?.fontSize || "text-[10px]";
  const gridGap = layout?.gap || "gap-3";
  const tileBR = layout?.borderRadius || "rounded-xl";

  return (
    <div className="min-h-screen bg-background">
      {/* Banner */}
      <div className="w-full overflow-hidden">
        <img
          src={solaceBanner}
          alt="Solace Banner"
          className="w-full h-40 object-cover"
        />
      </div>

      {/* Welcome + Security Shield + Share */}
      <div className="px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">Welcome to Solace</h1>
          <p className="text-muted-foreground text-sm">Your AI companion to do everything</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShareOpen(true)} className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
            <Share2 className="w-5 h-5" />
          </button>
          <SecurityShield />
        </div>
      </div>

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        title="Solace App"
        url="https://golden-vault-builder.lovable.app"
        description="Check out Solace — your AI companion to do everything! Download it now."
      />


      {/* App Grid */}
      <div className={`grid ${gridGap} px-4 pb-24`} style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
        {tiles.map((tile) => (
          <button
            key={tile.path + tile.label}
            onClick={() => navigate(tile.path)}
            className={`holo-tile flex flex-col items-center gap-2 p-3 ${tileBR}`}
          >
            <div className={`holo-icon text-primary [&>svg]:${iconSize}`}>{tile.icon}</div>
            <span className={`${labelSize} text-foreground font-medium text-center leading-tight`}>
              {tile.label}
            </span>
          </button>
        ))}
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
