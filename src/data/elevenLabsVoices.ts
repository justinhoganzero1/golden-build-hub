// Curated, verified ElevenLabs premade voices that work on any account.
export interface CuratedVoice {
  id: string;
  name: string;
  gender: "Male" | "Female" | "Neutral";
  accent: string;
  age: string;
  description: string;
  use_case: string;
}

export const CURATED_ELEVENLABS_VOICES: CuratedVoice[] = [
  { id: "9BWtsMINqrJLrRacOk9x", name: "Aria", gender: "Female", accent: "American", age: "Middle-aged", description: "Expressive, warm", use_case: "Social media" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger", gender: "Male", accent: "American", age: "Middle-aged", description: "Confident, classy", use_case: "Narration" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "Female", accent: "American", age: "Young", description: "Soft, gentle", use_case: "Conversational" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", gender: "Female", accent: "American", age: "Young", description: "Sunny, upbeat", use_case: "Social media" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", gender: "Male", accent: "Australian", age: "Middle-aged", description: "Casual, friendly", use_case: "Conversational" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", gender: "Male", accent: "British", age: "Middle-aged", description: "Warm, mature", use_case: "Narration" },
  { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum", gender: "Male", accent: "Transatlantic", age: "Middle-aged", description: "Intense, deep", use_case: "Characters" },
  { id: "SAz9YHcvj6GT2YYXdXww", name: "River", gender: "Neutral", accent: "American", age: "Middle-aged", description: "Calm, androgynous", use_case: "Conversational" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", gender: "Male", accent: "American", age: "Young", description: "Articulate, neutral", use_case: "Narration" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", gender: "Female", accent: "British", age: "Middle-aged", description: "Clear, professional", use_case: "News" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", gender: "Female", accent: "American", age: "Middle-aged", description: "Friendly, warm", use_case: "Audiobooks" },
  { id: "bIHbv24MWmeRgasZH58o", name: "Will", gender: "Male", accent: "American", age: "Young", description: "Friendly, chill", use_case: "Social media" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", gender: "Female", accent: "American", age: "Young", description: "Popular, expressive", use_case: "Conversational" },
  { id: "cjVigY5qzO86Huf0OWal", name: "Eric", gender: "Male", accent: "American", age: "Middle-aged", description: "Smooth, mature", use_case: "Narration" },
  { id: "iP95p4xoKVk53GoZ742B", name: "Chris", gender: "Male", accent: "American", age: "Middle-aged", description: "Casual, natural", use_case: "Conversational" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", gender: "Male", accent: "American", age: "Middle-aged", description: "Resonant, warm", use_case: "Narration" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", gender: "Male", accent: "British", age: "Middle-aged", description: "Authoritative, deep", use_case: "News" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", gender: "Female", accent: "British", age: "Middle-aged", description: "Warm, gentle", use_case: "Narration" },
  { id: "pqHfZKP75CvOlQylNhV4", name: "Bill", gender: "Male", accent: "American", age: "Old", description: "Trustworthy, deep", use_case: "Documentary" },
  // Extra characters
  { id: "MDLAMJ0jxkpYkjXbmG4t", name: "Santa", gender: "Male", accent: "American", age: "Old", description: "Jolly, festive", use_case: "Characters" },
  { id: "SAhdygBsjizE9aIj39dz", name: "Mrs Claus", gender: "Female", accent: "American", age: "Old", description: "Warm, festive", use_case: "Characters" },
  { id: "h6u4tPKmcPlxUdZOaVpH", name: "The Reindeer", gender: "Neutral", accent: "American", age: "Middle-aged", description: "Playful, magical", use_case: "Characters" },
  { id: "e79twtVS2278lVZZQiAD", name: "The Elf", gender: "Neutral", accent: "American", age: "Young", description: "Cheerful, mischievous", use_case: "Characters" },
  { id: "kPtEHAvRnjUJFv7SK9WI", name: "Glitch", gender: "Neutral", accent: "American", age: "Young", description: "Robotic, edgy", use_case: "Characters" },
];

export type PresetName = "Narration" | "Conversational" | "Announcement" | "Character";

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  speed: number;
  model_id: string;
}

export const DEFAULT_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.35,
  use_speaker_boost: true,
  speed: 1.0,
  model_id: "eleven_turbo_v2_5",
};

export const PRESETS: Record<PresetName, Partial<VoiceSettings>> = {
  Narration: { stability: 0.6, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true, speed: 0.95 },
  Conversational: { stability: 0.4, similarity_boost: 0.7, style: 0.45, use_speaker_boost: true, speed: 1.0 },
  Announcement: { stability: 0.85, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true, speed: 1.0 },
  Character: { stability: 0.3, similarity_boost: 0.7, style: 0.7, use_speaker_boost: true, speed: 1.05 },
};

export const MODELS = [
  { id: "eleven_multilingual_v2", label: "Multilingual v2 (highest quality, 29 langs)" },
  { id: "eleven_turbo_v2_5", label: "Turbo v2.5 (fast, low latency)" },
  { id: "eleven_turbo_v2", label: "Turbo v2 (fastest)" },
  { id: "eleven_monolingual_v1", label: "Monolingual v1 (English, legacy)" },
];
