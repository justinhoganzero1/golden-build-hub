import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import {
  Shield, Users, Gift, Star, BarChart3, Mail, Megaphone,
  Lock, ChevronRight, CheckCircle, XCircle, Eye, Sparkles,
  TrendingUp, DollarSign, Globe, Smartphone, Bell, Settings,
  Search, Filter, Send, Crown, Zap, Image, Video, Music,
  Camera, Grid, List, Trash2, Play, Download, Share2, LogOut, Home
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useNavigate } from "react-router-dom";
import { useAllUserMediaPaginated } from "@/hooks/useAllUserMedia";
import { useQueryClient } from "@tanstack/react-query";
import ShareDialog from "@/components/ShareDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadFileFromUrl, isLowPowerMobile } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import FeaturedPhotoPicker from "@/components/admin/FeaturedPhotoPicker";

const StripeConnectPanel = lazy(() => import("@/components/StripeConnectPanel"));
const StripeRevenuePanel = lazy(() => import("@/components/StripeRevenuePanel"));
const AdvertiserInquiriesPanel = lazy(() => import("@/components/admin/AdvertiserInquiriesPanel"));
const AudioAnalyticsCard = lazy(() => import("@/components/admin/AudioAnalyticsCard"));
const PricingEditorPanel = lazy(() => import("@/components/admin/PricingEditorPanel"));

// Admin access is controlled via user_roles table (RBAC)

