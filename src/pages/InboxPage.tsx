import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Loader2, Send, CornerDownRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import UniversalBackButton from "@/components/UniversalBackButton";
import ContactOwnerDialog from "@/components/ContactOwnerDialog";

/**
 * My Inbox — the *user* side of the in-app mail system.
 *
 * Strictly personal: the query is scoped to the signed-in user's own rows and
 * the `admin_messages` RLS policy ("Users read their own messages") enforces
 * the same rule server-side. Users never see other users' mail, and the
 * owner's Admin Inbox lives at /admin/inbox behind RequireAdmin.
 */
const InboxPage = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [composeOpen, setComposeOpen] = useState(false);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["my-inbox", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_messages")
        .select("id,kind,subject,message,owner_reply,replied_at,created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const replies = messages.filter((m: any) => !!m.owner_reply).length;

  return (
    <div className="min-h-screen bg-background p-4 pb-28">
      <SEO
        title="My Inbox — Oracle Lunar"
        description="Your private in-app inbox: messages you sent to the Oracle Lunar team and their replies."
        path="/inbox"
      />
      <UniversalBackButton />
      <div className="max-w-2xl mx-auto pt-12">
        <header className="mb-4">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" /> My Inbox
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Your private conversation with the founder — {messages.length} message
            {messages.length === 1 ? "" : "s"}, {replies} repl{replies === 1 ? "y" : "ies"}.
          </p>
        </header>

        <button
          onClick={() => setComposeOpen(true)}
          className="w-full mb-5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold py-2.5 flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" /> New message to the admin inbox
        </button>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16">
            <Mail className="w-10 h-10 text-primary/50 mx-auto mb-3" />
            <p className="text-sm text-foreground font-medium">No messages yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Send a note and any reply from the team lands right here in the app.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m: any) => (
              <article key={m.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-primary/40 text-primary">
                    {m.kind}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(m.created_at).toLocaleString()}
                  </span>
                </div>
                <h2 className="text-sm font-semibold text-foreground">{m.subject || "(no subject)"}</h2>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1">{m.message}</p>

                {m.owner_reply ? (
                  <div className="mt-3 rounded-xl border border-primary/30 bg-primary/10 p-3">
                    <p className="text-[10px] font-semibold text-primary flex items-center gap-1 mb-1">
                      <CornerDownRight className="w-3 h-3" /> Reply from the founder
                      {m.replied_at ? ` · ${new Date(m.replied_at).toLocaleDateString()}` : ""}
                    </p>
                    <p className="text-xs text-foreground whitespace-pre-wrap">{m.owner_reply}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-[10px] text-muted-foreground">Awaiting reply…</p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      <ContactOwnerDialog
        open={composeOpen}
        onClose={() => {
          setComposeOpen(false);
          qc.invalidateQueries({ queryKey: ["my-inbox", user?.id] });
        }}
      />
    </div>
  );
};

export default InboxPage;
