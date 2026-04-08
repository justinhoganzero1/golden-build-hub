import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Brain, Shield, Heart, MessageCircle, Video, Camera, Music,
  Wallet, Calendar, Clock, Settings, User, Sparkles, Phone,
  BookOpen, Users, Zap, Globe, Star, Lightbulb, Film,
  Eye, Mic, ShoppingCart, Palette, GraduationCap, Home,
  Bell, Map, Download, Smartphone, CreditCard, BarChart3,
  Pill, Gift, Share2, Wrench, Lock, ChevronRight, ChevronDown
} from "lucide-react";
import solaceBanner from "@/assets/solace-banner.jpg";

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
  { label: "Owner Hub", icon: <CreditCard className="w-6 h-6" />, path: "/owner-dashboard" },
];

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showVault, setShowVault] = useState(false);
  const [showFreebies, setShowFreebies] = useState(false);
  const [vaultEmail, setVaultEmail] = useState("");
  const [vaultLevel, setVaultLevel] = useState("viewer");
  const [freebieEmail, setFreebieEmail] = useState("");

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

      {/* Welcome */}
      <div className="px-4 py-4">
        <h1 className="text-xl font-bold text-primary">Welcome to Solace</h1>
        <p className="text-muted-foreground text-sm">Your AI companion to do everything</p>
      </div>

      {/* Owner Tools - Deep Dark Vault & Freebies */}
      <div className="px-4 mb-4 space-y-2">
        {/* Deep Dark Vault */}
        <button onClick={() => setShowVault(!showVault)} className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-primary/40 bg-gradient-to-r from-primary/10 via-purple-500/10 to-blue-500/10">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 via-yellow-500 to-blue-500 flex items-center justify-center">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 text-left">
            <h3 className="text-sm font-bold bg-gradient-to-r from-red-400 via-yellow-400 to-green-400 bg-clip-text text-transparent">Deep Dark Vault</h3>
            <p className="text-xs text-muted-foreground">Maximum security file storage</p>
          </div>
          <ChevronRight className="w-5 h-5 text-primary" />
        </button>
        {showVault && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <p className="text-xs text-muted-foreground">Share vault access with specific users at different security levels.</p>
            <input value={vaultEmail} onChange={e => setVaultEmail(e.target.value)} placeholder="User email" className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none" />
            <select value={vaultLevel} onChange={e => setVaultLevel(e.target.value)} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground">
              <option value="viewer">Viewer - Read only</option>
              <option value="editor">Editor - Read & write</option>
              <option value="admin">Admin - Full access</option>
            </select>
            <button className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">Grant Vault Access</button>
          </div>
        )}

        {/* Freebies Manager */}
        <button onClick={() => setShowFreebies(!showFreebies)} className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-primary/40 bg-gradient-to-r from-green-500/10 via-blue-500/10 to-purple-500/10">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 via-cyan-500 to-purple-500 flex items-center justify-center">
            <Gift className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 text-left">
            <h3 className="text-sm font-bold bg-gradient-to-r from-green-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">Freebies Manager</h3>
            <p className="text-xs text-muted-foreground">Manage lifetime free access</p>
          </div>
          <ChevronDown className="w-5 h-5 text-primary" />
        </button>
        {showFreebies && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <p className="text-xs text-muted-foreground">Grant lifetime free access to users whose suggestions were implemented.</p>
            <input value={freebieEmail} onChange={e => setFreebieEmail(e.target.value)} placeholder="User email" className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none" />
            <button
              onClick={async () => {
                if (!freebieEmail.trim()) { toast.error("Enter an email address"); return; }
                try {
                  const { error } = await supabase.from("suggestions").insert({
                    user_id: "00000000-0000-0000-0000-000000000000",
                    suggestion: `Lifetime access granted to ${freebieEmail.trim()}`,
                    status: "implemented",
                    granted_free_access: true,
                    category: "Freebie",
                  });
                  if (error) throw error;
                  toast.success(`Lifetime free access granted to ${freebieEmail.trim()}! 🎉`);
                  setFreebieEmail("");
                } catch (e) {
                  console.error(e);
                  toast.error("Failed to grant access");
                }
              }}
              className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
            >
              Grant Lifetime Free Access
            </button>
            <div className="border-t border-border pt-3">
              <p className="text-xs font-semibold text-foreground mb-2">Recently Granted</p>
              <p className="text-xs text-muted-foreground italic">No users granted yet</p>
            </div>
          </div>
        )}
      </div>

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