const OwnerDashboardPage = () => {
  const { user, loading, signOut } = useAuth();
  const { isReady, accessToken } = useAuthReady();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"overview" | "suggestions" | "freebies" | "vault" | "marketing" | "advertising" | "advertisers" | "library" | "leads" | "ai-studio" | "builder" | "sources" | "crawler" | "users" | "trials" | "failed-signups">("overview");
  // Users tab — list of all members, split into online/offline sub-tabs
  const [usersList, setUsersList] = useState<Array<{ id: string; email: string; created_at: string; last_sign_in_at: string | null; online: boolean; member?: boolean; freebie_active?: boolean; free_for_life?: boolean; grant_expires_at?: string | null; grant_reason?: string | null; wallet_balance_cents?: number }>>([]);
  const [trialsList, setTrialsList] = useState<Array<{ id: string; email: string | null; created_at: string | null; last_sign_in_at: string | null; reward_type: string | null; grant_reason: string | null; grant_expires_at: string | null; free_for_life: boolean }>>([]);
  const [trialsLoading, setTrialsLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersSubTab, setUsersSubTab] = useState<"online" | "offline">("online");
  const [usersSearch, setUsersSearch] = useState("");
  // Failed sign-ups tab
  const [failedSignups, setFailedSignups] = useState<Array<{ id: string; email: string | null; reason: string; error_code: string | null; created_at: string }>>([]);
  const [failedSignupsLoading, setFailedSignupsLoading] = useState(false);
  // Web Crawler state (admin growth engine)
  const [crawlerCampaign, setCrawlerCampaign] = useState<"press" | "partnership" | "directory" | "investor" | "backlink">("press");
  const [crawlerNiche, setCrawlerNiche] = useState("AI mental health super app");
  const [crawlerLimit, setCrawlerLimit] = useState(8);
  const [crawlerLogToLeads, setCrawlerLogToLeads] = useState(true);
  const [crawlerBusy, setCrawlerBusy] = useState(false);
  const [crawlerResults, setCrawlerResults] = useState<Array<{ url: string; title?: string; description?: string; contact_email?: string | null; outreach_subject?: string; outreach_body?: string; category?: string }>>([]);
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
  const [memberStats, setMemberStats] = useState({ totalUsers: 0, paidUsers: 0, trialUsers: 0, revenue: 0 });
  // Private live-traffic stats (admin-only) — visitors to landing + total installs + paid upgrades
  const [liveTraffic, setLiveTraffic] = useState<{ visitors: number; returning: number; installs: number; paidUpgrades: number }>({ visitors: 0, returning: 0, installs: 0, paidUpgrades: 0 });
  // Traffic sources for the bar graph (admin-only): which sites/campaigns referred visitors
  const [trafficSources, setTrafficSources] = useState<{ source: string; visits: number }[]>([]);
  // Top pages viewed (admin-only): which pages are most-visited
  const [topPages, setTopPages] = useState<{ page: string; visits: number }[]>([]);

  // Ad platform state
  const [adPlatformView, setAdPlatformView] = useState<string | null>(null);
  const [adCampaigns, setAdCampaigns] = useState<{
    platform: string; name: string; status: string; budget: number; spent: number;
    impressions: number; clicks: number; conversions: number; startDate: string; endDate: string;
  }[]>(() => {
    const saved = localStorage.getItem("oracle-lunar-ad-campaigns");
    return saved ? JSON.parse(saved) : [];
  });
  const [newCampaign, setNewCampaign] = useState({ name: "", budget: "", startDate: "", endDate: "" });

  useEffect(() => {
    localStorage.setItem("oracle-lunar-ad-campaigns", JSON.stringify(adCampaigns));
  }, [adCampaigns]);

  const lowPowerMode = useMemo(() => isLowPowerMobile(), []);

  // ⚠️ Hook-order safety: must run BEFORE any conditional early return below.
  // The previous placement (after the "if (!hasAdminAccess) return null" guard)
  // caused "Rendered more hooks than during the previous render" and blocked
  // admin login when auth state flipped from loading → ready.
  // We reference allMedia further down; safe because React hooks only care
  // about call ORDER, not what variables exist yet at this textual position.

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
  } = useAllUserMediaPaginated(tab === "library", lowPowerMode ? 24 : 60);
  const allMedia = (mediaPages?.pages.flat() ?? []) as any[];

  // ⚠️ Hook-order safety: declared BEFORE the early-return guard at ~L346.
  // Previously this useMemo lived after the guard, which made the hook
  // count flip when admin auth resolved → "Rendered more hooks than during
  // the previous render" crash that blocked admin login.
  const filteredLib = useMemo(() => {
    if (tab !== "library") return [];
    return allMedia.filter((m: any) => {
      if (libFilter === "Images" && m.media_type !== "image") return false;
      if (libFilter === "Videos" && m.media_type !== "video") return false;
      if (libFilter === "Audio" && m.media_type !== "audio") return false;
      if (libSearch && !(m.title || "").toLowerCase().includes(libSearch.toLowerCase())) return false;
      return true;
    });
  }, [allMedia, libFilter, libSearch, tab]);
  const qc = useQueryClient();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Hardened admin gate:
  // 1) Hard email allowlist — ONLY justinbretthogan@gmail.com is permitted, no matter what.
  // 2) Wait for auth restoration before rendering admin-only panels.
  const ADMIN_EMAIL = "justinbretthogan@gmail.com";
  const isOwnerEmail = ((user?.email || "").trim().toLowerCase() === ADMIN_EMAIL);
  const hasAdminAccess = isOwnerEmail || isAdmin;
  useEffect(() => {
    if (loading || adminLoading || !isReady) return;

    if (!user) {
      navigate("/sign-in?redirect=/owner-dashboard&force=1", { replace: true });
      return;
    }

    // Hard email allowlist — block anyone else immediately, even if RBAC ever leaks.
    const email = (user.email || "").trim().toLowerCase();
    if (email !== ADMIN_EMAIL) {
      supabase.auth.signOut().finally(() => {
        toast.error("Admin access denied.");
        navigate("/sign-in?redirect=/owner-dashboard&force=1", { replace: true });
      });
      return;
    }

    if (!hasAdminAccess) {
      navigate("/dashboard", { replace: true });
    }
  }, [loading, adminLoading, hasAdminAccess, user, navigate, isReady]);

  useEffect(() => {
    if (!hasAdminAccess || tab !== "suggestions" || suggestions.length > 0) return;

    (async () => {
      const { data } = await supabase
        .from("suggestions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (data) setSuggestions(data);
    })();
  }, [hasAdminAccess, suggestions.length, tab]);

  // Load concierge + crawler leads for the Leads tab
  useEffect(() => {
    if (!hasAdminAccess || tab !== "leads" || leads.length > 0) return;

    (async () => {
      const { data } = await supabase
        .from("inquiry_leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (data) setLeads(data);
    })();
  }, [hasAdminAccess, leads.length, tab]);

  // Load install analytics events for the owner dashboard
  useEffect(() => {
    if (!hasAdminAccess || tab !== "overview") return;

    const timeoutId = window.setTimeout(async () => {
      const { data } = await supabase
        .from("install_events")
        .select("event_type, platform")
        .limit(lowPowerMode ? 1500 : 10000);
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
    }, lowPowerMode ? 1200 : 0);

    return () => window.clearTimeout(timeoutId);
  }, [hasAdminAccess, lowPowerMode, tab]);

  // Load private live traffic (admin only): site visitors, installs, paid upgrades
  useEffect(() => {
    if (!hasAdminAccess || tab !== "overview") return;

    let cancelled = false;
    const load = async () => {
      try {
        const [{ count: visitors }, { count: returning }, { count: installs }] = await Promise.all([
          supabase.from("page_views").select("*", { count: "exact", head: true }).eq("page", "landing"),
          supabase.from("page_views").select("*", { count: "exact", head: true }).eq("page", "landing").eq("utm_medium", "returning"),
          supabase.from("install_events").select("*", { count: "exact", head: true }).eq("event_type", "installed"),
        ]);
        let paidUpgrades = 0;
        try {
          if (accessToken) {
            const { data } = await supabase.functions.invoke("check-subscription", {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
              body: { admin_count: true },
            });
            if (typeof data?.paid_count === "number") paidUpgrades = data.paid_count;
            if (!cancelled) {
              setMemberStats({
                totalUsers: typeof data?.total_users === "number" ? data.total_users : 0,
                paidUsers: typeof data?.paid_count === "number" ? data.paid_count : 0,
                trialUsers: typeof data?.trial_count === "number" ? data.trial_count : 0,
                revenue: typeof data?.revenue === "number" ? data.revenue : 0,
              });
            }
          }
        } catch {}
        if (!cancelled) {
          setLiveTraffic({
            visitors: typeof visitors === "number" ? visitors : 0,
            returning: typeof returning === "number" ? returning : 0,
            installs: typeof installs === "number" ? installs : 0,
            paidUpgrades,
          });
        }
      } catch {}
    };

    const timeoutId = window.setTimeout(load, lowPowerMode ? 800 : 0);
    if (lowPowerMode) {
      return () => {
        cancelled = true;
        window.clearTimeout(timeoutId);
      };
    }

    const i = window.setInterval(load, 30000);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      window.clearInterval(i);
    };
  }, [accessToken, hasAdminAccess, lowPowerMode, tab]);

  // Load traffic sources (admin only) — aggregates utm_source/referrer for the bar graph
  useEffect(() => {
    if (!hasAdminAccess || tab !== "sources") return;

    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await supabase
          .from("page_views")
          .select("utm_source, referrer, page")
          .order("created_at", { ascending: false })
          .limit(lowPowerMode ? 1000 : 5000);
        if (!data) return;
        const counts: Record<string, number> = {};
        const pageCounts: Record<string, number> = {};
        for (const row of data as Array<{ utm_source: string | null; referrer: string | null; page: string | null }>) {
          let src = row.utm_source?.trim().toLowerCase() || "";
          if (!src && row.referrer) {
            try { src = new URL(row.referrer).hostname.replace(/^www\./, "").toLowerCase(); }
            catch {}
          }
          if (!src) src = "direct";
          counts[src] = (counts[src] || 0) + 1;

          const pg = (row.page || "").trim() || "(unknown)";
          pageCounts[pg] = (pageCounts[pg] || 0) + 1;
        }
        const arr = Object.entries(counts)
          .map(([source, visits]) => ({ source, visits }))
          .sort((a, b) => b.visits - a.visits)
          .slice(0, 12);
        const pagesArr = Object.entries(pageCounts)
          .map(([page, visits]) => ({ page, visits }))
          .sort((a, b) => b.visits - a.visits)
          .slice(0, 20);
        if (!cancelled) {
          setTrafficSources(arr);
          setTopPages(pagesArr);
        }
      } catch {}
    };

    load();
    if (lowPowerMode) {
      return () => {
        cancelled = true;
      };
    }

    const i = window.setInterval(load, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(i);
    };
  }, [hasAdminAccess, lowPowerMode, tab]);

  // Load all users (with online/offline split) when the Users tab opens
  useEffect(() => {
    if (!hasAdminAccess || (tab !== "users" && tab !== "trials") || !accessToken) return;
    let cancelled = false;
    (async () => {
      setUsersLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("check-subscription", {
          headers: { Authorization: `Bearer ${accessToken}` },
          body: { admin_users: true },
        });
        if (error) throw error;
        if (!cancelled && Array.isArray(data?.users)) setUsersList(data.users);
      } catch (e: any) {
        if (!cancelled) toast.error("Failed to load users: " + (e?.message || "unknown"));
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    })();
    const i = window.setInterval(() => {
      if (!cancelled) {
        supabase.functions.invoke("check-subscription", {
          headers: { Authorization: `Bearer ${accessToken}` },
          body: { admin_users: true },
        }).then(({ data }) => {
          if (!cancelled && Array.isArray(data?.users)) setUsersList(data.users);
        }).catch(() => {});
      }
    }, 30000);
    return () => { cancelled = true; window.clearInterval(i); };
  }, [accessToken, hasAdminAccess, tab]);

  // Load Trial Users (fast, dedicated endpoint — pulls all active reward_grants)
  useEffect(() => {
    if (!hasAdminAccess || tab !== "trials") return;
    let cancelled = false;
    (async () => {
      setTrialsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("admin-list-trials", { body: {} });
        if (error) throw error;
        if (!cancelled && Array.isArray((data as any)?.trials)) {
          setTrialsList((data as any).trials);
        }
      } catch (e: any) {
        if (!cancelled) toast.error("Failed to load trial users: " + (e?.message || "unknown"));
      } finally {
        if (!cancelled) setTrialsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hasAdminAccess, tab]);

  // Load failed sign-up attempts
  useEffect(() => {
    if (!hasAdminAccess || tab !== "failed-signups") return;
    let cancelled = false;
    (async () => {
      setFailedSignupsLoading(true);
      const { data, error } = await supabase
        .from("signup_failures")
        .select("id, email, reason, error_code, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!cancelled) {
        if (error) toast.error("Failed to load sign-up failures");
        else if (data) setFailedSignups(data as typeof failedSignups);
        setFailedSignupsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hasAdminAccess, tab]);

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords don't match"); return; }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast.error(error.message);
    else { toast.success("Password updated successfully!"); setNewPassword(""); setConfirmPassword(""); }
    setChangingPassword(false);
  };

  if (loading || adminLoading || !isReady || !accessToken || !hasAdminAccess) {
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

  const addFreebie = async () => {
    const email = freebieEmail.trim().toLowerCase();
    if (!email) return;
    try {
      const { data, error } = await supabase.functions.invoke("admin-grant-free-access", {
        body: { email, days: 365, reason: "admin_freebie" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setFreebies(prev => [...prev, { email, date: new Date().toLocaleDateString(), reason: "Admin free AI credits" }]);
      setUsersList(prev => prev.map(u => u.email?.toLowerCase() === email ? { ...u, freebie_active: true, wallet_balance_cents: (data as any)?.newBalanceCents ?? u.wallet_balance_cents } : u));
      setFreebieEmail("");
      toast.success(`Freebie credits linked to ${email}`);
    } catch (e: any) {
      toast.error(e?.message || "Could not grant access. The user must sign up first.");
    }
  };

  // Verify the grant actually landed in reward_grants for the target user.
  const verifyGrant = async (userId: string, expectFreeForLife: boolean) => {
    const { data } = await supabase
      .from("reward_grants")
      .select("reward_type, reason, expires_at, active")
      .eq("user_id", userId)
      .eq("active", true)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return false;
    if (expectFreeForLife) return data.reward_type === "free_for_life" || data.reason === "free_for_life";
    return true;
  };

  const grantFreeForUser = async (email: string, userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-grant-free-access", {
        body: { userId, email, days: 365, reason: "admin_user_row_grant" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const ok = await verifyGrant(userId, false);
      const bal = (data as any)?.newBalanceCents;
      if (ok) {
        toast.success(`✅ Linked to ${email}${bal != null ? ` — wallet $${(bal/100).toFixed(2)}` : ""}`);
      } else {
        toast.error(`Grant call returned OK but no active reward_grants row found for ${email}. Check user ID.`);
      }
      setUsersList(prev => prev.map(u => u.id === userId ? { ...u, freebie_active: true, wallet_balance_cents: bal ?? u.wallet_balance_cents } : u));
      setFreebies(prev => [...prev, { email, date: new Date().toLocaleDateString(), reason: "Admin free AI credits" }]);
    } catch (e: any) {
      toast.error(e?.message || "Grant failed");
    }
  };

  const grantFreeForLife = async (email: string, userId: string) => {
    if (!confirm(`Grant FREE FOR LIFE to ${email}? This is permanent and unlimited.`)) return;
    try {
      const { data, error } = await supabase.functions.invoke("admin-grant-free-access", {
        body: { userId, email, freeForLife: true, reason: "free_for_life" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const ok = await verifyGrant(userId, true);
      const bal = (data as any)?.newBalanceCents;
      const exp = (data as any)?.expiresAt;
      if (ok) {
        toast.success(`💎 ${email} is Free For Life — linked to account${bal != null ? ` (wallet $${(bal/100).toFixed(2)})` : ""}`);
      } else {
        toast.error(`Free For Life call returned OK but couldn't verify the grant for ${email}. Ask them to log out and back in.`);
      }
      setUsersList(prev => prev.map(u => u.id === userId ? { ...u, freebie_active: true, free_for_life: true, grant_expires_at: exp ?? u.grant_expires_at, grant_reason: "free_for_life", wallet_balance_cents: bal ?? u.wallet_balance_cents } : u));
    } catch (e: any) {
      toast.error(e?.message || "Free For Life grant failed");
    }
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
  const { totalUsers, paidUsers, trialUsers, revenue } = memberStats;

  const tabs = [
    { key: "overview", label: "Overview", icon: <BarChart3 className="w-4 h-4" /> },
    { key: "leads", label: "Leads", icon: <Mail className="w-4 h-4" /> },
    { key: "crawler", label: "Web Crawler", icon: <Search className="w-4 h-4" /> },
    { key: "builder", label: "AI Builder", icon: <Zap className="w-4 h-4" /> },
    { key: "library", label: "Users Library", icon: <Camera className="w-4 h-4" /> },
    { key: "suggestions", label: "Ideas", icon: <Sparkles className="w-4 h-4" /> },
    { key: "freebies", label: "Freebies", icon: <Gift className="w-4 h-4" /> },
    { key: "vault", label: "Vault", icon: <Lock className="w-4 h-4" /> },
    { key: "marketing", label: "Marketing", icon: <Megaphone className="w-4 h-4" /> },
    { key: "advertising", label: "Ads", icon: <Globe className="w-4 h-4" /> },
    { key: "advertisers", label: "Advertisers", icon: <Megaphone className="w-4 h-4" /> },
    { key: "users", label: "Users", icon: <Users className="w-4 h-4" /> },
    { key: "trials", label: "Trial Users", icon: <Zap className="w-4 h-4" /> },
    { key: "failed-signups", label: "Failed Sign-ups", icon: <XCircle className="w-4 h-4" /> },
    { key: "sources", label: "Traffic Sources", icon: <TrendingUp className="w-4 h-4" /> },
    { key: "ai-studio", label: "AI Studio (Beta)", icon: <Sparkles className="w-4 h-4" /> },
  ] as const;

  const runCrawler = async () => {
    if (crawlerBusy) return;
    setCrawlerBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("web-crawler-outreach", {
        body: {
          action: "discover",
          campaign: crawlerCampaign,
          niche: crawlerNiche,
          limit: crawlerLimit,
          logToLeads: crawlerLogToLeads,
        },
      });
      if (error) throw error;
      const list = (data as { prospects?: typeof crawlerResults })?.prospects || [];
      setCrawlerResults(list);
      toast.success(`Found ${list.length} prospects${crawlerLogToLeads ? " — logged to Leads" : ""}`);
      if (crawlerLogToLeads) {
        const { data: l } = await supabase.from("inquiry_leads").select("*").order("created_at", { ascending: false }).limit(200);
        if (l) setLeads(l);
      }
    } catch (err) {
      toast.error("Crawler failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setCrawlerBusy(false);
    }
  };

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
                "You are ORACLE LUNAR Site Architect — an elite full-stack engineer with ULTIMATE coding ability for the ORACLE LUNAR web app. " +
                "Stack: React 18 + Vite + Tailwind + shadcn/ui + Supabase (Postgres + RLS + Edge Functions in Deno) + Lovable AI Gateway. " +
                "When the admin asks to add a feature, change behavior, fix a bug, or extend an app inside ORACLE LUNAR, respond with: " +
                "(1) a short plan, (2) the exact files to create/edit with full code blocks, (3) any SQL migration needed, " +
                "(4) RLS policies for any new tables, (5) any edge function changes. " +
                "IMPORTANT LIMITS: You can only modify THIS ORACLE LUNAR codebase. You CANNOT remotely modify third-party websites, " +
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

  // filteredLib hook moved above the early-return guard for hook-order safety.

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
      <button
        type="button"
        onClick={() => navigate("/dashboard", { replace: false })}
        aria-label="Go back to user dashboard"
        className="fixed left-3 z-[1000] flex items-center gap-2 rounded-full border-2 border-primary bg-primary px-5 py-3 text-sm font-black uppercase tracking-normal text-primary-foreground shadow-[0_0_44px_hsl(var(--primary)/0.75)] backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-primary/90 active:scale-95"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
      >
        <Home className="h-5 w-5" />
        USER DASHBOARD
      </button>
      <div className="px-4 pt-20 pb-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30">
            <Crown className="w-8 h-8 text-yellow-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent">Owner Dashboard</h1>
            <p className="text-gray-500 text-xs truncate">{user?.email || "ORACLE LUNAR Command Center"}</p>
          </div>
          <button
            onClick={() => navigate("/dashboard", { replace: false })}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-primary text-primary-foreground border border-primary/40 shadow-[0_0_24px_hsl(var(--primary)/0.35)] hover:bg-primary/90 transition"
            title="Go to the normal user dashboard"
          >
            <Home className="w-4 h-4" /> User Dashboard
          </button>
          <button
            onClick={async () => {
              try {
                await signOut();
                toast.success("Signed out");
                navigate("/sign-in", { replace: true });
              } catch {
                toast.error("Sign-out failed");
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 transition"
            title="Sign out of admin"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-yellow-500 to-orange-500 text-black border border-yellow-400 hover:opacity-90 transition"
            title="Open the regular User Dashboard"
          >
            <Home className="w-4 h-4" /> User Dashboard
          </button>
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
            {/* Admin-only tools — App Wrapper (hidden from public Portal & user Dashboard) */}
            <div className="bg-gradient-to-br from-primary/15 to-amber-500/10 border border-primary/30 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <Lock className="w-4 h-4 text-primary" />
                  <div>
                    <h3 className="text-sm font-bold text-foreground">App Wrapper (Admin tool)</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Hidden from public Portal & user Dashboard. Generates the Android build recipe for any URL.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate("/web-wrapper")}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-xs font-bold whitespace-nowrap"
                >
                  Open App Wrapper
                </button>
              </div>
            </div>

            {/* Live Stripe revenue (admin only) */}
            <Suspense fallback={null}>
              <StripeRevenuePanel />
            </Suspense>

            {/* ElevenLabs Affiliate Tracker */}
            <div className="bg-gradient-to-br from-primary/10 to-amber-500/10 border border-primary/30 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Crown className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">ElevenLabs Affiliate</h3>
                <span className="ml-auto text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full">20% commission</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-amber-300">
                    {(() => { try { return localStorage.getItem("affiliate_clicks_elevenlabs") || "0"; } catch { return "0"; } })()}
                  </p>
                  <p className="text-[10px] text-gray-400">Local Clicks</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-300 truncate" title="https://try.elevenlabs.io/20p2fwdcfmr2">
                    try.elevenlabs.io/20p2fwdcfmr2
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">Your Link</p>
                </div>
              </div>
              <a
                href="https://try.elevenlabs.io/20p2fwdcfmr2"
                target="_blank"
                rel="noopener noreferrer sponsored"
                onClick={() => {
                  try {
                    const k = "affiliate_clicks_elevenlabs";
                    localStorage.setItem(k, String(parseInt(localStorage.getItem(k) || "0", 10) + 1));
                  } catch {}
                }}
                className="block w-full text-center px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90"
              >
                Open Affiliate Dashboard →
              </a>
              <p className="text-[10px] text-gray-400 mt-2 text-center">
                Live in: Voice Studio header, Voice Enrollment dialog, Subscribe page footer
              </p>
            </div>

            {/* HeyGen Affiliate Tracker */}
            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Video className="w-4 h-4 text-pink-400" />
                <h3 className="text-sm font-bold text-white">HeyGen Affiliate</h3>
                <span className="ml-auto text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full">Up to 30% commission</span>
              </div>
              {(() => {
                const isLive = (() => {
                  try {
                    // Lazy-read so swapping the URL flips the badge instantly on next render
                    const url = (window as any).__HEYGEN_AFFILIATE_URL__ || "";
                    return url && !url.includes("?sid=oraclelunar");
                  } catch { return false; }
                })();
                return (
                  <div className={`mb-3 px-3 py-2 rounded-lg text-[11px] font-semibold text-center ${
                    isLive
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  }`}>
                    {isLive ? "✅ LIVE — Earning commissions" : "⏳ PENDING — Awaiting HeyGen approval"}
                  </div>
                );
              })()}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-pink-300">
                    {(() => { try { return localStorage.getItem("affiliate_clicks_heygen") || "0"; } catch { return "0"; } })()}
                  </p>
                  <p className="text-[10px] text-gray-400">Local Clicks</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-300 truncate">Edit src/lib/affiliateLinks.ts</p>
                  <p className="text-[10px] text-gray-400 mt-1">Paste real URL when approved</p>
                </div>
              </div>
              <a
                href="https://www.heygen.com/affiliate"
                target="_blank"
                rel="noopener noreferrer sponsored"
                onClick={() => {
                  try {
                    const k = "affiliate_clicks_heygen";
                    localStorage.setItem(k, String(parseInt(localStorage.getItem(k) || "0", 10) + 1));
                  } catch {}
                }}
                className="block w-full text-center px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold hover:opacity-90"
              >
                Open HeyGen Affiliate Portal →
              </a>
              <p className="text-[10px] text-gray-400 mt-2 text-center">
                Will auto-activate in: Movie Studio • Photography Hub • Video Editor
              </p>
            </div>

            {/* Stripe Connect demo (admin view) */}
            <Suspense fallback={null}>
              <StripeConnectPanel />
            </Suspense>

            {/* Private Live Traffic — admin only, your site */}
            <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="w-4 h-4 text-yellow-400" />
                <h3 className="text-sm font-bold text-white">Live Traffic — Your Site (Private)</h3>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <Eye className="w-4 h-4 text-cyan-300 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-cyan-300">{liveTraffic.visitors.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400">Visitors</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <Users className="w-4 h-4 text-purple-300 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-purple-300">{liveTraffic.returning.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400">Returning (no DL)</p>
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

        {/* WEB CRAWLER — Growth engine */}
        {tab === "crawler" && (
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-amber-500/10 to-purple-500/10 border border-amber-500/30 rounded-xl p-4">
              <h2 className="text-lg font-bold text-white mb-1">Web Crawler & Outreach</h2>
              <p className="text-xs text-gray-400 mb-3">Discovers high-value sites (press, partners, directories, investors, backlink targets), extracts contact emails, and AI-drafts personalized outreach for every prospect. Optionally logs each prospect to the Leads tab.</p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <select value={crawlerCampaign} onChange={(e) => setCrawlerCampaign(e.target.value as typeof crawlerCampaign)}
                  className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
                  <option value="press">Press / Tech Media</option>
                  <option value="partnership">Partnerships / Integrations</option>
                  <option value="directory">App Directories</option>
                  <option value="investor">Investors / VCs</option>
                  <option value="backlink">Backlink / Guest Posts</option>
                </select>
                <input type="number" min={1} max={25} value={crawlerLimit} onChange={(e) => setCrawlerLimit(Math.max(1, Math.min(25, Number(e.target.value) || 8)))}
                  className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" placeholder="Limit (1-25)" />
              </div>
              <input value={crawlerNiche} onChange={(e) => setCrawlerNiche(e.target.value)}
                placeholder="Niche / topic (e.g. AI mental health super app)"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white mb-3" />
              <label className="flex items-center gap-2 text-xs text-gray-300 mb-3 cursor-pointer">
                <input type="checkbox" checked={crawlerLogToLeads} onChange={(e) => setCrawlerLogToLeads(e.target.checked)} />
                Auto-log results to the Leads tab
              </label>
              <button onClick={runCrawler} disabled={crawlerBusy}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {crawlerBusy ? "Crawling the web…" : "Discover Prospects & Draft Outreach"}
              </button>
              <button
                onClick={async () => {
                  const message = prompt(
                    "Broadcast message to Telegram / Discord / Slack / Email / 80 webhooks:",
                    "🆓 ORACLE LUNAR is FREE to join — become a Founding Member at https://oracle-lunar.online"
                  );
                  if (!message) return;
                  try {
                    const { data, error } = await supabase.functions.invoke("growth-broadcast", {
                      body: { event: "feature", title: "📣 ORACLE LUNAR Announcement", message, url: "https://oracle-lunar.online" },
                    });
                    if (error) throw error;
                    const ok = (data?.results || []).filter((r: any) => r.ok).map((r: any) => r.label).join(", ");
                    alert(`Broadcast sent ✓\nDelivered to: ${ok || "(no destinations configured yet — add secrets first)"}`);
                  } catch (e) {
                    alert("Broadcast failed: " + String(e));
                  }
                }}
                className="mt-2 w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-bold text-sm flex items-center justify-center gap-2">
                📣 Broadcast to All Channels
              </button>
            </div>
            {crawlerResults.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">{crawlerResults.length} prospects</h3>
                  <span className="text-[10px] text-amber-400">{crawlerCampaign}</span>
                </div>
                {crawlerResults.map((p, i) => (
                  <div key={i} className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <a href={p.url} target="_blank" rel="noreferrer" className="text-sm font-bold text-amber-400 hover:underline truncate">{p.title || p.url}</a>
                      {p.contact_email && <span className="text-[10px] text-green-400 font-mono shrink-0">{p.contact_email}</span>}
                    </div>
                    <p className="text-[10px] text-gray-500 truncate mb-2">{p.url}</p>
                    {p.outreach_subject && (
                      <div className="bg-black/40 border border-white/5 rounded-lg p-2 mb-2">
                        <p className="text-[10px] text-purple-300 mb-1">Subject: <span className="text-white font-medium">{p.outreach_subject}</span></p>
                        <p className="text-xs text-gray-300 whitespace-pre-wrap">{p.outreach_body}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      {p.contact_email && (
                        <a href={`mailto:${p.contact_email}?subject=${encodeURIComponent(p.outreach_subject || "")}&body=${encodeURIComponent(p.outreach_body || "")}`}
                          className="flex-1 text-center px-3 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-bold">Send Email</a>
                      )}
                      <button onClick={() => navigator.clipboard.writeText(`${p.outreach_subject}\n\n${p.outreach_body}`)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-xs">Copy</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* LEADS — captured by ORACLE LUNAR Concierge */}
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
                      <a href={`mailto:${l.email}?subject=Re:%20${encodeURIComponent(l.interest || "Your ORACLE LUNAR inquiry")}`}
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
                <h3 className="text-sm font-bold text-white">Grant Free AI Credits</h3>
              </div>
              <p className="text-xs text-gray-400 mb-3">Links directly to an existing account and tops up enough coins for free AI use. Paid purchases still stay paid.</p>
              <input value={freebieEmail} onChange={e => setFreebieEmail(e.target.value)} placeholder="user@email.com" className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none mb-3" />
              <button onClick={addFreebie} className="w-full py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium text-sm">Grant Freebie Credits</button>
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

            {/* SEO Blast — instant indexing across Bing/Yandex/IndexNow */}
            <div className="bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/30 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" /> SEO Blast — Instant Indexing
              </h3>
              <p className="text-xs text-gray-400 mb-3">
                Submits all 70+ landing pages to Bing, Yandex, and IndexNow API in one shot.
                Crawlers visit within hours instead of weeks. Safe to run any time.
              </p>
              <button
                onClick={async () => {
                  toast.loading("Firing SEO blast across search engines…", { id: "seo-blast" });
                  try {
                    const { data, error } = await supabase.functions.invoke("seo-blast");
                    if (error) throw error;
                    toast.success(
                      `Blast complete — ${data?.urls_submitted ?? 0} URLs submitted. Bing/Yandex will crawl shortly.`,
                      { id: "seo-blast", duration: 6000 }
                    );
                  } catch (e: any) {
                    toast.error(`SEO blast failed: ${e?.message ?? "unknown"}`, { id: "seo-blast" });
                  }
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold text-sm flex items-center justify-center gap-2 hover:brightness-110 transition-all"
              >
                <Zap className="w-4 h-4" /> Fire SEO Blast Now
              </button>
              <p className="text-[10px] text-gray-500 mt-2">
                Tip: also run from cron (already set up to fire daily). Add your Google Search Console + Bing Webmaster verification tokens in <code className="text-yellow-400">index.html</code> for full coverage.
              </p>
            </div>
          </div>
        )}

        {/* ADVERTISER INQUIRIES — submissions from /advertise */}
        {tab === "advertisers" && (
          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <Suspense fallback={<div className="text-sm text-muted-foreground">Loading advertiser inquiries…</div>}>
                <AdvertiserInquiriesPanel />
              </Suspense>
              <div className="mt-3 text-xs text-gray-400">
                Public form lives at <code className="text-yellow-400">/advertise</code> — share that link anywhere.
              </div>
            </div>
            <Suspense fallback={null}>
              <PricingEditorPanel />
            </Suspense>
            <Suspense fallback={null}>
              <AudioAnalyticsCard />
            </Suspense>
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
            <FeaturedPhotoPicker />
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
        {tab === "trials" && (
          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2"><Zap className="w-5 h-5 text-purple-400" /> Trial Users</h2>
                  <p className="text-xs text-gray-400">Everyone with an active reward / freebie grant — full email + one-click Free For Life upgrade.</p>
                </div>
                <span className="text-xs text-purple-300 bg-purple-500/10 border border-purple-500/30 px-2 py-1 rounded-lg">
                  {trialsList.length} active
                </span>
              </div>
              {trialsLoading ? (
                <p className="text-xs text-gray-400 py-6 text-center">Loading trial users…</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-white/10">
                        <th className="py-2 pr-3">Email</th>
                        <th className="py-2 pr-3">Joined</th>
                        <th className="py-2 pr-3">Last sign-in</th>
                        <th className="py-2 pr-3">Grant</th>
                        <th className="py-2 pr-3">Expires</th>
                        <th className="py-2 pr-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trialsList.map(u => (
                        <tr key={u.id} className="border-b border-white/5">
                          <td className="py-2 pr-3 text-white font-medium">{u.email || <span className="text-gray-500">—</span>}</td>
                          <td className="py-2 pr-3 text-gray-400">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                          <td className="py-2 pr-3 text-gray-400">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "Never"}</td>
                          <td className="py-2 pr-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${u.free_for_life ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-purple-500/15 text-purple-300 border border-purple-500/30"}`}>
                              {u.free_for_life ? "💎 Free For Life" : (u.grant_reason || u.reward_type || "trial")}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-gray-400">{u.grant_expires_at ? new Date(u.grant_expires_at).toLocaleDateString() : "—"}</td>
                          <td className="py-2 pr-3 text-right">
                            {u.free_for_life ? (
                              <span className="text-[10px] text-emerald-400">Active ✓</span>
                            ) : (
                              <button
                                onClick={async () => {
                                  if (!u.email) return;
                                  await grantFreeForLife(u.email, u.id);
                                  setTrialsList(prev => prev.map(t => t.id === u.id ? { ...t, free_for_life: true, reward_type: "free_for_life", grant_reason: "free_for_life" } : t));
                                }}
                                className="px-3 py-1 rounded-lg text-[10px] font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-black hover:brightness-110"
                              >
                                Make Free For Life
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {trialsList.length === 0 && (
                        <tr><td colSpan={6} className="py-6 text-center text-gray-500">No active trial users yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "users" && (
          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2"><Users className="w-5 h-5 text-cyan-400" /> Members</h2>
                  <p className="text-xs text-gray-400">All registered users — split by online/offline (online = active in last 5 min).</p>
                </div>
                <input
                  value={usersSearch}
                  onChange={(e) => setUsersSearch(e.target.value)}
                  placeholder="Search by email…"
                  className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs w-56"
                />
              </div>
              <div className="flex gap-2 mb-3">
                {(["online", "offline"] as const).map(s => {
                  const count = usersList.filter(u => (s === "online" ? u.online : !u.online)).length;
                  return (
                    <button
                      key={s}
                      onClick={() => setUsersSubTab(s)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${usersSubTab === s ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "bg-white/5 text-gray-400 border border-white/10"}`}
                    >
                      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${s === "online" ? "bg-emerald-400" : "bg-gray-500"}`} />
                      {s === "online" ? "Online" : "Offline"} ({count})
                    </button>
                  );
                })}
                <div className="ml-auto text-[11px] text-gray-500 self-center">Total: {usersList.length}</div>
              </div>
              {usersLoading ? (
                <p className="text-xs text-gray-400 py-6 text-center">Loading members…</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-white/10">
                        <th className="py-2 pr-3">Email</th>
                        <th className="py-2 pr-3">Joined</th>
                        <th className="py-2 pr-3">Last sign-in</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersList
                        .filter(u => (usersSubTab === "online" ? u.online : !u.online))
                        .filter(u => !usersSearch || (u.email || "").toLowerCase().includes(usersSearch.toLowerCase()))
                        .map(u => (
                          <tr key={u.id} className="border-b border-white/5">
                            <td className="py-2 pr-3 text-white">{u.email || <span className="text-gray-500">—</span>}</td>
                            <td className="py-2 pr-3 text-gray-400">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                            <td className="py-2 pr-3 text-gray-400">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "Never"}</td>
                            <td className="py-2 pr-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${u.online ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" : "bg-gray-500/15 text-gray-400 border border-gray-500/30"}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${u.online ? "bg-emerald-400 animate-pulse" : "bg-gray-500"}`} />
                                {u.online ? "Online" : "Offline"}
                              </span>
                            </td>
                            <td className="py-2 pr-3 text-right">
                              {u.free_for_life ? (
                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">💎 Free For Life</span>
                              ) : (
                                <div className="flex gap-1.5 justify-end">
                                  <button
                                    onClick={() => u.email && grantFreeForUser(u.email, u.id)}
                                    className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-white/10 text-white hover:bg-white/20 border border-white/20"
                                  >
                                    +Credits
                                  </button>
                                  <button
                                    onClick={() => u.email && grantFreeForLife(u.email, u.id)}
                                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-black hover:brightness-110"
                                  >
                                    Free For Life
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      {usersList.filter(u => (usersSubTab === "online" ? u.online : !u.online)).length === 0 && (
                        <tr><td colSpan={5} className="py-6 text-center text-gray-500">No {usersSubTab} members.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "failed-signups" && (
          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2"><XCircle className="w-5 h-5 text-red-400" /> Failed Sign-ups</h2>
                  <p className="text-xs text-gray-400">People who tried to join but couldn't — last 500 attempts.</p>
                </div>
                <span className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 px-2 py-1 rounded-lg">{failedSignups.length} attempts</span>
              </div>
              {failedSignupsLoading ? (
                <p className="text-xs text-gray-400 py-6 text-center">Loading…</p>
              ) : failedSignups.length === 0 ? (
                <p className="text-xs text-gray-500 py-6 text-center">🎉 No failed sign-ups recorded.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-white/10">
                        <th className="py-2 pr-3">When</th>
                        <th className="py-2 pr-3">Email</th>
                        <th className="py-2 pr-3">Reason</th>
                        <th className="py-2 pr-3">Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {failedSignups.map(f => (
                        <tr key={f.id} className="border-b border-white/5">
                          <td className="py-2 pr-3 text-gray-400 whitespace-nowrap">{new Date(f.created_at).toLocaleString()}</td>
                          <td className="py-2 pr-3 text-white">{f.email || <span className="text-gray-500">(no email)</span>}</td>
                          <td className="py-2 pr-3 text-red-300">{f.reason}</td>
                          <td className="py-2 pr-3 text-gray-500">{f.error_code || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

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

            {/* Top pages viewed */}
            <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-5 h-5 text-emerald-300" />
                <h3 className="text-sm font-bold text-white">Top pages viewed</h3>
              </div>
              <p className="text-[11px] text-gray-400 mb-4">
                Most-visited pages across the last 5,000 visits.
              </p>

              {topPages.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-xs">No page views recorded yet.</div>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    const max = Math.max(...topPages.map(p => p.visits), 1);
                    return topPages.map((p, i) => {
                      const pct = (p.visits / max) * 100;
                      return (
                        <div key={p.page + i} className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-white font-medium truncate max-w-[70%]" title={p.page}>{p.page}</span>
                            <span className="text-emerald-300 font-bold">{p.visits.toLocaleString()}</span>
                          </div>
                          <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-500"
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

        {/* AI BUILDER — Admin-only ultimate-coding chat for shipping features into ORACLE LUNAR */}
        {tab === "builder" && (
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-5 h-5 text-yellow-400" />
                <h2 className="text-base font-bold text-white">ORACLE LUNAR AI Builder</h2>
              </div>
              <p className="text-[11px] text-gray-400">
                Ultimate-level coding assistant for this site and every app inside it. Ask it to add features, fix bugs,
                build new pages, or extend existing apps — it returns full code + SQL + edge function plans.
                Changes deploy to all signed-in users on next page load. Note: external sites and other users' devices
                cannot be remotely modified — only this ORACLE LUNAR app.
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
          description={`Check out this ${libShareItem?.media_type || "media"} from Oracle Lunar!`}
        />
      </div>
      
    </div>
  );
};

export default OwnerDashboardPage;
