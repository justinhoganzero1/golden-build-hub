import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Mail, Lightbulb, TrendingUp, Check } from "lucide-react";
import SEO from "@/components/SEO";

type Tab = "messages" | "ideas";

const AdminInboxPage = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("messages");
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const messages = useQuery({
    queryKey: ["admin-inbox-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const ideas = useQuery({
    queryKey: ["admin-inbox-ideas"],
    enabled: tab === "ideas",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suggestions")
        .select("id,category,suggestion,status,created_at,user_id")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const markRead = async (id: string, is_read: boolean) => {
    const { error } = await supabase.from("admin_messages").update({ is_read }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-inbox-messages"] });
  };

  const saveReply = async (id: string) => {
    const { error } = await supabase
      .from("admin_messages")
      .update({ owner_reply: replyText, replied_at: new Date().toISOString(), is_read: true })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Reply saved — the sender sees it in their app.");
    setReplyFor(null);
    setReplyText("");
    qc.invalidateQueries({ queryKey: ["admin-inbox-messages"] });
  };

  const unread = (messages.data || []).filter((m: any) => !m.is_read).length;

  return (
    <div className="min-h-screen bg-background p-4 pb-28 max-w-3xl mx-auto">
      <SEO title="Admin Inbox — Oracle Lunar" description="Owner inbox for in-app messages, ideas and investor enquiries." path="/admin/inbox" />
      <h1 className="text-xl font-bold text-foreground mb-1">Admin Inbox</h1>
      <p className="text-xs text-muted-foreground mb-4">{unread} unread message{unread === 1 ? "" : "s"}</p>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("messages")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border ${tab === "messages" ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}
        >
          <Mail className="w-3.5 h-3.5" /> Messages
        </button>
        <button
          onClick={() => setTab("ideas")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border ${tab === "ideas" ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}
        >
          <Lightbulb className="w-3.5 h-3.5" /> User ideas
        </button>
      </div>

      {tab === "messages" ? (
        messages.isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        ) : (messages.data || []).length === 0 ? (
          <p className="text-xs text-muted-foreground">No messages yet.</p>
        ) : (
          <div className="space-y-2">
            {(messages.data || []).map((m: any) => (
              <div key={m.id} className={`rounded-xl border p-3 ${m.is_read ? "border-border bg-card/50" : "border-primary/50 bg-primary/5"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {m.kind === "investor" ? <TrendingUp className="w-3.5 h-3.5 text-primary shrink-0" /> : m.kind === "idea" ? <Lightbulb className="w-3.5 h-3.5 text-primary shrink-0" /> : <Mail className="w-3.5 h-3.5 text-primary shrink-0" />}
                    <span className="text-xs font-semibold text-foreground truncate">{m.subject || m.kind}</span>
                  </div>
                  <button onClick={() => markRead(m.id, !m.is_read)} className="text-[10px] text-muted-foreground hover:text-primary shrink-0">
                    {m.is_read ? "Mark unread" : "Mark read"}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {m.sender_name || "Anonymous"} · {m.reply_to_email || "no email"} · {new Date(m.created_at).toLocaleString()}
                </p>
                <p className="text-xs text-foreground whitespace-pre-wrap mt-2">{m.message}</p>

                {m.owner_reply && (
                  <p className="mt-2 rounded-lg bg-muted/40 p-2 text-[11px] text-muted-foreground whitespace-pre-wrap">
                    <Check className="w-3 h-3 inline mr-1 text-primary" />
                    {m.owner_reply}
                  </p>
                )}

                {replyFor === m.id ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      rows={3}
                      className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground"
                      placeholder="Your reply…"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => saveReply(m.id)} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold">Send reply</button>
                      <button onClick={() => setReplyFor(null)} className="px-3 py-1.5 rounded-lg border border-border text-[11px] text-muted-foreground">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex gap-3">
                    <button onClick={() => { setReplyFor(m.id); setReplyText(m.owner_reply || ""); }} className="text-[11px] text-primary hover:underline">
                      {m.owner_reply ? "Edit reply" : "Reply in app"}
                    </button>
                    {m.reply_to_email && (
                      <a href={`mailto:${m.reply_to_email}?subject=${encodeURIComponent("Re: " + (m.subject || "Oracle Lunar"))}`} className="text-[11px] text-primary hover:underline">
                        Reply by email
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : ideas.isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      ) : (ideas.data || []).length === 0 ? (
        <p className="text-xs text-muted-foreground">No ideas submitted yet.</p>
      ) : (
        <div className="space-y-2">
          {(ideas.data || []).map((s: any) => (
            <div key={s.id} className="rounded-xl border border-border bg-card/50 p-3">
              <p className="text-[10px] text-muted-foreground">{s.category} · {s.status} · {new Date(s.created_at).toLocaleString()}</p>
              <p className="text-xs text-foreground whitespace-pre-wrap mt-1">{s.suggestion}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminInboxPage;
