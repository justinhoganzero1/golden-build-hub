export const STORY_CHAPTER_MAX_WORDS = 4000;
export const STORY_CHAPTER_MIN_WORDS = 1000;
export const STORY_CHAPTER_TARGET_WORDS = 2000;

export interface RewrittenChapterLike {
  title: string;
  content: string;
}

export function countStoryWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function buildRewriteContinuity(chapters: RewrittenChapterLike[]): string {
  return chapters
    .map((chapter) => {
      const prose = chapter.content.trim();
      const opening = prose.slice(0, 700);
      const ending = prose.length > 1_600 ? prose.slice(-900) : prose.slice(700);
      return `${chapter.title}:\n${opening}${ending ? `\n…\n${ending}` : ""}`;
    })
    .join("\n\n")
    .slice(-14_000);
}

export function validateRewrittenBook(
  original: RewrittenChapterLike[],
  rewritten: RewrittenChapterLike[],
): string[] {
  const errors: string[] = [];
  if (rewritten.length !== original.length) {
    errors.push(`Expected ${original.length} chapters but received ${rewritten.length}.`);
  }

  rewritten.forEach((chapter, index) => {
    const words = countStoryWords(chapter.content);
    if (!chapter.content.trim()) errors.push(`Chapter ${index + 1} is empty.`);
    if (words < STORY_CHAPTER_MIN_WORDS) errors.push(`Chapter ${index + 1} is too short (${words} words).`);
    if (words > STORY_CHAPTER_MAX_WORDS) errors.push(`Chapter ${index + 1} exceeds 4,000 words (${words}).`);
    if (chapter.title !== original[index]?.title) errors.push(`Chapter ${index + 1} title changed unexpectedly.`);
  });

  const seenParagraphs = new Map<string, number>();
  rewritten.forEach((chapter, chapterIndex) => {
    chapter.content.split(/\n\s*\n/).forEach((paragraph) => {
      const normalized = paragraph.toLowerCase().replace(/\s+/g, " ").trim();
      if (normalized.split(" ").length < 35) return;
      const seenIn = seenParagraphs.get(normalized);
      if (seenIn !== undefined && seenIn !== chapterIndex) {
        errors.push(`Repeated long passage found in chapters ${seenIn + 1} and ${chapterIndex + 1}.`);
      } else {
        seenParagraphs.set(normalized, chapterIndex);
      }
    });
  });

  return [...new Set(errors)];
}