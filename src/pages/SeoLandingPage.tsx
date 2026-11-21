import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SEO_TOOL_DESTINATIONS } from "@/lib/toolDestinations";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MessageCircle, Heart, Mic, Shield, Sparkles, Check } from "lucide-react";
import LeadMagnetWidget from "@/components/LeadMagnetWidget";
import RealSocialProof from "@/components/RealSocialProof";
import AppStorePage from "@/pages/AppStorePage";

import { SEO_VARIANTS as VARIANTS, PRICING_FAQ, SAFETY_FAQ } from "@/lib/seoPages";

// These pages are adverts for search visitors. They open on the same
// download listing as /download (identical for people and Google), with the
// page's own topic and questions underneath. A signed-in member is taken
// straight to the real tool instead (keeping the Oracle overlay state).
export default function SeoLandingPage() {
  const location = useLocation();
  const { user } = useAuth();
  const destination = SEO_TOOL_DESTINATIONS[location.pathname] ?? "/oracle";
  if (user) return <Navigate to={destination} replace state={location.state} />;
  return <SeoLandingContent />;
}

function SeoLandingContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const variant = VARIANTS[location.pathname] ?? VARIANTS["/ai-chat-companion"];
  // "Get the app" scrolls back up to the Install button on this same page.
  const toTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const faqs = [...variant.faqs, PRICING_FAQ, ...(variant.safety ? [SAFETY_FAQ] : [])];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: variant.h1,
      url: `https://oraclelunar.com${variant.path}`,
      description: variant.description,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Web, iOS, Android",
      offers: [
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: "AUD" },
        { "@type": "Offer", name: "Plus", price: "9.99", priceCurrency: "AUD" },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <>
      <SEO
        title={variant.title}
        description={variant.description}
        path={variant.path}
        jsonLd={jsonLd}
      />
      <AppStorePage extra={
      <div className="text-foreground border-t border-border/60">
        {/* Topic */}
        <section className="container mx-auto px-4 pt-12 pb-12 text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-6">
            <Sparkles className="w-4 h-4" /> Free to download · Plans from A$9.99/mo
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {variant.h1}
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">{variant.tagline}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <Button size="lg" onClick={toTop} className="text-base">
              <MessageCircle className="w-5 h-5 mr-2" /> Get the app
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/ad")}>
              Watch the ad
            </Button>
          </div>
          <RealSocialProof />
        </section>

        {/* Lead magnet — instant free value, no signup */}
        <section className="container mx-auto px-4 pb-8 max-w-2xl">
          <LeadMagnetWidget inline />
        </section>

        {/* Features */}
        <section className="container mx-auto px-4 py-12 max-w-5xl">
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: Mic, title: "Voice & Text Chat", desc: "On Plus, speak naturally and Oracle replies out loud in her premium voice." },
              { icon: Heart, title: "Remembers You", desc: "Oracle remembers your name, interests and what you've shared." },
              { icon: Shield, title: "Private & Secure", desc: "Your personal data is not sold. Mood reading stays on your device." },
            ].map((f) => (
              <Card key={f.title} className="p-6 bg-card/50 backdrop-blur border-border/50">
                <f.icon className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-semibold mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Why */}
        <section className="container mx-auto px-4 py-12 max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center">Why people choose ORACLE LUNAR</h2>
          <ul className="space-y-3">
            {[
              "Free to download, with free diary, calendar, Library and safety tools",
              "Oracle speaks in a warm, natural premium voice",
              "Design her look and outfits — woman, man or androgynous",
              "Stories, pictures and music in one app, with video on Pro",
              "The Crisis Hub is always free",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section className="container mx-auto px-4 py-12 max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqs.map((f) => (
              <Card key={f.q} className="p-5 bg-card/50">
                <h3 className="font-semibold mb-2">{f.q}</h3>
                <p className="text-sm text-muted-foreground">{f.a}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-4 py-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to meet your AI companion?</h2>
          <p className="text-muted-foreground mb-6">Free to download. Chat with Oracle from A$9.99 a month.</p>
          <Button size="lg" onClick={toTop}>
            <MessageCircle className="w-5 h-5 mr-2" /> Get the app
          </Button>
        </section>

        {/* Internal cross-links — passes Google PageRank to key pages incl. /investor */}
        <section className="container mx-auto px-4 py-12 border-t border-border/40">
          <h2 className="text-xl font-bold mb-4 text-center">Explore ORACLE LUNAR</h2>
          <nav aria-label="Site links" className="grid grid-cols-2 md:grid-cols-4 gap-2 max-w-4xl mx-auto text-sm">
            {[
              { href: "/free-ai-app-2026", label: "AI Super App 2026" },
              { href: "/chatgpt-alternative", label: "ChatGPT Alternative" },
              { href: "/gemini-alternative", label: "Gemini Alternative" },
              { href: "/claude-alternative", label: "Claude Alternative" },
              { href: "/ai-friend", label: "AI Friend" },
              { href: "/free-ai-voice-chat", label: "Voice Chat" },
              { href: "/ai-image-generator-free", label: "AI Images" },
              { href: "/ai-video-generator", label: "AI Video" },
              { href: "/ai-music-generator", label: "AI Music" },
              { href: "/ai-coder", label: "AI Coder" },
              { href: "/ai-therapist-free", label: "Wellness Chat" },
              { href: "/ai-tutor-free", label: "AI Tutor" },
              { href: "/ai-life-coach-free", label: "AI Life Coach" },
              { href: "/ai-resume-builder-free", label: "Resume Builder" },
              { href: "/ai-interview-coach", label: "Interview Coach" },
              { href: "/ai-travel-planner", label: "Travel Planner" },
              { href: "/ai-cooking-assistant", label: "Cooking Assistant" },
              { href: "/ai-fitness-coach-free", label: "Fitness Coach" },
              { href: "/free-ai-meditation", label: "Meditation" },
              { href: "/ai-elderly-care", label: "Elderly Care" },
              { href: "/ai-companion", label: "AI Companion" },
              { href: "/creators", label: "Creators" },
              { href: "/investor", label: "Investor Hub" },
              { href: "/about", label: "About" },
            ].map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-muted-foreground hover:text-primary transition-colors py-1"
              >
                {l.label}
              </a>
            ))}
          </nav>
        </section>
      </div>
      } />
    </>
  );
}
