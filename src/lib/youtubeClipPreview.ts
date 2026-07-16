// Pure helpers for the YouTube Show Studio "picked clips" preview toggle.
// Extracted so tests can verify the Hide button actually collapses the iframe
// (the bug: comparing embed URL to watch URL never matched).

export function embedUrlFor(videoId: string | null | undefined, fallbackUrl: string): string {
  return videoId ? `https://www.youtube.com/embed/${videoId}` : fallbackUrl;
}

export function isClipPreviewOpen(
  previewUrl: string | null | undefined,
  videoId: string | null | undefined,
): boolean {
  return !!previewUrl && !!videoId && previewUrl.includes(videoId);
}

export function toggleClipPreview(
  previewUrl: string | null | undefined,
  videoId: string | null | undefined,
  fallbackUrl: string,
): { next: string | null; opened: boolean } {
  if (isClipPreviewOpen(previewUrl, videoId)) {
    return { next: null, opened: false };
  }
  return { next: embedUrlFor(videoId, fallbackUrl), opened: true };
}
