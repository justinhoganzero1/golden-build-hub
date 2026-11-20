// Website marketing pages (made for search visitors) and the real in-app tool
// each one describes. Signed-in members — and every in-app menu or Oracle
// shortcut — go to the real tool, never to the marketing page.

/** Opens Oracle's chat with a ready-to-send starter (nothing is sent or charged until the member taps send). */
export const askOracle = (prompt: string) => `/oracle?ask=${encodeURIComponent(prompt)}`;

export const SEO_TOOL_DESTINATIONS: Record<string, string> = {
  "/ai-chat-companion": "/oracle",
  "/ai-friend": "/oracle",
  "/free-ai-chat": "/oracle",
  "/ai-girlfriend": "/oracle",
  "/ai-boyfriend": "/oracle",
  "/character-ai-alternative": "/oracle",
  "/replika-alternative": "/oracle",
  "/kindroid-alternative": "/oracle",
  "/nomi-ai-alternative": "/oracle",
  "/ai-companion-app": "/oracle",
  "/replika-vs-oracle-lunar": "/oracle",
  "/chatgpt-alternative": "/oracle",
  "/gemini-alternative": "/oracle",
  "/claude-alternative": "/oracle",
  "/free-ai-app-2026": "/oracle",
  "/ai-for-android": "/oracle",
  "/ai-for-iphone": "/oracle",
  "/free-ai-voice-chat": "/oracle",
  "/ai-therapist-free": "/mind-hub",
  "/free-ai-meditation": "/mind-hub",
  "/ai-crisis-support": "/crisis-hub",
  "/ai-elderly-care": "/elderly-care",
  "/ai-tutor-free": "/ai-tutor",
  "/ai-app-builder": "/app-builder",
  "/ai-coder": "/app-builder",
  "/ai-3d-app-builder": "/app-builder",
  "/ai-image-generator-free": "/photography-hub",
  "/ai-photo-editor": "/photography-hub",
  "/ai-logo-ideas": "/photography-hub",
  "/ai-video-generator": "/movie-studio-pro",
  "/ai-music-generator": "/movie-studio-pro",
  "/ai-email-writer": "/personal-assistant",
  "/ai-resume-builder-free": "/professional-hub",
  "/ai-interview-coach": "/professional-hub",
  "/ai-tagline-generator": "/marketing-hub",
  "/free-seo-tools": "/marketing-hub",
  "/ai-name-generator": askOracle("Give me 10 name ideas for "),
  "/ai-business-idea-generator": askOracle("Give me 5 business ideas that suit me. Here's a bit about me: "),
  "/ai-horoscope-free": askOracle("What's my horoscope for today? My star sign is "),
  "/ai-life-coach-free": askOracle("Be my life coach. The goal I want help with is "),
  "/ai-relationship-advice": askOracle("I'd love some relationship advice about "),
  "/ai-cooking-assistant": askOracle("Give me an easy recipe using "),
  "/ai-travel-planner": askOracle("Plan me a trip to "),
  "/ai-fitness-coach-free": askOracle("Make me a simple workout plan. My goal is "),
  "/ai-investor-pitch": askOracle("Help me write a short investor pitch for my idea: "),
};

/** Where a menu or Oracle shortcut should really go (marketing pages swap to the real tool). */
export function toolDestination(path: string): string {
  return SEO_TOOL_DESTINATIONS[path] ?? path;
}
