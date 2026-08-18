import { useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Check, Plug, ShieldCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PROJECT_REF = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
const MCP_URL = `https://${PROJECT_REF ?? "project"}.supabase.co/functions/v1/mcp`;

const TOOLS = [
  { name: "whoami", desc: "Identify the connected Oracle Lunar account." },
  { name: "list_diary_entries", desc: "Read entries from your Life Diary." },
  { name: "create_diary_entry", desc: "Write a new entry into your Life Diary." },
  { name: "get_wallet_balance", desc: "Check your current coin balance." },
  { name: "list_calendar_events", desc: "See your upcoming calendar events." },
];

export default function MCPServerPage() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(MCP_URL);
      setCopied(true);
      toast.success("MCP endpoint copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed — select the URL manually");
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 space-y-6">
      <header className="space-y-2">
        <Badge variant="secondary" className="gap-1">
          <Plug className="h-3 w-3" /> Agent integrations
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight">Oracle Lunar MCP server</h1>
        <p className="text-muted-foreground">
          Connect Claude, ChatGPT, Cursor or any MCP-capable agent straight to your Oracle Lunar
          account. Every tool runs as you, under your own permissions.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your endpoint</CardTitle>
          <CardDescription>Paste this URL into your agent's MCP server settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3">
            <code className="flex-1 break-all text-sm">{MCP_URL}</code>
            <Button size="sm" variant="secondary" onClick={copy} aria-label="Copy MCP endpoint">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Your agent will open an Oracle Lunar sign-in window the first time it connects. Approve
            it once and the connection stays active until you revoke it.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tools your agent gets</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {TOOLS.map((t) => (
              <li key={t.name} className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0">
                <code className="text-sm font-medium">{t.name}</code>
                <span className="text-sm text-muted-foreground">{t.desc}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-4 w-4" /> Stay in control
          </CardTitle>
          <CardDescription>
            Review or revoke every agent you've connected at any time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/settings/authorizations">
              Manage connected apps <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
