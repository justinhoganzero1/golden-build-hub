import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Package, ExternalLink, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Result = {
  ok?: boolean;
  buildId?: string | null;
  dashboard?: string | null;
  message?: string;
  branch?: string;
  error?: string;
  missing?: string[];
  details?: unknown;
};

export default function AdminBuildAABPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const triggerBuild = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("codemagic-build-aab", {
        body: { branch: "main" },
      });
      if (error) throw error;
      setResult(data as Result);
      if ((data as Result)?.ok) {
        toast.success("Codemagic build started");
      } else {
        toast.error((data as Result)?.error || "Build failed to start");
      }
    } catch (e: any) {
      const msg = e?.message || "Failed to trigger build";
      setResult({ error: msg });
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
            <Package className="w-8 h-8 text-primary" />
            Build Android AAB
          </h1>
          <p className="text-muted-foreground">
            Triggers a real Codemagic CI build of a signed <code>.aab</code> for Google Play.
            Takes ~8 minutes. You'll get an email with the download link when it's ready.
          </p>
        </header>

        <Card className="p-6 space-y-4 border-primary/30">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Workflow</div>
            <div className="font-mono text-sm">android-aab-release</div>
            <div className="text-sm text-muted-foreground mt-3">Branch</div>
            <div className="font-mono text-sm">main</div>
            <div className="text-sm text-muted-foreground mt-3">Package</div>
            <div className="font-mono text-sm">app.oraclelunar.ai</div>
          </div>

          <Button
            size="lg"
            onClick={triggerBuild}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Starting build…</>
            ) : (
              <>Build AAB now</>
            )}
          </Button>
        </Card>

        {result && (
          <Card className="p-6 space-y-3">
            {result.ok ? (
              <>
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-semibold">Build started</span>
                </div>
                <p className="text-sm">{result.message}</p>
                {result.buildId && (
                  <div className="text-xs font-mono text-muted-foreground break-all">
                    Build ID: {result.buildId}
                  </div>
                )}
                {result.dashboard && (
                  <a
                    href={result.dashboard}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-primary underline text-sm"
                  >
                    View live build log <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-semibold">Build failed to start</span>
                </div>
                <p className="text-sm">{result.error}</p>
                {result.missing && result.missing.length > 0 && (
                  <div className="text-sm">
                    <div className="text-muted-foreground mb-1">Missing secrets:</div>
                    <ul className="list-disc list-inside font-mono text-xs">
                      {result.missing.map((m) => <li key={m}>{m}</li>)}
                    </ul>
                  </div>
                )}
                {result.details ? (
                  <pre className="text-xs bg-muted/40 p-3 rounded overflow-auto max-h-60">
                    {JSON.stringify(result.details, null, 2)}
                  </pre>
                ) : null}
              </>
            )}
          </Card>
        )}

        <Card className="p-6 space-y-2 text-sm text-muted-foreground">
          <div className="font-semibold text-foreground">One-time setup required in Codemagic:</div>
          <ol className="list-decimal list-inside space-y-1">
            <li>Create signing keystore + add secrets to <code>android_signing</code> group</li>
            <li>Add <code>GCLOUD_SERVICE_ACCOUNT_CREDENTIALS</code> for Play Console upload</li>
            <li>Add <code>CODEMAGIC_API_TOKEN</code> + <code>CODEMAGIC_APP_ID</code> in Lovable secrets</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
