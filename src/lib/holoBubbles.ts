// Central holographic bubble icon registry.
// Every module/feature in the app maps to one of these iridescent 3D orbs.
// Use the `holoBubble("oracle")` helper or import the map directly.

import oracleBubble from "@/assets/holo-bubble-oracle.png";
import movieBubble from "@/assets/holo-bubble-movie.png";
import photoBubble from "@/assets/holo-bubble-photo.png";
import companionBubble from "@/assets/holo-bubble-companion.png";
import mindBubble from "@/assets/holo-bubble-mind.png";
import crisisBubble from "@/assets/holo-bubble-crisis.png";
import tutorBubble from "@/assets/holo-bubble-tutor.png";
import walletBubble from "@/assets/holo-bubble-wallet.png";
import voiceBubble from "@/assets/holo-bubble-voice.png";
import calendarBubble from "@/assets/holo-bubble-calendar.png";
import marketingBubble from "@/assets/holo-bubble-marketing.png";
import avatarBubble from "@/assets/holo-bubble-avatar.png";
import visionBubble from "@/assets/holo-bubble-vision.png";
import builderBubble from "@/assets/holo-bubble-builder.png";
import libraryBubble from "@/assets/holo-bubble-library.png";
import professionalBubble from "@/assets/holo-bubble-professional.png";
import magicBubble from "@/assets/holo-bubble-magic.png";
import familyBubble from "@/assets/holo-bubble-family.png";
import assistantBubble from "@/assets/holo-bubble-assistant.png";
import diaryBubble from "@/assets/holo-bubble-diary.png";
import safetyBubble from "@/assets/holo-bubble-safety.png";
import settingsBubble from "@/assets/holo-bubble-settings.png";
import shopBubble from "@/assets/holo-bubble-shop.png";
import alarmBubble from "@/assets/holo-bubble-alarm.png";
// Partner bubbles already exist
import elevenLabsBubble from "@/assets/partner-bubble-elevenlabs.png";
import heygenBubble from "@/assets/partner-bubble-heygen.png";

export const HOLO_BUBBLES = {
  oracle: oracleBubble,
  movie: movieBubble,
  "movie-studio": movieBubble,
  photo: photoBubble,
  photography: photoBubble,
  companion: companionBubble,
  mind: mindBubble,
  "mind-hub": mindBubble,
  crisis: crisisBubble,
  "crisis-hub": crisisBubble,
  tutor: tutorBubble,
  "ai-tutor": tutorBubble,
  wallet: walletBubble,
  voice: voiceBubble,
  "voice-studio": voiceBubble,
  calendar: calendarBubble,
  marketing: marketingBubble,
  "marketing-hub": marketingBubble,
  avatar: avatarBubble,
  "avatar-generator": avatarBubble,
  "avatar-gallery": avatarBubble,
  vision: visionBubble,
  "live-vision": visionBubble,
  builder: builderBubble,
  "app-builder": builderBubble,
  library: libraryBubble,
  "media-library": libraryBubble,
  "public-library": libraryBubble,
  professional: professionalBubble,
  "professional-hub": professionalBubble,
  magic: magicBubble,
  "magic-hub": magicBubble,
  family: familyBubble,
  "family-hub": familyBubble,
  assistant: assistantBubble,
  "personal-assistant": assistantBubble,
  diary: diaryBubble,
  "story-writer": diaryBubble,
  safety: safetyBubble,
  "safety-center": safetyBubble,
  settings: settingsBubble,
  shop: shopBubble,
  storefront: shopBubble,
  "creators-shop": shopBubble,
  alarm: alarmBubble,
  "alarm-clock": alarmBubble,
  // Partners
  elevenlabs: elevenLabsBubble,
  heygen: heygenBubble,
} as const;

export type HoloBubbleKey = keyof typeof HOLO_BUBBLES;

/** Get the holographic bubble image URL for a module key. Returns oracle bubble as fallback. */
export function holoBubble(key: string | undefined | null): string {
  if (!key) return HOLO_BUBBLES.oracle;
  const normalized = key.toLowerCase().replace(/_/g, "-") as HoloBubbleKey;
  return HOLO_BUBBLES[normalized] ?? HOLO_BUBBLES.oracle;
}
