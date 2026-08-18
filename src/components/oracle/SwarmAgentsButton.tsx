import { useState } from "react";
import { Users, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";

/** Provider cost per agent pass in cents, shown before the user commits. */
const CENTS_PER_AGENT = 3;

interface SwarmAgentsButtonProps {
  /** Pre-fills the objective from whatever is currently in the composer. */
  currentInput?: string;
  /** Called with the swarm's final deliverable so it lands in the chat thread. */
  onResult: (markdown: string) => void;
}

export function SwarmAgentsButton({ currentInput, onResult }: SwarmAgentsButtonProps) {
  const [open, setOpen] = useState(false);
  const [objective, setObjective] = useState("");
  const [agents, setAgents] = useState(5);
  const [running, setRunning] = useState(false);

  const estimateCents = (agents + 1) * CENTS_PER_AGENT;

  const launch = async () => {
    const text = objective.trim() || currentInput?.trim() || "";
    if (!text) {
      toast.error("Tell the swarm what to build first.");
      return;
    }
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("oracle-swarm", {
        body: { objective: text, agents, requestKey: crypto.randomUUID() },
      });
      if (error) {
        const ctx = (error as { context?: { status?: number } }).context;
        if (ctx?.status === 402) {
          toast.error("Not enough coins — top up your wallet to run the swarm.");
        } else {
          toast.error(error.message || "Swarm failed to launch.");
        }
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      onResult(data.synthesis as string);
      setOpen(false);
      setObjective("");
      toast.success(
        `Swarm complete — ${agents} agents${data.library_id ? ", saved to your library" : ""}.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Swarm failed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Send a swarm of AI agents at this"
        className="px-3 py-1.5 rounded-full border border-primary/40 bg-primary/15 hover:bg-primary/25 transition-colors text-[10px] font-semibold text-primary flex items-center gap-1.5"
      >
        <Users className="w-3.5 h-3.5" />
        Swarm of Agents
      </button>

      <Dialog open={open} onOpenChange={(v) => !running && setOpen(v)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Launch a swarm of agents
            </DialogTitle>
            <DialogDescription>
              Specialist agents (architect, builder, critic, researcher, designer, monetizer and more) work the
              same objective in parallel, then the Oracle merges them into one deliverable and files it in your library.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder={currentInput?.trim() || "What should the swarm build, fix, or figure out?"}
              rows={3}
            />

            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-muted-foreground">Agents in the swarm</span>
                <span className="font-semibold text-primary">{agents}</span>
              </div>
              <Slider value={[agents]} min={3} max={12} step={1} onValueChange={(v) => setAgents(v[0])} />
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{agents} agents + 1 lead synthesis</span>
                <span className="font-semibold">≈ ${(estimateCents / 100).toFixed(2)}</span>
              </div>
              <p className="text-muted-foreground mt-1">
                Charged from your wallet at cost plus the platform margin, and only for the agents that actually run.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={running}>
              Cancel
            </Button>
            <Button onClick={launch} disabled={running}>
              {running ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Swarm working…
                </>
              ) : (
                <>Launch swarm · ${(estimateCents / 100).toFixed(2)}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SwarmAgentsButton;
