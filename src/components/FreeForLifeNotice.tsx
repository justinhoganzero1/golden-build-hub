import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Gift, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const KEY = "oracle.ffl.notice.v1";

/** In-app welcome for free-for-life members: Zero Protocol link + Kindle guide. */
const FreeForLifeNotice = () => {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [storyUrl, setStoryUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    try { if (localStorage.getItem(KEY) === "1") return; } catch {}
    (async () => {
      const { data: ffl } = await supabase.rpc("has_active_reward", { _user_id: user.id });
      if (!ffl) return;
      const { data } = await (supabase as any).from("public_stories").select("slug").ilike("title", "Zero Protocol%").limit(1).maybeSingle();
      setStoryUrl(data?.slug ? `/stories/${data.slug}` : null);
      setShow(true);
    })();
  }, [user]);

  if (!show) return null;
  const close = () => { setShow(false); try { localStorage.setItem(KEY, "1"); } catch {} };

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,28rem)] rounded-2xl border border-primary/40 bg-card p-4 shadow-2xl">
      <button onClick={close} className="absolute top-2 right-2 text-muted-foreground" aria-label="Close"><X className="w-4 h-4" /></button>
      <p className="font-bold text-foreground flex items-center gap-2"><Gift className="w-4 h-4 text-primary" /> A gift for our free-for-life members</p>
      <p className="text-xs text-muted-foreground mt-1">Read Juzzy's new book <b>Zero Protocol: The Doolan Defense</b> free, and see how to publish your own book on Kindle.</p>
      <div className="flex flex-wrap gap-2 mt-3">
        {storyUrl ? <Link to={storyUrl} onClick={close} className="text-xs font-semibold rounded-full bg-primary text-primary-foreground px-3 py-1.5">Read Zero Protocol</Link>
          : <span className="text-xs text-muted-foreground">Book link coming soon</span>}
        <Link to="/story-writer" onClick={close} className="text-xs font-semibold rounded-full border border-primary text-primary px-3 py-1.5">Kindle publishing guide</Link>
        <Link to="/free-zone" onClick={close} className="text-xs font-semibold rounded-full border border-border text-foreground px-3 py-1.5">Free games</Link>
      </div>
    </div>
  );
};

export default FreeForLifeNotice;
