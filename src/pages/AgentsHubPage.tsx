import { Link } from "react-router-dom";
import { Brain, Sparkles } from "lucide-react";
import SEO from "@/components/SEO";
import UniversalBackButton from "@/components/UniversalBackButton";
import heroImg from "@/assets/agents-hub-hero.jpg";

const AGENTS = [
  {
    id: "nova",
    name: "Nova",
    tagline: "Sharp. Precise. Analytical.",
    description: "Powered by GPT-5.5. The thinker — reasoning, code, structured analysis, careful planning.",
    icon: Brain,
    accent: "from-sky-500/30 to-blue-700/10 border-sky-500/40",
    iconColor: "text-sky-400",
    href: "/agents/nova",
  },
  {
    id: "lyra",
    name: "Lyra",
    tagline: "Warm. Fast. Creative.",
    description: "Powered by Gemini 3.5 Flash. The muse — brainstorming, storytelling, quick ideas, playful energy.",
    icon: Sparkles,
    accent: "from-amber-500/30 to-orange-700/10 border-amber-500/40",
    iconColor: "text-amber-400",
    href: "/agents/lyra",
  },
];

const AgentsHubPage = () => {
  return (
    <div className="min-h-screen bg-background pb-20">
      <SEO
        title="AI Agents — Oracle Lunar"
        description="Chat with Nova (GPT-5.5) and Lyra (Gemini 3.5 Flash) — two distinct AI agents inside Oracle Lunar."
        path="/agents"
      />
      <UniversalBackButton />

      <div className="px-4 pt-14 pb-4 max-w-4xl mx-auto">
        <div className="relative rounded-2xl overflow-hidden mb-6 aspect-[2/1]">
          <img src={heroImg} alt="Oracle Lunar AI Agents" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h1 className="text-2xl md:text-3xl font-bold text-primary">Choose Your Agent</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Two AI minds, two distinct personalities. Pick one and start chatting.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {AGENTS.map((agent) => {
            const Icon = agent.icon;
            return (
              <Link
                key={agent.id}
                to={agent.href}
                className={`group bg-gradient-to-br ${agent.accent} border rounded-2xl p-5 hover:scale-[1.02] transition-transform`}
              >
                <div className={`p-3 rounded-xl bg-card/50 w-fit mb-3 ${agent.iconColor}`}>
                  <Icon className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-bold text-foreground">{agent.name}</h2>
                <p className={`text-xs font-medium mt-0.5 ${agent.iconColor}`}>{agent.tagline}</p>
                <p className="text-sm text-muted-foreground mt-2">{agent.description}</p>
                <div className="mt-4 text-xs font-medium text-primary group-hover:underline">
                  Chat with {agent.name} →
                </div>
              </Link>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground text-center mt-6">
          Agent calls count toward your daily free limit ({25}/day) unless you have unlimited access.
        </p>
      </div>
    </div>
  );
};

export default AgentsHubPage;
