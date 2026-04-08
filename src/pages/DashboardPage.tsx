import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Brain, Shield, Heart, MessageCircle, Video, Camera, Music,
  Wallet, Calendar, Clock, Settings, User, Sparkles, Phone,
  BookOpen, Users, Zap, Globe, Star, Lightbulb, Film,
  Eye, Mic, ShoppingCart, Palette, GraduationCap, Home,
  Bell, Map, Download, Smartphone, CreditCard, BarChart3,
  Pill, Gift, Share2, Wrench, TrendingUp, Code
} from "lucide-react";
import solaceBanner from "@/assets/solace-banner.jpg";
import SecurityShield from "@/components/SecurityShield";

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
  { label: "Photography", icon: <Camera className="w-6 h-6" />, path: "/photography-hub" },
  { label: "Assistant", icon: <Sparkles className="w-6 h-6" />, path: "/personal-assistant" },
  { label: "AI Tutor", icon: <GraduationCap className="w-6 h-6" />, path: "/ai-tutor" },
  { label: "AI Friends", icon: <Users className="w-6 h-6" />, path: "/oracle" },
  { label: "Interpreter", icon: <Globe className="w-6 h-6" />, path: "/interpreter" },
  { label: "Inventor", icon: <Lightbulb className="w-6 h-6" />, path: "/inventor" },
  { label: "Calendar", icon: <Calendar className="w-6 h-6" />, path: "/calendar" },
  { label: "Alarm Clock", icon: <Clock className="w-6 h-6" />, path: "/alarm-clock" },
  { label: "Safety Center", icon: <Shield className="w-6 h-6" />, path: "/safety-center" },
  { label: "Diagnostics", icon: <Heart className="w-6 h-6" />, path: "/diagnostics" },
  { label: "Elderly Care", icon: <Pill className="w-6 h-6" />, path: "/elderly-care" },
  { label: "Haptic Escape", icon: <Zap className="w-6 h-6" />, path: "/haptic-escape" },
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
  
  { label: "Install", icon: <Download className="w-6 h-6" />, path: "/install" },
  
  { label: "Settings", icon: <Settings className="w-6 h-6" />, path: "/settings" },
  { label: "Profile", icon: <User className="w-6 h-6" />, path: "/profile" },
  { label: "Companion", icon: <Heart className="w-6 h-6" />, path: "/ai-companion" },
  { label: "Investor", icon: <TrendingUp className="w-6 h-6" />, path: "/investor" },
  { label: "Creators", icon: <Code className="w-6 h-6" />, path: "/creators" },
];

const OWNER_EMAIL = "justinbretthogan@gmail.com";

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isOwner = user?.email === OWNER_EMAIL;

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

      {/* Welcome + Security Shield */}
      <div className="px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">Welcome to Solace</h1>
          <p className="text-muted-foreground text-sm">Your AI companion to do everything</p>
        </div>
        <SecurityShield />
      </div>

      {/* Owner-only quick link */}
      {isOwner && (
        <div className="px-4 mb-4">
          <button onClick={() => navigate("/owner-dashboard")} className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-primary/40 bg-gradient-to-r from-primary/10 via-purple-500/10 to-blue-500/10">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary via-purple-500 to-blue-500 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-sm font-bold bg-gradient-to-r from-primary via-purple-400 to-blue-400 bg-clip-text text-transparent">Owner Dashboard</h3>
              <p className="text-xs text-muted-foreground">Manage your platform</p>
            </div>
          </button>
        </div>
      )}

      {/* App Grid */}
      <div className="grid grid-cols-4 gap-3 px-4 pb-24">
        {tiles.map((tile) => (
          <button
            key={tile.path + tile.label}
            onClick={() => navigate(tile.path)}
            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border hover:border-primary hover:bg-secondary transition-all"
          >
            <div className="text-primary">{tile.icon}</div>
            <span className="text-[10px] text-foreground font-medium text-center leading-tight">
              {tile.label}
            </span>
          </button>
        ))}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-around py-3">
        <button onClick={() => navigate("/dashboard")} className="flex flex-col items-center gap-1 text-primary">
          <Home className="w-5 h-5" />
          <span className="text-[10px]">Home</span>
        </button>
        <button onClick={() => navigate("/oracle")} className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
          <MessageCircle className="w-5 h-5" />
          <span className="text-[10px]">Oracle</span>
        </button>
        <button onClick={() => navigate("/vault")} className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
          <Shield className="w-5 h-5" />
          <span className="text-[10px]">Vault</span>
        </button>
        <button onClick={() => navigate("/settings")} className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
          <Settings className="w-5 h-5" />
          <span className="text-[10px]">Settings</span>
        </button>
        <button onClick={() => navigate("/profile")} className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
          <User className="w-5 h-5" />
          <span className="text-[10px]">Profile</span>
        </button>
      </div>
    </div>
  );
};

export default DashboardPage;
