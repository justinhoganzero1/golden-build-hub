import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, MessageCircle, Wallet, Shield, X } from "lucide-react";

const STORAGE_KEY = "oracle-lunar-onboarding-dismissed-v1";

/**
 * Lightweight first-visit onboarding shown inside the dashboard.
 * Dismissable, persisted in localStorage. Never mentions the builder.
 */
const DashboardOnboarding = () => {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setShow(true);
    } catch {}
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    setShow(false);
  };

  if (!show) return null;

  const steps = [
    {
      icon: <MessageCircle className="w-4 h-4" />,
      title: "Talk to Oracle",
      body: "Your AI best friend — chat, voice, vision and more.",
      cta: "Open Oracle",
      onClick: () => { navigate("/oracle"); dismiss(); },
    },
    {
      icon: <Sparkles className="w-4 h-4" />,
      title: "Pick a tool",
      body: "40+ studios: photo, video, tutor, mind, family and more.",
      cta: "Explore",
      onClick: () => { dismiss(); },
    },
    {
      icon: <Wallet className="w-4 h-4" />,
      title: "Top up when you need",
      body: "Free core forever. Paid AI runs charge tiny coins per use.",
      cta: "View wallet",
      onClick: () => { navigate("/wallet"); dismiss(); },
    },
    {
      icon: <Shield className="w-4 h-4" />,
      title: "Your vault is private",
      body: "Everything you create auto-saves to your private Vault.",
      cta: "Open vault",
      onClick: () => { navigate("/vault"); dismiss(); },
    },
  ];

  return (
    <div className="mx-4 mb-4">
      <div className="relative rounded-2xl border border-primary/40 bg-gradient-to-br from-background via-background to-primary/5 p-4 sm:p-5 shadow-lg">
        <button
          onClick={dismiss}
          aria-label="Dismiss welcome panel"
          className="absolute top-2 right-2 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
            ✨ Welcome
          </span>
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-foreground leading-tight">
          You're in. Here's how to get the most out of Oracle Lunar.
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Four quick steps — skip any of them, you can come back anytime.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
          {steps.map((s, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-3 flex flex-col"
            >
              <div className="flex items-center gap-2 text-primary mb-1">
                <span className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
                  {s.icon}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Step {i + 1}
                </span>
              </div>
              <div className="text-sm font-semibold text-foreground">{s.title}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug flex-1">
                {s.body}
              </p>
              <button
                onClick={s.onClick}
                className="mt-2 text-[11px] font-bold text-primary hover:underline self-start"
              >
                {s.cta} →
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mt-3">
          <span className="text-[10px] text-muted-foreground">
            You won't see this again on this device.
          </span>
          <button
            onClick={dismiss}
            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardOnboarding;
