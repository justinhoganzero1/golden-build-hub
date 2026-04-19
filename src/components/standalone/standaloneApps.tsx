import { Sparkles, GraduationCap, Brain, LifeBuoy, Camera, Megaphone, Heart, Wallet, Calendar, Eye, Youtube } from "lucide-react";
import type { ComponentType } from "react";

/**
 * Single source of truth for all standalone /apps/<slug> routes.
 * Each entry powers:
 *  - the /apps storefront card
 *  - the /apps/<slug> route via StandaloneAppRoute
 *
 * `Component` is the simplified standalone module (lazy-loaded).
 * `fullAppPath` deep-links into the full in-app version.
 */
import { lazy } from "react";

export interface StandaloneApp {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  color: string; // tailwind gradient classes
  fullAppPath: string;
  Component: ReturnType<typeof lazy>;
}

export const STANDALONE_APPS: StandaloneApp[] = [
  {
    slug: "oracle",
    title: "Oracle Chat",
    tagline: "Talk to Eric, your personal AI",
    description: "Voice + text chat with an AI that remembers you. Ask anything.",
    icon: Sparkles,
    color: "from-amber-500 to-orange-500",
    fullAppPath: "/oracle",
    Component: lazy(() => import("@/pages/standalone/StandaloneOracle")),
  },
  {
    slug: "tutor",
    title: "AI Tutor",
    tagline: "Learn anything, instantly",
    description: "Ask any question and get a clear, step-by-step explanation.",
    icon: GraduationCap,
    color: "from-blue-500 to-indigo-500",
    fullAppPath: "/ai-tutor",
    Component: lazy(() => import("@/pages/standalone/StandaloneTutor")),
  },
  {
    slug: "mind",
    title: "Mind Hub",
    tagline: "60-second wellness reset",
    description: "Quick guided breathing, grounding & mood check-ins.",
    icon: Brain,
    color: "from-purple-500 to-pink-500",
    fullAppPath: "/mind-hub",
    Component: lazy(() => import("@/pages/standalone/StandaloneMind")),
  },
  {
    slug: "crisis",
    title: "Crisis Help",
    tagline: "Help when you need it now",
    description: "One-tap hotlines and a calm AI to talk you through it.",
    icon: LifeBuoy,
    color: "from-red-500 to-rose-500",
    fullAppPath: "/crisis-hub",
    Component: lazy(() => import("@/pages/standalone/StandaloneCrisis")),
  },
  {
    slug: "photography",
    title: "Photo Magic",
    tagline: "AI-edit any photo",
    description: "Upload a photo and describe how to transform it.",
    icon: Camera,
    color: "from-cyan-500 to-teal-500",
    fullAppPath: "/photography-hub",
    Component: lazy(() => import("@/pages/standalone/StandalonePhoto")),
  },
  {
    slug: "marketing",
    title: "Marketing Genie",
    tagline: "Ad copy in seconds",
    description: "Tell it what you sell, get headlines, captions, and posts.",
    icon: Megaphone,
    color: "from-emerald-500 to-green-500",
    fullAppPath: "/marketing-hub",
    Component: lazy(() => import("@/pages/standalone/StandaloneMarketing")),
  },
  {
    slug: "companion",
    title: "AI Companion",
    tagline: "Your always-there friend",
    description: "Pick a personality and chat. They remember what matters.",
    icon: Heart,
    color: "from-pink-500 to-rose-500",
    fullAppPath: "/ai-companion",
    Component: lazy(() => import("@/pages/standalone/StandaloneCompanion")),
  },
  {
    slug: "wallet",
    title: "Wallet",
    tagline: "Your balance + top-ups",
    description: "Quick view of your ORACLE LUNAR wallet for calls and premium use.",
    icon: Wallet,
    color: "from-yellow-500 to-amber-500",
    fullAppPath: "/wallet",
    Component: lazy(() => import("@/pages/standalone/StandaloneWallet")),
  },
  {
    slug: "calendar",
    title: "Life Calendar",
    tagline: "Add events fast, get reminders",
    description: "A focused calendar that just works. AI helps you schedule.",
    icon: Calendar,
    color: "from-violet-500 to-purple-500",
    fullAppPath: "/calendar",
    Component: lazy(() => import("@/pages/standalone/StandaloneCalendar")),
  },
  {
    slug: "vision",
    title: "Live Vision",
    tagline: "Point your camera, ask anything",
    description: "Real-time AI describes what your camera sees.",
    icon: Eye,
    color: "from-sky-500 to-blue-500",
    fullAppPath: "/live-vision",
    Component: lazy(() => import("@/pages/standalone/StandaloneVision")),
  },
  {
    slug: "youtube-show",
    title: "YouTube Show Studio",
    tagline: "Build a full episode in minutes",
    description: "Pick clips, write a script with AI, voice it, and render a real show.",
    icon: Youtube,
    color: "from-red-500 to-orange-500",
    fullAppPath: "/youtube-show-studio",
    Component: lazy(() => import("@/pages/standalone/StandaloneYouTubeShow")),
  },
];

export const getStandaloneApp = (slug: string) => STANDALONE_APPS.find((a) => a.slug === slug);
