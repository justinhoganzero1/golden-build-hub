import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  Brain, Shield, Heart, MessageCircle, Video, Camera, Music,
  Wallet, Calendar, Clock, Settings, User, Sparkles,
  BookOpen, Globe, Star, Lightbulb, Film,
  Eye, Palette, GraduationCap, Home,
  Bell, CreditCard, BarChart3,
  Pill, Gift, Share2, Wrench, TrendingUp, Code, LogOut, ChevronDown
} from "lucide-react";
import OracleMoonHeader from "@/components/OracleMoonHeader";
import SecurityShield from "@/components/SecurityShield";
import ShareDialog from "@/components/ShareDialog";
import WelcomeModal from "@/components/WelcomeModal";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import HomePublicGallery from "@/components/HomePublicGallery";
import MonthlyAwardsShowcase from "@/components/MonthlyAwardsShowcase";

interface AppTile {
  label: string;
  icon: React.ReactNode;
  path: string;
}

interface TileGroup {
  id: string;
  label: string;
  emoji: string;
  defaultOpen?: boolean;
  tiles: AppTile[];
}

const groups: TileGroup[] = [
  {
    id: "featured",
    label: "Talk to Oracle",
    emoji: "✨",
    defaultOpen: true,
    tiles: [
      { label: "Oracle AI", icon: <MessageCircle className="w-6 h-6" />, path: "/oracle" },
      { label: "Companion", icon: <Heart className="w-6 h-6" />, path: "/ai-companion" },
      { label: "Assistant", icon: <Sparkles className="w-6 h-6" />, path: "/personal-assistant" },
      { label: "AI Tutor", icon: <GraduationCap className="w-6 h-6" />, path: "/ai-tutor" },
      { label: "Interpreter", icon: <Globe className="w-6 h-6" />, path: "/interpreter" },
      { label: "Live Vision", icon: <Eye className="w-6 h-6" />, path: "/live-vision" },
    ],
  },
  {
    id: "creator",
    label: "Create & Studio",
    emoji: "🎬",
    tiles: [
      { label: "Photo Studio", icon: <Camera className="w-6 h-6" />, path: "/photography-hub" },
      { label: "Video Editor", icon: <Video className="w-6 h-6" />, path: "/video-editor" },
      { label: "Movie Studio", icon: <Film className="w-6 h-6" />, path: "/movie-studio-pro" },
      { label: "YouTube Studio", icon: <Video className="w-6 h-6" />, path: "/youtube-show-studio" },
      { label: "Voice Studio", icon: <Music className="w-6 h-6" />, path: "/voice-studio" },
      { label: "Avatar Gen", icon: <Palette className="w-6 h-6" />, path: "/avatar-generator" },
      { label: "Magic Hub", icon: <Star className="w-6 h-6" />, path: "/magic-hub" },
      { label: "Story Writer", icon: <BookOpen className="w-6 h-6" />, path: "/story-writer" },
      { label: "Media Library", icon: <Camera className="w-6 h-6" />, path: "/media-library" },
    ],
  },
  {
    id: "care",
    label: "Care & Safety",
    emoji: "🛡️",
    tiles: [
      { label: "Crisis Hub", icon: <Shield className="w-6 h-6" />, path: "/crisis-hub" },
      { label: "Safety Center", icon: <Shield className="w-6 h-6" />, path: "/safety-center" },
      { label: "Elderly Care", icon: <Pill className="w-6 h-6" />, path: "/elderly-care" },
      { label: "Mind Hub", icon: <Brain className="w-6 h-6" />, path: "/mind-hub" },
      { label: "Family Hub", icon: <Home className="w-6 h-6" />, path: "/family-hub" },
      { label: "Audio Filter", icon: <Shield className="w-6 h-6" />, path: "/audio-filter" },
    ],
  },
  {
    id: "productivity",
    label: "Daily Life",
    emoji: "📅",
    tiles: [
      { label: "Calendar", icon: <Calendar className="w-6 h-6" />, path: "/calendar" },
      { label: "Alarm Clock", icon: <Clock className="w-6 h-6" />, path: "/alarm-clock" },
      { label: "Occasions", icon: <Gift className="w-6 h-6" />, path: "/special-occasions" },
      { label: "Inventor", icon: <Lightbulb className="w-6 h-6" />, path: "/inventor" },
      { label: "Pro Hub", icon: <BarChart3 className="w-6 h-6" />, path: "/professional-hub" },
      { label: "App Builder", icon: <Wrench className="w-6 h-6" />, path: "/app-builder" },
      { label: "POS Learn", icon: <BookOpen className="w-6 h-6" />, path: "/pos-learn" },
    ],
  },
  // Wallet & Vault and Settings & Account groups removed from dashboard —
  // those are now reached via the bottom-nav Vault and Settings tabs.
];

const STORAGE_KEY = "oracle-lunar-dash-groups-open-v2";

