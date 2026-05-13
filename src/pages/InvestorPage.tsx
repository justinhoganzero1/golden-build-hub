import { useState, useEffect } from "react";
import SEO from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import UniversalBackButton from "@/components/UniversalBackButton";
import { TrendingUp, DollarSign, Mail, User, Send, Trash2, Check, X, MessageSquare, Clock, Star, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const OWNER_EMAIL = "justinbretthogan@gmail.com";

interface Offer {
  id: string;
  investor_name: string;
  investor_email: string;
  offer_amount: string | null;
  message: string;
  status: string;
  ai_score: number | null;
  ai_notes: string | null;
  created_at: string;
}

const InvestorPage = () => {
  const { user } = useAuth();
  const isOwner = user?.email === OWNER_EMAIL;
  const [offers, setOffers] = useState<Offer[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState<"submit" | "offers">(isOwner ? "offers" : "submit");

  useEffect(() => {
    if (isOwner) loadOffers();
  }, [isOwner]);

  const loadOffers = async () => {
    const { data } = await supabase
      .from("investment_offers")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setOffers(data);
  };

  const submitOffer = async () => {
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSending(true);
    try {
      // AI analysis
      const { data: aiData } = await supabase.functions.invoke("ai-moderate", {
        body: {
          type: "investment",
          content: `Investor: ${name}\nEmail: ${email}\nAmount: ${amount || "Not specified"}\nMessage: ${message}`,
        },
      });

      const aiScore = aiData?.score ?? 50;
      const aiNotes = aiData?.notes ?? "Pending review";

      const { error } = await supabase.from("investment_offers").insert({
        investor_name: name,
        investor_email: email,
        offer_amount: amount || null,
        message,
        ai_score: aiScore,
        ai_notes: aiNotes,
      });

      if (error) throw error;
      toast.success("Investment offer submitted! We'll review and get back to you.");
      setName(""); setEmail(""); setAmount(""); setMessage("");
    } catch (e) {
      toast.error("Failed to submit offer");
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("investment_offers").update({ status }).eq("id", id);
    loadOffers();
    toast.success(`Offer marked as ${status}`);
  };

  const deleteOffer = async (id: string) => {
    await supabase.from("investment_offers").delete().eq("id", id);
    loadOffers();
    toast.success("Offer removed");
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "pending": return "bg-yellow-500/20 text-yellow-400";
      case "reviewing": return "bg-blue-500/20 text-blue-400";
      case "accepted": return "bg-green-500/20 text-green-400";
      case "declined": return "bg-red-500/20 text-red-400";
      case "negotiating": return "bg-purple-500/20 text-purple-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEO title="Investor Information — Oracle Lunar" description="Investment opportunities and submissions for Oracle Lunar — the cinematic AI super-app." path="/investor" />
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-primary/10">
            <TrendingUp className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">Investor Hub</h1>
            <p className="text-xs text-muted-foreground">AI-Monitored Investment Opportunities</p>
          </div>
        </div>

        {/* Tabs for owner */}
        {isOwner && (
          <div className="flex gap-2 mb-6">
            <button onClick={() => setTab("offers")} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "offers" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
              Offers ({offers.length})
            </button>
            <button onClick={() => setTab("submit")} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "submit" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
              Submit Form Preview
            </button>
          </div>
        )}

        {/* Owner offers view */}
        {isOwner && tab === "offers" && (
          <div className="space-y-3">
            {offers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No investment offers yet</p>
              </div>
            ) : offers.map((offer) => (
              <div key={offer.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-foreground">{offer.investor_name}</h3>
                    <p className="text-xs text-muted-foreground">{offer.investor_email}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(offer.status)}`}>
                    {offer.status}
                  </span>
                </div>

                {offer.offer_amount && (
                  <div className="flex items-center gap-1 text-sm text-primary mb-2">
                    <DollarSign className="w-4 h-4" />
                    <span className="font-semibold">{offer.offer_amount}</span>
                  </div>
                )}

                <p className="text-sm text-foreground mb-3">{offer.message}</p>

                {/* AI Analysis */}
                <div className="bg-secondary/50 rounded-lg p-3 mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold text-primary">AI Analysis: {offer.ai_score}/100</span>
                    {(offer.ai_score ?? 0) < 30 && <AlertTriangle className="w-4 h-4 text-yellow-400" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{offer.ai_notes}</p>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => updateStatus(offer.id, "reviewing")} className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium">
                    <Clock className="w-3 h-3 inline mr-1" />Reviewing
                  </button>
                  <button onClick={() => updateStatus(offer.id, "negotiating")} className="px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-xs font-medium">
                    <MessageSquare className="w-3 h-3 inline mr-1" />Negotiate
                  </button>
                  <button onClick={() => updateStatus(offer.id, "accepted")} className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs font-medium">
                    <Check className="w-3 h-3 inline mr-1" />Accept
                  </button>
                  <button onClick={() => updateStatus(offer.id, "declined")} className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium">
                    <X className="w-3 h-3 inline mr-1" />Decline
                  </button>
                  <button onClick={() => deleteOffer(offer.id)} className="px-3 py-1.5 bg-destructive/20 text-destructive rounded-lg text-xs font-medium">
                    <Trash2 className="w-3 h-3 inline mr-1" />Delete
                  </button>
                </div>

                <p className="text-[10px] text-muted-foreground mt-2">{new Date(offer.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}

        {/* Submit form */}
        {(tab === "submit" || !isOwner) && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4 mb-4">
              <h2 className="text-lg font-semibold text-primary mb-2">Invest in Oracle Lunar</h2>
              <p className="text-sm text-muted-foreground">
                Oracle Lunar is an AI-powered super app with 40+ tools, 101 AI security guards, and a vision to become 
                the world's most comprehensive personal companion. All investment offers are reviewed by our AI 
                system and personally evaluated. Terms are negotiable.
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 space-y-4">
              <h3 className="font-semibold text-foreground">Submit Investment Offer</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
                  <User className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <label htmlFor="investor-name" className="sr-only">Your name</label>
                  <input id="investor-name" name="name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your Name *" className="bg-transparent flex-1 text-sm outline-none text-foreground placeholder:text-muted-foreground" />
                </div>
                <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
                  <Mail className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <label htmlFor="investor-email" className="sr-only">Your email</label>
                  <input id="investor-email" name="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Your Email *" type="email" className="bg-transparent flex-1 text-sm outline-none text-foreground placeholder:text-muted-foreground" />
                </div>
                <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
                  <DollarSign className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <label htmlFor="investor-amount" className="sr-only">Investment amount</label>
                  <input id="investor-amount" name="amount" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Investment Amount (negotiable)" className="bg-transparent flex-1 text-sm outline-none text-foreground placeholder:text-muted-foreground" />
                </div>
                <label htmlFor="investor-message" className="sr-only">Investment interest message</label>
                <textarea id="investor-message" name="message" value={message} onChange={e => setMessage(e.target.value)} placeholder="Tell us about your investment interest... *" rows={4} className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground resize-none" />
              </div>
              <button onClick={submitOffer} disabled={sending} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50">
                {sending ? "Submitting..." : <><Send className="w-4 h-4" /> Submit Offer</>}
              </button>
              <p className="text-[10px] text-muted-foreground text-center">All offers are AI-analyzed and personally reviewed. We respond within 48 hours.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvestorPage;
