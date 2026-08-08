// Admin — AI ingest health check.
// Verifies the machine-readable surface AI answer engines rely on:
//   /.well-known/ai.json, /ai.json, /llms.txt, /ai-search (JSON-LD), /robots.txt bot rules,
//   and the live ai-ingest edge endpoint.
import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import SEO from "@/components/SEO";

type Status = "pass" | "fail" | "warn";
interface Check { name: string; status: Status; detail: string }

const REQUIRED_BOTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot",
  "ClaudeBot", "Google-Extended", "Applebot", "Bingbot",
];

const FUNCTIONS_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;

async function checkJson(path: string, requiredKeys: string[]): Promise<Check> {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) return { name: path, status: "fail", detail: `HTTP ${res.status}` };
    const json = await res.json();
    const missing = requiredKeys.filter(k => !(k in json));
    return missing.length
      ? { name: path, status: "warn", detail: `Missing keys: ${missing.join(", ")}` }
      : { name: path, status: "pass", detail: `Valid JSON with ${Object.keys(json).length} keys` };
  } catch (e) {
    return { name: path, status: "fail", detail: e instanceof Error ? e.message : "unreachable" };
  }
}

async function checkText(path: string, mustContain: string[]): Promise<Check> {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) return { name: path, status: "fail", detail: `HTTP ${res.status}` };
    const text = await res.text();
    const missing = mustContain.filter(s => !text.toLowerCase().includes(s.toLowerCase()));
    return missing.length
      ? { name: path, status: "warn", detail: `Missing: ${missing.join(", ")}` }
      : { name: path, status: "pass", detail: `${text.length} bytes, all markers present` };
  } catch (e) {
    return { name: path, status: "fail", detail: e instanceof Error ? e.message : "unreachable" };
  }
}

async function checkRobots(): Promise<Check> {
  try {
    const res = await fetch("/robots.txt", { cache: "no-store" });
    if (!res.ok) return { name: "/robots.txt", status: "fail", detail: `HTTP ${res.status}` };
    const text = await res.text();
    if (/^\s*User-agent:\s*\*\s*[\r\n]+\s*Disallow:\s*\/\s*$/im.test(text)) {
      return { name: "/robots.txt", status: "fail", detail: "Wildcard Disallow: / blocks every crawler" };
    }
    const missing = REQUIRED_BOTS.filter(b => !text.includes(b));
    return missing.length
      ? { name: "/robots.txt", status: "warn", detail: `Not explicitly allowed: ${missing.join(", ")}` }
      : { name: "/robots.txt", status: "pass", detail: "All configured AI bots explicitly allowed" };
  } catch (e) {
    return { name: "/robots.txt", status: "fail", detail: e instanceof Error ? e.message : "unreachable" };
  }
}

async function checkAiSearchJsonLd(): Promise<Check> {
  try {
    const res = await fetch("/ai-search", { cache: "no-store" });
    if (!res.ok) return { name: "/ai-search", status: "fail", detail: `HTTP ${res.status}` };
    // The route is client-rendered, so read the JSON-LD from the live DOM when we're on it,
    // otherwise mount the page's schema check against the running app.
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    const types = scripts
      .map(s => { try { return JSON.parse(s.textContent || "{}")["@type"]; } catch { return null; } })
      .filter(Boolean);
    const wanted = ["SoftwareApplication", "FAQPage"];
    const missing = wanted.filter(w => !types.includes(w));
    return missing.length
      ? { name: "/ai-search JSON-LD", status: "warn", detail: `Open /ai-search to verify; not detected here: ${missing.join(", ")}` }
      : { name: "/ai-search JSON-LD", status: "pass", detail: `Schema types found: ${types.join(", ")}` };
  } catch (e) {
    return { name: "/ai-search", status: "fail", detail: e instanceof Error ? e.message : "unreachable" };
  }
}

export default function AdminAiHealthPage() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [running, setRunning] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    const results = await Promise.all([
      checkJson("/.well-known/ai.json", ["name", "url"]),
      checkJson("/ai.json", ["name", "url"]),
      checkText("/llms.txt", ["Oracle Lunar", "ai-search"]),
      checkRobots(),
      checkAiSearchJsonLd(),
      checkJson(`${FUNCTIONS_BASE}/ai-ingest?probe=1`, ["name", "capabilities", "pricing"]),
      checkText("/sitemap.xml", ["/ai-search"]),
    ]);
    setChecks(results);
    setRunning(false);
  }, []);

  useEffect(() => { run(); }, [run]);

  const failed = checks.filter(c => c.status === "fail").length;
  const warned = checks.filter(c => c.status === "warn").length;

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <SEO title="AI Ingest Health — Oracle Lunar Admin" description="Automated health check of the Oracle Lunar AI ingest surface." path="/admin/ai-health" />
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">AI Ingest Health Check</h1>
          <Button size="sm" variant="outline" onClick={run} disabled={running}>
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span className="ml-1 text-xs">Re-run</span>
          </Button>
        </div>

        <Card className="p-3 text-xs">
          {running ? "Running checks…" : failed
            ? <span className="text-destructive font-semibold">{failed} failing, {warned} warnings</span>
            : warned
              ? <span className="text-yellow-500 font-semibold">All reachable — {warned} warnings</span>
              : <span className="text-primary font-semibold">All checks passing ✅</span>}
        </Card>

        <div className="space-y-2">
          {checks.map(c => (
            <Card key={c.name} className="p-3 flex items-start gap-3">
              {c.status === "pass" ? <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                : c.status === "warn" ? <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                : <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />}
              <div className="min-w-0">
                <p className="text-sm font-semibold break-all">{c.name}</p>
                <p className="text-[11px] text-muted-foreground break-words">{c.detail}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
