import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutGrid, Search, ChevronUp } from "lucide-react";
import { ROUTE_REGISTRY } from "@/lib/oracleControl";
import { Button } from "@/components/ui/button";

const tools = [...ROUTE_REGISTRY.filter(t => t.path !== "/oracle"),
  { label: "Creator Studio", path: "/creator-studio" },
  { label: "Module Shop", path: "/module-shop" },
  { label: "Free Zone", path: "/free-zone" },
  { label: "Author Dashboard", path: "/author-dashboard" },
  { label: "My Amazon Books", path: "/my-amazon-books" },
  { label: "My Apps", path: "/my-apps" },
  { label: "Founder Vault", path: "/founder-vault" },
  { label: "Realm Builder", path: "/realm-builder" },
  { label: "Immersive Movie Studio", path: "/immersive-movie-studio" },
].sort((a, b) => a.label.localeCompare(b.label));

export default function OracleToolsMenu({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    if (open) { document.addEventListener("pointerdown", dismiss); document.addEventListener("keydown", escape); }
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [open]);
  const filtered = tools.filter(t => t.label.toLowerCase().includes(query.toLowerCase()));
  return <div ref={container}>
      <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-controls="oracle-tools-panel" aria-label="All Oracle tools" title="All Oracle tools" className="oracle-control">
        <LayoutGrid className="h-5 w-5" />
      </Button>
    {open && <div id="oracle-tools-panel" role="dialog" aria-label="All Oracle tools" className="absolute bottom-full left-0 mb-3 z-50 w-[min(360px,calc(100vw-32px))] max-h-[min(480px,55dvh)] overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground p-3 shadow-lg">
      <div className="flex items-center justify-between mb-2"><h2 className="text-sm font-semibold">All Oracle tools</h2><ChevronUp className="h-4 w-4" /></div>
      {children && <div className="flex flex-wrap items-center gap-2 mb-3">{children}</div>}
      <label className="flex items-center gap-2 rounded-lg bg-muted border border-border px-2 mb-2">
        <Search className="w-4 h-4 shrink-0" />
        <input aria-label="Search Oracle tools" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tools…" className="w-full min-w-0 py-2 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
      </label>
      <div className="grid grid-cols-2 gap-1.5">
        {filtered.map(t => <Button type="button" variant="outline" key={t.path} onClick={() => { setOpen(false); navigate(t.path, { state: { oracleWorkspace: true } }); }} className="h-auto min-h-11 rounded-md justify-start whitespace-normal text-left text-sm p-2.5">{t.label}</Button>)}
      </div>
      {!filtered.length && <p className="text-xs py-3">No tools found.</p>}
    </div>}
  </div>;
}