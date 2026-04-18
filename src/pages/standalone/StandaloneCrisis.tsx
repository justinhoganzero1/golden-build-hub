import { Phone, MessageCircle, Heart } from "lucide-react";
import { Link } from "react-router-dom";

const HOTLINES = [
  { country: "US", name: "988 Suicide & Crisis Lifeline", number: "988" },
  { country: "US", name: "Crisis Text Line", number: "Text HOME to 741741" },
  { country: "UK", name: "Samaritans", number: "116 123" },
  { country: "AU", name: "Lifeline Australia", number: "13 11 14" },
  { country: "AU", name: "Beyond Blue", number: "1300 22 4636" },
  { country: "Global", name: "Find a helpline", number: "findahelpline.com" },
];

/** Simplified Crisis Hub: hotlines + path to Oracle. */
const StandaloneCrisis = () => (
  <div className="space-y-4">
    <div className="rounded-2xl bg-gradient-to-br from-rose-500/20 to-red-500/10 border border-rose-500/30 p-5 text-center">
      <Heart className="w-10 h-10 mx-auto text-rose-500 mb-2" />
      <p className="font-semibold">You are not alone.</p>
      <p className="text-sm text-muted-foreground mt-1">If you're in immediate danger, please call your local emergency number.</p>
    </div>

    <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mt-6">Free crisis lines</h2>
    <div className="space-y-2">
      {HOTLINES.map((h) => {
        const isUrl = h.number.includes(".");
        return (
          <a
            key={h.country + h.number}
            href={isUrl ? `https://${h.number}` : `tel:${h.number.replace(/\D/g, "")}`}
            target={isUrl ? "_blank" : undefined}
            rel="noreferrer"
            className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/40"
          >
            <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center">
              <Phone className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{h.name}</div>
              <div className="text-xs text-muted-foreground">{h.country} · {h.number}</div>
            </div>
          </a>
        );
      })}
    </div>

    <Link to="/apps/oracle" className="flex items-center gap-3 p-4 rounded-xl bg-primary text-primary-foreground mt-6">
      <MessageCircle className="w-5 h-5" />
      <div>
        <div className="font-semibold">Talk to Eric now</div>
        <div className="text-xs opacity-90">A calm AI to listen, any time</div>
      </div>
    </Link>
  </div>
);

export default StandaloneCrisis;
