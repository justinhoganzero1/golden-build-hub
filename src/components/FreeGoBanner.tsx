import { useNavigate } from "react-router-dom";
import { Sparkles, Lock } from "lucide-react";
import sample8k from "@/assets/quality-8k-sample.jpg";
import sample25d from "@/assets/quality-2-5d-sample.jpg";

/**
 * "One Free Go" banner — explains the visitor offer and the quality
 * difference between the free 2.5D super-detail render and the
 * member-only 8K photoreal render. Members still see it (informational).
 */
export const FreeGoBanner = () => {
  const navigate = useNavigate();

  return (
    <div className="mx-4 mb-4 rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/10 via-background to-primary/10 p-4 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
      <div className="flex items-start gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
        <div>
          <h2 className="text-base font-black text-amber-300 uppercase tracking-wide">
            One FREE go on EVERYTHING
          </h2>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Try every feature once — no signup needed. Visitors get <strong className="text-foreground">2.5D super-detail</strong> renders.
            Build a full app in the App Builder, but to <strong className="text-foreground">export, download or publish</strong> it
            you'll need to join (just like Lovable). Members unlock unlimited <strong className="text-amber-300">true 8K photoreal</strong>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <figure className="relative rounded-xl overflow-hidden border border-border/50 bg-muted/30">
          <img
            src={sample25d}
            alt="2.5D super-detail render sample"
            loading="lazy"
            width={400}
            height={400}
            className="w-full aspect-square object-cover"
          />
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2">
            <p className="text-[10px] font-bold text-white uppercase">2.5D Super-Detail</p>
            <p className="text-[9px] text-white/80">Free for visitors · stylized + crisp</p>
          </figcaption>
        </figure>

        <figure className="relative rounded-xl overflow-hidden border border-amber-400/50 bg-muted/30 shadow-[0_0_20px_rgba(245,158,11,0.25)]">
          <img
            src={sample8k}
            alt="True 8K photoreal render sample"
            loading="lazy"
            width={400}
            height={400}
            className="w-full aspect-square object-cover"
          />
          <div className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/90 text-[8px] font-black text-black uppercase">
            <Lock className="w-2.5 h-2.5" /> Member
          </div>
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2">
            <p className="text-[10px] font-bold text-amber-300 uppercase">True 8K Photoreal</p>
            <p className="text-[9px] text-white/80">Every hair, pore &amp; reflection · museum quality</p>
          </figcaption>
        </figure>
      </div>

      <div className="mt-3 rounded-lg bg-background/60 border border-border/50 p-2.5">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <strong className="text-amber-300">What's the 8K difference?</strong> 2.5D renders look great at thumbnail size but flatten under zoom — perfect for previews.
          True 8K resolves <strong className="text-foreground">individual hair fibers, micro-pores, iris flecks and dewdrop reflections</strong> — print-ready,
          ad-campaign quality you can blow up to a billboard.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <button
          onClick={() => navigate("/sign-in")}
          className="px-4 py-1.5 rounded-full text-[11px] font-black uppercase bg-amber-500 text-black hover:bg-amber-400 transition shadow-[0_0_18px_rgba(245,158,11,0.45)]"
        >
          Join — unlock 8K + export
        </button>
        <button
          onClick={() => navigate("/wallet")}
          className="px-4 py-1.5 rounded-full text-[11px] font-bold bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 transition"
        >
          Visitor? Top up coins (3×)
        </button>
      </div>
    </div>
  );
};

export default FreeGoBanner;
