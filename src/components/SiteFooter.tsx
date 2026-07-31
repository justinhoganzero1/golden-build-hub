import { Link, useLocation } from "react-router-dom";

/**
 * Global app footer — About, Help and Legal links on every page.
 * Hidden on immersive/standalone routes where a footer would cover the UI.
 */
const HIDDEN_PREFIXES = ["/standalone", "/app/", "/oracle-preview", "/teleport"];

const SiteFooter = () => {
  const { pathname } = useLocation();
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const year = new Date().getFullYear();

  const links = [
    { label: "About the app", to: "/about" },
    { label: "Help & Support", to: "/suggestion-box" },
    { label: "Safety Centre", to: "/safety-center" },
    { label: "Privacy Policy", to: "/privacy-policy" },
    { label: "Terms of Service", to: "/terms-of-service" },
  ];

  return (
    <footer className="mt-10 border-t border-border bg-card/60 backdrop-blur-sm px-4 pt-6 pb-28">
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
  );
};

export default SiteFooter;
