export interface MovieFormat {
  id: string;
  label: string;
  blurb: string;
  emoji: string;
  /** Output aspect ratio, width:height */
  width: number;
  height: number;
  /** Suggested total runtime in seconds */
  targetSeconds: number;
  /** Where this cut is meant to be published */
  destination: "youtube" | "shorts" | "social" | "cinema" | "audiobook";
  /** File type the finished movie is shared as */
  fileExtension: "webm" | "mp4";
}

export const MOVIE_FORMATS: MovieFormat[] = [
  {
    id: "youtube_standard",
    label: "YouTube Movie (16:9)",
    blurb: "Full-length landscape cut — chapters become scenes, narrated end to end.",
    emoji: "📺",
    width: 1920,
    height: 1080,
    targetSeconds: 600,
    destination: "youtube",
    fileExtension: "webm",
  },
  {
    id: "youtube_short",
    label: "YouTube Short (9:16)",
    blurb: "Under 60s vertical hook cut from the story's biggest moment.",
    emoji: "⚡",
    width: 1080,
    height: 1920,
    targetSeconds: 58,
    destination: "shorts",
    fileExtension: "webm",
  },
  {
    id: "youtube_trailer",
    label: "YouTube Trailer (16:9)",
    blurb: "90-second cinematic teaser — fast cuts, score, title card, no spoilers.",
    emoji: "🎞️",
    width: 1920,
    height: 1080,
    targetSeconds: 90,
    destination: "youtube",
    fileExtension: "webm",
  },
  {
    id: "reels_tiktok",
    label: "Reels / TikTok (9:16)",
    blurb: "Vertical social cut with burned-in captions for silent scrolling.",
    emoji: "📱",
    width: 1080,
    height: 1920,
    targetSeconds: 45,
    destination: "social",
    fileExtension: "webm",
  },
  {
    id: "cinematic_feature",
    label: "Cinematic Feature (2.39:1)",
    blurb: "Widescreen letterboxed film with grade, grain and rolling credits.",
    emoji: "🎬",
    width: 1920,
    height: 804,
    targetSeconds: 900,
    destination: "cinema",
    fileExtension: "webm",
  },
  {
    id: "narrated_slideshow",
    label: "Narrated Story Video (1:1)",
    blurb: "Square audiobook-style video — illustrations plus full narration.",
    emoji: "🔊",
    width: 1080,
    height: 1080,
    targetSeconds: 1200,
    destination: "audiobook",
    fileExtension: "webm",
  },
];

export const getMovieFormat = (id?: string | null) =>
  MOVIE_FORMATS.find(f => f.id === id) || MOVIE_FORMATS[0];

export const MOVIE_FORMAT_KEY = "oracle_movie_format";

export const stashMovieFormat = (format: MovieFormat) => {
  try {
    sessionStorage.setItem(MOVIE_FORMAT_KEY, JSON.stringify(format));
  } catch {
    /* ignore */
  }
};

export const readMovieFormat = (): MovieFormat | null => {
  try {
    const raw = sessionStorage.getItem(MOVIE_FORMAT_KEY);
    return raw ? (JSON.parse(raw) as MovieFormat) : null;
  } catch {
    return null;
  }
};
