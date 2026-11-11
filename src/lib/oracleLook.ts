// Oracle's look: the member chooses how she (or he) appears. Each new look is one
// wallet-paid picture edit of the canonical portrait, saved per account on this device.
export type LookGender = "woman" | "man" | "nonbinary";
export interface OracleLookChoice {
  gender: LookGender;
  heritage: string;
  hairColour: string;
  hairLength: string;
  eyeColour: string;
  age: string;
  orientation: string;
}
export interface OracleLook { url: string; choice: OracleLookChoice; libraryId?: string | null }

export const LOOK_OPTIONS = {
  gender: [
    { id: "woman", label: "Woman" },
    { id: "man", label: "Man" },
    { id: "nonbinary", label: "Non-binary" },
  ],
  heritage: ["Caucasian / European", "Aboriginal Australian", "Torres Strait Islander", "Pacific Islander", "Maori", "East Asian", "South Asian", "Southeast Asian", "African", "African American", "Middle Eastern", "Latino / Hispanic", "Mixed heritage"],
  hairColour: ["Black", "Dark brown", "Light brown", "Blonde", "Platinum blonde", "Red", "Auburn", "Grey", "Silver", "White"],
  hairLength: ["Shaved", "Very short", "Short", "Shoulder length", "Long", "Very long"],
  eyeColour: ["Brown", "Dark brown", "Hazel", "Green", "Blue", "Grey", "Amber"],
  age: ["Mid 20s", "30s", "40s", "50s", "60s", "70s"],
  orientation: ["Not set", "Straight", "Gay", "Lesbian", "Bisexual", "Pansexual", "Asexual"],
} as const;

export const DEFAULT_LOOK: OracleLookChoice = {
  gender: "woman", heritage: "Caucasian / European", hairColour: "Dark brown", hairLength: "Long", eyeColour: "Brown", age: "30s", orientation: "Not set",
};

const pick = (list: readonly string[], value: unknown, fallback: string) => typeof value === "string" && list.includes(value) ? value : fallback;

/** Keeps only known choices so nothing odd ever reaches the picture prompt. */
export function cleanLook(raw: Partial<OracleLookChoice> | null | undefined): OracleLookChoice {
  const r = raw || {};
  const gender = (["woman", "man", "nonbinary"] as const).includes(r.gender as LookGender) ? r.gender as LookGender : DEFAULT_LOOK.gender;
  return {
    gender,
    heritage: pick(LOOK_OPTIONS.heritage, r.heritage, DEFAULT_LOOK.heritage),
    hairColour: pick(LOOK_OPTIONS.hairColour, r.hairColour, DEFAULT_LOOK.hairColour),
    hairLength: pick(LOOK_OPTIONS.hairLength, r.hairLength, DEFAULT_LOOK.hairLength),
    eyeColour: pick(LOOK_OPTIONS.eyeColour, r.eyeColour, DEFAULT_LOOK.eyeColour),
    age: pick(LOOK_OPTIONS.age, r.age, DEFAULT_LOOK.age),
    orientation: pick(LOOK_OPTIONS.orientation, r.orientation, DEFAULT_LOOK.orientation),
  };
}

const PERSON: Record<LookGender, string> = { woman: "woman", man: "man", nonbinary: "androgynous non-binary person" };

/** Picture instruction: image 1 is her canonical portrait. Orientation is never drawn. */
export function lookPrompt(raw: OracleLookChoice) {
  const c = cleanLook(raw);
  const hair = c.hairLength === "Shaved" ? "a cleanly shaved head" : `${c.hairLength.toLowerCase()} ${c.hairColour.toLowerCase()} hair`;
  return `Edit the first image. Replace the person with a warm, friendly, kind-looking adult ${PERSON[c.gender]} in their ${c.age.replace(/^Mid /, "mid ")}, of ${c.heritage} heritage, with ${hair} and ${c.eyeColour.toLowerCase()} eyes. Gentle, caring smile, mouth closed, looking at the camera. Keep the same pose, framing, camera angle, lighting, smart professional outfit style and the futuristic office background exactly the same. Photorealistic, natural skin, respectful and dignified, fully clothed and suitable for all ages.`;
}

export function lookLabel(raw: OracleLookChoice) {
  const c = cleanLook(raw);
  const g = LOOK_OPTIONS.gender.find(x => x.id === c.gender)!.label;
  return `${g}, ${c.age}, ${c.heritage}, ${c.hairLength.toLowerCase()} ${c.hairLength === "Shaved" ? "head" : c.hairColour.toLowerCase() + " hair"}, ${c.eyeColour.toLowerCase()} eyes`;
}

/** Short note for the chat brain so she talks about herself to match the chosen look. */
export function lookPersona(look: OracleLook | null): string | null {
  if (!look) return null;
  const c = cleanLook(look.choice);
  const parts = [`appearance: ${lookLabel(c)}`, `pronouns: ${c.gender === "man" ? "he/him" : c.gender === "woman" ? "she/her" : "they/them"}`];
  if (c.orientation !== "Not set") parts.push(`persona orientation: ${c.orientation.toLowerCase()}`);
  return parts.join("; ");
}

const key = (userId: string) => `oracle-look:v1:${userId}`;

export function loadLook(userId: string | undefined): OracleLook | null {
  if (!userId) return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(key(userId)) || "null");
    return parsed && typeof parsed.url === "string" && parsed.url ? { ...parsed, choice: cleanLook(parsed.choice) } : null;
  } catch { return null; }
}

export function saveLook(userId: string, look: OracleLook | null) {
  try {
    if (!look) localStorage.removeItem(key(userId));
    else localStorage.setItem(key(userId), JSON.stringify(look));
    return true;
  } catch { return false; }
}
