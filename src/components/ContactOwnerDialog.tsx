import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Mail, X } from "lucide-react";

type Kind = "general" | "idea" | "investor";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultKind?: Kind;
}

const KINDS: { value: Kind; label: string; hint: string }[] = [
  { value: "general", label: "General", hint: "Questions, help or feedback" },
  { value: "idea", label: "Idea", hint: "Something you'd love us to build" },
  { value: "investor", label: "Investor", hint: "Investment or partnership enquiry" },
];

/** In-app mail: sends straight to the owner's admin inbox — no email client needed. */
const ContactOwnerDialog = ({ open, onClose, defaultKind = "general" }: Props) => {
  const { user } = useAuth();
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  if (!open) return null;

  const send = async () => {
    if (!user) {
      toast.error("Please sign in first so we can reply to you.");
      return;
    }
    if (!message.trim()) {
      toast.error("Write a message first.");
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.from("admin_messages").insert({
        user_id: user.id,
        sender_name: name.trim() || null,
        reply_to_email: (email || user.email || "").trim() || null,
        kind,
        subject: subject.trim() || KINDS.find(k => k.value === kind)!.label,
        message: message.trim(),
      });
      if (error) throw error;
      toast.success("Sent — it's in the founder's inbox.");
      setSubject("");
      setMessage("");
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Could not send your message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-background/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-4 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 m-0">
            <Mail className="w-4 h-4 text-primary" /> Message the founder
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {KINDS.map(k => (
            <button
              key={k.value}
              onClick={() => setKind(k.value)}
              className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium ${
                kind === k.value
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">{KINDS.find(k => k.value === kind)!.hint}</p>

        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name (optional)"
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground"
        />
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Reply-to email"
          type="email"
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground"
        />
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="Subject"
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground"
        />
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={6}
          placeholder={kind === "investor" ? "Tell us about your interest in investing…" : "Type your message…"}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground resize-y"
        />

        <button
          onClick={send}
          disabled={sending}
          className="w-full rounded-lg bg-primary text-primary-foreground text-xs font-semibold py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          Send to admin inbox
        </button>
      </div>
    </div>
  );
};

export default ContactOwnerDialog;
