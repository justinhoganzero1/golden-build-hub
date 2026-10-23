import { resolveStorageUrl } from "./signedStorageUrl";

export async function loadMovieVideo(url: string): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  if (!video.canPlayType('video/mp4; codecs="avc1.64001f"')) throw new Error("This browser cannot decode MP4 video. Open the movie in a browser with MP4 playback support.");
  video.crossOrigin = "anonymous";
  video.playsInline = true;
  video.muted = true;
  video.preload = "auto";
  const resolved = await resolveStorageUrl(url);
  if (!resolved) throw new Error("Video unavailable");
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("Could not load movie clip"));
    video.src = resolved;
    video.load();
  });
  return video;
}

export function drawMovieVideo(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, width: number, height: number) {
  const scale = Math.min(width / video.videoWidth, height / video.videoHeight);
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(video, (width - video.videoWidth * scale) / 2, (height - video.videoHeight * scale) / 2, video.videoWidth * scale, video.videoHeight * scale);
}