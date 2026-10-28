export type OracleSpeechMode = "device" | "premium";
export function resolveOraclePremiumVoice(saved: string | null | undefined): string {
  // Charlie is a male voice, not the female presenter requested by Juzzy.
  return !saved || saved === "IKne3meq5aSn9XLyUdCD" ? "EXAVITQu4vr4xnSDxMaL" : saved;
}
export function resolveVideoReplies(saved: string | null, authorizedDefault: boolean): boolean {
  if (saved === "on" || saved === "off") return saved === "on";
  return authorizedDefault;
}
export type OracleArtifactKind = "image" | "video" | "audio" | "story" | "app";
export interface OracleArtifact {
  id: string;
  kind: OracleArtifactKind;
  url?: string;
  body?: string;
  libraryId?: string;
  deepPath: string;
  reused?: boolean;
}

export function resolveSpeechMode(saved: string | null, hasSavedPremiumVoice: boolean): OracleSpeechMode {
  if (saved === "device" || saved === "premium") return saved;
  // Premium is the default sound; members without funds fall back to device
  // speech at playback time, so nobody is left unheard.
  return "premium";
}

export async function routeOracleSpeech(mode: OracleSpeechMode, device: () => Promise<void>, premium: () => Promise<void>) {
  if (mode === "device") await device();
  else await premium();
}

export function finishedArtifact(input: OracleArtifact & { state: "complete" | "failed" | "queued"; fallback?: boolean }): OracleArtifact | null {
  if (input.state !== "complete" || input.fallback || !(input.url || input.body || input.libraryId)) return null;
  const { state, fallback, ...artifact } = input;
  return artifact;
}

export function artifactAnnouncement(artifact: OracleArtifact) {
  const start = artifact.reused ? `I found your existing ${artifact.kind}.` : `Your ${artifact.kind} is finished.`;
  return `${start}${artifact.libraryId ? " It is saved in your Library." : " The Library save is not confirmed."} Would you like to see it?`;
}