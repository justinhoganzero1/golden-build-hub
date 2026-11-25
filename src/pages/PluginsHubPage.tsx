import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, CalendarDays, Heart, Paintbrush, Puzzle, Search, Star, BriefcaseBusiness, Link2 } from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOraclePlugins } from "@/hooks/useOraclePlugins";
import { ORACLE_PLUGINS, PLUGIN_GROUPS, type PluginGroup } from "@/lib/oraclePlugins";
import officeBackdrop from "@/assets/oracle-office-empty.jpg";

const icons = { Everyday: CalendarDays, Creative: Paintbrush, Wellbeing: Heart, Work: BriefcaseBusiness };

export default function PluginsHubPage() {
  const navigate = useNavigate();
  const { ids, toggle } = useOraclePlugins();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All" | PluginGroup>("All");
  const [view, setView] = useState("all");
  const matches = ORACLE_PLUGINS.filter(p => (category === "All" || p.group === category)
    && (view !== "favourites" || ids.includes(p.id)) && p.name.toLowerCase().includes(query.trim().toLowerCase()));
  const open = (path: string) => navigate(path, { state: { oracleWorkspace: true } });

  return <main className="relative isolate min-h-dvh text-foreground">
    <SEO title="Plugins & Tools" description="Your Oracle Lunar tools and private plugin favourites." path="/plugins" />
    <img src={officeBackdrop} alt="" aria-hidden="true" className="fixed inset-0 -z-20 h-full w-full object-cover" />
    <div aria-hidden="true" className="fixed inset-0 -z-10 bg-background/90" />
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
      <Button variant="ghost" size="sm" onClick={() => open("/oracle")}><ArrowLeft className="h-4 w-4" />Oracle</Button>
      <header className="my-7 flex flex-wrap items-start justify-between gap-4">
        <div><div className="mb-2 flex items-center gap-2 text-primary"><Puzzle className="h-6 w-6" /><span className="text-sm font-medium">Oracle Lunar</span></div>
          <h1 className="text-3xl font-semibold">Plugins &amp; Tools</h1>
          <p className="mt-3 text-sm text-muted-foreground">{ids.length} favourites · No favourites limit · Saved on this device</p>
        </div>
        <Button variant="outline" onClick={() => open("/settings/connected-apps")}><Link2 className="h-4 w-4" />Connected apps</Button>
      </header>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Tabs value={view} onValueChange={setView}><TabsList><TabsTrigger value="all">All tools</TabsTrigger><TabsTrigger value="favourites"><Star className="mr-2 h-4 w-4" />My favourites</TabsTrigger></TabsList></Tabs>
        <label className="relative min-w-0 flex-1 basis-60"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search plugins" placeholder="Search plugins…" value={query} onChange={e => setQuery(e.target.value)} className="pl-9" /></label>
      </div>
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Plugin category">
        {PLUGIN_GROUPS.map(group => <Button key={group} variant={category === group ? "default" : "outline"} size="sm" aria-pressed={category === group} onClick={() => setCategory(group)}>{group}</Button>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {matches.map(plugin => {
          const Icon = icons[plugin.group];
          return <article key={plugin.id} className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-card/75 p-4 backdrop-blur-md">
            <div className="flex items-start justify-between gap-3"><Icon className="h-6 w-6 text-primary" />
              <Switch aria-label={`Favourite ${plugin.name}`} checked={ids.includes(plugin.id)} onCheckedChange={() => { if (!toggle(plugin.id)) toast.error("Couldn't save your favourites on this device."); }} />
            </div>
            <div className="min-w-0 flex-1"><h2 className="break-words text-base font-semibold">{plugin.name}</h2><p className="mt-1 text-xs text-muted-foreground">{plugin.group}</p></div>
            <Button variant="outline" className="w-full justify-between" onClick={() => open(plugin.path)}>Open {plugin.name}<ArrowUpRight className="h-4 w-4 shrink-0" /></Button>
          </article>;
        })}
      </div>
      {!matches.length && <div role="status" className="py-12 text-center"><Puzzle className="mx-auto mb-4 h-8 w-8 text-muted-foreground" /><p>{view === "favourites" && !ids.length ? "No favourites yet." : "No matching plugins."}</p><Button variant="ghost" className="mt-3" onClick={() => { setView("all"); setQuery(""); setCategory("All"); }}>Show all tools</Button></div>}
      <footer className="mt-8 space-y-2 border-t border-border pt-5 text-xs text-muted-foreground">
        <p>Paid AI tools retain their existing charges. Saving a favourite does not buy or run anything.</p>
        <p>Connected apps shows access you have granted. Adding outside-service plugins is not available yet.</p>
      </footer>
    </div>
  </main>;
}