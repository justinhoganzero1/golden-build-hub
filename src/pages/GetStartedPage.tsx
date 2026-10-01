import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import UniversalBackButton from "@/components/UniversalBackButton";
import { Coins, Gift, MessageCircle, Wallet, CheckCircle2, Sparkles } from "lucide-react";

const steps = [
  { icon: Gift, title: "Your 3-day free trial", body: "Every free tool is open to you straight away — no card needed." },
  { icon: Sparkles, title: "Pick a membership", body: "After 3 days, choose Founder (A$1 lifetime, limited seats) or A$19.99 a month.", to: "/membership", cta: "See memberships" },
  { icon: Wallet, title: "Top up your coin wallet", body: "AI features run on coins. Top up any amount from A$5 — you pay securely by card.", to: "/wallet", cta: "Open my wallet" },
  { icon: MessageCircle, title: "Talk to Oracle", body: "Ask Oracle anything. Each reply uses a few coins — you always see your balance.", to: "/oracle", cta: "Open Oracle" },
];

const free = ["Calendar & Life Diary", "Planners & trackers", "Alarm clock", "Personal vault", "Free games", "Media library", "Public library reading"];
const paid = ["Oracle AI chat replies", "Voices & narration", "AI images & avatars", "Video & movies", "Phone receptionist calls", "Story writing with AI"];

const GetStartedPage = () => (
  <div className="min-h-screen bg-background pb-20">
    <SEO title="Get Started — Oracle Lunar" description="How to top up and which Oracle Lunar features are free or paid." path="/get-started" />
    <UniversalBackButton />
    <div className="px-4 pt-14 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-primary">Welcome to Oracle Lunar</h1>
        <p className="text-sm text-muted-foreground">Four quick steps and you're set.</p>
      </div>

      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s.title} className="rounded-2xl border border-border bg-card p-4 flex gap-3">
            <div className="p-2 h-fit rounded-xl bg-primary/10"><s.icon className="w-5 h-5 text-primary" /></div>
            <div className="flex-1">
              <p className="font-bold text-foreground">{i + 1}. {s.title}</p>
              <p className="text-xs text-muted-foreground">{s.body}</p>
              {s.to && <Link to={s.to} className="inline-block mt-2 text-xs font-semibold text-primary underline">{s.cta}</Link>}
            </div>
          </li>
        ))}
      </ol>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="font-bold text-foreground flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Always free</p>
          <ul className="mt-2 text-xs text-muted-foreground list-disc pl-4 space-y-1">{free.map((f) => <li key={f}>{f}</li>)}</ul>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="font-bold text-foreground flex items-center gap-2"><Coins className="w-4 h-4 text-primary" /> Uses coins</p>
          <ul className="mt-2 text-xs text-muted-foreground list-disc pl-4 space-y-1">{paid.map((f) => <li key={f}>{f}</li>)}</ul>
          <p className="mt-2 text-[11px] text-muted-foreground">You pay the real service cost plus 20%. A$1 = 5.37 coins.</p>
        </div>
      </div>
    </div>
  </div>
);

export default GetStartedPage;
