// App Builder start-up questions: Oracle asks who the app is for, then a few
// tailored questions, and turns the answers into one clear build request.
export type BuildPurpose = "personal" | "sell";

export interface IntakeQuestion {
  id: string;
  question: string;
  kind: "text" | "single" | "multi";
  options?: string[];
  placeholder?: string;
  required?: boolean;
}

export const INTAKE_QUESTIONS: Record<BuildPurpose, IntakeQuestion[]> = {
  personal: [
    { id: "goal", question: "What should your app help you do?", kind: "text", required: true, placeholder: "e.g. track my workouts and meals" },
    { id: "who", question: "Who will use it?", kind: "single", options: ["Just me", "My family", "My team or club"] },
    { id: "where", question: "Where will you use it most?", kind: "single", options: ["Phone", "Computer", "Both"] },
    { id: "musts", question: "Any must-haves?", kind: "multi", options: ["Works offline", "Reminders", "Private — stays on my device", "Charts & progress", "Photos", "Lists & notes", "Calendar"] },
  ],
  sell: [
    { id: "goal", question: "What problem does your app solve?", kind: "text", required: true, placeholder: "e.g. lets dog walkers take bookings" },
    { id: "customers", question: "Who are your customers?", kind: "text", placeholder: "e.g. busy pet owners in my area" },
    { id: "pricing", question: "How do you want to charge?", kind: "single", options: ["Free to download", "One-off price", "Monthly subscription", "Free + paid upgrades"] },
    { id: "where", question: "Where will you sell it?", kind: "multi", options: ["Oracle Lunar Creators Shop", "Google Play", "My own website"] },
  ],
};

export type IntakeAnswers = Record<string, string | string[]>;

/** Turns the answers into one plain build request the builder can follow exactly. */
export function composeIntakePrompt(purpose: BuildPurpose, answers: IntakeAnswers): string {
  const get = (id: string) => {
    const v = answers[id];
    const s = Array.isArray(v) ? v.filter(Boolean).join(", ") : String(v || "");
    return s.replace(/\s+/g, " ").trim().slice(0, 600);
  };
  const lines: string[] = [];
  if (purpose === "personal") {
    lines.push(`Build me an app for my own use. It should help me: ${get("goal") || "organise my day"}.`);
    if (get("who")) lines.push(`Who uses it: ${get("who")}.`);
    if (get("where")) lines.push(`Mostly used on: ${get("where")}.`);
    if (get("musts")) lines.push(`Must-haves: ${get("musts")}.`);
    lines.push("No prices, paywalls, adverts or store listing — it's just for me.");
  } else {
    lines.push(`Build me an app to sell. The problem it solves: ${get("goal") || "a common everyday problem"}.`);
    if (get("customers")) lines.push(`My customers: ${get("customers")}.`);
    if (get("pricing")) lines.push(`How I'll charge: ${get("pricing")}.`);
    if (get("where")) lines.push(`Where I'll sell it: ${get("where")}.`);
  }
  if (get("extra")) lines.push(`Also: ${get("extra")}.`);
  return lines.join("\n");
}

export function intakeComplete(purpose: BuildPurpose, answers: IntakeAnswers): boolean {
  return INTAKE_QUESTIONS[purpose].every((q) => {
    if (!q.required) return true;
    const v = answers[q.id];
    return Array.isArray(v) ? v.length > 0 : String(v || "").trim().length >= 3;
  });
}
