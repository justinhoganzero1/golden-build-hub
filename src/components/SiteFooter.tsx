import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Mail, TrendingUp } from "lucide-react";
import ContactOwnerDialog from "@/components/ContactOwnerDialog";
import { useIsAdmin } from "@/hooks/useIsAdmin";

/**
 * Global app footer — About, Help, Legal, Investor and in-app mail on every page.
 * Hidden on immersive/standalone routes where a footer would cover the UI.
 */
const HIDDEN_PREFIXES = ["/standalone", "/app/", "/oracle-preview", "/teleport"];

const SiteFooter = () => {
  const { pathname } = useLocation();
  const { isAdmin } = useIsAdmin();
  const [contactOpen, setContactOpen] = useState(false);
  const [kind, setKind] = useState<"general" | "investor">("general");

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const year = new Date().getFullYear();

  const links = [
    { label: "About the app", to: "/about" },
    { label: "Help & Support", to: "/suggestion-box" },
    { label: "Safety Centre", to: "/safety-center" },
    { label: "Privacy Policy", to: "/privacy-policy" },
    { label: "Terms of Service", to: "/terms-of-service" },
  ];

  const open = (k: "general" | "investor") => { setKind(k); setContactOpen(true); };

  return (
    <>
      <footer className="mt-10 border-t border-border bg-card/60 backdrop-blur-sm px-4 pt-6 pb-28">
        <div className="flex flex-wrap justify-center gap-2 mb-4">
          <Link
            to="/investor"
            className="flex items-center gap-1.5 rounded-full border border-primary/50 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
          >
            <TrendingUp className="w-3.5 h-3.5" /> Investors
          </Link>
          <button
            onClick={() => open("investor")}
            className="flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:border-primary/50 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" /> Investor enquiry
          </button>
          <button
            onClick={() => open("general")}
            className="flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:border-primary/50 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" /> Email the founder
          </button>
          <Link
            to="/inbox"
            className="flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:border-primary/50 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" /> My inbox
          </Link>

          {isAdmin && (
            <Link
              to="/admin/inbox"
              className="flex items-center gap-1.5 rounded-full border border-primary/50 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              <Mail className="w-3.5 h-3.5" /> Admin inbox
            </Link>
          )}
        </div>

        <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          © {year} Oracle Lunar · Your AI best friend, always here for you.
        </p>
      </footer>

      <ContactOwnerDialog open={contactOpen} onClose={() => setContactOpen(false)} defaultKind={kind} />
    </>
  );
};

export default SiteFooter;
