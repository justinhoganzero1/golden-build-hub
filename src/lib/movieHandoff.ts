import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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

export interface MovieHandoffRecord {
  id: string;
  title: string;
  source: string;
  brief: MovieHandoffBrief;
  opened: boolean;
  opened_at: string | null;
  created_at: string;
}

/**
 * Permanently save a brief to the user's Movie Maker inbox so the story is
 * still waiting for them next time they open the studio (new tab, new day,
 * native app — sessionStorage does not survive any of those).
 */
export const saveMovieHandoff = async (
  brief: MovieHandoffBrief,
  source: "story_writer" | "library" | "director" = "story_writer",
): Promise<string | null> => {
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return null;
    const { data, error } = await supabase
      .from("movie_story_handoffs")
      .insert({
        user_id: auth.user.id,
        title: brief.youtube?.title || "Untitled story",
        source,
        brief: JSON.parse(JSON.stringify(brief)),
      })
      .select("id")
      .single();
    if (error) throw error;
    return data?.id ?? null;
  } catch (e) {
    console.error("[movieHandoff] failed to save handoff", e);
    return null;
  }
};

/** Everything Story Writer / Library has sent to Movie Maker, newest first. */
export const listMovieHandoffs = async (): Promise<MovieHandoffRecord[]> => {
  const { data, error } = await supabase
    .from("movie_story_handoffs")
    .select("id, title, source, brief, opened, opened_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []) as unknown as MovieHandoffRecord[];
};

export const markMovieHandoffOpened = async (id: string) => {
  await supabase
    .from("movie_story_handoffs")
    .update({ opened: true, opened_at: new Date().toISOString() })
    .eq("id", id);
};

export const deleteMovieHandoff = async (id: string) => {
  const { error } = await supabase.from("movie_story_handoffs").delete().eq("id", id);
  if (error) throw error;
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
      thumbnail_prompt: `Cinematic 4K poster for "${story.title || "Untitled"}" — ${story.premise || story.genre || "dramatic scene"}`,
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
  const brief = buildBriefFromStory(story);
  stashMovieBrief(brief);
  void saveMovieHandoff(brief, "story_writer");
  toast.success("Story sent to Movie Maker — it's saved there waiting for you.");
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
  const brief: MovieHandoffBrief = {
    script,
    intent: `Cinematic adaptation of "${item.title || "library item"}" from your Oracle Lunar library.`,
    frames,
    youtube: {
      title: item.title || "Oracle Lunar movie",
      description: script.slice(0, 400),
      tags: ["oracle lunar", "ai movie"],
      thumbnail_prompt: `Cinematic 4K poster for "${item.title || "Oracle Lunar movie"}"`,
      channel_name: "Oracle Lunar",
    },
  };
  stashMovieBrief(brief);
  void saveMovieHandoff(brief, "library");
  toast.success("Sent to Movie Maker — it's saved there waiting for you.");
  navigate("/movie-studio-pro?fromStory=1");
};
