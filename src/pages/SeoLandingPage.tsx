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
  safety: boolean;
  faqs: { q: string; a: string }[];
}

const VARIANTS: Record<string, SeoVariant> = {
  "/ai-chat-companion": {
    path: "/ai-chat-companion",
    title: "AI Chat Companion — Talk to Oracle by Voice or Text",
    description: "Oracle is a warm AI chat companion who listens, remembers you and replies by voice or text. Free to download; chat from A$9.99/mo.",
    h1: "Your AI Chat Companion",
    tagline: "A caring AI friend to talk to, by voice or text, whenever you need her.",
    keywords: ["AI chat companion", "AI friend to talk to", "talk to AI", "virtual companion"],
    safety: false,
    faqs: [
      { q: "Can I talk to Oracle with my voice?", a: "Yes. On Plus and Pro you can speak to Oracle and she replies out loud in her natural premium voice." },
    ],
  },
  "/ai-friend": {
    path: "/ai-friend",
    title: "AI Friend — Meet Oracle, Your AI Best Friend",
    description: "Oracle is an AI friend who listens, remembers what matters to you and keeps you safe first. Free to download; chat from A$9.99/mo.",
    h1: "Meet Your AI Friend",
    tagline: "A happy, caring AI friend who remembers you and is always there.",
    keywords: ["AI friend", "virtual friend", "AI buddy", "free AI friend app", "online AI friend"],
    safety: false,
    faqs: [
      { q: "Will my AI friend remember me?", a: "Yes. Oracle remembers your name, interests and what you've talked about, so conversations pick up where you left off." },
      { q: "Can I change how she looks?", a: "Yes. Plus members design Oracle's look and outfits: hair, eyes, age, heritage, and a woman, man or androgynous look." },
    ],
  },
  "/free-ai-chat": {
    path: "/free-ai-chat",
    title: "AI Chat App — Start Free With Oracle Lunar",
    description: "Download Oracle Lunar free, see Oracle's welcome, then chat with her by voice or text on Plus from A$9.99/mo.",
    h1: "Start Free, Chat With Oracle",
    tagline: "Download free, meet Oracle, and upgrade when you want to chat.",
    keywords: ["free AI chatbot", "chat with AI free"],
    safety: false,
    faqs: [
      { q: "Is there a free way to try it?", a: "Yes. Download the app free and Oracle gives you a scripted welcome and tour. Chatting with her uses AI, so it's on Plus." },
    ],
  },
  "/ai-girlfriend": {
    path: "/ai-girlfriend",
    title: "AI Girlfriend App — A Caring AI Companion",
    description: "Oracle is a warm, caring AI companion with a look you design and a natural voice. Adults 18+ only for flirting. From A$9.99/mo.",
    h1: "A Caring AI Companion",
    tagline: "Warm, playful and kind — with a look and voice you'll love.",
    keywords: ["AI girlfriend", "virtual girlfriend", "AI girlfriend app", "free AI girlfriend"],
    safety: false,
    faqs: [
      { q: "Is it explicit?", a: "No. Oracle can be sweet and a little flirty with adult members who flirt first, but she never gets explicit." },
      { q: "Can I design her look?", a: "Yes. Choose hair, eyes, age, heritage and outfits on Plus." },
    ],
  },
  "/ai-boyfriend": {
    path: "/ai-boyfriend",
    title: "AI Boyfriend App — A Caring AI Companion",
    description: "Choose a male look for Oracle with a matching voice. Warm, caring conversation by voice or text. Adults 18+ only for flirting.",
    h1: "A Caring AI Companion",
    tagline: "Choose a male or androgynous look with a matching voice.",
    keywords: ["AI boyfriend", "virtual boyfriend", "AI boyfriend app", "free AI boyfriend"],
    safety: false,
    faqs: [
      { q: "Can Oracle have a male look?", a: "Yes. Plus members can choose a man or androgynous look, and Oracle switches to a matching voice." },
      { q: "Is it explicit?", a: "No. Flirting is sweet, adult-only, and never explicit." },
    ],
  },
  "/character-ai-alternative": {
    path: "/character-ai-alternative",
    title: "Character AI Alternative — One AI Friend With a Real Voice",
    description: "Want one companion who remembers you? Oracle chats by voice or text, with a look you design. Free to download; from A$9.99/mo.",
    h1: "A Character AI Alternative With One Caring Friend",
    tagline: "One companion who remembers you, speaks in a natural voice and keeps you safe.",
    keywords: ["character ai alternative", "c.ai alternative", "free character chat ai", "best ai chat app"],
    safety: false,
    faqs: [
      { q: "How is Oracle Lunar different?", a: "Instead of many characters, you get one caring companion with memory, a natural premium voice and a look you design, plus story, picture and music tools in the same app." },
    ],
  },
  "/replika-alternative": {
    path: "/replika-alternative",
    title: "Replika Alternative — Oracle, an AI Friend With Voice",
    description: "Looking for a Replika alternative? Oracle remembers you, replies in a natural voice, and you design her look. From A$9.99/mo.",
    h1: "A Replika Alternative",
    tagline: "A warm AI friend with memory, a natural voice and a look you design.",
    keywords: ["replika alternative", "free replika", "ai companion app", "best replika alternative"],
    safety: false,
    faqs: [
      { q: "Does Oracle remember me?", a: "Yes. She remembers your name, interests and past chats." },
      { q: "Does she have a voice?", a: "Yes. On Plus and Pro she replies out loud in her premium voice." },
    ],
  },
  "/ai-therapist-free": {
    path: "/ai-therapist-free",
    title: "AI Wellness Chat — Supportive, Not a Therapist",
    description: "Talk through stress and tough days with Oracle, a caring AI. Not a therapist. Crisis Hub always free; chat from A$9.99/mo.",
    h1: "A Supportive AI to Talk To",
    tagline: "A kind ear on hard days — with real help one tap away.",
    keywords: ["free ai therapist", "ai therapy chat", "mental health ai", "ai for anxiety"],
    safety: true,
    faqs: [
      { q: "Is this real therapy?", a: "No. Oracle is supportive AI, not a therapist. For real help, the Crisis Hub lists hotlines and is always free." },
    ],
  },
  "/ai-tutor-free": {
    path: "/ai-tutor-free",
    title: "AI Tutor — Learn Any Subject With Oracle Lunar",
    description: "Ask questions, get step-by-step help and practise with the AI Tutor in Oracle Lunar. Free to download; AI Tutor on Plus.",
    h1: "Your AI Tutor",
    tagline: "Patient, step-by-step help for any subject.",
    keywords: ["free ai tutor", "ai tutor app", "ai homework help", "learn with ai"],
    safety: false,
    faqs: [
      { q: "What subjects can it help with?", a: "Maths, science, languages, writing, history and more — just ask." },
    ],
  },
  "/free-ai-voice-chat": {
    path: "/free-ai-voice-chat",
    title: "AI Voice Chat — Talk to Oracle Out Loud",
    description: "Speak to Oracle and hear her reply in a natural premium voice. Free to download; voice chat on Plus from A$9.99/mo.",
    h1: "Talk to AI Out Loud",
    tagline: "Speak naturally. Oracle answers in a warm, natural voice.",
    keywords: ["free ai voice chat", "talk to ai voice", "ai voice assistant free", "ai with voice"],
    safety: false,
    faqs: [
      { q: "Is voice chat free?", a: "Voice chat uses paid AI, so it's on Plus and Pro. Downloading the app and Oracle's welcome are free." },
    ],
  },
  "/ai-app-builder": {
    path: "/ai-app-builder",
    title: "AI App Builder — Build Apps by Chatting (Pro)",
    description: "Describe an app and the App Builder in Oracle Lunar writes it. Included on Pro (A$24.99/mo).",
    h1: "Build Apps by Chatting",
    tagline: "Describe your idea in plain words and the App Builder starts building.",
    keywords: ["ai app builder", "no-code ai app maker", "build app with ai", "ai website builder"],
    safety: false,
    faqs: [
      { q: "Do I need to code?", a: "No coding needed to start. Describe what you want and refine it by chatting. Always test before you launch." },
    ],
  },
  "/ai-image-generator-free": {
    path: "/ai-image-generator-free",
    title: "AI Image Generator — Make Pictures in Oracle Lunar",
    description: "Turn a description into a picture with Oracle Lunar's image tools. On Plus from A$9.99/mo, with monthly AI credit included.",
    h1: "AI Image Generator",
    tagline: "Describe it and get a picture you can save to your Library.",
    keywords: ["free ai image generator", "ai photo generator", "ai art free"],
    safety: false,
    faqs: [
      { q: "How many images can I make?", a: "Plus includes about A$3 of AI credit each month. When it runs out you can top up your wallet." },
    ],
  },
  "/ai-video-generator": {
    path: "/ai-video-generator",
    title: "AI Video Generator — Movie Studio on Pro",
    description: "Make short AI videos and movies with Oracle Lunar's Movie Studio. Included on Pro (A$24.99/mo) with monthly AI credit.",
    h1: "AI Video Generator",
    tagline: "Write a script, pick scenes, and build a short movie.",
    keywords: ["ai video generator", "text to video ai", "ai movie maker", "ai film generator"],
    safety: false,
    faqs: [
      { q: "Which plan includes video?", a: "Movie Studio and AI video are on Pro. Pro includes about A$10 of AI credit each month; longer videos may need a wallet top-up." },
    ],
  },
  "/ai-music-generator": {
    path: "/ai-music-generator",
    title: "AI Music Generator — Make Songs in Oracle Lunar",
    description: "Describe a mood and create music and sound with Oracle Lunar's audio tools. On Plus from A$9.99/mo.",
    h1: "AI Music Generator",
    tagline: "Describe the vibe and create a track.",
    keywords: ["ai music generator", "ai song maker", "free music ai", "ai composer"],
    safety: false,
    faqs: [
      { q: "Can I use the music commercially?", a: "Check the terms for each tool before commercial use. Personal use is fine." },
    ],
  },
  "/ai-coder": {
    path: "/ai-coder",
    title: "AI Coder — Oracle's Coding Helper (Pro)",
    description: "Get help writing and fixing code with the Oracle coder in Oracle Lunar. Included on Pro (A$24.99/mo).",
    h1: "Your AI Coding Helper",
    tagline: "Ask for code, fixes and explanations in plain words.",
    keywords: ["ai coder", "ai programmer", "ai code generator", "ai coding assistant"],
    safety: false,
    faqs: [
      { q: "Can it build full apps?", a: "The App Builder on Pro can start full apps from a description. Always review and test the code." },
    ],
  },
  "/ai-3d-app-builder": {
    path: "/ai-3d-app-builder",
    title: "AI 3D App Builder — 3D Scenes by Chatting (Pro)",
    description: "Describe a 3D scene and Oracle Lunar's App Builder can build it for the web. Included on Pro (A$24.99/mo).",
    h1: "AI 3D App Builder",
    tagline: "Describe a 3D scene and watch it come together.",
    keywords: ["ai 3d app builder", "three.js ai", "ai 3d scene generator", "react three fiber ai"],
    safety: false,
    faqs: [
      { q: "Do I need 3D experience?", a: "No. Describe the scene in plain words and refine it by chatting." },
    ],
  },
  "/ai-name-generator": {
    path: "/ai-name-generator",
    title: "AI Name Generator — Business Name Ideas With Oracle",
    description: "Ask Oracle for brandable business and product names in seconds. Oracle chat is on Plus from A$9.99/mo.",
    h1: "AI Business Name Ideas",
    tagline: "Tell Oracle your idea and get name suggestions.",
    keywords: ["ai name generator", "brand name generator", "business name generator", "free name ideas"],
    safety: false,
    faqs: [
      { q: "Can I check trademarks?", a: "Always do a trademark search in your country before using a name." },
    ],
  },
  "/ai-tagline-generator": {
    path: "/ai-tagline-generator",
    title: "AI Tagline Generator — Slogan Ideas With Oracle",
    description: "Ask Oracle for punchy taglines and slogans for your business. Oracle chat is on Plus from A$9.99/mo.",
    h1: "AI Tagline Ideas",
    tagline: "Describe your business and get slogan ideas.",
    keywords: ["ai tagline generator", "slogan generator", "free tagline maker"],
    safety: false,
    faqs: [
      { q: "How do I get the best taglines?", a: "Tell Oracle who your customers are and the feeling you want. Ask for more until one fits." },
    ],
  },
  "/ai-business-idea-generator": {
    path: "/ai-business-idea-generator",
    title: "AI Business Idea Generator — Brainstorm With Oracle",
    description: "Brainstorm startup and side-hustle ideas with Oracle based on your skills. Oracle chat is on Plus from A$9.99/mo.",
    h1: "Brainstorm Business Ideas",
    tagline: "Share your skills and interests and get ideas to explore.",
    keywords: ["business idea generator", "ai startup ideas", "ai business ideas free"],
    safety: false,
    faqs: [
      { q: "Are the ideas validated?", a: "No. Ideas are AI suggestions — always check real demand before you build." },
    ],
  },
  "/ai-horoscope-free": {
    path: "/ai-horoscope-free",
    title: "AI Horoscope — A Daily Reading From Oracle",
    description: "Ask Oracle for a personal daily horoscope for fun and reflection. Oracle chat is on Plus from A$9.99/mo.",
    h1: "AI Horoscope",
    tagline: "A daily reading for fun and reflection.",
    keywords: ["ai horoscope", "free horoscope ai", "daily horoscope", "ai astrology"],
    safety: false,
    faqs: [
      { q: "Is it accurate?", a: "Horoscopes are for entertainment and reflection, not prediction." },
    ],
  },
  "/ai-logo-ideas": {
    path: "/ai-logo-ideas",
    title: "AI Logo Ideas — Logo Concepts With Oracle Lunar",
    description: "Get logo concept ideas and images with Oracle Lunar's picture tools. On Plus from A$9.99/mo.",
    h1: "AI Logo Ideas",
    tagline: "Describe your brand and get logo concepts.",
    keywords: ["ai logo generator", "free logo ideas", "logo concept generator"],
    safety: false,
    faqs: [
      { q: "Does it design the final logo?", a: "It gives concepts and images you can refine. Many people then finish the logo with a designer." },
    ],
  },
  "/ai-companion-app": {
    path: "/ai-companion-app",
    title: "AI Companion App — Oracle Lunar",
    description: "Oracle Lunar is an AI companion app: Oracle chats by voice or text, remembers you and keeps you safe. Free to download; from A$9.99/mo.",
    h1: "The AI Companion App",
    tagline: "A caring AI friend, creative tools and a free Crisis Hub in one app.",
    keywords: ["ai companion app", "best ai companion", "ai friend app"],
    safety: false,
    faqs: [
      { q: "What else is in the app?", a: "Story Writer, picture, music and sound tools on Plus; Movie Studio and App Builder on Pro; diary, calendar, Library and Crisis Hub free." },
    ],
  },
  "/replika-vs-oracle-lunar": {
    path: "/replika-vs-oracle-lunar",
    title: "Replika vs Oracle Lunar — Which AI Friend Suits You?",
    description: "Comparing Replika and Oracle Lunar? Here's what Oracle Lunar offers and what it costs, so you can decide.",
    h1: "Replika vs Oracle Lunar",
    tagline: "What Oracle Lunar offers, honestly, so you can choose.",
    keywords: ["replika vs oracle-lunar", "replika comparison", "best replika alternative"],
    safety: false,
    faqs: [
      { q: "What does Oracle Lunar offer?", a: "One caring companion with memory, a natural premium voice, a look and outfits you design, and creative tools in the same app. Plus is A$9.99/mo; check Replika's own site for its current plans." },
    ],
  },
  "/ai-life-coach-free": {
    path: "/ai-life-coach-free",
    title: "AI Life Coach — Goals and Habits With Oracle",
    description: "Set goals, build habits and get daily encouragement from Oracle. Not a licensed coach. Oracle chat on Plus from A$9.99/mo.",
    h1: "AI Life Coach",
    tagline: "Daily encouragement for your goals and habits.",
    keywords: ["ai life coach", "free life coach app", "ai goal setting", "ai motivation"],
    safety: true,
    faqs: [
      { q: "Is it like a real coach?", a: "It's supportive AI for everyday motivation, not a replacement for a licensed professional." },
    ],
  },
  "/ai-elderly-care": {
    path: "/ai-elderly-care",
    title: "AI Companion for Seniors — Friendly Voice Chat",
    description: "A friendly AI voice to chat with, plus reminders and a diary. Not a medical service. Free tools; chat from A$9.99/mo.",
    h1: "A Friendly AI Companion for Seniors",
    tagline: "Warm voice chat, reminders and a diary in one simple app.",
    keywords: ["ai elderly care", "senior ai companion", "ai for grandparents", "elderly safety app"],
    safety: true,
    faqs: [
      { q: "Is it easy for seniors?", a: "Oracle can talk out loud, and reminders, diary and calendar are free." },
    ],
  },
  "/ai-crisis-support": {
    path: "/ai-crisis-support",
    title: "Crisis Support — Free Crisis Hub in Oracle Lunar",
    description: "Oracle Lunar's Crisis Hub is always free and lists hotlines. Oracle is AI support, not an emergency service.",
    h1: "Crisis Support When You Need It",
    tagline: "Real hotlines, always free — and a caring AI to talk to.",
    keywords: ["ai crisis support", "free mental health ai", "ai for anxiety attack", "24/7 ai support"],
    safety: true,
    faqs: [
      { q: "Is the Crisis Hub free?", a: "Yes. The Crisis Hub and safety pages are always free, with or without a plan." },
    ],
  },
  "/ai-photo-editor": {
    path: "/ai-photo-editor",
    title: "AI Photo Editor — Edit Photos in Oracle Lunar",
    description: "Transform and improve photos with Oracle Lunar's photo tools. On Plus from A$9.99/mo, with monthly AI credit.",
    h1: "AI Photo Editor",
    tagline: "Change backgrounds, styles and more with AI.",
    keywords: ["ai photo editor", "free photo ai", "ai image editor", "ai background remover"],
    safety: false,
    faqs: [
      { q: "Is editing included?", a: "Photo tools are on Plus, which includes about A$3 of AI credit a month; top up if you need more." },
    ],
  },
  "/free-seo-tools": {
    path: "/free-seo-tools",
    title: "AI SEO Helper — Titles and Descriptions With Oracle",
    description: "Ask Oracle to draft page titles, descriptions and ideas for your website. Oracle chat is on Plus from A$9.99/mo.",
    h1: "AI SEO Helper",
    tagline: "Draft titles, descriptions and content ideas for your pages.",
    keywords: ["free seo tools", "ai seo generator", "free meta description", "schema generator"],
    safety: false,
    faqs: [
      { q: "Do I need SEO experience?", a: "No. Describe your page and Oracle suggests wording. Review it before publishing." },
    ],
  },
  "/ai-email-writer": {
    path: "/ai-email-writer",
    title: "AI Email Writer — Draft Emails With Oracle",
    description: "Ask Oracle to draft friendly, formal or sales emails in seconds. Oracle chat is on Plus from A$9.99/mo.",
    h1: "AI Email Writer",
    tagline: "Tell Oracle what you need and get a draft to edit.",
    keywords: ["ai email writer", "free email generator", "ai cold email", "ai marketing email"],
    safety: false,
    faqs: [
      { q: "Can I choose the tone?", a: "Yes. Ask for friendly, formal, short or detailed." },
    ],
  },
  "/chatgpt-alternative": {
    path: "/chatgpt-alternative",
    title: "ChatGPT Alternative — An AI Best Friend With a Voice",
    description: "Want an AI that feels like a friend? Oracle chats by voice or text, remembers you and helps create. From A$9.99/mo.",
    h1: "A Friendlier ChatGPT Alternative",
    tagline: "An AI that answers questions and actually feels like a friend.",
    keywords: ["chatgpt alternative", "free chatgpt", "best chatgpt alternative 2026", "chatgpt vs"],
    safety: false,
    faqs: [
      { q: "Can Oracle answer everyday questions?", a: "Yes. Oracle can search the web for current answers and shows her sources." },
    ],
  },
  "/gemini-alternative": {
    path: "/gemini-alternative",
    title: "Gemini Alternative — Oracle Lunar AI Companion",
    description: "Oracle Lunar pairs a caring AI friend with creative tools in one app. Free to download; chat from A$9.99/mo.",
    h1: "A Gemini Alternative With a Personality",
    tagline: "Helpful answers from a warm AI friend.",
    keywords: ["gemini alternative", "google gemini alternative", "free gemini", "multi-model ai"],
    safety: false,
    faqs: [
      { q: "Do I need a Google account?", a: "No. Sign in with your email and a password." },
    ],
  },
  "/claude-alternative": {
    path: "/claude-alternative",
    title: "Claude Alternative — Oracle, a Caring AI Friend",
    description: "Oracle Lunar offers a warm AI companion with voice, memory and creative tools. Free to download; chat from A$9.99/mo.",
    h1: "A Claude Alternative With a Voice",
    tagline: "Thoughtful answers, a natural voice and a friend who remembers you.",
    keywords: ["claude alternative", "free claude", "anthropic alternative", "long context ai"],
    safety: false,
    faqs: [
      { q: "Does Oracle have a voice?", a: "Yes. On Plus and Pro she replies out loud in her premium voice." },
    ],
  },
  "/free-ai-app-2026": {
    path: "/free-ai-app-2026",
    title: "AI Super App 2026 — Oracle Lunar",
    description: "One app for an AI best friend, stories, pictures, music and video. Free to download; plans from A$9.99/mo.",
    h1: "An AI Super App for 2026",
    tagline: "An AI friend plus creative tools, all in one place.",
    keywords: ["best free ai app 2026", "best ai app", "free ai super app", "ai apps 2026"],
    safety: false,
    faqs: [
      { q: "What's included?", a: "Free: diary, calendar, Library, Crisis Hub. Plus: Oracle chat, Story Writer, picture and music tools. Pro: Movie Studio, AI video, App Builder." },
    ],
  },
  "/ai-for-android": {
    path: "/ai-for-android",
    title: "AI App for Android — Download Oracle Lunar",
    description: "Download Oracle Lunar straight to your Android phone from oraclelunar.com. Free to download; chat from A$9.99/mo.",
    h1: "AI App for Android",
    tagline: "Download directly from our website in a few taps.",
    keywords: ["ai app for android", "best android ai", "free ai android app", "android ai assistant"],
    safety: false,
    faqs: [
      { q: "Is it on Google Play?", a: "Not yet. You can download the Android app directly from oraclelunar.com." },
    ],
  },
  "/ai-for-iphone": {
    path: "/ai-for-iphone",
    title: "AI App for iPhone — Install Oracle Lunar From Safari",
    description: "Install Oracle Lunar on your iPhone from Safari in seconds. Free to download; chat from A$9.99/mo.",
    h1: "AI App for iPhone",
    tagline: "Install from Safari and add it to your home screen.",
    keywords: ["ai app for iphone", "best iphone ai", "free ios ai app", "siri alternative"],
    safety: false,
    faqs: [
      { q: "Is it on the App Store?", a: "Not yet. Open oraclelunar.com in Safari, tap Share, then Add to Home Screen." },
    ],
  },
  "/free-ai-meditation": {
    path: "/free-ai-meditation",
    title: "AI Meditation — Calm Moments With Oracle",
    description: "Guided calm, breathing and gentle talk with Oracle and the Mind Hub. Not medical care. On Plus from A$9.99/mo.",
    h1: "AI Meditation and Calm",
    tagline: "Gentle breathing and calm talk when you need a moment.",
    keywords: ["ai meditation", "free meditation app", "ai sleep stories", "ai mindfulness"],
    safety: true,
    faqs: [
      { q: "Is it medical treatment?", a: "No. It's for relaxation and wellbeing, not medical care." },
    ],
  },
  "/ai-relationship-advice": {
    path: "/ai-relationship-advice",
    title: "AI Relationship Advice — Talk It Through With Oracle",
    description: "Talk through relationship questions with Oracle, a caring AI. Not a counsellor. Oracle chat on Plus from A$9.99/mo.",
    h1: "Talk Through Relationship Questions",
    tagline: "A kind, honest sounding board.",
    keywords: ["ai relationship advice", "ai dating coach", "free relationship coach", "ai marriage advice"],
    safety: true,
    faqs: [
      { q: "Is this professional counselling?", a: "No. Oracle is supportive AI. For serious problems, please see a qualified counsellor." },
    ],
  },
  "/ai-resume-builder-free": {
    path: "/ai-resume-builder-free",
    title: "AI Resume Help — Draft Your Resume With Oracle",
    description: "Ask Oracle to draft and polish your resume and cover letter. Oracle chat is on Plus from A$9.99/mo.",
    h1: "AI Resume Help",
    tagline: "Turn your experience into a clear resume draft.",
    keywords: ["ai resume builder", "free resume builder", "ai cover letter", "ats resume"],
    safety: false,
    faqs: [
      { q: "Will it get me the job?", a: "No promises — it helps you write clearly. Always check details are true and accurate." },
    ],
  },
  "/ai-interview-coach": {
    path: "/ai-interview-coach",
    title: "AI Interview Coach — Practise With Oracle",
    description: "Practise job interview questions with Oracle and get friendly feedback. Oracle chat on Plus from A$9.99/mo.",
    h1: "AI Interview Practice",
    tagline: "Practise answers out loud and get feedback.",
    keywords: ["ai interview coach", "ai mock interview", "interview practice ai", "ai job coach"],
    safety: false,
    faqs: [
      { q: "Can I practise by voice?", a: "Yes. On Plus you can speak your answers and Oracle replies out loud." },
    ],
  },
  "/ai-cooking-assistant": {
    path: "/ai-cooking-assistant",
    title: "AI Cooking Assistant — Recipe Ideas From Oracle",
    description: "Tell Oracle what's in your fridge and get recipe ideas. Oracle chat is on Plus from A$9.99/mo.",
    h1: "AI Cooking Assistant",
    tagline: "What's in the fridge? Oracle suggests what to cook.",
    keywords: ["ai cooking assistant", "ai recipe generator", "ai chef", "what to cook ai"],
    safety: false,
    faqs: [
      { q: "Can it handle allergies?", a: "Tell Oracle your allergies, but always check ingredients yourself." },
    ],
  },
  "/ai-travel-planner": {
    path: "/ai-travel-planner",
    title: "AI Travel Planner — Plan Trips With Oracle",
    description: "Ask Oracle to plan itineraries and ideas for your next trip. Oracle chat is on Plus from A$9.99/mo.",
    h1: "AI Travel Planner",
    tagline: "Plan a trip by chatting with Oracle.",
    keywords: ["ai travel planner", "free trip planner ai", "ai itinerary", "ai vacation planner"],
    safety: false,
    faqs: [
      { q: "Are prices and times current?", a: "Oracle can search the web, but always confirm bookings, prices and times with the provider." },
    ],
  },
  "/ai-fitness-coach-free": {
    path: "/ai-fitness-coach-free",
    title: "AI Fitness Coach — Workout Ideas From Oracle",
    description: "Get workout ideas and encouragement from Oracle. Not medical advice. Oracle chat on Plus from A$9.99/mo.",
    h1: "AI Fitness Coach",
    tagline: "Workout ideas and encouragement that fit your day.",
    keywords: ["ai fitness coach", "free workout app", "ai personal trainer", "ai gym coach"],
    safety: false,
    faqs: [
      { q: "Is it safe for everyone?", a: "Check with a doctor before starting a new exercise program." },
    ],
  },
  "/ai-investor-pitch": {
    path: "/ai-investor-pitch",
    title: "AI Pitch Deck Helper — Draft Your Pitch With Oracle",
    description: "Ask Oracle to outline an investor pitch and slide wording. Oracle chat is on Plus from A$9.99/mo.",
    h1: "AI Pitch Deck Helper",
    tagline: "Outline your pitch and polish the wording.",
    keywords: ["ai pitch deck", "investor pitch generator", "startup pitch ai", "free pitch deck"],
    safety: false,
    faqs: [
      { q: "Is the deck investor-ready?", a: "It's a strong first draft. Check every number and claim before sending." },
      { q: "Interested in investing in Oracle Lunar?", a: "Visit the Investor page to send an enquiry to the founder." },
    ],
  },
};

const PRICING_FAQ = {
  q: "What's free and what's paid?",
  a: "Oracle Lunar is free to download. Free includes Oracle's welcome tour, calendar, diary, reminders, your Library, the Book Reader and the Crisis Hub. Chatting with Oracle and the AI tools need Plus (A$9.99/month, includes about A$3 of AI credit) or Pro (A$24.99/month). Heavier use is topped up from your wallet. Sign-in with email is required.",
};

const SAFETY_FAQ = {
  q: "Is Oracle a professional or an emergency service?",
  a: "No. Oracle is AI support, not a person, health professional, therapist or emergency service. In an emergency call 000 in Australia or 911 in the US. The Crisis Hub is always free.",
};

export default function SeoLandingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const variant = VARIANTS[location.pathname] ?? VARIANTS["/ai-chat-companion"];
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
      <main className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <section className="container mx-auto px-4 pt-16 pb-12 text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-6">
            <Sparkles className="w-4 h-4" /> Free to download · Plans from A$9.99/mo
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {variant.h1}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">{variant.tagline}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <Button size="lg" onClick={() => navigate("/")} className="text-base">
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
          <Button size="lg" onClick={() => navigate("/")}>
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
      </main>
    </>
  );
}
