import { useEffect, useState } from "react";
import { Phone, PhoneCall, PhoneIncoming, Save, AlertCircle } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

interface Settings {
  personal_phone: string;
  twilio_number: string;
  call_answering_enabled: boolean;
  outbound_calls_enabled: boolean;
  reply_channel: "chat" | "sms" | "both";
  greeting: string;
  hold_message: string;
}

const DEFAULTS: Settings = {
  personal_phone: "",
  twilio_number: "",
  call_answering_enabled: false,
  outbound_calls_enabled: false,
  reply_channel: "both",
  greeting: "Hello, this is the personal assistant. How can I help you today?",
  hold_message: "One moment please, I'm muting you while I check with the owner. I'll be right back.",
};

const E164 = /^\+[1-9]\d{6,14}$/;

const AssistantPhonePage = () => {
  const { user } = useAuth();
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_assistant_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setS({
          personal_phone: data.personal_phone ?? "",
          twilio_number: data.twilio_number ?? "",
          call_answering_enabled: data.call_answering_enabled,
          outbound_calls_enabled: data.outbound_calls_enabled,
          reply_channel: (data.reply_channel === "chat" || data.reply_channel === "sms") ? data.reply_channel : "both",
          greeting: data.greeting ?? DEFAULTS.greeting,
          hold_message: data.hold_message ?? DEFAULTS.hold_message,
        });
      }
      setLoading(false);
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    if (s.personal_phone && !E164.test(s.personal_phone)) {
      toast.error("Personal phone must be in E.164 format, e.g. +14155550123");
      return;
    }
    if (s.twilio_number && !E164.test(s.twilio_number)) {
      toast.error("Twilio number must be in E.164 format, e.g. +14155550123");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("user_assistant_settings")
      .upsert({ user_id: user.id, ...s }, { onConflict: "user_id" });
    setSaving(false);
    if (error) toast.error("Save failed: " + error.message);
    else toast.success("Assistant phone settings saved");
  };

  const projectRef = (import.meta.env.VITE_SUPABASE_URL || "").split("//")[1]?.split(".")[0];
  const inboundUrl = projectRef ? `https://${projectRef}.supabase.co/functions/v1/oracle-call-inbound` : "";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <UniversalBackButton />
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="w-6 h-6 text-primary" /> Oracle Phone Assistant
          </h1>
          <p className="text-sm text-muted-foreground">
            Let Oracle answer your calls and place calls on your behalf. When a caller speaks,
            Oracle politely puts them on hold, asks you for a reply in the app, then unmutes
            and reads your reply to the caller.
          </p>
        </header>

        {/* Phone numbers */}
        <section className="rounded-lg border border-border bg-card p-4 space-y-4">
          <h2 className="font-semibold">Phone numbers</h2>
          <label className="block space-y-1">
            <span className="text-sm">Your personal phone (for SMS notifications)</span>
            <input
              type="tel"
              value={s.personal_phone}
              onChange={(e) => setS({ ...s, personal_phone: e.target.value.trim() })}
              placeholder="+14155550123"
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm">Your Twilio number (the number callers will dial)</span>
            <input
              type="tel"
              value={s.twilio_number}
              onChange={(e) => setS({ ...s, twilio_number: e.target.value.trim() })}
              placeholder="+14155550199"
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
            />
          </label>
        </section>

        {/* Toggles */}
        <section className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2 className="font-semibold">Capabilities</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <PhoneIncoming className="w-4 h-4 text-primary" /> Answer incoming calls
            </div>
            <Switch
              checked={s.call_answering_enabled}
              onCheckedChange={(v) => setS({ ...s, call_answering_enabled: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <PhoneCall className="w-4 h-4 text-primary" /> Make outbound calls
            </div>
            <Switch
              checked={s.outbound_calls_enabled}
              onCheckedChange={(v) => setS({ ...s, outbound_calls_enabled: v })}
            />
          </div>
          <div>
            <label className="text-sm block mb-1">How should Oracle reach you for replies?</label>
            <select
              value={s.reply_channel}
              onChange={(e) => setS({ ...s, reply_channel: e.target.value as Settings["reply_channel"] })}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
            >
              <option value="chat">In-app Oracle chat only</option>
              <option value="sms">SMS to my personal phone</option>
              <option value="both">Both (chat first, SMS fallback)</option>
            </select>
          </div>
        </section>

        {/* Scripts */}
        <section className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2 className="font-semibold">What Oracle says</h2>
          <label className="block space-y-1">
            <span className="text-sm">Greeting (when answering a call)</span>
            <textarea
              value={s.greeting}
              onChange={(e) => setS({ ...s, greeting: e.target.value })}
              rows={2}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm">Hold message (before muting the caller)</span>
            <textarea
              value={s.hold_message}
              onChange={(e) => setS({ ...s, hold_message: e.target.value })}
              rows={2}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
            />
          </label>
        </section>

        {/* Webhook URL for Twilio */}
        <section className="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-2">
          <h2 className="font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-primary" /> Twilio webhook URL
          </h2>
          <p className="text-xs text-muted-foreground">
            In your Twilio Console → Phone Numbers → your number → Voice configuration,
            set the "A call comes in" webhook to:
          </p>
          <code className="block text-xs bg-background border border-border rounded px-2 py-2 break-all">
            {inboundUrl}
          </code>
        </section>

        <button
          onClick={save}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-md py-3 font-semibold disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
};

export default AssistantPhonePage;
