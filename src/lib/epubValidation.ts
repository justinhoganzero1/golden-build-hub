import { StoryFileSource } from "./storyFiles";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a story against Kindle/KDP requirements before EPUB generation.
 */
export const validateForKindle = (story: StoryFileSource): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[];
  warnings = [];

  if (!story.title?.trim()) errors.push("Story title is required.");
  if (!story.chapters || story.chapters.filter(c => c.content?.trim()).length === 0) {
    errors.push("Story must have at least one non-empty chapter.");
  }

  // Kindle specific checks
  const chapters = story.chapters || [];
  
  // Check for potentially huge images
  let totalImageSizeEstimate = 0;
  const imageLimit = 5 * 1024 * 1024; // 5MB recommendation for Kindle images
  
  const checkImage = (dataUrl: string | undefined, context: string) => {
    if (!dataUrl || !dataUrl.startsWith("data:")) return;
    // Base64 size estimate: length * 0.75
    const size = dataUrl.length * 0.75;
    totalImageSizeEstimate += size;
    if (size > imageLimit) {
      warnings.push(`${context} image is very large (${(size / (1024 * 1024)).toFixed(1)}MB). Kindle conversion may fail or look poor.`);
    }
  };

  checkImage(story.coverImage, "Cover");
  chapters.forEach((c, i) => {
    (c.images || []).forEach((img, k) => {
      checkImage(img, `Chapter ${i + 1} image ${k + 1}`);
    });
  });

  // Total estimate for Send to Kindle (50MB limit)
  if (totalImageSizeEstimate > 45 * 1024 * 1024) {
    errors.push("Total book size is likely to exceed Amazon's 50MB Send to Kindle limit.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};
