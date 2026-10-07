import { Link } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import SEO from "@/components/SEO";
import { STANDALONE_APPS } from "@/components/standalone/standaloneApps";

/** One place listing every Oracle Lunar app the member can open, with a link to each. */
const EXTRA: { title: string; tagline: string; path: string; group: string }[] = [
  { title: "Story Writer", tagline: "Write and publish your books", path: "/story-writer", group: "Writing" },
  { title: "My Author Dashboard", tagline: "Books, chapters, words and goals", path: "/author-dashboard", group: "Writing" },
  { title: "My Books on Amazon", tagline: "Add each book's Amazon link", path: "/my-amazon-books", group: "Writing" },
  { title: "App Builder", tagline: "Build your own apps", path: "/app-builder", group: "Create" },
  { title: "Creator Studio", tagline: "Sell what you make", path: "/creator-studio", group: "Create" },
  { title: "Module Shop", tagline: "Member-made games and trackers", path: "/module-shop", group: "Create" },
  { title: "Movie Studio Pro", tagline: "Make videos and films", path: "/movie-studio-pro", group: "Create" },
  { title: "Living GIF Studio", tagline: "Bring pictures to life", path: "/living-gif-studio", group: "Create" },
  { title: "YouTube Show Studio", tagline: "Build a full episode", path: "/youtube-show-studio", group: "Create" },
  { title: "Avatar Generator", tagline: "Make your own avatars", path: "/avatar-generator", group: "Create" },
  { title: "Voice Studio", tagline: "Voices and voice cloning", path: "/voice-studio", group: "Create" },
  { title: "Free Zone", tagline: "Free games, planners and trackers", path: "/free-zone", group: "Free" },
  { title: "Media Library", tagline: "Everything you've made", path: "/media-library", group: "Free" },
  { title: "Wallet", tagline: "Coins, top-ups and spending", path: "/wallet", group: "Account" },
  { title: "My Account", tagline: "Balance, top-up history, buy coins", path: "/my-account", group: "Account" },
  { title: "Founder Seats", tagline: "Buy or sell a founding seat", path: "/founder-seats", group: "Account" },
  { title: "Founder's Vault", tagline: "Member-only extras", path: "/founder-vault", group: "Account" },
  { title: "Profile", tagline: "Your details and AI agents", path: "/profile", group: "Account" },
];

export default function MyAppsPage() {
  const groups: Record<string, { title: string; tagline: string; path: string }[]> = {
    "AI tools": STANDALONE_APPS.map((a) => ({ title: a.title, tagline: a.tagline, path: a.fullAppPath })),
  };
  for (const e of EXTRA) (groups[e.group] ??= []).push(e);

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      <SEO title="My Apps — everything in Oracle Lunar" description="Every Oracle Lunar app in one place, with a link to each." path="/my-apps" />
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 py-3">
          <Link to="/" className="p-2 -ml-2 rounded-full hover:bg-muted" aria-label="Home"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="flex-1">
            <h1 className="font-bold text-lg">My Apps</h1>
            <p className="text-xs text-muted-foreground">Everything you can open, in one list</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-6">
        {Object.entries(groups).map(([group, items]) => (
          <section key={group}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</h2>
            <div className="divide-y divide-border rounded-2xl border border-border bg-card">
              {items.map((a) => (
                <Link key={a.path + a.title} to={a.path} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.tagline}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
