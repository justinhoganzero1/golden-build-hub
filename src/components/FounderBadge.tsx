import { Crown } from "lucide-react";

const FounderBadge = ({ number, size = "md" }: { number: number; size?: "sm" | "md" | "lg" }) => {
  const s = size === "lg" ? "text-base px-4 py-2" : size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-3 py-1";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold tracking-wide border ${s}`}
      style={{
        background: "linear-gradient(135deg, hsl(var(--gold-light)), hsl(var(--gold)) 50%, hsl(var(--gold-dark)))",
        color: "hsl(var(--background))",
        borderColor: "hsl(var(--gold-light))",
        boxShadow: "0 0 18px hsl(var(--gold-glow) / 0.45)",
      }}
      aria-label={`Founding member number ${number}`}
    >
      <Crown className="w-3.5 h-3.5" /> FOUNDER #{number}
    </span>
  );
};

export default FounderBadge;
