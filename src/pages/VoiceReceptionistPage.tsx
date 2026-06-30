// Public marketing page for the Voice AI Receptionist module.
// Mirrors the 5-capability layout from the GoHighLevel reference, restyled
// to Oracle Lunar's dark/amber aesthetic.
import { Link } from "react-router-dom";
import { CheckCircle2, Phone, BookOpen, Calendar, MessageSquare, Workflow } from "lucide-react";
import SEO from "@/components/SEO";
import PageShell from "@/components/PageShell";
import UniversalBackButton from "@/components/UniversalBackButton";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const CAPABILITIES = [
  {
    icon: Phone,
    title: "Voice AI agent that answers every call",
    body: "A real phone number that picks up 24/7, greets callers, answers FAQs, qualifies the lead, and books appointments — no human on the line.",
  },
  {
    icon: BookOpen,
    title: "Prompts, knowledge & business hours",
    body: "Edit the agent's prompt, FAQ knowledge base, languages, voice, and business hours so it stays on-script and on-brand.",
  },
  {
    icon: Calendar,
    title: "Booking rules & human handoff",
    body: "Set rules that route complaints, refunds, or high-value calls to a real person. Booked appointments land in both Oracle Calendar and Google Calendar.",
  },
  {
    icon: MessageSquare,
    title: "Missed calls become booked revenue",
    body: "The second a call ends without being answered, the system fires a text-back and a 24h + 72h reactivation drip until the caller replies.",
  },
  {
    icon: Workflow,
    title: "Feeds your whole system",
    body: "Every call creates a CRM contact, advances pipeline stage, schedules follow-up SMS/email/tasks, and POSTs to your external webhook (Zapier, n8n, HighLevel-compatible).",
  },
];

const VoiceReceptionistPage = () => {
  const { isAdmin } = useIsAdmin();
  return (
    <PageShell title="Voice AI Receptionist" subtitle="A real phone number, answered by AI, 24/7.">
      <SEO title="Voice AI Receptionist — Oracle Lunar" description="A real phone number that answers, qualifies, books, follows up, and feeds your CRM — 24/7." />
      <UniversalBackButton />
      <main className="container mx-auto px-4 py-12 max-w-6xl">
        <header className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-br from-amber-300 to-amber-500 bg-clip-text text-transparent mb-4">
            Voice AI Receptionist
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            One phone number, one AI agent, five superpowers. Live in your Oracle Lunar workspace.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {CAPABILITIES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="relative rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-6 backdrop-blur-sm hover:border-amber-400 transition-colors">
              <div className="absolute -top-3 -left-3 h-10 w-10 rounded-full bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/50">
                <CheckCircle2 className="h-6 w-6 text-slate-950" />
              </div>
              <Icon className="h-8 w-8 text-amber-400 mb-3" />
              <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <div className="text-center space-y-3">
          {isAdmin ? (
            <Button asChild size="lg" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold">
              <Link to="/admin/voice-receptionist">Open Receptionist Console</Link>
            </Button>
          ) : (
            <Button asChild size="lg" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold">
              <Link to="/contact">Request Activation</Link>
            </Button>
          )}
          <p className="text-xs text-muted-foreground">Powered by Twilio + Gemini + ElevenLabs · 100% live in this app.</p>
        </div>
      </main>
    </PageShell>
  );
};

export default VoiceReceptionistPage;
