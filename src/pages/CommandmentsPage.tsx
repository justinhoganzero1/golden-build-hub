import { ShieldCheck, Scroll } from "lucide-react";
import SEO from "@/components/SEO";
import UniversalBackButton from "@/components/UniversalBackButton";
import { COMMANDMENTS } from "@/data/commandments";

const CommandmentsPage = () => {
  const grouped = COMMANDMENTS.reduce<Record<string, typeof COMMANDMENTS>>((acc, c) => {
    (acc[c.category] ||= []).push(c);
    return acc;
  }, {});

  const order = [
    "Supreme",
    "Safety",
    "Honesty",
    "Children",
    "Content",
    "Privacy",
    "Money",
    "Behaviour",
    "Voice",
    "Owner",
    "Compliance",
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <SEO
        title="The 100 Commandments — Oracle Lunar"
        description="The non-negotiable rails every AI in Oracle Lunar must obey. Public, auditable, and stored in the Vault."
        path="/commandments"
      />
      <UniversalBackButton />
      <div className="max-w-3xl mx-auto px-4 pt-14">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto mb-3 shadow-lg">
            <Scroll className="w-8 h-8 text-background" />
          </div>
          <h1 className="text-2xl font-bold text-primary">The 100 Commandments</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
            The rails every AI surface in Oracle Lunar must obey. Rules #1 and #2
            are supreme and outrank everything else — including the platform.
          </p>
        </div>

        <div className="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-transparent p-5 mb-8">
          <div className="flex items-center gap-2 text-amber-500 font-semibold mb-3">
            <ShieldCheck className="w-5 h-5" />
            Supreme Rules
          </div>
          {COMMANDMENTS.slice(0, 2).map((c) => (
            <p key={c.n} className="text-sm text-foreground leading-relaxed mb-2">
              <span className="font-bold text-amber-500">#{c.n}.</span> {c.rule}
            </p>
          ))}
        </div>

        {order.map((cat) => {
          const items = (grouped[cat] || []).filter((c) => c.n > 2);
          if (!items.length) return null;
          return (
            <section key={cat} className="mb-6">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                {cat}
              </h2>
              <ol className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
                {items.map((c) => (
                  <li key={c.n} className="px-4 py-3 text-sm text-foreground flex gap-3">
                    <span className="text-primary font-mono shrink-0 w-8">#{c.n}</span>
                    <span className="leading-relaxed">{c.rule}</span>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}

        <p className="text-center text-xs text-muted-foreground mt-8">
          Stored in the Vault • Public • Auditable • Breaking one is a bug.
        </p>
      </div>
    </div>
  );
};

export default CommandmentsPage;
