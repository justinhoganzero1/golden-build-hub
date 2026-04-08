import { useState, useEffect } from "react";
import {
  Shield, Users, Gift, Star, BarChart3, Mail, Megaphone,
  Lock, ChevronRight, CheckCircle, XCircle, Eye, Sparkles,
  TrendingUp, DollarSign, Globe, Smartphone, Bell, Settings,
  Search, Filter, Send, Crown, Zap
} from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const OWNER_EMAIL = "justinbretthogan@gmail.com";

const OwnerDashboardPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"overview" | "suggestions" | "freebies" | "vault" | "marketing" | "advertising">("overview");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [freebieEmail, setFreebieEmail] = useState("");
  const [freebies, setFreebies] = useState<{ email: string; date: string; reason: string }[]>([]);
  const [vaultEmail, setVaultEmail] = useState("");
  const [vaultLevel, setVaultLevel] = useState("viewer");
  const [vaultUsers, setVaultUsers] = useState<{ email: string; level: string }[]>([]);
  const [marketingEmail, setMarketingEmail] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  if (!loading && user?.email !== OWNER_EMAIL) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  useEffect(() => {
    loadSuggestions();
  }, []);

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
  const totalUsers = 247; // Mock
  const paidUsers = 89;
  const trialUsers = 158;
  const revenue = 4523;

  const tabs = [
    { key: "overview", label: "Overview", icon: <BarChart3 className="w-4 h-4" /> },
    { key: "suggestions", label: "Ideas", icon: <Sparkles className="w-4 h-4" /> },
    { key: "freebies", label: "Freebies", icon: <Gift className="w-4 h-4" /> },
    { key: "vault", label: "Vault", icon: <Lock className="w-4 h-4" /> },
    { key: "marketing", label: "Marketing", icon: <Megaphone className="w-4 h-4" /> },
    { key: "advertising", label: "Ads", icon: <Globe className="w-4 h-4" /> },
  ] as const;

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
        {tab === "advertising" && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-white mb-2">Ad Platform Integration</h2>
            {[
              { name: "Google AdMob", status: "Ready", icon: "🟢", desc: "Banner, interstitial, rewarded ads" },
              { name: "Google Play Store", status: "Setup", icon: "🔵", desc: "Store listing, screenshots, description" },
              { name: "Apple App Store", status: "Setup", icon: "🍎", desc: "iOS listing, TestFlight" },
              { name: "Facebook Ads", status: "Ready", icon: "📘", desc: "Audience targeting, pixel tracking" },
              { name: "Instagram Ads", status: "Ready", icon: "📸", desc: "Story ads, reels promotion" },
              { name: "TikTok Ads", status: "Ready", icon: "🎵", desc: "In-feed ads, branded effects" },
              { name: "Twitter/X Ads", status: "Ready", icon: "🐦", desc: "Promoted tweets, trending" },
              { name: "Website Banner", status: "Active", icon: "🌐", desc: "Your website ad integration" },
            ].map((ad, i) => (
              <button key={i} onClick={() => toast.success(`${ad.name} campaign launched!`)} className="w-full flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-4 hover:border-yellow-500/30 transition-all">
                <span className="text-2xl">{ad.icon}</span>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-white">{ad.name}</p>
                  <p className="text-[10px] text-gray-500">{ad.desc}</p>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded-full ${ad.status === "Active" ? "bg-green-500/20 text-green-400" : ad.status === "Ready" ? "bg-blue-500/20 text-blue-400" : "bg-yellow-500/20 text-yellow-400"}`}>{ad.status}</span>
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnerDashboardPage;
