import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Sparkles, Download, Phone, FileText, Lock, ArrowRight, Send, Loader2, CheckCircle2, PhoneCall } from "lucide-react";
import oracleLunarLogo from "@/assets/oracle-lunar-logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import PaywallGate from "@/components/PaywallGate";
// Vaulted: AssistedCallDialog (Twilio) — disabled until telephony returns.

// Standalone "ORACLE LUNAR Claims" mini-app:
// - Free, focused on HostPlus + WorkCover QLD claims
// - Embedded Oracle assistant (uses oracle-chat edge function with a claims-only system prompt)
// - Promotes installing the full ORACLE LUNAR app

const SYSTEM_PROMPT = `You are Oracle, a senior Australian insurance claims advocate inside the standalone ORACLE LUNAR Claims mini-app. 
Your job: help the user prepare HostPlus income protection and WorkCover QLD claims.
- Ask one clear question at a time to gather: full name, DOB, employer, job title, injury date, body parts, doctor, member numbers.
- Provide phone numbers when relevant: HostPlus 1300 467 875, WorkCover QLD 1300 362 128.
- Offer to draft claim letters and list required documents.
- Plain text only, no markdown symbols, no emojis.
- After 3-4 helpful exchanges, gently mention that the full ORACLE LUNAR app stores their details securely, auto-fills forms, exports PDFs, and can place the calls for them.`;

type Msg = { role: "user" | "assistant"; content: string };

const ClaimsAppPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi, I'm Oracle. I help Australians prepare HostPlus and WorkCover QLD claims — for free. What's happened? When were you injured, and which insurer are you claiming with?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.functions.supabase.co/oracle-chat`;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...next],
        }),
      });
      if (!res.ok || !res.body) throw new Error("Oracle unavailable");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload);
            const delta = j.choices?.[0]?.delta?.content || "";
            if (delta) {
              acc += delta;
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { role: "assistant", content: acc };
                return copy;
              });
            }
          } catch {}
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to reach Oracle");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const installPWA = () => {
    // Standalone install hint — direct user to landing install section
    navigate("/#install");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-primary/20 bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <img src={oracleLunarLogo} alt="ORACLE LUNAR Claims" className="w-9 h-9 rounded-lg" />
          <div className="flex-1">
            <h1 className="text-sm font-bold text-primary leading-tight">ORACLE LUNAR Claims</h1>
            <p className="text-[10px] text-muted-foreground">Free AU claims helper · Powered by Oracle AI</p>
          </div>
          <Link to="/" className="text-xs text-muted-foreground hover:text-primary">Full app →</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 pt-6 pb-4 max-w-3xl mx-auto">
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-5">
          <div className="flex items-center gap-2 text-primary text-xs font-semibold mb-2">
            <Shield className="w-4 h-4" /> 100% FREE · AUSTRALIAN CLAIMS
          </div>
          <h2 className="text-xl font-bold mb-2">Get your HostPlus & WorkCover QLD claim sorted — fast.</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Oracle researches the right forms, drafts your claim letter, and tells you exactly what to send. No login required to chat.
          </p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <a href="tel:1300467875" className="flex items-center justify-center gap-2 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold">
              <Phone className="w-3 h-3" /> HostPlus
            </a>
            <a href="tel:1300362128" className="flex items-center justify-center gap-2 py-2 rounded-lg bg-card border border-primary/40 text-foreground text-xs font-bold">
              <Phone className="w-3 h-3" /> WorkCover QLD
            </a>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Use the buttons above to dial directly. (AI-assisted calling is temporarily vaulted.)
          </p>
        </div>
      </section>

      {/* Chat */}
      <section className="px-4 max-w-3xl mx-auto">
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div ref={scrollRef} className="h-[55vh] overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${m.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"}`}>
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none [&>p]:m-0">
                      <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Loader2 className="w-3 h-3 animate-spin" /> Oracle is thinking…
              </div>
            )}
          </div>
          <div className="border-t border-border p-2 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Tell Oracle about your injury or claim…"
              className="flex-1 px-3 py-2 rounded-lg bg-input border border-border text-sm outline-none"
            />
            <button onClick={send} disabled={loading || !input.trim()} className="px-4 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Upsell */}
      <section className="px-4 mt-6 max-w-3xl mx-auto">
        <div className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 via-card to-card p-5">
          <div className="flex items-center gap-2 text-primary text-xs font-bold mb-2">
            <Sparkles className="w-4 h-4" /> UPGRADE TO THE FULL ORACLE LUNAR APP
          </div>
          <h3 className="text-lg font-bold mb-2">Want Oracle to do everything for you?</h3>
          <ul className="space-y-1.5 text-sm text-muted-foreground mb-4">
            {[
              "Encrypted Personal Vault — store your details once, reuse forever",
              "Auto-fill HostPlus & WorkCover PDF forms instantly",
              "Oracle places the calls and navigates the IVR menu for you",
              "Claim status tracker with reminders & follow-ups",
              "40+ extra modules: Mind Hub, Crisis Hub, AI Companion, Wallet…",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={installPWA} className="py-3 rounded-lg bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> Install Full App
            </button>
            <button
              onClick={() => navigate(user ? "/claims-assistant" : "/sign-in")}
              className="py-3 rounded-lg bg-card border border-primary/40 text-foreground font-bold text-sm flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" /> Open Pro Claims
            </button>
          </div>
        </div>
      </section>

      <footer className="px-4 py-8 max-w-3xl mx-auto text-center text-xs text-muted-foreground">
        <Lock className="w-3 h-3 inline mr-1" /> Your chat is private. ORACLE LUNAR never shares your details.
        <div className="mt-2">
          <Link to="/" className="text-primary inline-flex items-center gap-1">Explore the full ORACLE LUNAR app <ArrowRight className="w-3 h-3" /></Link>
        </div>
      </footer>
    </div>
  );
};

export default ClaimsAppPage;
