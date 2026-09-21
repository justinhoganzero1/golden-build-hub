import { StoryFileSource } from "./storyFiles";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Audit a story for Kindle compatibility.
 * Checks against Amazon KDP and "Send to Kindle" requirements.
 */
export const validateForKindle = (story: StoryFileSource): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Mandatory Metadata
  if (!story.title?.trim()) {
    errors.push("Missing book title.");
  }
  if (!story.author?.trim()) {
    warnings.push("No author name provided. Kindle will show 'Anonymous'.");
  }

  // 2. Content Structure
  const activeChapters = story.chapters?.filter(c => c.content?.trim()) || [];
  if (activeChapters.length === 0) {
    errors.push("The book must have at least one chapter with text.");
  }

  // 3. Image Constraints
  // Amazon KDP recommendation: max 5MB per image.
  // Send to Kindle (Email): 50MB total limit, but our edge function caps at ~11MB (15MB base64).
  const INDIVIDUAL_IMAGE_LIMIT = 5 * 1024 * 1024; 
  const EDGE_FUNCTION_LIMIT = 11 * 1024 * 1024; // Roughly 15MB base64
  const SEND_TO_KINDLE_LIMIT = 50 * 1024 * 1024;

  let totalSizeEstimate = 0;
  let oversizedImages = 0;

  const checkImage = (dataUrl: string | undefined, label: string) => {
    if (!dataUrl || !dataUrl.startsWith("data:")) return;
    const size = Math.floor(dataUrl.length * 0.75);
    totalSizeEstimate += size;
    if (size > INDIVIDUAL_IMAGE_LIMIT) {
      oversizedImages++;
      warnings.push(`${label} image is very large (${(size / (1024 * 1024)).toFixed(1)}MB). Kindle conversion might fail.`);
    }
  };

  checkImage(story.coverImage, "Cover");
  activeChapters.forEach((ch, i) => {
    (ch.images || []).forEach((img, k) => {
      checkImage(img, `Chapter ${i + 1} image ${k + 1}`);
    });
  });

  // 4. Payload Size Alerts
  if (totalSizeEstimate > EDGE_FUNCTION_LIMIT) {
    warnings.push(`This book is large (${(totalSizeEstimate / (1024 * 1024)).toFixed(1)}MB). Auto-delivery to Kindle might fail due to email limits. If it fails, use 'Download EPUB' and upload it manually.`);
  }
  
  if (totalSizeEstimate > SEND_TO_KINDLE_LIMIT) {
    errors.push(`Book size (${(totalSizeEstimate / (1024 * 1024)).toFixed(1)}MB) exceeds Amazon's 50MB Send to Kindle limit.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};
