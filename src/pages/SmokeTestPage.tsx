import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, Circle, AlertTriangle } from "lucide-react";

type StepStatus = "pending" | "running" | "pass" | "fail" | "warn";

interface Step {
  id: string;
  name: string;
  description: string;
  status: StepStatus;
  detail?: string;
  durationMs?: number;
  route?: string;
}

const INITIAL_STEPS: Step[] = [
  { id: "auth", name: "Authentication session", description: "Verifies your Lovable Cloud auth session loads.", status: "pending" },
  { id: "profile", name: "Profile record", description: "Loads your user profile from the database.", status: "pending", route: "/profile" },
  { id: "wallet", name: "Wallet & credits", description: "Reads credit balance for pay-per-use flows.", status: "pending", route: "/wallet" },
  { id: "media", name: "Media Library access", description: "Lists your saved media items.", status: "pending", route: "/media-library" },
  { id: "dashboard", name: "Dashboard route", description: "Confirms the main dashboard chunk loads.", status: "pending", route: "/dashboard" },
  { id: "oracle", name: "Oracle AI gateway", description: "Pings the Oracle edge function.", status: "pending", route: "/oracle" },
  { id: "voice", name: "Voice Studio config", description: "Checks voice provider configuration.", status: "pending", route: "/voice-studio" },
  { id: "storage", name: "Storage buckets", description: "Lists user-visible storage buckets.", status: "pending" },
];

const StatusIcon = ({ status }: { status: StepStatus }) => {
  switch (status) {
    case "pass": return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    case "fail": return <XCircle className="h-5 w-5 text-red-500" />;
    case "warn": return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    case "running": return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
    default: return <Circle className="h-5 w-5 text-muted-foreground" />;
  }
};

export default function SmokeTestPage() {
  const { user } = useAuth();
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);

  const update = (id: string, patch: Partial<Step>) =>
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const runStep = async (id: string, fn: () => Promise<{ status: StepStatus; detail?: string }>) => {
    update(id, { status: "running", detail: undefined });
    const start = performance.now();
    try {
      const result = await fn();
      update(id, { ...result, durationMs: Math.round(performance.now() - start) });
    } catch (e: any) {
      update(id, { status: "fail", detail: e?.message ?? String(e), durationMs: Math.round(performance.now() - start) });
    }
  };

  const runAll = useCallback(async () => {
    setRunning(true);
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: "pending", detail: undefined, durationMs: undefined })));

    await runStep("auth", async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) return { status: "fail", detail: error.message };
      if (!data.session) return { status: "warn", detail: "No active session — sign in to fully test." };
      return { status: "pass", detail: `Signed in as ${data.session.user.email ?? data.session.user.id}` };
    });

    await runStep("profile", async () => {
      if (!user) return { status: "warn", detail: "Skipped — not signed in." };
      const { data, error } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
      if (error) return { status: "fail", detail: error.message };
      if (!data) return { status: "warn", detail: "Profile row missing." };
      return { status: "pass", detail: "Profile loaded." };
    });

    await runStep("wallet", async () => {
      if (!user) return { status: "warn", detail: "Skipped — not signed in." };
      const { data, error } = await supabase
        .from("user_credits" as any)
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error && !/relation .* does not exist/i.test(error.message)) return { status: "fail", detail: error.message };
      const bal = (data as any)?.balance;
      return { status: "pass", detail: bal != null ? `Balance: ${bal} credits` : "Wallet reachable." };
    });

    await runStep("media", async () => {
      if (!user) return { status: "warn", detail: "Skipped — not signed in." };
      const { error, count } = await supabase
        .from("media_library" as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (error) return { status: "fail", detail: error.message };
      return { status: "pass", detail: `${count ?? 0} item(s) in library.` };
    });

    await runStep("dashboard", async () => {
      try {
        await import("./DashboardPage");
        return { status: "pass", detail: "Dashboard chunk loaded." };
      } catch (e: any) {
        return { status: "fail", detail: e?.message ?? "Failed to load chunk" };
      }
    });

    await runStep("oracle", async () => {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { messages: [{ role: "user", content: "ping" }], smokeTest: true },
      });
      if (error) {
        const msg = error.message || "";
        if (/not found|404/i.test(msg)) return { status: "warn", detail: "ai-chat function not deployed." };
        return { status: "fail", detail: msg };
      }
      return { status: "pass", detail: data ? "Gateway responded." : "Gateway reachable." };
    });

    await runStep("voice", async () => {
      const { error } = await supabase.functions.invoke("elevenlabs-voices", { body: {} });
      if (error) {
        if (/not found|404/i.test(error.message)) return { status: "warn", detail: "Voice function not deployed." };
        return { status: "fail", detail: error.message };
      }
      return { status: "pass", detail: "Voice provider reachable." };
    });

    await runStep("storage", async () => {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) return { status: "fail", detail: error.message };
      return { status: "pass", detail: `${data?.length ?? 0} bucket(s) visible.` };
    });

    setRunning(false);
  }, [user]);

  const counts = steps.reduce(
    (acc, s) => ({ ...acc, [s.status]: (acc as any)[s.status] + 1 }),
    { pending: 0, running: 0, pass: 0, fail: 0, warn: 0 } as Record<StepStatus, number>,
  );
  const done = !running && steps.every((s) => s.status !== "pending" && s.status !== "running");

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Guided Smoke Test</h1>
          <p className="text-muted-foreground">
            Walks the critical flows in order and reports the status of each step. Use this to confirm the app is healthy after changes.
          </p>
        </header>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-lg">Run checks</CardTitle>
            <div className="flex items-center gap-2">
              {done && (
                <>
                  <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600">{counts.pass} pass</Badge>
                  {counts.warn > 0 && <Badge variant="secondary" className="bg-amber-500/15 text-amber-600">{counts.warn} warn</Badge>}
                  {counts.fail > 0 && <Badge variant="destructive">{counts.fail} fail</Badge>}
                </>
              )}
              <Button onClick={runAll} disabled={running}>
                {running ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running…</> : "Run smoke test"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {steps.map((step, i) => (
              <div key={step.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                <div className="pt-0.5"><StatusIcon status={step.status} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{i + 1}. {step.name}</span>
                    {step.durationMs != null && (
                      <span className="text-xs text-muted-foreground">{step.durationMs} ms</span>
                    )}
                    {step.route && (
                      <Link to={step.route} className="text-xs text-primary hover:underline">Open {step.route}</Link>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                  {step.detail && (
                    <p className={`text-xs mt-1 break-words ${step.status === "fail" ? "text-red-500" : step.status === "warn" ? "text-amber-600" : "text-muted-foreground"}`}>
                      {step.detail}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {done && counts.fail === 0 && counts.warn === 0 && (
          <p className="text-sm text-emerald-600">All critical flows passed.</p>
        )}
        {done && (counts.fail > 0 || counts.warn > 0) && (
          <p className="text-sm text-muted-foreground">
            Review the failed/warning steps above. Click the route link beside each step to open it directly.
          </p>
        )}
      </div>
    </div>
  );
}
