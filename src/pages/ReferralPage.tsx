import { useState, useEffect } from "react";
import SEO from "@/components/SEO";
import { Share2, Copy, Gift, Users, Trophy, Star, Sparkles, CheckCircle } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const ReferralPage = () => {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState("ORACLE LUNAR2026");
  const [email, setEmail] = useState("");
  const [referrals, setReferrals] = useState<any[]>([]);
  const [tab, setTab] = useState<"invite" | "history" | "rewards">("invite");

  useEffect(() => {
    if (user) {
      setReferralCode(`ORACLE LUNAR${user.id.slice(0, 6).toUpperCase()}`);
      loadReferrals();
    }
  }, [user]);

  const loadReferrals = async () => {
    if (!user) return;
    const { data } = await supabase.from("referrals").select("*").eq("referrer_id", user.id).order("created_at", { ascending: false });
    if (data) setReferrals(data);
  };

  const handleCopy = () => { navigator.clipboard.writeText(referralCode); toast.success("Referral code copied!"); };

  const sendInvite = async () => {
    if (!email.trim() || !user) { toast.error("Enter an email"); return; }
    const { error } = await supabase.from("referrals").insert({ referrer_id: user.id, referred_email: email.trim(), referral_code: referralCode });
    if (error) { toast.error("Failed to send invite"); return; }
    toast.success(`Invite sent to ${email}! 🎉`);
    setEmail("");
    loadReferrals();
  };

  const shareLink = () => {
    const url = `${window.location.origin}/?ref=${referralCode}`;
    if (navigator.share) {
      navigator.share({ title: "Join Oracle Lunar!", text: `Use my code ${referralCode} to get started!`, url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Share link copied!");
    }
  };

  const joined = referrals.filter(r => r.status === "joined").length;
  const paid = referrals.filter(r => r.status === "paid").length;
  const rewarded = referrals.filter(r => r.reward_granted).length;

  const checkRewards = async () => {
    toast.info("Checking your friends' subscriptions...");
    const { data, error } = await supabase.functions.invoke("process-referral-rewards");
    if (error) { toast.error("Couldn't check rewards right now"); return; }
    if (data?.rewarded > 0) toast.success(`🎉 ${data.rewarded} new reward${data.rewarded > 1 ? "s" : ""} unlocked!`);
    else if (data?.waiting > 0) toast.info(`${data.waiting} friend(s) subscribed — reward unlocks after their 7-day window`);
    else toast.info("No rewards ready yet — invite more friends!");
    loadReferrals();
  };

  const REWARDS = [
    { threshold: 1, reward: "+1 Month Free Tier 3 (Full Access)", unlocked: rewarded >= 1 },
    { threshold: 3, reward: "+3 Months Free Tier 3 (stacks)", unlocked: rewarded >= 3 },
    { threshold: 5, reward: "Free AI Friend Unlock", unlocked: rewarded >= 5 },
    { threshold: 10, reward: "+10 Months Free Tier 3", unlocked: rewarded >= 10 },
    { threshold: 25, reward: "1 Year Free Premium", unlocked: rewarded >= 25 },
    { threshold: 50, reward: "Lifetime Free Access! 🏆", unlocked: rewarded >= 50 },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEO title="Refer Friends, Earn Credits — Oracle Lunar" description="Invite friends to Oracle Lunar and earn free credits when they sign up." path="/referral" />
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Share2 className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">Referral Program</h1><p className="text-muted-foreground text-xs">Invite friends & earn rewards</p></div>
        </div>

        {/* Code Banner */}
        <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-2xl p-5 mb-4 text-center">
          <Gift className="w-10 h-10 text-primary mx-auto mb-2" />
          <p className="text-xs text-muted-foreground mb-3">Your unique referral code</p>
          <div className="flex items-center justify-center gap-2 bg-card rounded-lg px-4 py-3 border border-border mb-3">
            <span className="text-lg font-mono font-bold text-primary tracking-widest">{referralCode}</span>
            <button onClick={handleCopy}><Copy className="w-4 h-4 text-primary" /></button>
          </div>
          <p className="text-[10px] text-muted-foreground">When your friend pays for any plan and stays subscribed 7 days, you get +30 days of Tier 3 (Full Access). Stacks with every friend!</p>
          <button onClick={checkRewards} className="mt-3 text-[11px] text-primary underline">Check rewards now</button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-3 bg-card border border-border rounded-xl"><Users className="w-5 h-5 text-primary mx-auto mb-1" /><p className="text-sm font-bold text-foreground">{referrals.length}</p><p className="text-[10px] text-muted-foreground">Invited</p></div>
          <div className="text-center p-3 bg-card border border-border rounded-xl"><Trophy className="w-5 h-5 text-primary mx-auto mb-1" /><p className="text-sm font-bold text-foreground">{joined}</p><p className="text-[10px] text-muted-foreground">Joined</p></div>
          <div className="text-center p-3 bg-card border border-border rounded-xl"><Star className="w-5 h-5 text-primary mx-auto mb-1" /><p className="text-sm font-bold text-foreground">{paid}</p><p className="text-[10px] text-muted-foreground">Paid</p></div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {(["invite", "history", "rewards"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 rounded-xl text-xs font-medium ${tab === t ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
              {t === "invite" ? "Invite" : t === "history" ? "History" : "Rewards"}
            </button>
          ))}
        </div>

        {tab === "invite" && (
          <div className="space-y-3">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-2">Send invite by email</p>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="friend@email.com" type="email"
                className="w-full px-4 py-3 bg-input border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary mb-3" />
              <button onClick={sendInvite} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm">Send Invite</button>
            </div>
            <button onClick={shareLink} className="w-full py-4 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold rounded-xl flex items-center justify-center gap-2">
              <Share2 className="w-5 h-5" /> Share Link
            </button>
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-2">
            {referrals.length === 0 ? <p className="text-center text-sm text-muted-foreground py-8">No referrals yet. Start inviting!</p> :
              referrals.map(r => (
                <div key={r.id} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
                  <div className={`w-2 h-2 rounded-full ${r.status === "paid" ? "bg-[hsl(var(--status-active))]" : r.status === "joined" ? "bg-primary" : "bg-muted-foreground"}`} />
                  <div className="flex-1">
                    <p className="text-sm text-foreground">{r.referred_email}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${r.status === "paid" ? "bg-[hsl(var(--status-active))]/20 text-[hsl(var(--status-active))]" : "bg-secondary text-muted-foreground"}`}>{r.status}</span>
                </div>
              ))
            }
          </div>
        )}

        {tab === "rewards" && (
          <div className="space-y-3">
            {REWARDS.map((r, i) => (
              <div key={i} className={`flex items-center gap-3 p-4 rounded-xl border ${r.unlocked ? "bg-primary/10 border-primary/30" : "bg-card border-border"}`}>
                {r.unlocked ? <CheckCircle className="w-5 h-5 text-[hsl(var(--status-active))]" /> : <Sparkles className="w-5 h-5 text-muted-foreground" />}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${r.unlocked ? "text-foreground" : "text-muted-foreground"}`}>{r.reward}</p>
                  <p className="text-[10px] text-muted-foreground">{r.threshold} referral{r.threshold > 1 ? "s" : ""} needed</p>
                </div>
                <span className="text-xs text-primary font-medium">{referrals.length}/{r.threshold}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
export default ReferralPage;
