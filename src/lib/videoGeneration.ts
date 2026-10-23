import { requireEdgeAuthToken } from "./edgeAuth";

export interface GeneratedVideo { video_url: string; job_id: string; media_id?: string; seconds?: number }
export class VideoPendingError extends Error {
  constructor(public jobId: string) { super("Your video is still rendering. Resume this clip instead of starting another."); }
}

/** Every lookup resumes the saved job; a failed request never resubmits generation. */
export async function generateMemberVideo(input: { image_url?: string; prompt: string; duration?: number; job_id?: string; request_key?: string }): Promise<GeneratedVideo> {
  const requestKey = input.request_key || crypto.randomUUID();
  let jobId = input.job_id;
  for (let attempt = 0; attempt < 30; attempt++) {
    if (attempt) await new Promise(resolve => setTimeout(resolve, Math.min(12000, 3000 + attempt * 1000)));
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-video`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await requireEdgeAuthToken()}` },
      body: JSON.stringify(jobId ? { job_id: jobId } : { ...input, request_key: requestKey }),
    }).catch(() => { throw new VideoPendingError(jobId || requestKey); });
    const data = await response.json();
    if (!response.ok) {
      if (data.job_id) throw new VideoPendingError(data.job_id);
      throw new Error(data.message || data.error || "Video generation unavailable");
    }
    jobId = data.job_id;
    if (data.video_url) return data;
    if (!jobId) throw new Error("No saved video job returned");
    if (data.status === "unknown" || data.status === "starting") throw new VideoPendingError(jobId);
  }
  throw new VideoPendingError(jobId || requestKey);
}