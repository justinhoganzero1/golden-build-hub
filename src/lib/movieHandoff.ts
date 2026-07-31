import { toast } from "sonner";

export interface MovieHandoffBrief {
  script: string;
  intent: string;
  frames?: string[];
  youtube: {
    title: string;
    description: string;
    tags: string[];
    thumbnail_prompt: string;
    channel_name: string;
  };
}

export const MOVIE_BRIEF_KEY = "oracle_movie_brief";

/** Stash a brief for Movie Studio to pick up on open. */
export const stashMovieBrief = (brief: MovieHandoffBrief) => {
  sessionStorage.setItem(MOVIE_BRIEF_KEY, JSON.stringify(brief));
};

interface StoryLike {
  title?: string;
  author?: string;
  genre?: string;
  premise?: string;
  coverImage?: string;
  backImage?: string;
  chapters?: Array<{ title?: string; content?: string; images?: string[] }>;
}

/** Build a Movie Studio brief from a Story Writer document. */
export const buildBriefFromStory = (story: StoryLike): MovieHandoffBrief => {
  const chapters = story.chapters || [];
  const script = [
    story.title ? `${story.title}` : "",
    story.author ? `by ${story.author}` : "",
    story.premise ? `\n${story.premise}\n` : "",
    ...chapters.flatMap(c => [c.title || "", (c.content || "").trim(), ""]),
  ].filter(Boolean).join("\n").trim();

  const frames = [
    story.coverImage,
    ...chapters.flatMap(c => c.images || []),
    story.backImage,
  ].filter((u): u is string => typeof u === "string" && u.length > 0);


  return {
    script,
    intent: `Cinematic adaptation of the ${story.genre || "original"} story "${story.title || "Untitled"}".`,
    frames,
    youtube: {
      title: story.title || "Untitled story",
      description: story.premise || "",
      tags: [story.genre || "story", "audiobook", "oracle lunar"].filter(Boolean),
      thumbnail_prompt: `Cinematic 8K poster for "${story.title || "Untitled"}" — ${story.premise || story.genre || "dramatic scene"}`,
      channel_name: story.author || "Oracle Lunar",
    },
  };
};

/**
 * Send a story straight into Movie Maker.
 * `navigate` is react-router's navigate function.
 */
export const sendStoryToMovieMaker = (
  story: StoryLike,
  navigate: (path: string) => void,
) => {
  const hasText = (story.chapters || []).some(c => (c.content || "").trim());
  if (!hasText && !(story.premise || "").trim()) {
    toast.error("Write at least one chapter (or a premise) before sending to Movie Maker.");
    return;
  }
  stashMovieBrief(buildBriefFromStory(story));
  toast.success("Story sent to Movie Maker — opening the studio…");
  navigate("/movie-studio-pro?fromStory=1");
};

/** Send a raw library item (story text, image, or video) to Movie Maker. */
export const sendLibraryItemToMovieMaker = (
  item: { title?: string | null; url?: string | null; media_type?: string | null; metadata?: any },
  navigate: (path: string) => void,
) => {
  const isText = item.media_type === "text" || item.media_type === "story" || item.media_type === "document";
  const script = isText ? String(item.url || "") : String(item.metadata?.prompt || item.title || "");
  const frames = !isText && item.url && (item.media_type === "image" || item.media_type === "gif")
    ? [item.url]
    : [];
  if (!script.trim() && frames.length === 0) {
    toast.error("Nothing in this item to build a movie from.");
    return;
  }
  stashMovieBrief({
    script,
    intent: `Cinematic adaptation of "${item.title || "library item"}" from your Oracle Lunar library.`,
    frames,
    youtube: {
      title: item.title || "Oracle Lunar movie",
      description: script.slice(0, 400),
      tags: ["oracle lunar", "ai movie"],
      thumbnail_prompt: `Cinematic 8K poster for "${item.title || "Oracle Lunar movie"}"`,
      channel_name: "Oracle Lunar",
    },
  });
  toast.success("Sent to Movie Maker — opening the studio…");
  navigate("/movie-studio-pro?fromStory=1");
};
