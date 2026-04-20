import { useNavigate } from "react-router-dom";
import { Construction, ArrowLeft, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";

interface ComingSoonPageProps {
  title: string;
  subtitle?: string;
}

/**
 * Generic "Under Construction" page used for features that are temporarily
 * disabled (e.g. Movie Studio Pro, Living GIF Studio). Steers users back to
 * the dashboard or to Oracle for guidance on building it externally.
 */
const ComingSoonPage = ({ title, subtitle }: ComingSoonPageProps) => {
  const navigate = useNavigate();

  return (
    <>
      <SEO
        title={`${title} — Coming Soon | ORACLE LUNAR`}
        description={`${title} is temporarily under construction. Talk to Oracle for guidance.`}
      />
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="max-w-xl w-full text-center space-y-6 p-8 rounded-3xl border border-primary/30 bg-card/60 backdrop-blur-xl shadow-[0_0_60px_hsl(var(--primary)/0.25)]">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/15 border border-primary/40 mx-auto">
            <Construction className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              {title}
            </h1>
            <p className="text-sm uppercase tracking-[0.3em] text-primary">
              Under Construction · Coming Soon
            </p>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            {subtitle ??
              "This studio is offline while we rebuild it. It can't be downloaded or generated inside the app right now."}
          </p>
          <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground text-left space-y-2">
            <p className="font-semibold text-foreground">Want to build it anyway?</p>
            <p>
              Ask Oracle. Oracle can guide you to the right external tools, open the
              connection sites for you, and securely store any API keys or secrets
              you need — all from chat.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button onClick={() => navigate("/oracle")} className="gap-2">
              <MessageCircle className="w-4 h-4" />
              Ask Oracle
            </Button>
            <Button variant="outline" onClick={() => navigate("/dashboard")} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ComingSoonPage;
