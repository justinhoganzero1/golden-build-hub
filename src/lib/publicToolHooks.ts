import { PLANS } from "@/lib/plans";
import { askOracle } from "@/lib/toolDestinations";

export type HookPlan = "free" | "plus" | "pro";
export interface PublicToolHook { name: string; hook: string; path: string; plan: HookPlan }

export const PUBLIC_TOOL_HOOKS: PublicToolHook[] = [
  { name: "App Builder", hook: "Got an app idea? Describe it. Start building with Oracle.", path: "/app-builder", plan: "pro" },
  { name: "Fitness Coach", hook: "Ask for an exercise. Oracle brings up a real YouTube demonstration.", path: "/fitness-coach", plan: "plus" },
  { name: "Story Writer", hook: "That story in your head? Give it a first chapter.", path: "/story-writer", plan: "plus" },
  { name: "Oracle Chat", hook: "One conversation. Help with writing, planning and creating.", path: "/oracle", plan: "plus" },
  { name: "Plugin Hub", hook: "Your workflow, your favourites. Keep the tools you use together.", path: "/plugins", plan: "plus" },
  { name: "Photography Hub", hook: "Give that photo a new direction without changing apps.", path: "/photography-hub", plan: "plus" },
  { name: "AI Image Generator", hook: "Describe the picture you wish existed.", path: "/photography-hub", plan: "plus" },
  { name: "Logo Ideas", hook: "Your business has a name. What should its logo look like?", path: "/photography-hub", plan: "plus" },
  { name: "Movie Studio", hook: "Bring your scenes, clips and ideas into one movie workspace.", path: "/movie-studio-pro", plan: "pro" },
  { name: "Video Editor", hook: "Got the footage? Make your next edit here.", path: "/video-editor", plan: "pro" },
  { name: "YouTube Show Studio", hook: "Your next show starts with your own studio workspace.", path: "/youtube-show-studio", plan: "pro" },
  { name: "AI Music Generator", hook: "What would your idea sound like as music?", path: "/movie-studio-pro", plan: "pro" },
  { name: "Voice Studio", hook: "Explore a different voice for your next creation.", path: "/voice-studio", plan: "plus" },
  { name: "Living GIF Studio", hook: "Give your next GIF an idea worth watching.", path: "/living-gif-studio", plan: "pro" },
  { name: "Avatar Generator", hook: "Create a character with a look of their own.", path: "/avatar-generator", plan: "plus" },
  { name: "Avatar Gallery", hook: "Your characters deserve more than a forgotten folder.", path: "/avatar-gallery", plan: "plus" },
  { name: "Media Library", hook: "Your stories, pictures and videos—back where you can find them.", path: "/media-library", plan: "free" },
  { name: "Book Reader", hook: "Open your saved story and take time to read it.", path: "/media-library", plan: "free" },
  { name: "Creator Shop", hook: "Find a creator’s template instead of starting from scratch.", path: "/module-shop", plan: "free" },
  { name: "Calendar", hook: "Give tomorrow a plan before tomorrow gets here.", path: "/calendar", plan: "free" },
  { name: "Diary", hook: "Keep your days together, not scattered across notes.", path: "/calendar", plan: "free" },
  { name: "Alarm Clock", hook: "Make room for the things you don’t want to forget.", path: "/alarm-clock", plan: "free" },
  { name: "Special Occasions", hook: "Birthdays and anniversaries deserve a place in your plans.", path: "/special-occasions", plan: "free" },
  { name: "Personal Assistant", hook: "Turn a jumble of tasks into a clearer next step.", path: "/personal-assistant", plan: "plus" },
  { name: "Interpreter", hook: "Need help with another language? Start the conversation here.", path: "/interpreter", plan: "plus" },
  { name: "Live Vision", hook: "Show Oracle what you’re looking at and ask a question.", path: "/live-vision", plan: "pro" },
  { name: "AI Tutor", hook: "Stuck on a topic? Ask for another explanation.", path: "/ai-tutor", plan: "plus" },
  { name: "Mind Hub", hook: "Make a little room in your day to pause.", path: "/mind-hub", plan: "plus" },
  { name: "Crisis Hub", hook: "Safety information should never sit behind a paid plan.", path: "/crisis-hub", plan: "free" },
  { name: "Family Hub", hook: "Bring your family’s everyday planning into one workspace.", path: "/family-hub", plan: "plus" },
  { name: "Personal Vault", hook: "Give your personal things their own private space.", path: "/personal-vault", plan: "free" },
  { name: "Inventor", hook: "That ‘what if’ idea? Start exploring it.", path: "/inventor", plan: "plus" },
  { name: "Professional Hub", hook: "Give your next work task a clearer starting point.", path: "/professional-hub", plan: "plus" },
  { name: "Email Writer", hook: "Know what you mean, but not how to say it? Draft it with Oracle.", path: "/personal-assistant", plan: "plus" },
  { name: "Resume Builder", hook: "Start shaping the experience you already have into a CV.", path: "/professional-hub", plan: "plus" },
  { name: "Interview Coach", hook: "Practise answering before the interview starts.", path: "/professional-hub", plan: "plus" },
  { name: "Cooking Assistant", hook: "Tell Oracle what’s in the kitchen. Ask for dinner ideas.", path: askOracle("Give me an easy recipe using "), plan: "plus" },
  { name: "Travel Planner", hook: "Your next trip starts with a plan, not fifty open tabs.", path: askOracle("Plan me a trip to "), plan: "plus" },
  { name: "Business Idea Generator", hook: "Start with your interests. Explore a business idea.", path: askOracle("Help me explore a business idea based on my interests: "), plan: "plus" },
  { name: "Name Generator", hook: "Great idea. Still no name? Ask Oracle for options.", path: askOracle("Give me 10 name ideas for "), plan: "plus" },
];

export function publicHookPrice(plan: HookPlan): string {
  return plan === "free" ? "Free account" : `${PLANS[plan].name} · A$${PLANS[plan].monthlyAud.toFixed(2)}/month`;
}

export function publicHookDestination(path: string, signedIn: boolean): string {
  return signedIn ? path : `/sign-in?mode=signup&redirect=${encodeURIComponent(path)}`;
}