const DashboardPage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [shareOpen, setShareOpen] = useState(false);
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return Object.fromEntries(groups.map(g => [g.id, !!g.defaultOpen]));
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(openMap)); } catch {}
  }, [openMap]);

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
  const labelSize = layout?.fontSize || "text-[10px]";
  const gridGap = layout?.gap || "gap-3";
  const tileBR = layout?.borderRadius || "rounded-xl";

  const handleTileClick = (tile: AppTile) => {
    if (tile.path === "__share__") { setShareOpen(true); return; }
    navigate(tile.path);
  };

  const expandAll = () => setOpenMap(Object.fromEntries(groups.map(g => [g.id, true])));
  const collapseAll = () => setOpenMap(Object.fromEntries(groups.map(g => [g.id, false])));

  return (
    <div className="min-h-screen bg-background">
      <WelcomeModal />
      <OracleMoonHeader>
        {/* Action bar under the moon */}
        <div className="flex items-center justify-center gap-3 flex-wrap mt-2">
          {adminLoading ? null : isAdmin ? (
            <>
              <button
                onClick={() => navigate("/owner-dashboard")}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] font-black uppercase bg-amber-500/20 border border-amber-400/60 text-amber-300 hover:bg-amber-500/30 transition shadow-[0_0_18px_rgba(245,158,11,0.35)]"
              >
                👑 Admin Dashboard
              </button>
              <button
                onClick={() => navigate("/admin/editor")}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] font-bold bg-primary/15 border border-primary/40 text-primary hover:bg-primary/25 transition"
              >
                ✏️ Live Editor
              </button>
              <button
                onClick={() => navigate("/admin/usage-audit")}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] font-bold bg-primary/15 border border-primary/40 text-primary hover:bg-primary/25 transition"
              >
                📊 Usage Audit
              </button>
            </>
          ) : (
            <Button
              onClick={() => navigate("/subscribe")}
              size="sm"
              className="group relative overflow-hidden rounded-full px-6 h-9 text-sm font-bold text-black bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.35)] hover:shadow-[0_0_32px_rgba(245,158,11,0.55)] hover:scale-105 transition-all duration-300 border-0"
            >
              <Sparkles className="w-4 h-4 mr-1 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
              Join Membership
            </Button>
          )}
          <SecurityShield />
          {user && (
            <button
              onClick={async () => { await signOut(); navigate("/"); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-destructive/15 border border-destructive/40 text-destructive hover:bg-destructive/25 transition"
              aria-label="Log out"
            >
              <LogOut className="w-3.5 h-3.5" />
              Log out
            </button>
          )}
        </div>
      </OracleMoonHeader>

      {/* Welcome + status line */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">Welcome to Oracle Lunar</h1>
          <p className="text-muted-foreground text-sm">Your AI companion to do everything</p>
          {adminLoading ? null : isAdmin ? (
            <span className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-black shadow-sm">
              👑 Lifetime Owner — Full Access
            </span>
          ) : user && (
            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-primary to-amber-500 text-primary-foreground shadow-sm">
              ✨ Member
            </span>
          )}
        </div>
      </div>

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        title="Oracle Lunar App"
        url={`https://oracle-lunar.online/?ref=${user ? `ORACLE LUNAR${user.id.slice(0,6).toUpperCase()}` : ""}`}
        description="Check out Oracle Lunar — your AI companion to do everything. Sign up free, get welcome coins, and top up only when you want more paid AI actions."
      />

      {/* Creators' Gallery — auto-loads opt-in public creations */}
      <MonthlyAwardsShowcase />
      <HomePublicGallery />

      {/* Expand/collapse controls */}
      <div className="px-4 flex items-center gap-2 mb-3">
        <button onClick={expandAll} className="text-[11px] px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition">Expand all</button>
        <button onClick={collapseAll} className="text-[11px] px-3 py-1 rounded-full bg-muted border border-border text-muted-foreground hover:bg-muted/70 transition">Collapse all</button>
      </div>

      {/* Grouped sections */}
      <div className="px-4 pb-24 space-y-3">
        {groups.map((group) => {
          const open = !!openMap[group.id];
          return (
            <Collapsible
              key={group.id}
              open={open}
              onOpenChange={(v) => setOpenMap(prev => ({ ...prev, [group.id]: v }))}
              className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm overflow-hidden"
            >
              <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{group.emoji}</span>
                  <span className="font-semibold text-foreground text-sm">{group.label}</span>
                  <span className="text-[10px] text-muted-foreground">({group.tiles.length})</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className={`grid ${gridGap} px-3 pb-4 pt-1`} style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
                  {group.tiles.map((tile) => (
                    <button
                      key={group.id + tile.path + tile.label}
                      onClick={() => handleTileClick(tile)}
                      className={`holo-tile flex flex-col items-center gap-2 p-3 ${tileBR} relative`}
                    >
                      <div className="holo-icon text-primary">{tile.icon}</div>
                      <span className={`${labelSize} text-foreground font-medium text-center leading-tight`}>
                        {tile.label}
                      </span>
                    </button>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-md border-t border-border flex justify-around gap-2 px-2 py-2">
        {[
          { label: "Home",     icon: <Home className="w-5 h-5" />,          path: "/dashboard" },
          { label: "Oracle",   icon: <MessageCircle className="w-5 h-5" />, path: "/oracle" },
          { label: "Vault",    icon: <Shield className="w-5 h-5" />,        path: "/vault" },
          { label: "Settings", icon: <Settings className="w-5 h-5" />,      path: "/settings" },
          { label: "Profile",  icon: <User className="w-5 h-5" />,          path: "/profile" },
        ].map((t) => (
          <button
            key={t.path}
            onClick={() => navigate(t.path)}
            className="holo-tile flex-1 flex flex-col items-center gap-1 p-2 rounded-xl"
          >
            <div className="holo-icon text-sky-400">{t.icon}</div>
            <span className="text-[10px] text-foreground font-medium leading-tight">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default DashboardPage;
