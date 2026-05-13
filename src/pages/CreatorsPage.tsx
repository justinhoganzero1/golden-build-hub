import { useState, useEffect } from "react";
import SEO from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import UniversalBackButton from "@/components/UniversalBackButton";
import StripeConnectPanel from "@/components/StripeConnectPanel";
import { Code, User, Mail, Send, Trash2, MessageSquare, Sparkles, Globe, Smartphone, Shield, Brain, Zap } from "lucide-react";
import { toast } from "sonner";

const OWNER_EMAIL = "justinbretthogan@gmail.com";

interface Comment {
  id: string;
  commenter_name: string;
  commenter_email: string | null;
  message: string;
  moderation_status: string;
  ai_moderation_notes: string | null;
  created_at: string;
}

const skills = [
  { icon: <Code className="w-5 h-5" />, name: "Full-Stack Development", desc: "React, TypeScript, Node.js, Python, SQL" },
  { icon: <Brain className="w-5 h-5" />, name: "AI Integration", desc: "LLM APIs, prompt engineering, AI pipelines" },
  { icon: <Smartphone className="w-5 h-5" />, name: "Mobile Apps", desc: "Capacitor, React Native, PWA development" },
  { icon: <Shield className="w-5 h-5" />, name: "Security Architecture", desc: "RLS policies, encryption, threat detection" },
  { icon: <Globe className="w-5 h-5" />, name: "Cloud Infrastructure", desc: "Supabase, AWS, edge functions, CI/CD" },
  { icon: <Zap className="w-5 h-5" />, name: "Real-Time Systems", desc: "WebSockets, streaming, live data pipelines" },
];

