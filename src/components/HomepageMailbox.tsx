import { useState } from "react";
import { Mail, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Public homepage mailbox — anyone can drop a note. Messages land in
 * `inquiry_leads` with source = 'mailbox' and surface in the admin
 * panel's "Mailbox" tab.
 */
const HomepageMailbox = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error("Please write a short message");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("inquiry_leads").insert({
        name: name.trim() || null,
        email: email.trim() || null,
        message: message.trim(),
        source: "mailbox",
        status: "new",
      });
      if (error) throw error;
      toast.success("Message sent — the team will be in touch.");
      setName("");
      setEmail("");
      setMessage("");
    } catch (err: any) {
      toast.error(err?.message || "Couldn't send right now");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="border-t border-primary/10 bg-background/40">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs text-primary mb-4">
            <Mail className="h-3.5 w-3.5" /> Direct line to the team
          </div>
          <h2 className="text-3xl md:text-4xl font-bold">
            Drop us a <span className="text-primary">message</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-3">
            Questions, feedback or partnership ideas — your note lands directly in the admin inbox.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-primary/20 bg-card/60 backdrop-blur p-6 md:p-8 space-y-4 shadow-[0_0_40px_hsl(var(--primary)/0.08)]"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name (optional)"
              className="w-full rounded-lg border border-border bg-background/70 px-4 py-3 text-sm focus:outline-none focus:border-primary"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email so we can reply (optional)"
              className="w-full rounded-lg border border-border bg-background/70 px-4 py-3 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={5}
            placeholder="Write your message…"
            className="w-full rounded-lg border border-border bg-background/70 px-4 py-3 text-sm focus:outline-none focus:border-primary resize-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-amber-500 px-5 py-3 text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {busy ? "Sending…" : "Send to admin inbox"}
          </button>
        </form>
      </div>
    </section>
  );
};

export default HomepageMailbox;
