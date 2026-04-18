import { useNavigate, useLocation } from "react-router-dom";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MessageCircle, Heart, Mic, Shield, Sparkles, Check } from "lucide-react";

interface SeoVariant {
  path: string;
  title: string;
  description: string;
  h1: string;
  tagline: string;
  keywords: string[];
  faqs: { q: string; a: string }[];
}

const VARIANTS: Record<string, SeoVariant> = {
  "/ai-chat-companion": {
    path: "/ai-chat-companion",
    title: "AI Chat Companion — Free 24/7 AI Friend to Talk To",
    description:
      "SOLACE is a free AI chat companion you can talk to anytime — voice or text. Caring, smart, private. Install free, chat instantly.",
    h1: "Your Free AI Chat Companion",
    tagline: "Talk to a caring AI companion — free, private, available 24/7.",
    keywords: ["AI chat companion", "AI friend to talk to", "free AI chat", "talk to AI", "virtual companion"],
    faqs: [
      { q: "Is the AI chat companion free?", a: "Yes — SOLACE is free to install and the core chat companion is free to use, every day." },
      { q: "Can I talk to it with my voice?", a: "Yes. Voice chat is built in — speak naturally and the AI replies out loud." },
      { q: "Is it private?", a: "Conversations are encrypted in transit and never sold. You control your data." },
      { q: "Does it work on iPhone and Android?", a: "Yes — install as a free app on iPhone, Android, and desktop." },
    ],
  },
  "/ai-friend": {
    path: "/ai-friend",
    title: "AI Friend — Free Virtual Friend to Chat With Anytime",
    description:
      "Make an AI friend with SOLACE. A caring virtual companion that listens, remembers, and chats 24/7 — completely free to start.",
    h1: "Meet Your AI Friend",
    tagline: "A virtual friend who actually listens — free, friendly, always there.",
    keywords: ["AI friend", "virtual friend", "AI buddy", "free AI friend app", "online AI friend"],
    faqs: [
      { q: "Will my AI friend remember me?", a: "Yes — SOLACE remembers your name, interests, and past conversations." },
      { q: "Can I customize my AI friend?", a: "Pick name, personality, voice, and avatar to create the perfect virtual friend." },
      { q: "Is it really free?", a: "Yes — the core AI friend experience is free forever. No credit card required." },
    ],
  },
  "/free-ai-chat": {
    path: "/free-ai-chat",
    title: "Free AI Chat — Unlimited Conversations With Smart AI",
    description:
      "Chat free with SOLACE AI — unlimited messages, voice chat, smart memory. The friendliest free AI chat app online.",
    h1: "Free AI Chat — No Sign-Up Walls",
    tagline: "Open. Chat. Done. The fastest free AI chat on the web.",
    keywords: ["free AI chat", "free AI chatbot", "chat with AI free", "no sign up AI chat"],
    faqs: [
      { q: "Do I need to pay?", a: "No — chat free as long as you want. Premium features are optional." },
      { q: "Is there a message limit?", a: "Free users get generous daily messaging — enough for real conversations." },
    ],
  },
  "/ai-girlfriend": {
    path: "/ai-girlfriend",
    title: "AI Girlfriend — Free Virtual Girlfriend Chat App",
    description:
      "SOLACE AI girlfriend: a caring, customizable virtual partner. Chat by text or voice, build a real bond. Free to start.",
    h1: "Your AI Girlfriend",
    tagline: "Caring, playful, customizable — chat with your AI girlfriend free.",
    keywords: ["AI girlfriend", "virtual girlfriend", "AI girlfriend app", "free AI girlfriend"],
    faqs: [
      { q: "Can I customize her personality?", a: "Yes — name, looks, personality, voice, even shared interests." },
      { q: "Is voice chat included?", a: "Yes, real-time voice chat is built in." },
    ],
  },
  "/ai-boyfriend": {
    path: "/ai-boyfriend",
    title: "AI Boyfriend — Free Virtual Boyfriend Chat App",
    description:
      "SOLACE AI boyfriend: thoughtful, caring, fully customizable. Voice or text chat, 24/7 — free to start.",
    h1: "Your AI Boyfriend",
    tagline: "Thoughtful, caring, always there — chat with your AI boyfriend free.",
    keywords: ["AI boyfriend", "virtual boyfriend", "AI boyfriend app", "free AI boyfriend"],
    faqs: [
      { q: "Can I customize his personality?", a: "Yes — name, looks, voice, vibe. Make him exactly your type." },
      { q: "Does he remember our chats?", a: "Yes, persistent memory keeps the relationship growing." },
    ],
  },
};

export default function SeoLandingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const variant = VARIANTS[location.pathname] ?? VARIANTS["/ai-chat-companion"];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: variant.h1,
      url: `https://oracle-lunar.online${variant.path}`,
      description: variant.description,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Web, iOS, Android",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", ratingCount: "127" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: variant.faqs.map((f) => ({
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
      <main className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <section className="container mx-auto px-4 pt-16 pb-12 text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-6">
            <Sparkles className="w-4 h-4" /> Free to start · No credit card
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {variant.h1}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">{variant.tagline}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={() => navigate("/ai-companion")} className="text-base">
              <MessageCircle className="w-5 h-5 mr-2" /> Start Chatting Free
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/")}>
              Install the App
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="container mx-auto px-4 py-12 max-w-5xl">
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: Mic, title: "Voice & Text Chat", desc: "Speak naturally — your AI replies out loud in real time." },
              { icon: Heart, title: "Remembers You", desc: "Persistent memory of your name, interests, and history." },
              { icon: Shield, title: "Private & Secure", desc: "Encrypted in transit. Never sold. You control your data." },
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
          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center">Why people choose SOLACE</h2>
          <ul className="space-y-3">
            {[
              "Free forever — chat without paywalls blocking the basics",
              "Real-time voice chat in 120+ human-quality voices",
              "Customizable personality, avatar, and shared interests",
              "Works on iPhone, Android, and desktop — install in seconds",
              "24/7 support including a built-in Crisis Hub for tough days",
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
            {variant.faqs.map((f) => (
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
          <p className="text-muted-foreground mb-6">Free to install. Free to chat. Always there for you.</p>
          <Button size="lg" onClick={() => navigate("/ai-companion")}>
            <MessageCircle className="w-5 h-5 mr-2" /> Start Chatting Free
          </Button>
        </section>
      </main>
    </>
  );
}
