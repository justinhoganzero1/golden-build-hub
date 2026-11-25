import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PUBLIC_TOOL_HOOKS, publicHookDestination, publicHookPrice } from "@/lib/publicToolHooks";

export default function PublicToolHooks({ signedIn }: { signedIn: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section aria-labelledby="tool-hooks-title" className="mt-8 border-t border-border/60 pt-6">
      <h2 id="tool-hooks-title" className="text-xl font-semibold">What would you like to create?</h2>
      <p className="mt-2 text-sm text-muted-foreground">Chat, create and plan in one AI workspace. Use it in your browser—no download needed.</p>
      <ul className="mt-5 grid gap-4 sm:grid-cols-2">
        {PUBLIC_TOOL_HOOKS.map((tool, index) => (
          <li key={tool.name} className={`${!expanded && index >= 6 ? "hidden" : "flex"} min-w-0 flex-col rounded-lg border border-border/60 bg-card/40 p-4`}>
            <h3 className="text-base font-semibold">{tool.name}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{tool.hook}</p>
            <p className="mt-4 text-xs font-medium text-primary">{publicHookPrice(tool.plan)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{tool.plan === "free" ? tool.name === "Creator Shop" ? "Browsing is free; purchases cost extra." : "Paid AI features are not included." : "AI uses credits; top-ups may be needed."}</p>
            <Button asChild variant="ghost" className="mt-3 h-auto justify-between whitespace-normal px-0 py-2 text-left">
              <Link to={publicHookDestination(tool.path, signedIn)} aria-label={`Explore ${tool.name}`}>
                Explore {tool.name}<ArrowRight className="ml-2 h-4 w-4 shrink-0" />
              </Link>
            </Button>
          </li>
        ))}
      </ul>
      <Button variant="outline" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} className="mt-5 w-full whitespace-normal">
        {expanded ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
        {expanded ? "Show fewer tools" : "Explore all 40 tools & features"}
      </Button>
    </section>
  );
}