const CreatorsPage = () => {
  const { user } = useAuth();
  const isOwner = user?.email === OWNER_EMAIL;
  const [comments, setComments] = useState<Comment[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadComments();
  }, []);

  const loadComments = async () => {
    if (isOwner) {
      // Owner can see all comments including emails via base table
      const { data } = await supabase
        .from("creator_comments")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setComments(data);
    } else {
      // Public users read approved comments only — strip email client-side for safety
      const { data } = await supabase
        .from("creator_comments")
        .select("id, commenter_name, message, moderation_status, created_at")
        .eq("moderation_status", "approved")
        .order("created_at", { ascending: false });
      if (data) setComments(data.map((d: any) => ({ ...d, commenter_email: null, ai_moderation_notes: null })));
    }
  };

  const submitComment = async () => {
    if (!name.trim() || !message.trim()) {
      toast.error("Please enter your name and comment");
      return;
    }
    setSending(true);
    try {
      // AI moderation
      const { data: aiData } = await supabase.functions.invoke("ai-moderate", {
        body: { type: "comment", content: `Name: ${name}\nComment: ${message}` },
      });

      const approved = aiData?.approved !== false;
      const notes = aiData?.notes ?? "";

      const { error } = await supabase.from("creator_comments").insert({
        commenter_name: name,
        commenter_email: email || null,
        message,
        moderation_status: approved ? "approved" : "pending",
        ai_moderation_notes: notes,
      });

      if (error) throw error;
      toast.success(approved ? "Comment posted!" : "Comment submitted for review");
      setName(""); setEmail(""); setMessage("");
      loadComments();
    } catch (e) {
      toast.error("Failed to post comment");
    } finally {
      setSending(false);
    }
  };

  const deleteComment = async (id: string) => {
    await supabase.from("creator_comments").delete().eq("id", id);
    loadComments();
    toast.success("Comment removed");
  };

  const approveComment = async (id: string) => {
    await supabase.from("creator_comments").update({ moderation_status: "approved" }).eq("id", id);
    loadComments();
    toast.success("Comment approved");
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEO title="Creators Shop — Sell Your AI Creations | Oracle Lunar" description="Earn from your AI work. Oracle Lunar Creators Shop with 70/30 revenue share via Stripe Connect." path="/creators" />
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4 max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary via-purple-500 to-blue-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Code className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-primary">Creator Studio</h1>
          <p className="text-muted-foreground text-sm mt-1">Built by a Passionate Developer</p>
        </div>

        {/* Stripe Connect demo panel — onboard, list products, take payments */}
        <div className="mb-6">
          <StripeConnectPanel />
        </div>

        {/* About Creator */}
        <div className="bg-card border border-border rounded-xl p-4 mb-6">
          <h2 className="text-lg font-semibold text-primary mb-2">About the Creator</h2>
          <p className="text-sm text-foreground leading-relaxed">
            Hi! I'm the creator of Oracle Lunar — a full-stack developer specializing in AI-powered applications, 
            mobile development, and security architecture. I built this entire super app from the ground up, 
            integrating 40+ AI tools, 101 security systems, and cutting-edge features that push the boundaries 
            of what a single app can do.
          </p>
          <p className="text-sm text-foreground leading-relaxed mt-3">
            I'm available for freelance projects, consulting, partnerships, and full-time opportunities. 
            Whether you need an AI chatbot, a mobile app, a secure platform, or a complete digital product — 
            I can build it.
          </p>
        </div>

        {/* Skills Grid */}
        <h2 className="text-lg font-semibold text-primary mb-3">Technical Skills</h2>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {skills.map((s) => (
            <div key={s.name} className="bg-card border border-border rounded-xl p-3">
              <div className="text-primary mb-2">{s.icon}</div>
              <h3 className="text-sm font-semibold text-foreground">{s.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Portfolio Highlight */}
        <div className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-blue-500/10 border border-primary/20 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-primary">Featured: Oracle Lunar AI Super App</h3>
          </div>
          <ul className="text-sm text-foreground space-y-1">
            <li>• 40+ AI-powered tools in one app</li>
            <li>• 101 AI security guard systems</li>
            <li>• Real-time voice AI with animated orb interface</li>
            <li>• Full Capacitor mobile build for Play Store</li>
            <li>• Multi-agent AI conversations with custom avatars</li>
            <li>• Enterprise-grade vault with encrypted storage</li>
          </ul>
        </div>

        {/* Contact */}
        <div className="bg-card border border-border rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-foreground mb-2">Get in Touch</h3>
          <p className="text-sm text-muted-foreground mb-3">Interested in working together? Drop a comment below or submit an investment offer on the Investor page.</p>
        </div>

        {/* Comments Section */}
        <h2 className="text-lg font-semibold text-primary mb-3 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" /> Comments
        </h2>

        {/* Comment Form */}
        <div className="bg-card border border-border rounded-xl p-4 mb-4 space-y-3">
          <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
            <User className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="creator-name" className="sr-only">Your name</label>
            <input id="creator-name" name="name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your Name *" className="bg-transparent flex-1 text-sm outline-none text-foreground placeholder:text-muted-foreground" />
          </div>
          <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
            <Mail className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="creator-email" className="sr-only">Email (optional)</label>
            <input id="creator-email" name="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (optional)" type="email" className="bg-transparent flex-1 text-sm outline-none text-foreground placeholder:text-muted-foreground" />
          </div>
          <label htmlFor="creator-message" className="sr-only">Comment</label>
          <textarea id="creator-message" name="message" value={message} onChange={e => setMessage(e.target.value)} placeholder="Leave a comment... *" rows={3} className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground resize-none" />
          <button onClick={submitComment} disabled={sending} className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50 text-sm">
            {sending ? "Posting..." : <><Send className="w-4 h-4" /> Post Comment</>}
          </button>
          <p className="text-[10px] text-muted-foreground text-center">Comments are AI-moderated for quality</p>
        </div>

        {/* Comment List */}
        <div className="space-y-3">
          {comments.filter(c => c.moderation_status === "approved" || isOwner).map((c) => (
            <div key={c.id} className={`bg-card border rounded-xl p-3 ${c.moderation_status !== "approved" ? "border-yellow-500/30" : "border-border"}`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-sm font-semibold text-foreground">{c.commenter_name}</span>
                  <span className="text-[10px] text-muted-foreground ml-2">{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
                {isOwner && (
                  <div className="flex gap-1">
                    {c.moderation_status !== "approved" && (
                      <button onClick={() => approveComment(c.id)} className="p-1 text-green-400 hover:bg-green-500/20 rounded">
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => deleteComment(c.id)} className="p-1 text-destructive hover:bg-destructive/20 rounded">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-sm text-foreground mt-1">{c.message}</p>
              {isOwner && c.moderation_status !== "approved" && (
                <p className="text-[10px] text-yellow-400 mt-1">⚠ {c.moderation_status} — {c.ai_moderation_notes}</p>
              )}
            </div>
          ))}
          {comments.filter(c => c.moderation_status === "approved" || isOwner).length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6">No comments yet. Be the first!</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreatorsPage;
