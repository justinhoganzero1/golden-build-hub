import { Share2, Copy, Gift, Users, Trophy } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
const ReferralPage = () => {
  const code = "SOLACE2026";
  const handleCopy = () => { navigator.clipboard.writeText(code); toast.success("Referral code copied!"); };
  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4"><div className="p-2 rounded-xl bg-primary/10"><Share2 className="w-7 h-7 text-primary" /></div><div><h1 className="text-xl font-bold text-primary">Referral</h1><p className="text-muted-foreground text-xs">Invite friends & earn rewards</p></div></div>
        <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-2xl p-6 mb-6 text-center">
          <Gift className="w-10 h-10 text-primary mx-auto mb-3" />
          <h3 className="text-foreground font-semibold mb-1">Share Solace, Get Rewards</h3>
          <p className="text-xs text-muted-foreground mb-4">Earn premium features for every friend who joins</p>
          <div className="flex items-center justify-center gap-2 bg-card rounded-lg px-4 py-3 border border-border"><span className="text-lg font-mono font-bold text-primary tracking-widest">{code}</span><button onClick={handleCopy}><Copy className="w-4 h-4 text-primary" /></button></div>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-6"><div className="text-center p-3 bg-card border border-border rounded-xl"><Users className="w-5 h-5 text-primary mx-auto mb-1" /><p className="text-sm font-bold text-foreground">7</p><p className="text-[10px] text-muted-foreground">Invited</p></div><div className="text-center p-3 bg-card border border-border rounded-xl"><Trophy className="w-5 h-5 text-primary mx-auto mb-1" /><p className="text-sm font-bold text-foreground">3</p><p className="text-[10px] text-muted-foreground">Joined</p></div><div className="text-center p-3 bg-card border border-border rounded-xl"><Gift className="w-5 h-5 text-primary mx-auto mb-1" /><p className="text-sm font-bold text-foreground">$15</p><p className="text-[10px] text-muted-foreground">Earned</p></div></div>
        <button className="w-full py-4 bg-primary text-primary-foreground font-semibold rounded-xl flex items-center justify-center gap-2"><Share2 className="w-5 h-5" /> Share with Friends</button>
      </div>
    </div>
  );
};
export default ReferralPage;
