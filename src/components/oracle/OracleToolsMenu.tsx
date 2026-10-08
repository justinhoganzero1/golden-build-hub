import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutGrid, Search, ChevronUp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ROUTE_REGISTRY } from "@/lib/oracleControl";

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
  const filtered = tools.filter(t => t.label.toLowerCase().includes(query.toLowerCase()));
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button aria-label="All Oracle tools" title="All Oracle tools" className={`h-9 w-9 shrink-0 rounded-full border flex items-center justify-center transition-colors ${open ? "bg-sky-400/30 border-sky-200 shadow-[0_0_12px_#38bdf855]" : "bg-sky-500/15 border-sky-300/30 hover:bg-sky-400/25"} text-[#dbeeff]`}>
        <LayoutGrid className="h-5 w-5" />
      </button>
    </PopoverTrigger>
    <PopoverContent side="top" align="start" sideOffset={10} className="w-[min(360px,calc(100vw-32px))] max-h-[min(480px,var(--radix-popover-content-available-height))] overflow-y-auto rounded-2xl border-sky-300/40 bg-[#091322] text-[#dbeeff] p-3 shadow-[0_0_24px_#38bdf833]">
      <div className="flex items-center justify-between mb-2"><h2 className="text-sm font-semibold">All Oracle tools</h2><ChevronUp className="h-4 w-4" /></div>
      <p className="text-xs text-sky-100/80 mb-3">Open any app tool here. Membership and wallet rules still apply.</p>
      {children && <div className="flex flex-wrap items-center gap-2 mb-3">{children}</div>}
      <label className="flex items-center gap-2 rounded-lg bg-sky-400/10 border border-sky-300/25 px-2 mb-2">
        <Search className="w-4 h-4 shrink-0" />
        <input aria-label="Search Oracle tools" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tools…" className="w-full min-w-0 py-2 bg-transparent text-xs outline-none placeholder:text-sky-100/60" />
      </label>
      <div className="grid grid-cols-2 gap-1.5">
        {filtered.map(t => <button key={t.path} onClick={() => { setOpen(false); navigate(t.path); }} className="text-left text-xs p-2.5 rounded-lg border border-sky-300/20 bg-sky-500/10 hover:bg-sky-400/25 hover:border-sky-200 focus-visible:ring-2 focus-visible:ring-sky-200 outline-none transition-colors">{t.label}</button>)}
      </div>
      {!filtered.length && <p className="text-xs py-3">No tools found.</p>}
    </PopoverContent>
  </Popover>;
}