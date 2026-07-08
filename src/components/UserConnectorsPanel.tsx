import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plug, ExternalLink, X, Check } from "lucide-react";

type Connector = {
  id: string;
  label: string;
  emoji: string;
  placeholder: string;
  getKeyUrl: string;
  blurb: string;
};

const CONNECTORS: Connector[] = [
  { id: "openai",     label: "OpenAI (Nova)",       emoji: "🤖", placeholder: "sk-...",           getKeyUrl: "https://platform.openai.com/api-keys",           blurb: "GPT chat, vision, embeddings — billed to your OpenAI account." },
  { id: "gemini",     label: "Google Gemini (Lyra)",emoji: "✨", placeholder: "AIza...",          getKeyUrl: "https://aistudio.google.com/apikey",             blurb: "Gemini chat + multimodal — free tier from Google, billed to you." },
  { id: "anthropic",  label: "Anthropic Claude",    emoji: "🧠", placeholder: "sk-ant-...",       getKeyUrl: "https://console.anthropic.com/settings/keys",    blurb: "Claude chat, long context — billed to your Anthropic account." },
  { id: "elevenlabs", label: "ElevenLabs Voice",    emoji: "🎙️", placeholder: "sk_...",           getKeyUrl: "https://elevenlabs.io/app/settings/api-keys",    blurb: "Voice cloning + TTS — billed to your ElevenLabs account." },
  { id: "replicate",  label: "Replicate Models",    emoji: "🎨", placeholder: "r8_...",           getKeyUrl: "https://replicate.com/account/api-tokens",       blurb: "Open-source image/video models — billed to you by Replicate." },
  { id: "stability",  label: "Stability AI Images", emoji: "🖼️", placeholder: "sk-...",           getKeyUrl: "https://platform.stability.ai/account/keys",     blurb: "Stable Diffusion image generation — billed to your Stability account." },
  { id: "resend",     label: "Resend Email",        emoji: "📧", placeholder: "re_...",           getKeyUrl: "https://resend.com/api-keys",                    blurb: "Send transactional email from your own Resend account." },
  { id: "stripe",     label: "Stripe Payments",     emoji: "💳", placeholder: "sk_live_...",      getKeyUrl: "https://dashboard.stripe.com/apikeys",           blurb: "Accept payments straight into your own Stripe account." },
  { id: "twilio",     label: "Twilio SMS / Voice",  emoji: "📞", placeholder: "SK... / auth token",getKeyUrl: "https://console.twilio.com",                     blurb: "SMS + phone calls, billed to your Twilio account." },
];

type Row = { provider: string; api_key: string | null; enabled: boolean };

const UserConnectorsPanel = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { void refresh(); }, []);

  const refresh = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await (supabase as any)
      .from("user_connectors")
      .select("provider, api_key, enabled")
      .eq("user_id", user.id);
    const map: Record<string, Row> = {};
    (data || []).forEach((r: Row) => { map[r.provider] = r; });
    setRows(map);
    setLoading(false);
  };

  const startConnect = (id: string) => {
    setOpenId(id);
    setKeyInput("");
  };

  const saveKey = async () => {
    if (!openId) return;
    const clean = keyInput.trim();
    if (clean.length < 8) { toast.error("That key looks too short."); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); toast.error("Please sign in."); return; }
    const { error } = await (supabase as any).from("user_connectors").upsert(
      { user_id: user.id, provider: openId, api_key: clean, enabled: true, connected_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: "user_id,provider" }
    );
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Connected to ${CONNECTORS.find(c => c.id === openId)?.label}. Charges go to your own account.`);
    setOpenId(null);
    setKeyInput("");
    void refresh();
  };

  const disconnect = async (id: string) => {
    if (!confirm(`Disconnect ${CONNECTORS.find(c => c.id === id)?.label}? Your API key will be deleted from this app.`)) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await (supabase as any).from("user_connectors").delete().eq("user_id", user.id).eq("provider", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Disconnected.");
    void refresh();
  };

  return (
    <div className="mx-4 mb-24 mt-6 p-4 rounded-2xl border border-border/60 bg-card/60">
      <div className="flex items-center gap-2 mb-1">
        <Plug className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Your personal connectors</h2>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
        Every connector below runs on <span className="text-foreground font-medium">your own account with that provider</span> — Oracle Lunar never touches your API key, and all usage is billed directly to you.
        Tap <span className="text-foreground font-medium">Connect</span> to paste a key and turn it on, or <span className="text-foreground font-medium">Disconnect</span> to unlink instantly.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading your connectors…
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CONNECTORS.map((c) => {
            const row = rows[c.id];
            const connected = !!(row?.enabled && row?.api_key);
            return (
              <div key={c.id} className={`rounded-xl border p-3 flex items-start gap-3 ${connected ? "border-green-500/40 bg-green-500/5" : "border-border/50 bg-background/40"}`}>
                <div className="text-xl leading-none">{c.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground truncate">{c.label}</span>
                    {connected && <Check className="w-3 h-3 text-green-400 flex-shrink-0" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{c.blurb}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {connected ? (
                      <button
                        onClick={() => disconnect(c.id)}
                        className="text-[11px] px-2 py-1 rounded-md bg-destructive/20 text-destructive hover:bg-destructive/30 inline-flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => startConnect(c.id)}
                        className="text-[11px] px-2 py-1 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90"
                      >
                        Connect
                      </button>
                    )}
                    <a
                      href={c.getKeyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      Get key <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {openId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !saving && setOpenId(null)}>
          <div className="bg-card border border-border rounded-2xl p-5 max-w-md w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-foreground">
              Connect {CONNECTORS.find(c => c.id === openId)?.label}
            </h3>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal ml-4">
              <li>
                Open{" "}
                <a href={CONNECTORS.find(c => c.id === openId)?.getKeyUrl} target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-1">
                  the provider's key page <ExternalLink className="w-3 h-3" />
                </a>{" "}
                and sign in with your own account.
              </li>
              <li>Create a new API key and copy it.</li>
              <li>Paste it below and press Save. It's stored only for your account.</li>
            </ol>
            <input
              type="password"
              autoFocus
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={CONNECTORS.find(c => c.id === openId)?.placeholder}
              autoComplete="off"
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOpenId(null)}
                disabled={saving}
                className="px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={saveKey}
                disabled={saving || keyInput.trim().length < 8}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40 inline-flex items-center gap-2"
              >
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                Save & Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserConnectorsPanel;
