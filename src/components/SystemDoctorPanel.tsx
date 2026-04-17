import { useState } from "react";
import { Activity, CheckCircle2, AlertTriangle, XCircle, Wrench, Loader2, Shield } from "lucide-react";
import { runFullDiagnostic, emergencyReset, type DoctorReport, type CheckResult } from "@/lib/systemDoctor";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

const StatusIcon = ({ s }: { s: CheckResult["status"] }) => {
  if (s === "ok") return <CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-active))]" />;
  if (s === "repaired") return <Wrench className="w-4 h-4 text-primary" />;
  if (s === "warn") return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  return <XCircle className="w-4 h-4 text-destructive" />;
};

const SystemDoctorPanel = ({ open, onClose }: Props) => {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<DoctorReport | null>(null);
  const [live, setLive] = useState<CheckResult[]>([]);

  if (!open) return null;

  const run = async () => {
    setRunning(true);
    setLive([]);
    setReport(null);
    try {
      const r = await runFullDiagnostic((res) => setLive((prev) => [...prev, res]));
      setReport(r);
      toast.success(r.summary);
    } catch (e: any) {
      toast.error(`Diagnostic failed: ${e?.message}`);
    } finally {
      setRunning(false);
    }
  };

  const reset = async () => {
    if (!confirm("Emergency reset will clear caches and stuck state (auth preserved). Continue?")) return;
    const msg = await emergencyReset();
    toast.success(msg);
  };

  const list = report?.results ?? live;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-2xl mx-auto p-4 pt-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Oracle System Doctor</h2>
              <p className="text-xs text-muted-foreground">Self-diagnose & auto-repair engine</p>
            </div>
          </div>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Close</button>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={run}
            disabled={running}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50"
          >
            {running ? <Loader2 className="w-5 h-5 animate-spin" /> : <Activity className="w-5 h-5" />}
            {running ? "Scanning…" : "Run Full Diagnostic"}
          </button>
          <button
            onClick={reset}
            disabled={running}
            className="px-4 py-3 rounded-xl bg-secondary text-foreground border border-border text-sm disabled:opacity-50"
          >
            Emergency Reset
          </button>
        </div>

        {report && (
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-[hsl(var(--status-active))]">{report.passed}</p>
              <p className="text-[10px] text-muted-foreground">OK</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-primary">{report.repaired}</p>
              <p className="text-[10px] text-muted-foreground">Repaired</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-amber-500">{report.warned}</p>
              <p className="text-[10px] text-muted-foreground">Warnings</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-destructive">{report.failed}</p>
              <p className="text-[10px] text-muted-foreground">Failed</p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {list.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-lg p-3 flex items-start gap-3">
              <StatusIcon s={r.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                  <span className="text-[10px] text-muted-foreground shrink-0">{r.durationMs}ms</span>
                </div>
                <p className="text-xs text-muted-foreground break-words">{r.detail}</p>
                {r.repairAction && (
                  <p className="text-[10px] text-primary mt-1">↻ Auto-repaired: {r.repairAction}</p>
                )}
              </div>
            </div>
          ))}
          {list.length === 0 && !running && (
            <p className="text-center text-sm text-muted-foreground py-8">
              Tap “Run Full Diagnostic” to scan all subsystems.
            </p>
          )}
        </div>

        {report && (
          <div className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/20">
            <p className="text-xs text-muted-foreground mb-1">Doctor's summary</p>
            <p className="text-sm text-foreground">{report.summary}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemDoctorPanel;
