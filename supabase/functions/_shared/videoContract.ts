export const VIDEO_MODEL = "google/gemini-omni-1.1-flash";
export function videoDuration(value: unknown): number {
  const duration = value === undefined ? 5 : Number(value);
  if (!Number.isInteger(duration) || duration < 3 || duration > 10) throw new Error("duration must be 3–10 whole seconds");
  return duration;
}
export function parseVideoJob(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Invalid video job response");
  const job = value as Record<string, unknown>;
  if (typeof job.id !== "string" || !["queued", "in_progress", "completed", "failed"].includes(String(job.status))) throw new Error("Invalid video job response");
  return { id: job.id, status: String(job.status), seconds: typeof job.seconds === "string" ? Number(job.seconds) : undefined };
}