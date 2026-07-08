import { useEffect, useState } from "react";
import { KeyRound, ExternalLink, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  agentId: "nova" | "lyra";
  onSaved?: () => void;
};

const CFG = {
  nova: {
    provider: "OpenAI",
    column: "openai_key" as const,
    placeholder: "sk-...",
    getKeyUrl: "https://platform.openai.com/api-keys",
    helpUrl: "https://platform.openai.com/settings/organization/billing/overview",
    label: "Nova (OpenAI GPT)",
  },
  lyra: {
    provider: "Google Gemini",
    column: "gemini_key" as const,
    placeholder: "AIza...",
    getKeyUrl: "https://aistudio.google.com/apikey",
    helpUrl: "https://aistudio.google.com/apikey",
    label: "Lyra (Google Gemini)",
  },
};

const AgentKeyPanel = ({ agentId, onSaved }: Props) => {
  const cfg = CFG[agentId];
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("user_ai_keys")
        .select(cfg.column)
        .eq("user_id", user.id)
        .maybeSingle();
      const k = (data as any)?.[cfg.column];
      setHasKey(!!(k && String(k).trim().length > 10));
      setLoading(false);
    })();
  }, [agentId, cfg.column]);

  const save = async () => {
    const clean = value.trim();
    if (clean.length < 10) { toast.error("That doesn't look like a valid API key."); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please sign in."); setSaving(false); return; }
    const { error } = await supabase.from("user_ai_keys").upsert(
      { user_id: user.id, [cfg.column]: clean, updated_at: new Date().toISOString() } as any,
      { onConflict: "user_id" }
    );
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${cfg.provider} key saved. ${cfg.label} will now use your own account.`);
    setHasKey(true);
    setValue("");
    setEditing(false);
    onSaved?.();
  };

  const remove = async () => {
    if (!confirm(`Remove your ${cfg.provider} key? ${cfg.label} will fall back to shared credits (subject to the daily free limit).`)) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("user_ai_keys")
      .update({ [cfg.column]: null, updated_at: new Date().toISOString() } as any)
      .eq("user_id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Key removed.");
    setHasKey(false);
  };

  if (loading) {
    return (
      <div className="mx-4 my-3 p-4 rounded-xl border border-border/50 bg-card/50 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Checking your {cfg.provider} key…
      </div>
    );
  }

  if (hasKey && !editing) {
    return (
      <div className="mx-4 my-3 p-3 rounded-xl border border-green-500/30 bg-green-500/5 flex items-center gap-3 text-xs">
        <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
        <div className="flex-1 text-foreground">
          Using <span className="font-semibold">your own {cfg.provider} account</span>. Charges go directly to you.
        </div>
        <button onClick={() => setEditing(true)} className="text-primary hover:underline">Change</button>
        <button onClick={remove} className="text-muted-foreground hover:text-destructive">Remove</button>
      </div>
    );
  }

  return (
    <div className="mx-4 my-3 p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
      <div className="flex items-start gap-3">
        <KeyRound className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            {hasKey ? `Update your ${cfg.provider} key` : `Add your ${cfg.provider} API key`}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-1">
            {cfg.label} will call {cfg.provider} directly from <span className="text-foreground">your own account</span> — you pay {cfg.provider} directly, nothing to us. Your key is stored privately and only used for your chats.
          </p>
          <a
            href={cfg.getKeyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-1"
          >
            Get a {cfg.provider} key <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={cfg.placeholder}
          autoComplete="off"
          className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
        />
        <button
          onClick={save}
          disabled={saving || value.trim().length < 10}
          className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40 flex items-center gap-1"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
        </button>
        {editing && (
          <button onClick={() => { setEditing(false); setValue(""); }} className="text-xs text-muted-foreground hover:text-foreground px-2">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

export default AgentKeyPanel;
