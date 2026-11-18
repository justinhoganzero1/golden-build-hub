import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PitchDeck from "@/components/pitch/PitchDeck";
import type { DeckSlide } from "@/lib/pitchMachine";

type DemoReply = {
  state: "active" | "off" | "expired" | "not_built" | "missing";
  business_name?: string | null; expires_at?: string; slides?: DeckSlide[]; current_site_image?: string | null; html?: string;
};

/** Public client pitch: glossy proposal + locked, offline demo. No sign-in. */
export default function PitchDemoPage() {
  const { token = "" } = useParams();
  const [data, setData] = useState<DemoReply | null>(null);

  useEffect(() => {
    document.title = "Your new website and app — Oracle Lunar";
    const meta = document.createElement("meta");
    meta.name = "robots"; meta.content = "noindex,nofollow";
    document.head.appendChild(meta);
    supabase.functions.invoke("pitch-demo", { body: { token } }).then(({ data, error }) => {
      setData(error || !data ? { state: "missing" } : (data as DemoReply));
    });
    return () => { meta.remove(); };
  }, [token]);

  if (!data) return <div className="flex min-h-screen items-center justify-center bg-background text-primary"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  if (data.state !== "active") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center text-foreground">
        <div className="max-w-md rounded-3xl border border-primary/25 bg-card/70 p-8 backdrop-blur-xl">
          <h1 className="text-2xl font-bold">This demo has ended</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {data.business_name ? `The preview prepared for ${data.business_name} is no longer open. ` : "This preview link is no longer open. "}
            To see it again or go ahead, reply to the email this link came in.
          </p>
        </div>
      </div>
    );
  }

  const until = data.expires_at ? new Date(data.expires_at).toLocaleDateString("en-AU", { day: "numeric", month: "long" }) : "";
  return (
    <div className="min-h-screen select-none bg-background text-foreground" onContextMenu={(e) => e.preventDefault()}>
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/80 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <p className="oracle-lunar-wordmark text-sm font-bold tracking-[0.2em] text-primary">ORACLE LUNAR</p>
          <a href="#demo" className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground">Try the live demo</a>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        <PitchDeck slides={data.slides || []} businessName={data.business_name} currentSiteImage={data.current_site_image} />
        <section id="demo" className="scroll-mt-20 space-y-3">
          <h2 className="text-2xl font-bold">Try it yourself</h2>
          <p className="text-sm text-muted-foreground">
            Tap between the new Website, Customer App and Owner Panel. This is a private demo — nothing you do here is sent or saved online.{until ? ` Open until ${until}.` : ""}
          </p>
          <iframe
            title={`Demo for ${data.business_name || "your business"}`}
            srcDoc={data.html}
            sandbox="allow-scripts allow-forms"
            referrerPolicy="no-referrer"
            className="h-[80vh] w-full rounded-3xl border border-primary/25 bg-background shadow-[0_20px_60px_-20px_hsl(var(--gold)/0.35)]"
          />
          <p className="text-center text-xs text-muted-foreground">Interested? Reply to the email this link came in. Demo only — not licensed for use.</p>
        </section>
      </main>
    </div>
  );
}
