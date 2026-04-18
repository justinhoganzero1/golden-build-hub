import { useNavigate, useLocation } from "react-router-dom";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MessageCircle, Heart, Mic, Shield, Sparkles, Check } from "lucide-react";
import LeadMagnetWidget from "@/components/LeadMagnetWidget";
import RealSocialProof from "@/components/RealSocialProof";

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
  "/character-ai-alternative": {
    path: "/character-ai-alternative",
    title: "Character AI Alternative — Free, Uncensored-Friendly AI Chat",
    description:
      "Looking for a Character AI alternative? SOLACE offers free unlimited chat, voice, custom personalities and persistent memory.",
    h1: "The Best Character AI Alternative",
    tagline: "Free, fast, voice-enabled — everything you wished Character AI had.",
    keywords: ["character ai alternative", "c.ai alternative", "free character chat ai", "best ai chat app"],
    faqs: [
      { q: "How is SOLACE different from Character AI?", a: "Real voice chat, persistent memory, no waitlists, custom avatars, and a generous free tier." },
      { q: "Is it free?", a: "Yes — free to install and chat. Premium features are optional." },
    ],
  },
  "/replika-alternative": {
    path: "/replika-alternative",
    title: "Replika Alternative — Free AI Companion With Voice & Memory",
    description:
      "A free Replika alternative with voice chat, customizable personality, persistent memory and no paywall on the basics.",
    h1: "The Free Replika Alternative",
    tagline: "Everything you loved about Replika — without the paywall.",
    keywords: ["replika alternative", "free replika", "ai companion app", "best replika alternative"],
    faqs: [
      { q: "Is voice chat behind a paywall?", a: "No — voice chat is included free." },
      { q: "Will my AI companion remember me?", a: "Yes, persistent memory is on by default." },
    ],
  },
  "/ai-therapist-free": {
    path: "/ai-therapist-free",
    title: "Free AI Therapist — Talk Through Anything 24/7",
    description:
      "SOLACE Mind Hub gives you a caring AI you can talk to about stress, anxiety, sleep, and tough days — free, private, 24/7.",
    h1: "Free AI Therapist & Wellness Companion",
    tagline: "A safe space to talk — supportive, private, always available.",
    keywords: ["free ai therapist", "ai therapy chat", "mental health ai", "ai for anxiety"],
    faqs: [
      { q: "Is this real therapy?", a: "No — SOLACE is supportive AI, not a licensed therapist. For crises, use the built-in Crisis Hub." },
      { q: "Is it private?", a: "Yes — your conversations are encrypted in transit and never sold." },
    ],
  },
  "/ai-tutor-free": {
    path: "/ai-tutor-free",
    title: "Free AI Tutor — Personalized Learning for Any Subject",
    description:
      "Get a free AI tutor that explains any subject, quizzes you, and adapts to your level. Voice + text. Works on phone or desktop.",
    h1: "Your Free AI Tutor",
    tagline: "Personalized lessons, instant answers, voice-friendly — for any subject.",
    keywords: ["free ai tutor", "ai tutor app", "ai homework help", "learn with ai"],
    faqs: [
      { q: "What subjects does it cover?", a: "Math, science, languages, coding, history, exam prep — anything you can ask." },
      { q: "Is voice supported?", a: "Yes — talk to your tutor and hear answers spoken back." },
    ],
  },
  "/free-ai-voice-chat": {
    path: "/free-ai-voice-chat",
    title: "Free AI Voice Chat — Talk to AI Out Loud, Free",
    description:
      "Free AI voice chat with 120+ realistic voices. Talk naturally — your AI replies out loud in real time. Install free.",
    h1: "Free AI Voice Chat",
    tagline: "Talk out loud. Hear it back. 120+ realistic voices, free to start.",
    keywords: ["free ai voice chat", "talk to ai voice", "ai voice assistant free", "ai with voice"],
    faqs: [
      { q: "How many voices are available?", a: "120+ human-quality voices spanning accents, professions, and styles." },
      { q: "Does it work on mobile?", a: "Yes — install free on iPhone, Android, and desktop." },
    ],
  },
  "/ai-app-builder": {
    path: "/ai-app-builder",
    title: "AI App Builder — Build Apps By Chatting With AI",
    description: "SOLACE App Builder lets you describe an app and AI builds it. Wrap for Play Store, add Stripe, monetize. Free to start.",
    h1: "Build Apps Just By Chatting",
    tagline: "Describe it. AI codes it. Wrap it for Play Store. Sell it.",
    keywords: ["ai app builder", "no-code ai app maker", "build app with ai", "ai website builder"],
    faqs: [
      { q: "Do I need to code?", a: "No — describe the app in plain English and AI generates production-ready code." },
      { q: "Can I sell my app?", a: "Yes — built-in Stripe paywall and Play Store wrapper get you live in minutes." },
    ],
  },
  "/ai-image-generator-free": {
    path: "/ai-image-generator-free",
    title: "Free AI Image Generator — 8K Photos, No Signup",
    description: "Generate stunning 8K AI images free with SOLACE. Photo, art, anime, logos. No watermark on the free tier.",
    h1: "Free AI Image Generator",
    tagline: "Type a prompt, get an 8K image. Free, fast, no watermark.",
    keywords: ["free ai image generator", "ai photo generator", "ai art free", "8k ai images"],
    faqs: [
      { q: "Is the free tier really free?", a: "Yes — daily free generations, no credit card needed." },
      { q: "Do I own the images?", a: "Yes — full commercial rights to images you generate." },
    ],
  },
  "/ai-video-generator": {
    path: "/ai-video-generator",
    title: "AI Video Generator — Make Movies From Text",
    description: "SOLACE Movie Studio turns text into cinematic AI videos. Script-to-scene, voice acting, soundtrack — all in one app.",
    h1: "AI Video Generator",
    tagline: "Type a script. Get a movie. Cinematic AI video in minutes.",
    keywords: ["ai video generator", "text to video ai", "ai movie maker", "ai film generator"],
    faqs: [
      { q: "How long can videos be?", a: "Free tier supports 30-second clips. Pro unlocks longer films." },
      { q: "Can I add my own voice?", a: "Yes — clone your voice or pick from 120+ ElevenLabs voices." },
    ],
  },
  "/ai-music-generator": {
    path: "/ai-music-generator",
    title: "AI Music Generator — Create Original Songs Free",
    description: "Generate original music tracks from a text prompt. Royalty-free, commercial-use, free to start with SOLACE.",
    h1: "AI Music Generator",
    tagline: "Describe the vibe. AI composes the song. Royalty-free.",
    keywords: ["ai music generator", "ai song maker", "free music ai", "ai composer"],
    faqs: [
      { q: "Are the songs royalty-free?", a: "Yes — full commercial rights to all music you generate." },
      { q: "What genres are supported?", a: "Pop, rock, lo-fi, classical, electronic, ambient — anything you describe." },
    ],
  },
  "/ai-coder": {
    path: "/ai-coder",
    title: "AI Coder — Build Full Apps with AI Pair Programmer",
    description: "Chat with SOLACE Oracle Coder — your senior AI engineer. React, Three.js, Supabase, edge functions. Production-ready code.",
    h1: "Your AI Pair Programmer",
    tagline: "Senior-level AI engineer in your pocket. Free to start.",
    keywords: ["ai coder", "ai programmer", "ai code generator", "ai coding assistant"],
    faqs: [
      { q: "What languages does it know?", a: "React, TypeScript, Three.js, Tailwind, Supabase SQL/RLS, edge functions, Stripe, Twilio — full stack." },
      { q: "Can it build full apps?", a: "Yes — multi-file projects with version history, live preview, and one-click deploy." },
    ],
  },
  "/ai-3d-app-builder": {
    path: "/ai-3d-app-builder",
    title: "AI 3D App Builder — Three.js Apps By Chatting",
    description: "Build interactive 3D web apps with React Three Fiber. SOLACE generates production-ready 3D scenes from a text prompt.",
    h1: "AI 3D App Builder",
    tagline: "Describe a 3D scene. AI builds it with Three.js. Live preview, deploy free.",
    keywords: ["ai 3d app builder", "three.js ai", "ai 3d scene generator", "react three fiber ai"],
    faqs: [
      { q: "What 3D library is used?", a: "React Three Fiber + drei — production-grade, Web GL, runs on phones." },
      { q: "Do I need 3D experience?", a: "No — describe the scene in plain English and AI handles the math." },
    ],
  },
  "/ai-name-generator": {
    path: "/ai-name-generator",
    title: "Free AI Name Generator — Brand Names in Seconds",
    description: "Free AI brand name generator. Type your idea, get 5 catchy names instantly. No signup required.",
    h1: "AI Brand Name Generator — Free",
    tagline: "Type your idea. Get 5 brandable names in seconds. No signup.",
    keywords: ["ai name generator", "brand name generator", "business name generator", "free name ideas"],
    faqs: [
      { q: "Do I need to sign up?", a: "No — generate names instantly. Save them by creating a free account." },
      { q: "Can I check trademarks?", a: "Always run a trademark search in your country before using a name commercially." },
    ],
  },
  "/ai-tagline-generator": {
    path: "/ai-tagline-generator",
    title: "Free AI Tagline Generator — Punchy Slogans Instantly",
    description: "Generate 5 punchy taglines for your brand free. AI-powered, no signup, copy & paste ready.",
    h1: "AI Tagline Generator",
    tagline: "Punchy slogans in 3 seconds. Free, no signup.",
    keywords: ["ai tagline generator", "slogan generator", "free tagline maker"],
    faqs: [
      { q: "How many do I get?", a: "5 taglines per generation, unlimited generations." },
    ],
  },
  "/ai-business-idea-generator": {
    path: "/ai-business-idea-generator",
    title: "AI Business Idea Generator — Free Startup Ideas",
    description: "Stuck for a business idea? Tell SOLACE your skills and get a custom startup idea instantly. Free.",
    h1: "AI Business Idea Generator",
    tagline: "Describe your skills. Get a custom startup idea. Free.",
    keywords: ["business idea generator", "ai startup ideas", "ai business ideas free"],
    faqs: [
      { q: "Are the ideas validated?", a: "Ideas are AI-generated — always validate market demand before building." },
    ],
  },
  "/ai-horoscope-free": {
    path: "/ai-horoscope-free",
    title: "Free AI Horoscope — Personal Daily Reading",
    description: "Get a personalized daily horoscope from SOLACE AI. Specific, uplifting, free, no signup.",
    h1: "Free AI Horoscope",
    tagline: "A personal daily horoscope from your cosmic AI guide.",
    keywords: ["ai horoscope", "free horoscope ai", "daily horoscope", "ai astrology"],
    faqs: [
      { q: "Is it accurate?", a: "Horoscopes are for entertainment and reflection — take them as inspiration, not prediction." },
    ],
  },
  "/ai-logo-ideas": {
    path: "/ai-logo-ideas",
    title: "Free AI Logo Idea Generator — Concepts in Seconds",
    description: "Get 3 logo design concepts from AI free. Type your brand, get visual ideas you can hand to a designer.",
    h1: "AI Logo Idea Generator",
    tagline: "3 logo concepts in 3 seconds. Free, no signup.",
    keywords: ["ai logo generator", "free logo ideas", "logo concept generator"],
    faqs: [
      { q: "Does it design the actual logo?", a: "It generates concept descriptions you can hand to a designer or use as AI image prompts." },
    ],
  },
  "/ai-companion-app": {
    path: "/ai-companion-app",
    title: "AI Companion App — Free Caring Friend in Your Pocket",
    description: "SOLACE is the all-in-one AI companion app: chat, voice, wellness, safety. Free to install on iPhone, Android, desktop.",
    h1: "The AI Companion App",
    tagline: "Caring AI friend, wellness coach, safety net — all free.",
    keywords: ["ai companion app", "best ai companion", "ai friend app"],
    faqs: [
      { q: "Is the app really free?", a: "Yes — install free, core chat & wellness are free forever." },
    ],
  },
  "/replika-vs-solace": {
    path: "/replika-vs-solace",
    title: "Replika vs SOLACE — Free Alternative Comparison",
    description: "Side-by-side: Replika vs SOLACE. SOLACE wins on free voice chat, persistent memory, no paywall on basics.",
    h1: "Replika vs SOLACE",
    tagline: "Free voice chat. Free memory. No paywall on basics.",
    keywords: ["replika vs solace", "replika comparison", "best replika alternative"],
    faqs: [
      { q: "Is voice chat free?", a: "Yes in SOLACE — Replika locks it behind Pro." },
    ],
  },
  "/ai-life-coach-free": {
    path: "/ai-life-coach-free",
    title: "Free AI Life Coach — Goals, Habits, Mindset",
    description: "SOLACE AI life coach helps you set goals, build habits, and stay motivated. Voice chat, daily check-ins, free.",
    h1: "Free AI Life Coach",
    tagline: "Daily check-ins, goals, mindset — your AI life coach, free.",
    keywords: ["ai life coach", "free life coach app", "ai goal setting", "ai motivation"],
    faqs: [
      { q: "Is it like a real coach?", a: "It's a supportive AI — great for daily accountability, not a replacement for licensed professionals." },
    ],
  },
  "/ai-elderly-care": {
    path: "/ai-elderly-care",
    title: "AI for Elderly Care — Voice Companion & Safety Net",
    description: "SOLACE Elderly Care: easy voice chat, medication reminders, emergency button, family hub. Free to start.",
    h1: "AI Elderly Care Companion",
    tagline: "Friendly voice chat, reminders, safety — for seniors and their families.",
    keywords: ["ai elderly care", "senior ai companion", "ai for grandparents", "elderly safety app"],
    faqs: [
      { q: "Is it easy for seniors?", a: "Yes — large buttons, voice-first, no typing needed." },
    ],
  },
  "/ai-crisis-support": {
    path: "/ai-crisis-support",
    title: "Free AI Crisis Support — Talk Through Anything Now",
    description: "SOLACE Crisis Hub: free 24/7 AI support for tough moments, with direct hotline shortcuts. Always available.",
    h1: "Free AI Crisis Support",
    tagline: "A safe voice when you need one most. Free, 24/7, with hotline access.",
    keywords: ["ai crisis support", "free mental health ai", "ai for anxiety attack", "24/7 ai support"],
    faqs: [
      { q: "Is this an emergency service?", a: "No — for emergencies call 000 (AU), 911 (US), or your local hotline. SOLACE provides supportive AI conversation." },
    ],
  },
  "/ai-photo-editor": {
    path: "/ai-photo-editor",
    title: "AI Photo Editor — Free Image Transformations",
    description: "SOLACE Photography Hub: AI image-to-image transforms, background removal, style transfer. Free to start.",
    h1: "AI Photo Editor",
    tagline: "Transform photos with AI. Free background removal, style transfer, and more.",
    keywords: ["ai photo editor", "free photo ai", "ai image editor", "ai background remover"],
    faqs: [
      { q: "Is editing free?", a: "Yes — daily free edits, premium unlocks 8K and unlimited." },
    ],
  },
  "/free-seo-tools": {
    path: "/free-seo-tools",
    title: "Free AI SEO Tools — Title, Meta, Schema Generator",
    description: "Free SOLACE AI SEO tools: title tag, meta description, schema markup, keyword ideas. No signup needed.",
    h1: "Free AI SEO Tools",
    tagline: "Title tags, meta, schema — generated by AI, free, no signup.",
    keywords: ["free seo tools", "ai seo generator", "free meta description", "schema generator"],
    faqs: [
      { q: "Do I need an SEO background?", a: "No — describe your page and AI generates production SEO." },
    ],
  },
  "/ai-email-writer": {
    path: "/ai-email-writer",
    title: "Free AI Email Writer — Professional Emails in Seconds",
    description: "SOLACE AI email writer: marketing, sales, follow-ups, cold outreach. Free, no signup needed.",
    h1: "Free AI Email Writer",
    tagline: "Sales, marketing, follow-ups — written by AI in 3 seconds.",
    keywords: ["ai email writer", "free email generator", "ai cold email", "ai marketing email"],
    faqs: [
      { q: "Can I customize tone?", a: "Yes — friendly, formal, urgent, casual. Just say what vibe you want." },
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
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <Button size="lg" onClick={() => navigate("/ai-companion")} className="text-base">
              <MessageCircle className="w-5 h-5 mr-2" /> Start Chatting Free
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/")}>
              Install the App
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
