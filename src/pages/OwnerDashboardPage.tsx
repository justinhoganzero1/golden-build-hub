import { useState, useEffect } from "react";
import {
  Shield, Users, Gift, Star, BarChart3, Mail, Megaphone,
  Lock, ChevronRight, CheckCircle, XCircle, Eye, Sparkles,
  TrendingUp, DollarSign, Globe, Smartphone, Bell, Settings,
  Search, Filter, Send, Crown, Zap, Image, Video, Music,
  Camera, Grid, List, Trash2, Play, Download, Share2
} from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useAllUserMediaPaginated } from "@/hooks/useAllUserMedia";
import { useQueryClient } from "@tanstack/react-query";
import ShareDialog from "@/components/ShareDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadFileFromUrl } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/useIsAdmin";

// Admin access is controlled via user_roles table (RBAC)

const OwnerDashboardPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"overview" | "suggestions" | "freebies" | "vault" | "marketing" | "advertising" | "library" | "leads" | "ai-studio" | "builder" | "sources">("overview");
  // Admin AI Builder chat state (Lovable AI gateway via ai-tools edge function)
  const [builderMessages, setBuilderMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [builderInput, setBuilderInput] = useState("");
  const [builderLoading, setBuilderLoading] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [freebieEmail, setFreebieEmail] = useState("");
  const [freebies, setFreebies] = useState<{ email: string; date: string; reason: string }[]>([]);
  const [vaultEmail, setVaultEmail] = useState("");
  const [vaultLevel, setVaultLevel] = useState("viewer");
  const [vaultUsers, setVaultUsers] = useState<{ email: string; level: string }[]>([]);
  const [marketingEmail, setMarketingEmail] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [libView, setLibView] = useState<"grid" | "list">("grid");
  const [libFilter, setLibFilter] = useState("All");
  const [libSearch, setLibSearch] = useState("");
  const [libSelected, setLibSelected] = useState<any>(null);
  const [libShareItem, setLibShareItem] = useState<any>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [installStats, setInstallStats] = useState<{
    totalClicks: number; totalInstalls: number;
    perPlatform: { android: { clicks: number; installs: number }; ios: { clicks: number; installs: number }; desktop: { clicks: number; installs: number } };
  }>({ totalClicks: 0, totalInstalls: 0, perPlatform: { android: { clicks: 0, installs: 0 }, ios: { clicks: 0, installs: 0 }, desktop: { clicks: 0, installs: 0 } } });
  // Private live-traffic stats (admin-only) — visitors to landing + total installs + paid upgrades
  const [liveTraffic, setLiveTraffic] = useState<{ visitors: number; installs: number; paidUpgrades: number }>({ visitors: 0, installs: 0, paidUpgrades: 0 });
  // Traffic sources for the bar graph (admin-only): which sites/campaigns referred visitors
  const [trafficSources, setTrafficSources] = useState<{ source: string; visits: number }[]>([]);

  // Ad platform state
  const [adPlatformView, setAdPlatformView] = useState<string | null>(null);
  const [adCampaigns, setAdCampaigns] = useState<{
    platform: string; name: string; status: string; budget: number; spent: number;
    impressions: number; clicks: number; conversions: number; startDate: string; endDate: string;
  }[]>(() => {
    const saved = localStorage.getItem("solace-ad-campaigns");
    return saved ? JSON.parse(saved) : [];
  });
  const [newCampaign, setNewCampaign] = useState({ name: "", budget: "", startDate: "", endDate: "" });

  useEffect(() => {
    localStorage.setItem("solace-ad-campaigns", JSON.stringify(adCampaigns));
  }, [adCampaigns]);

  const adPlatforms = [
    { id: "admob", name: "Google AdMob", icon: "🟢", desc: "Banner, interstitial, rewarded ads", types: ["Banner", "Interstitial", "Rewarded Video", "Native"] },
    { id: "playstore", name: "Google Play Store", icon: "🔵", desc: "Store listing, screenshots, description", types: ["App Install", "Engagement", "Pre-Registration"] },
    { id: "appstore", name: "Apple App Store", icon: "🍎", desc: "iOS listing, TestFlight", types: ["Search Ads", "Today Tab", "Search Tab"] },
    { id: "facebook", name: "Facebook Ads", icon: "📘", desc: "Audience targeting, pixel tracking", types: ["Feed", "Stories", "Marketplace", "Video"] },
    { id: "instagram", name: "Instagram Ads", icon: "📸", desc: "Story ads, reels promotion", types: ["Stories", "Reels", "Feed", "Explore"] },
    { id: "tiktok", name: "TikTok Ads", icon: "🎵", desc: "In-feed ads, branded effects", types: ["In-Feed", "TopView", "Branded Effect", "Hashtag Challenge"] },
    { id: "twitter", name: "Twitter/X Ads", icon: "🐦", desc: "Promoted tweets, trending", types: ["Promoted Tweets", "Follower Ads", "Trend Takeover"] },
    { id: "website", name: "Website Banner", icon: "🌐", desc: "Your website ad integration", types: ["Header Banner", "Sidebar", "Pop-up", "Footer"] },
  ];

  const createCampaign = (platformId: string) => {
    if (!newCampaign.name || !newCampaign.budget) {
      toast.error("Please fill in campaign name and budget");
      return;
    }
    const campaign = {
      platform: platformId,
      name: newCampaign.name,
      status: "Draft",
      budget: parseFloat(newCampaign.budget),
      spent: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      startDate: newCampaign.startDate || new Date().toISOString().split("T")[0],
      endDate: newCampaign.endDate || "",
    };
    setAdCampaigns(prev => [...prev, campaign]);
    setNewCampaign({ name: "", budget: "", startDate: "", endDate: "" });
    toast.success(`Campaign "${campaign.name}" created!`);
  };

  const toggleCampaignStatus = (index: number) => {
    setAdCampaigns(prev => prev.map((c, i) => i === index ? { ...c, status: c.status === "Active" ? "Paused" : "Active" } : c));
  };

  const deleteCampaign = (index: number) => {
    setAdCampaigns(prev => prev.filter((_, i) => i !== index));
    toast.success("Campaign deleted");
  };

  const {
    data: mediaPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: libLoading,
  } = useAllUserMediaPaginated();
  const allMedia = (mediaPages?.pages.flat() ?? []) as any[];
  const qc = useQueryClient();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    // Only redirect once we've fully resolved auth + admin status,
    // and only if the user is signed in but not an admin.
    if (loading || adminLoading) return;
    if (!user) {
      navigate("/sign-in?redirect=/owner-dashboard", { replace: true });
      return;
    }
    if (!isAdmin) {
      navigate("/dashboard", { replace: true });
    }
  }, [loading, adminLoading, isAdmin, user, navigate]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("suggestions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (data) setSuggestions(data);
    })();
  }, []);

  // Load install analytics events for the owner dashboard
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data } = await supabase
        .from("install_events")
        .select("event_type, platform")
        .limit(10000);
      if (!data) return;
      const stats = {
        totalClicks: 0, totalInstalls: 0,
        perPlatform: {
          android: { clicks: 0, installs: 0 },
          ios: { clicks: 0, installs: 0 },
          desktop: { clicks: 0, installs: 0 },
        },
      };
      for (const e of data as Array<{ event_type: string; platform: string }>) {
        const isInstall = e.event_type === "installed";
        if (isInstall) stats.totalInstalls++; else stats.totalClicks++;
        const p = (e.platform === "android" || e.platform === "ios" || e.platform === "desktop") ? e.platform : null;
        if (p) {
          if (isInstall) stats.perPlatform[p].installs++;
          else stats.perPlatform[p].clicks++;
        }
      }
      setInstallStats(stats);
    })();
  }, [isAdmin]);

  // Load private live traffic (admin only): site visitors, installs, paid upgrades
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [{ count: visitors }, { count: installs }] = await Promise.all([
          supabase.from("page_views").select("*", { count: "exact", head: true }).eq("page", "landing"),
          supabase.from("install_events").select("*", { count: "exact", head: true }).eq("event_type", "installed"),
        ]);
        // Paid upgrades: count distinct paid users via Stripe (server-side admin endpoint).
        // Until a dedicated admin counter exists, fall back to 0 — Stripe dashboard is the source of truth.
        let paidUpgrades = 0;
        try {
          const { data } = await supabase.functions.invoke("check-subscription", { body: { admin_count: true } });
          if (typeof data?.paid_count === "number") paidUpgrades = data.paid_count;
        } catch { /* ignore — endpoint may not expose admin counts yet */ }
        if (!cancelled) {
          setLiveTraffic({
            visitors: typeof visitors === "number" ? visitors : 0,
            installs: typeof installs === "number" ? installs : 0,
            paidUpgrades,
          });
        }
      } catch { /* silent */ }
    };
    load();
    const i = window.setInterval(load, 30000);
    return () => { cancelled = true; window.clearInterval(i); };
  }, [isAdmin]);

  // Load traffic sources (admin only) — aggregates utm_source/referrer for the bar graph
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await supabase
          .from("page_views")
          .select("utm_source, referrer")
          .order("created_at", { ascending: false })
          .limit(5000);
        if (!data) return;
        const counts: Record<string, number> = {};
        for (const row of data as Array<{ utm_source: string | null; referrer: string | null }>) {
          let src = row.utm_source?.trim().toLowerCase() || "";
          if (!src && row.referrer) {
            try { src = new URL(row.referrer).hostname.replace(/^www\./, "").toLowerCase(); }
            catch { /* ignore */ }
          }
          if (!src) src = "direct";
          counts[src] = (counts[src] || 0) + 1;
        }
        const arr = Object.entries(counts)
          .map(([source, visits]) => ({ source, visits }))
          .sort((a, b) => b.visits - a.visits)
          .slice(0, 12);
        if (!cancelled) setTrafficSources(arr);
      } catch { /* silent */ }
    };
    load();
    const i = window.setInterval(load, 60000);
    return () => { cancelled = true; window.clearInterval(i); };
  }, [isAdmin]);

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords don't match"); return; }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast.error(error.message);
    else { toast.success("Password updated successfully!"); setNewPassword(""); setConfirmPassword(""); }
    setChangingPassword(false);
  };

  if (loading || adminLoading || !isAdmin) {
    return null;
  }

  const loadSuggestions = async () => {
    // Load all user suggestions (owner can see all)
    const { data } = await supabase.from("suggestions").select("*").order("created_at", { ascending: false }).limit(100);
    if (data) setSuggestions(data);
  };

  const grantFreeAccess = (suggestionId: string) => {
    setSuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, granted_free_access: true, status: "implemented" } : s));
    toast.success("Free lifetime access granted! 🎉");
  };

  const dismissSuggestion = (id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: "dismissed" } : s));
    toast("Suggestion dismissed");
  };

  const addFreebie = () => {
    if (!freebieEmail.trim()) return;
    setFreebies(prev => [...prev, { email: freebieEmail, date: new Date().toLocaleDateString(), reason: "Suggestion implemented" }]);
    setFreebieEmail("");
    toast.success("Lifetime free access granted!");
  };

  const addVaultUser = () => {
    if (!vaultEmail.trim()) return;
    setVaultUsers(prev => [...prev, { email: vaultEmail, level: vaultLevel }]);
    setVaultEmail("");
    toast.success("Vault access granted!");
  };

  const sendMarketingEmail = () => {
    if (!marketingEmail || !emailSubject || !emailBody) { toast.error("Fill all fields"); return; }
    toast.success("Marketing email sent!");
    setMarketingEmail("");
    setEmailSubject("");
    setEmailBody("");
  };

  const qualitySuggestions = suggestions.filter(s => (s.ai_quality_score || 0) >= 5 && s.status !== "dismissed");
  const totalUsers = 0;
  const paidUsers = 0;
  const trialUsers = 0;
  const revenue = 0;

  const tabs = [
    { key: "overview", label: "Overview", icon: <BarChart3 className="w-4 h-4" /> },
    { key: "builder", label: "AI Builder", icon: <Zap className="w-4 h-4" /> },
    { key: "library", label: "Users Library", icon: <Camera className="w-4 h-4" /> },
    { key: "suggestions", label: "Ideas", icon: <Sparkles className="w-4 h-4" /> },
    { key: "freebies", label: "Freebies", icon: <Gift className="w-4 h-4" /> },
    { key: "vault", label: "Vault", icon: <Lock className="w-4 h-4" /> },
    { key: "marketing", label: "Marketing", icon: <Megaphone className="w-4 h-4" /> },
    { key: "advertising", label: "Ads", icon: <Globe className="w-4 h-4" /> },
    { key: "sources", label: "Traffic Sources", icon: <TrendingUp className="w-4 h-4" /> },
    { key: "ai-studio", label: "AI Studio (Beta)", icon: <Sparkles className="w-4 h-4" /> },
  ] as const;

  // Admin AI Builder — sends messages to the existing ai-tools edge function with a
  // "site architect" system prompt. Returns engineering plans + code skeletons the admin
  // can hand to Lovable to implement. (We can only modify THIS site/app — third-party apps
  // and arbitrary websites on the public internet cannot be remotely edited.)
  const sendBuilderMessage = async () => {
    const text = builderInput.trim();
    if (!text || builderLoading) return;
    setBuilderInput("");
    const userMsg = { role: "user" as const, content: text };
    setBuilderMessages(prev => [...prev, userMsg]);
    setBuilderLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-tools", {
        body: {
          tool: "site-architect",
          messages: [
            {
              role: "system",
              content:
                "You are SOLACE Site Architect — an elite full-stack engineer with ULTIMATE coding ability for the SOLACE web app. " +
                "Stack: React 18 + Vite + Tailwind + shadcn/ui + Supabase (Postgres + RLS + Edge Functions in Deno) + Lovable AI Gateway. " +
                "When the admin asks to add a feature, change behavior, fix a bug, or extend an app inside SOLACE, respond with: " +
                "(1) a short plan, (2) the exact files to create/edit with full code blocks, (3) any SQL migration needed, " +
                "(4) RLS policies for any new tables, (5) any edge function changes. " +
                "IMPORTANT LIMITS: You can only modify THIS SOLACE codebase. You CANNOT remotely modify third-party websites, " +
                "external apps, or other users' devices on the public internet — say so plainly if asked. " +
                "For features that need to be deployed to other users, explain that the admin should ship the change here " +
                "and all signed-in users will receive the update on next page load.",
            },
            ...builderMessages,
            userMsg,
          ],
        },
      });
      if (error) throw error;
      const reply = (data?.reply || data?.content || data?.message || "I couldn't generate a response.") as string;
      setBuilderMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "AI Builder failed");
      setBuilderMessages(prev => [...prev, { role: "assistant", content: "Sorry — the AI Builder hit an error. Please try again." }]);
    } finally {
      setBuilderLoading(false);
    }
  };

  const filteredLib = allMedia.filter((m: any) => {
    if (libFilter === "Images" && m.media_type !== "image") return false;
    if (libFilter === "Videos" && m.media_type !== "video") return false;
    if (libFilter === "Audio" && m.media_type !== "audio") return false;
    if (libSearch && !(m.title || "").toLowerCase().includes(libSearch.toLowerCase())) return false;
    return true;
  });

  const handleDeleteMedia = async (id: string) => {
    const { error } = await supabase.from("user_media").delete().eq("id", id);
    if (!error) {
      toast.success("Deleted");
      setLibSelected(null);
      qc.invalidateQueries({ queryKey: ["all-user-media-paginated"] });
      qc.invalidateQueries({ queryKey: ["all-user-media"] });
    }
  };

  const getMediaIcon = (type: string) => {
    if (type === "image") return <Image className="w-6 h-6 text-blue-400" />;
    if (type === "video") return <Video className="w-6 h-6 text-purple-400" />;
    return <Music className="w-6 h-6 text-pink-400" />;
  };

  return (
    <div className="min-h-screen pb-20" style={{ background: "linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 50%, #0a1628 100%)" }}>
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30">
            <Crown className="w-8 h-8 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent">Owner Dashboard</h1>
            <p className="text-gray-500 text-xs">SOLACE Command Center</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all ${tab === t.key ? "bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 border border-yellow-500/30" : "bg-white/5 text-gray-400 border border-white/5"}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="space-y-4">
            {/* Private Live Traffic — admin only, your site */}
            <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="w-4 h-4 text-yellow-400" />
                <h3 className="text-sm font-bold text-white">Live Traffic — Your Site (Private)</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <Eye className="w-4 h-4 text-cyan-300 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-cyan-300">{liveTraffic.visitors.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400">Visitors</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <Download className="w-4 h-4 text-emerald-300 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-emerald-300">{liveTraffic.installs.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400">Downloads</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <Crown className="w-4 h-4 text-yellow-300 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-yellow-300">{liveTraffic.paidUpgrades.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400">Upgraded</p>
                </div>
              </div>
              <p className="text-[10px] text-gray-500 mt-2">Refreshes every 30 seconds. Only you can see this.</p>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total Users", value: totalUsers, icon: <Users className="w-5 h-5" />, color: "from-blue-500/20 to-cyan-500/20", textColor: "text-blue-400" },
                { label: "Paid Members", value: paidUsers, icon: <DollarSign className="w-5 h-5" />, color: "from-green-500/20 to-emerald-500/20", textColor: "text-green-400" },
                { label: "Trial Users", value: trialUsers, icon: <Zap className="w-5 h-5" />, color: "from-purple-500/20 to-pink-500/20", textColor: "text-purple-400" },
                { label: "Revenue", value: `$${revenue}`, icon: <TrendingUp className="w-5 h-5" />, color: "from-yellow-500/20 to-orange-500/20", textColor: "text-yellow-400" },
              ].map((stat, i) => (
                <div key={i} className={`bg-gradient-to-br ${stat.color} border border-white/10 rounded-2xl p-4`}>
                  <div className={`${stat.textColor} mb-2`}>{stat.icon}</div>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-[10px] text-gray-400">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-white mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Review Ideas", action: () => setTab("suggestions"), icon: <Sparkles className="w-4 h-4" /> },
                  { label: "Grant Freebies", action: () => setTab("freebies"), icon: <Gift className="w-4 h-4" /> },
                  { label: "Send Campaign", action: () => setTab("marketing"), icon: <Mail className="w-4 h-4" /> },
                  { label: "Manage Ads", action: () => setTab("advertising"), icon: <Globe className="w-4 h-4" /> },
                  { label: "Marketing Studio", action: () => navigate("/marketing-hub"), icon: <Megaphone className="w-4 h-4" /> },
                ].map((qa, i) => (
                  <button key={i} onClick={qa.action} className="flex items-center gap-2 px-3 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-xs hover:border-yellow-500/30 transition-all">
                    {qa.icon} {qa.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pending quality suggestions count */}
            <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-2xl p-4 flex items-center gap-3">
              <Bell className="w-6 h-6 text-yellow-400" />
              <div className="flex-1">
                <p className="text-sm font-bold text-white">{qualitySuggestions.length} Quality Ideas Pending</p>
                <p className="text-[10px] text-gray-400">AI filtered — garbage removed</p>
              </div>
              <button onClick={() => setTab("suggestions")} className="text-xs text-yellow-400 font-medium">Review →</button>
            </div>

            {/* Install Analytics */}
            {(() => {
              const conv = installStats.totalClicks > 0
                ? Math.round((installStats.totalInstalls / installStats.totalClicks) * 100)
                : 0;
              const rows = [
                { key: "android", label: "Android", icon: <Smartphone className="w-4 h-4" />, ...installStats.perPlatform.android },
                { key: "ios", label: "iOS", icon: <Smartphone className="w-4 h-4" />, ...installStats.perPlatform.ios },
                { key: "desktop", label: "Desktop", icon: <Globe className="w-4 h-4" />, ...installStats.perPlatform.desktop },
              ];
              return (
                <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Download className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-sm font-bold text-white">Install Analytics</h3>
                    <span className="ml-auto text-[10px] text-gray-400">Live</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white/5 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-cyan-300">{installStats.totalClicks}</p>
                      <p className="text-[10px] text-gray-400">Clicks</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-emerald-300">{installStats.totalInstalls}</p>
                      <p className="text-[10px] text-gray-400">Installs</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-yellow-300">{conv}%</p>
                      <p className="text-[10px] text-gray-400">Conversion</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {rows.map((r) => (
                      <div key={r.key} className="flex items-center gap-2 text-xs bg-white/5 rounded-lg px-3 py-2">
                        <span className="text-cyan-300">{r.icon}</span>
                        <span className="text-white font-medium w-16">{r.label}</span>
                        <span className="text-gray-400">Clicks: <span className="text-white">{r.clicks}</span></span>
                        <span className="text-gray-400 ml-auto">Installs: <span className="text-emerald-300">{r.installs}</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* LEADS — captured by SOLACE Concierge */}
        {tab === "leads" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-lg font-bold text-white">Concierge Leads</h2>
                <p className="text-xs text-gray-400">Inquiries the Oracle Concierge captured from visitors</p>
              </div>
              <span className="text-xs text-amber-400 font-bold">{leads.length} total</span>
            </div>
            {leads.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm">
                No leads yet. The Concierge will capture them as visitors ask questions.
              </div>
            ) : (
              <div className="space-y-2">
                {leads.map((l) => (
                  <div key={l.id} className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-sm font-bold text-white">{l.name || "Anonymous visitor"}</p>
                        <p className="text-xs text-amber-400">{l.email || "no email"}{l.phone ? ` · ${l.phone}` : ""}</p>
                      </div>
                      <span className="text-[10px] text-gray-500">{new Date(l.created_at).toLocaleString()}</span>
                    </div>
                    {l.interest && (
                      <p className="text-xs text-purple-300 mb-1">Interest: {l.interest}</p>
                    )}
                    <p className="text-sm text-gray-300">{l.message}</p>
                    {l.email && (
                      <a href={`mailto:${l.email}?subject=Re:%20${encodeURIComponent(l.interest || "Your SOLACE inquiry")}`}
                        className="inline-block mt-2 px-3 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-bold">
                        Reply by Email
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SUGGESTIONS */}
        {tab === "suggestions" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-white">Quality User Ideas</h2>
              <span className="text-[10px] text-gray-400">AI filtered • Garbage removed</span>
            </div>
            {suggestions.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No suggestions yet</p>
            ) : suggestions.filter(s => s.status !== "dismissed").map(s => (
              <div key={s.id} className={`bg-white/5 border rounded-2xl p-4 ${s.granted_free_access ? "border-green-500/30" : "border-white/10"}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${(s.ai_quality_score || 0) >= 7 ? "bg-green-500/20 text-green-400" : (s.ai_quality_score || 0) >= 4 ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"}`}>
                      Score: {s.ai_quality_score || 0}/10
                    </div>
                    <span className="text-[9px] text-gray-500">{s.category}</span>
                  </div>
                  <span className="text-[9px] text-gray-600">{new Date(s.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-gray-200 mb-3">{s.suggestion}</p>
                {s.ai_response && <p className="text-[10px] text-gray-500 italic mb-3">AI: {s.ai_response}</p>}
                {!s.granted_free_access && s.status !== "implemented" ? (
                  <div className="flex gap-2">
                    <button onClick={() => grantFreeAccess(s.id)} className="flex-1 py-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs font-medium flex items-center justify-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Implement & Grant Free
                    </button>
                    <button onClick={() => dismissSuggestion(s.id)} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-xs">
                      <XCircle className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-green-400 text-xs">
                    <CheckCircle className="w-4 h-4" /> Free access granted
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* FREEBIES */}
        {tab === "freebies" && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Gift className="w-5 h-5 text-green-400" />
                <h3 className="text-sm font-bold text-white">Grant Lifetime Free Access</h3>
              </div>
              <p className="text-xs text-gray-400 mb-3">For users whose ideas were implemented</p>
              <input value={freebieEmail} onChange={e => setFreebieEmail(e.target.value)} placeholder="user@email.com" className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none mb-3" />
              <button onClick={addFreebie} className="w-full py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium text-sm">Grant Lifetime Access</button>
            </div>
            <h3 className="text-sm font-bold text-white">Granted Users ({freebies.length})</h3>
            {freebies.length === 0 ? <p className="text-xs text-gray-500 italic">No users granted yet</p> : freebies.map((f, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <div className="flex-1">
                  <p className="text-sm text-white">{f.email}</p>
                  <p className="text-[10px] text-gray-500">{f.date} • {f.reason}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* VAULT */}
        {tab === "vault" && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Deep Dark Vault Access</h3>
              </div>
              <p className="text-xs text-gray-400 mb-3">Share vault access with different security levels</p>
              <input value={vaultEmail} onChange={e => setVaultEmail(e.target.value)} placeholder="user@email.com" className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none mb-3" />
              <select value={vaultLevel} onChange={e => setVaultLevel(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white mb-3">
                <option value="viewer">👁 Viewer — Read only</option>
                <option value="editor">✏️ Editor — Read & write</option>
                <option value="admin">🔐 Admin — Full access</option>
              </select>
              <button onClick={addVaultUser} className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium text-sm">Grant Vault Access</button>
            </div>
            <h3 className="text-sm font-bold text-white">Vault Users ({vaultUsers.length})</h3>
            {vaultUsers.map((u, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
                <Shield className="w-4 h-4 text-purple-400" />
                <div className="flex-1">
                  <p className="text-sm text-white">{u.email}</p>
                  <p className="text-[10px] text-gray-500 capitalize">{u.level}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MARKETING */}
        {tab === "marketing" && (
          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Mail className="w-4 h-4 text-yellow-400" /> Email Campaign</h3>
              <input value={marketingEmail} onChange={e => setMarketingEmail(e.target.value)} placeholder="Recipient emails (comma separated)" className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none mb-3" />
              <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Email subject" className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none mb-3" />
              <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} placeholder="Email body..." rows={4} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none mb-3 resize-none" />
              <button onClick={sendMarketingEmail} className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-medium text-sm flex items-center justify-center gap-2">
                <Send className="w-4 h-4" /> Send Campaign
              </button>
            </div>

            {/* Trial bombardment */}
            <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-white mb-2">⚡ Trial User Marketing</h3>
              <p className="text-xs text-gray-400 mb-3">Automatically send marketing to trial users whose trial expired</p>
              <div className="space-y-2">
                {["Send upgrade reminder", "Send feature highlights", "Send discount offer (20% off)", "Send FOMO countdown"].map((action, i) => (
                  <button key={i} onClick={() => toast.success(`${action} sent to ${trialUsers} trial users!`)} className="w-full py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-xs hover:border-orange-500/30 transition-all text-left px-4">
                    {action}
                  </button>
                ))}
              </div>
            </div>

            {/* Referral paywall discounts */}
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-white mb-2">🎁 Referral Discounts</h3>
              <p className="text-xs text-gray-400 mb-3">Configure paywall discounts for referrals</p>
              <div className="grid grid-cols-2 gap-2">
                {["10% off 1 referral", "25% off 3 referrals", "50% off 5 referrals", "Free month 10 refs"].map((d, i) => (
                  <div key={i} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300 text-center">{d}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ADVERTISING */}
        {tab === "advertising" && !adPlatformView && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-white mb-2">Ad Platform Integration</h2>
            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Active Campaigns", value: adCampaigns.filter(c => c.status === "Active").length },
                { label: "Total Budget", value: `$${adCampaigns.reduce((s, c) => s + c.budget, 0).toLocaleString()}` },
                { label: "Total Spent", value: `$${adCampaigns.reduce((s, c) => s + c.spent, 0).toLocaleString()}` },
                { label: "Total Clicks", value: adCampaigns.reduce((s, c) => s + c.clicks, 0).toLocaleString() },
              ].map((s, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-white">{s.value}</p>
                  <p className="text-[10px] text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>

            {adPlatforms.map((ad) => {
              const campaigns = adCampaigns.filter(c => c.platform === ad.id);
              const active = campaigns.filter(c => c.status === "Active").length;
              return (
                <button key={ad.id} onClick={() => setAdPlatformView(ad.id)}
                  className="w-full flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-4 hover:border-yellow-500/30 transition-all">
                  <span className="text-2xl">{ad.icon}</span>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-white">{ad.name}</p>
                    <p className="text-[10px] text-gray-500">{ad.desc}</p>
                    {campaigns.length > 0 && (
                      <p className="text-[10px] text-yellow-400 mt-0.5">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} • {active} active</p>
                    )}
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full ${active > 0 ? "bg-green-500/20 text-green-400" : campaigns.length > 0 ? "bg-blue-500/20 text-blue-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                    {active > 0 ? "Active" : campaigns.length > 0 ? "Ready" : "Setup"}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>
              );
            })}
          </div>
        )}

        {/* AD PLATFORM DETAIL VIEW */}
        {tab === "advertising" && adPlatformView && (() => {
          const platform = adPlatforms.find(p => p.id === adPlatformView)!;
          const campaigns = adCampaigns.filter(c => c.platform === adPlatformView);
          const campaignStartIdx = adCampaigns.findIndex(c => c.platform === adPlatformView);
          return (
            <div className="space-y-4">
              <button onClick={() => setAdPlatformView(null)} className="flex items-center gap-2 text-yellow-400 text-sm mb-2">
                ← Back to platforms
              </button>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">{platform.icon}</span>
                <div>
                  <h2 className="text-base font-bold text-white">{platform.name}</h2>
                  <p className="text-xs text-gray-400">{platform.desc}</p>
                </div>
              </div>

              {/* Platform stats */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Impressions", value: campaigns.reduce((s, c) => s + c.impressions, 0).toLocaleString() },
                  { label: "Clicks", value: campaigns.reduce((s, c) => s + c.clicks, 0).toLocaleString() },
                  { label: "Conversions", value: campaigns.reduce((s, c) => s + c.conversions, 0).toLocaleString() },
                ].map((s, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-2 text-center">
                    <p className="text-sm font-bold text-white">{s.value}</p>
                    <p className="text-[9px] text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Create campaign */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-white">Create Campaign</h3>
                <input value={newCampaign.name} onChange={e => setNewCampaign(p => ({ ...p, name: e.target.value }))}
                  placeholder="Campaign name" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-gray-600 outline-none" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={newCampaign.budget} onChange={e => setNewCampaign(p => ({ ...p, budget: e.target.value }))}
                    placeholder="Budget ($)" type="number" className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-gray-600 outline-none" />
                  <input value={newCampaign.startDate} onChange={e => setNewCampaign(p => ({ ...p, startDate: e.target.value }))}
                    type="date" className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                </div>
                <div className="flex flex-wrap gap-1">
                  {platform.types.map(t => (
                    <span key={t} className="text-[9px] px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">{t}</span>
                  ))}
                </div>
                <button onClick={() => createCampaign(adPlatformView)}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 text-yellow-400 text-sm font-medium hover:from-yellow-500/30 hover:to-orange-500/30 transition-all">
                  + Create Campaign
                </button>
              </div>

              {/* Campaign list */}
              {campaigns.length === 0 ? (
                <div className="text-center py-10">
                  <Megaphone className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No campaigns yet</p>
                  <p className="text-gray-600 text-xs">Create your first campaign above</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-white">Campaigns ({campaigns.length})</h3>
                  {campaigns.map((c, ci) => {
                    const globalIdx = adCampaigns.indexOf(c);
                    const ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(1) : "0.0";
                    return (
                      <div key={ci} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-white">{c.name}</p>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full ${c.status === "Active" ? "bg-green-500/20 text-green-400" : c.status === "Paused" ? "bg-orange-500/20 text-orange-400" : "bg-gray-500/20 text-gray-400"}`}>
                            {c.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {[
                            { label: "Budget", value: `$${c.budget}` },
                            { label: "Spent", value: `$${c.spent}` },
                            { label: "Clicks", value: c.clicks.toLocaleString() },
                            { label: "CTR", value: `${ctr}%` },
                          ].map((s, si) => (
                            <div key={si} className="text-center">
                              <p className="text-[10px] font-bold text-white">{s.value}</p>
                              <p className="text-[8px] text-gray-500">{s.label}</p>
                            </div>
                          ))}
                        </div>
                        {/* Budget bar */}
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all"
                            style={{ width: `${c.budget > 0 ? Math.min((c.spent / c.budget) * 100, 100) : 0}%` }} />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => toggleCampaignStatus(globalIdx)}
                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium border transition-all ${c.status === "Active" ? "bg-orange-500/10 border-orange-500/20 text-orange-400" : "bg-green-500/10 border-green-500/20 text-green-400"}`}>
                            {c.status === "Active" ? "⏸ Pause" : "▶ Activate"}
                          </button>
                          <button onClick={() => deleteCampaign(globalIdx)}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-red-500/10 border border-red-500/20 text-red-400 transition-all">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* USERS LIBRARY */}
        {tab === "library" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-white">All Users' Media ({filteredLib.length})</h2>
              <button onClick={() => setLibView(libView === "grid" ? "list" : "grid")} className="p-2 rounded-lg bg-white/5 border border-white/10">
                {libView === "grid" ? <List className="w-4 h-4 text-gray-400" /> : <Grid className="w-4 h-4 text-gray-400" />}
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
              <input value={libSearch} onChange={e => setLibSearch(e.target.value)} placeholder="Search all user media..."
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-gray-600 outline-none" />
            </div>

            <div className="flex gap-2">
              {["All", "Images", "Videos", "Audio"].map(f => (
                <button key={f} onClick={() => setLibFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-colors ${libFilter === f ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" : "bg-white/5 border border-white/10 text-gray-400"}`}>{f}</button>
              ))}
            </div>

            {filteredLib.length === 0 ? (
              <div className="text-center py-20">
                <Camera className="w-16 h-16 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No user media found</p>
              </div>
            ) : libView === "grid" ? (
              <div className="grid grid-cols-3 gap-2">
                {filteredLib.map((m: any) => (
                  <div key={m.id} className="relative">
                    <button
                      onClick={() => setLibSelected(m)}
                      onMouseEnter={() => setHoveredItem(m.id)}
                      onMouseLeave={() => setHoveredItem(null)}
                      className="w-full aspect-square bg-white/5 border border-white/10 rounded-xl overflow-hidden flex flex-col items-center justify-center gap-1 hover:border-yellow-500/30 transition-all"
                    >
                      {m.media_type === "image" && m.url ? (
                        <img src={m.url} alt={m.title} className="w-full h-full object-cover" />
                      ) : (
                        <>
                          {getMediaIcon(m.media_type)}
                          <p className="text-[9px] text-gray-500 truncate w-full text-center px-1">{m.title}</p>
                        </>
                      )}
                    </button>
                    {hoveredItem === m.id && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm rounded-b-xl p-2 text-[9px] text-gray-300 z-10">
                        <p className="font-medium truncate">{m.title || "Untitled"}</p>
                        <p className="text-gray-500">By: {m.user_id?.slice(0, 8)}... • {m.source_page}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLib.map((m: any) => (
                  <button key={m.id} onClick={() => setLibSelected(m)}
                    className="w-full flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3 hover:border-yellow-500/30 transition-all text-left group">
                    {m.media_type === "image" && m.url ? (
                      <img src={m.url} alt={m.title} className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="p-2 rounded-lg bg-white/10">{getMediaIcon(m.media_type)}</div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm text-white">{m.title || "Untitled"}</p>
                      <p className="text-[10px] text-gray-500">{m.source_page} • {new Date(m.created_at).toLocaleDateString()}</p>
                      <p className="text-[9px] text-gray-600">User: {m.user_id?.slice(0, 8)}...</p>
                    </div>
                    <Eye className="w-4 h-4 text-gray-600 group-hover:text-yellow-400" />
                  </button>
                ))}
              </div>
            )}

            {hasNextPage && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="px-5 py-2 rounded-xl bg-yellow-500/15 border border-yellow-500/40 text-yellow-300 text-sm font-medium hover:bg-yellow-500/25 transition disabled:opacity-50"
                >
                  {isFetchingNextPage ? "Loading..." : "Load 60 more"}
                </button>
              </div>
            )}
            {libLoading && allMedia.length === 0 && (
              <div className="text-center py-10 text-xs text-gray-500">Loading library...</div>
            )}
          </div>
        )}

        {/* Library item detail dialog */}
        <Dialog open={!!libSelected} onOpenChange={() => setLibSelected(null)}>
          <DialogContent className="max-w-[95vw] bg-[#1a1a2e] border-white/10 text-white">
            <DialogHeader><DialogTitle className="text-base">{libSelected?.title || "Media"}</DialogTitle></DialogHeader>
            {libSelected && (
              <div className="space-y-4 mt-2">
                <div className="aspect-video bg-white/5 rounded-xl flex items-center justify-center overflow-hidden">
                  {libSelected.media_type === "image" && libSelected.url ? (
                    <img src={libSelected.url} alt={libSelected.title} className="w-full h-full object-contain" />
                  ) : libSelected.media_type === "video" ? (
                    <div className="text-center"><Play className="w-12 h-12 text-purple-400 mx-auto mb-2" /><p className="text-xs text-gray-500">Video</p></div>
                  ) : (
                    <div className="text-center"><Music className="w-12 h-12 text-pink-400 mx-auto mb-2" /><p className="text-xs text-gray-500">Audio</p></div>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-400">Source: {libSelected.source_page}</p>
                  <p className="text-xs text-gray-400">Creator: {libSelected.user_id}</p>
                  <p className="text-[10px] text-gray-500">{new Date(libSelected.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={async () => {
                    if (!libSelected.url) return;
                    try {
                      await downloadFileFromUrl(libSelected.url, libSelected.title || "media");
                      toast.success("Downloaded!");
                    } catch (error) {
                      console.error(error);
                      toast.error("Failed to download media");
                    }
                  }}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-xs font-medium flex items-center justify-center gap-2">
                    <Download className="w-4 h-4" /> Download
                  </button>
                  <button onClick={() => setLibShareItem(libSelected)}
                    className="py-2.5 px-4 rounded-xl bg-white/10 text-white text-xs font-medium">
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteMedia(libSelected.id)}
                    className="py-2.5 px-4 rounded-xl bg-red-500/20 text-red-400 text-xs font-medium">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* TRAFFIC SOURCES — admin-only bar graph showing where visitors came from */}
        {tab === "sources" && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-5 h-5 text-cyan-300" />
                <h3 className="text-sm font-bold text-white">Where your visitors came from</h3>
              </div>
              <p className="text-[11px] text-gray-400 mb-4">
                Top sources for the last 5,000 visits. Sources include UTM tags (e.g. <span className="text-cyan-300">?utm_source=facebook</span>) and referring sites. "direct" = typed URL or no referrer.
              </p>

              {trafficSources.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-xs">No traffic data yet — share your link to start tracking.</div>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    const max = Math.max(...trafficSources.map(s => s.visits), 1);
                    return trafficSources.map((s, i) => {
                      const pct = (s.visits / max) * 100;
                      return (
                        <div key={s.source + i} className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-white font-medium truncate max-w-[60%]">{s.source}</span>
                            <span className="text-cyan-300 font-bold">{s.visits.toLocaleString()}</span>
                          </div>
                          <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-[11px] text-gray-400">
              <p className="text-white text-xs font-bold mb-2">💡 Tip — track each campaign</p>
              <p>Share trackable links like:</p>
              <code className="block mt-2 p-2 bg-black/40 rounded text-cyan-300 break-all">
                https://golden-vault-builder.lovable.app/?utm_source=facebook&utm_medium=ad&utm_campaign=launch
              </code>
              <p className="mt-2">Each one shows up as a separate bar above so you know exactly what's working.</p>
            </div>
          </div>
        )}

        {tab === "ai-studio" && (
          <div className="bg-white/5 border border-yellow-500/20 rounded-2xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <Sparkles className="w-6 h-6 text-yellow-400 mt-0.5" />
              <div>
                <h2 className="text-lg font-bold text-white">AI Studio (Admin Only — Beta)</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Hidden from regular users while we polish it. Only admins can preview and iterate here.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate("/ai-studio")}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-semibold text-sm hover:shadow-lg hover:shadow-yellow-500/30 transition-all"
            >
              Open AI Studio →
            </button>
          </div>
        )}

        {/* AI BUILDER — Admin-only ultimate-coding chat for shipping features into SOLACE */}
        {tab === "builder" && (
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-5 h-5 text-yellow-400" />
                <h2 className="text-base font-bold text-white">SOLACE AI Builder</h2>
              </div>
              <p className="text-[11px] text-gray-400">
                Ultimate-level coding assistant for this site and every app inside it. Ask it to add features, fix bugs,
                build new pages, or extend existing apps — it returns full code + SQL + edge function plans.
                Changes deploy to all signed-in users on next page load. Note: external sites and other users' devices
                cannot be remotely modified — only this SOLACE app.
              </p>
            </div>

            <div className="bg-black/40 border border-white/10 rounded-2xl h-[420px] overflow-y-auto p-3 space-y-3">
              {builderMessages.length === 0 && (
                <div className="text-center text-xs text-gray-500 py-8">
                  Try: <span className="text-yellow-400">"Add a /changelog page that lists every release"</span> or{" "}
                  <span className="text-yellow-400">"Make Oracle remember favorite color"</span>
                </div>
              )}
              {builderMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-yellow-500/20 border border-yellow-500/30 text-yellow-100"
                      : "bg-white/5 border border-white/10 text-gray-200"
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {builderLoading && (
                <div className="text-[11px] text-gray-500">Architect is thinking…</div>
              )}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); sendBuilderMessage(); }}
              className="flex gap-2"
            >
              <input
                value={builderInput}
                onChange={(e) => setBuilderInput(e.target.value)}
                placeholder="Describe a feature, fix, or app to build…"
                className="flex-1 px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-500/50"
              />
              <button
                type="submit"
                disabled={builderLoading || !builderInput.trim()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-semibold text-xs disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        <ShareDialog
          open={!!libShareItem}
          onOpenChange={() => setLibShareItem(null)}
          title={libShareItem?.title || "Media"}
          url={libShareItem?.url}
          imageUrl={libShareItem?.url}
          description={`Check out this ${libShareItem?.media_type || "media"} from Solace!`}
        />
      </div>
    </div>
  );
};

export default OwnerDashboardPage;
