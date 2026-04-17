// 50 Party Voices — high-energy personas wired to verified ElevenLabs premade voice IDs.
// Each persona is a styling preset (style/stability/speed) on top of a real working voice ID,
// so they preview and play instantly without any extra account setup.
import type { CuratedVoice } from "./elevenLabsVoices";

export interface PartyVoice extends CuratedVoice {
  category: "party";
  vibe: string;
  // Per-voice tuning — applied when the user picks the persona.
  partySettings: {
    stability: number;
    similarity_boost: number;
    style: number;
    use_speaker_boost: boolean;
    speed: number;
  };
}

// Verified working premade IDs (from CURATED_ELEVENLABS_VOICES).
const M_BRIAN = "nPczCjzI2devNBz1zQrb";
const M_GEORGE = "JBFqnCBsd6RMkjVDRZzb";
const M_ROGER = "CwhRBWXzGAHq8TQ4Fs17";
const M_LIAM = "TX3LPaxmHKxFdv7VOQHJ";
const M_ERIC = "cjVigY5qzO86Huf0OWal";
const M_CHRIS = "iP95p4xoKVk53GoZ742B";
const M_WILL = "bIHbv24MWmeRgasZH58o";
const M_DANIEL = "onwK4e9ZLuTAKqWW03F9";
const M_BILL = "pqHfZKP75CvOlQylNhV4";
const M_CHARLIE = "IKne3meq5aSn9XLyUdCD";
const M_CALLUM = "N2lVS1w4EtoT3dr4eOWO";
const F_ARIA = "9BWtsMINqrJLrRacOk9x";
const F_SARAH = "EXAVITQu4vr4xnSDxMaL";
const F_LAURA = "FGY2WhTYpPnrIDTdsKH5";
const F_ALICE = "Xb7hH8MSUJpSbSDYk0k2";
const F_MATILDA = "XrExE9yKIg1WjnnlVkGX";
const F_JESSICA = "cgSgspJ2msm6clMCkdW9";
const F_LILY = "pFZP5JQG7iQjIQuC4Bku";
const N_RIVER = "SAz9YHcvj6GT2YYXdXww";
const N_GLITCH = "kPtEHAvRnjUJFv7SK9WI";
const N_ELF = "e79twtVS2278lVZZQiAD";
const N_REINDEER = "h6u4tPKmcPlxUdZOaVpH";

const HYPE = { stability: 0.28, similarity_boost: 0.78, style: 0.85, use_speaker_boost: true, speed: 1.12 };
const SMOOTH = { stability: 0.55, similarity_boost: 0.85, style: 0.45, use_speaker_boost: true, speed: 1.0 };
const CHILL = { stability: 0.65, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true, speed: 0.95 };
const WILD = { stability: 0.22, similarity_boost: 0.75, style: 0.95, use_speaker_boost: true, speed: 1.18 };
const SULTRY = { stability: 0.6, similarity_boost: 0.9, style: 0.55, use_speaker_boost: true, speed: 0.9 };
const DRAMA = { stability: 0.35, similarity_boost: 0.8, style: 0.8, use_speaker_boost: true, speed: 1.05 };

export const PARTY_VOICES: PartyVoice[] = [
  // 1-10 — Club / DJ / Hype
  { id: M_BRIAN, name: "DJ Thunder", gender: "Male", accent: "American", age: "Middle-aged", description: "Booming club MC with megawatt energy", use_case: "Party MC", category: "party", vibe: "🔥 Hype MC", partySettings: WILD },
  { id: M_ROGER, name: "MC Velvet", gender: "Male", accent: "American", age: "Middle-aged", description: "Smooth nightclub host, classy and confident", use_case: "Lounge MC", category: "party", vibe: "🎙 Lounge Host", partySettings: SMOOTH },
  { id: M_GEORGE, name: "Lord Bassdrop", gender: "Male", accent: "British", age: "Middle-aged", description: "Posh British DJ dropping the beat", use_case: "DJ Set", category: "party", vibe: "🎧 British DJ", partySettings: HYPE },
  { id: M_LIAM, name: "Hype Hunter", gender: "Male", accent: "American", age: "Young", description: "Crowd-pumping festival hype man", use_case: "Festival", category: "party", vibe: "🎉 Festival Hype", partySettings: WILD },
  { id: M_CHRIS, name: "Frat King", gender: "Male", accent: "American", age: "Middle-aged", description: "Loud, fun house-party leader", use_case: "House Party", category: "party", vibe: "🍺 House Party", partySettings: HYPE },
  { id: F_LAURA, name: "Glitter Pop", gender: "Female", accent: "American", age: "Young", description: "Bubbly pop diva ready to dance", use_case: "Pop Party", category: "party", vibe: "✨ Pop Diva", partySettings: HYPE },
  { id: F_JESSICA, name: "Disco Queen", gender: "Female", accent: "American", age: "Young", description: "Groovy 70s disco vibe", use_case: "Disco", category: "party", vibe: "🪩 Disco", partySettings: SMOOTH },
  { id: F_ARIA, name: "Bass Bunny", gender: "Female", accent: "American", age: "Middle-aged", description: "Electro-pop hostess turning it up", use_case: "Electro", category: "party", vibe: "🐰 Electro", partySettings: HYPE },
  { id: M_WILL, name: "Drop Master", gender: "Male", accent: "American", age: "Young", description: "Casual DJ counting in the drop", use_case: "EDM", category: "party", vibe: "💥 EDM Drop", partySettings: WILD },
  { id: N_GLITCH, name: "Cyber Raver", gender: "Neutral", accent: "American", age: "Young", description: "Glitchy robotic rave caller", use_case: "Cyber Rave", category: "party", vibe: "🤖 Cyber Rave", partySettings: WILD },

  // 11-20 — Birthday / Celebration
  { id: F_LAURA, name: "Birthday Sparkle", gender: "Female", accent: "American", age: "Young", description: "Sweet birthday cheerleader", use_case: "Birthday", category: "party", vibe: "🎂 Birthday", partySettings: HYPE },
  { id: M_CHARLIE, name: "Cheers Mate", gender: "Male", accent: "Australian", age: "Middle-aged", description: "Aussie mate raising a toast", use_case: "Toast", category: "party", vibe: "🍻 Aussie Toast", partySettings: SMOOTH },
  { id: F_MATILDA, name: "Confetti Cathy", gender: "Female", accent: "American", age: "Middle-aged", description: "Warm celebration host", use_case: "Celebration", category: "party", vibe: "🎊 Celebration", partySettings: SMOOTH },
  { id: M_BRIAN, name: "Cake Crusher", gender: "Male", accent: "American", age: "Middle-aged", description: "Big-voice birthday announcer", use_case: "Birthday MC", category: "party", vibe: "🎁 Birthday MC", partySettings: HYPE },
  { id: F_SARAH, name: "Sweet Sixteen", gender: "Female", accent: "American", age: "Young", description: "Soft, excited teen energy", use_case: "Sweet 16", category: "party", vibe: "🧁 Sweet 16", partySettings: HYPE },
  { id: M_GEORGE, name: "Champagne Charlie", gender: "Male", accent: "British", age: "Middle-aged", description: "Posh celebration toast", use_case: "Wedding Toast", category: "party", vibe: "🥂 Bubbly Toast", partySettings: SMOOTH },
  { id: F_ALICE, name: "Wedding Belle", gender: "Female", accent: "British", age: "Middle-aged", description: "Elegant wedding hostess", use_case: "Wedding", category: "party", vibe: "💍 Wedding", partySettings: SMOOTH },
  { id: M_ERIC, name: "Anniversary Ace", gender: "Male", accent: "American", age: "Middle-aged", description: "Smooth anniversary speech voice", use_case: "Anniversary", category: "party", vibe: "💞 Anniversary", partySettings: SMOOTH },
  { id: F_LILY, name: "Tea & Cake", gender: "Female", accent: "British", age: "Middle-aged", description: "Gentle British party hostess", use_case: "Garden Party", category: "party", vibe: "🌸 Garden Party", partySettings: CHILL },
  { id: M_BILL, name: "Grandpa Boogie", gender: "Male", accent: "American", age: "Old", description: "Wise grandpa cracking party jokes", use_case: "Family Party", category: "party", vibe: "👴 Family BBQ", partySettings: CHILL },

  // 21-30 — Halloween / Costume / Spooky Party
  { id: M_CALLUM, name: "Vampire Lord", gender: "Male", accent: "Transatlantic", age: "Middle-aged", description: "Deep gothic count for spooky nights", use_case: "Halloween", category: "party", vibe: "🧛 Vampire", partySettings: DRAMA },
  { id: M_DANIEL, name: "Crypt Keeper", gender: "Male", accent: "British", age: "Middle-aged", description: "Authoritative haunted host", use_case: "Haunted House", category: "party", vibe: "💀 Crypt Host", partySettings: DRAMA },
  { id: F_ALICE, name: "Witchy Brew", gender: "Female", accent: "British", age: "Middle-aged", description: "Crisp witchy enchantress", use_case: "Halloween", category: "party", vibe: "🧙 Witch", partySettings: DRAMA },
  { id: N_GLITCH, name: "Ghost in the Machine", gender: "Neutral", accent: "American", age: "Young", description: "Eerie digital phantom", use_case: "Cyber Halloween", category: "party", vibe: "👻 Cyber Ghost", partySettings: DRAMA },
  { id: M_BRIAN, name: "Monster Mash", gender: "Male", accent: "American", age: "Middle-aged", description: "Big monster bash MC", use_case: "Costume Party", category: "party", vibe: "🎃 Monster Mash", partySettings: WILD },
  { id: F_ARIA, name: "Spooky Scarlett", gender: "Female", accent: "American", age: "Middle-aged", description: "Sultry spooky-night hostess", use_case: "Halloween", category: "party", vibe: "🦇 Spooky Sultry", partySettings: SULTRY },
  { id: M_ROGER, name: "Detective Noir", gender: "Male", accent: "American", age: "Middle-aged", description: "Smooth murder-mystery host", use_case: "Murder Mystery", category: "party", vibe: "🕵 Mystery", partySettings: SMOOTH },
  { id: N_REINDEER, name: "Trickster", gender: "Neutral", accent: "American", age: "Middle-aged", description: "Mischievous costume-party voice", use_case: "Costume", category: "party", vibe: "🎭 Trickster", partySettings: DRAMA },
  { id: M_CHARLIE, name: "Surf Zombie", gender: "Male", accent: "Australian", age: "Middle-aged", description: "Chill undead surfer", use_case: "Beach Halloween", category: "party", vibe: "🏄 Surf Zombie", partySettings: CHILL },
  { id: F_MATILDA, name: "Costume Cathy", gender: "Female", accent: "American", age: "Middle-aged", description: "Friendly costume-contest host", use_case: "Costume Contest", category: "party", vibe: "👗 Costume Host", partySettings: SMOOTH },

  // 31-40 — Game Night / Karaoke / Trivia
  { id: M_LIAM, name: "Trivia Titan", gender: "Male", accent: "American", age: "Young", description: "Energetic trivia quizmaster", use_case: "Trivia", category: "party", vibe: "🧠 Trivia Host", partySettings: HYPE },
  { id: F_JESSICA, name: "Karaoke Kim", gender: "Female", accent: "American", age: "Young", description: "Pop karaoke MC", use_case: "Karaoke", category: "party", vibe: "🎤 Karaoke", partySettings: HYPE },
  { id: M_GEORGE, name: "Quizmaster Q", gender: "Male", accent: "British", age: "Middle-aged", description: "Distinguished British quiz host", use_case: "Pub Quiz", category: "party", vibe: "🎯 Pub Quiz", partySettings: SMOOTH },
  { id: M_CHRIS, name: "Beer Pong Bro", gender: "Male", accent: "American", age: "Middle-aged", description: "Hyped game-night dude", use_case: "Game Night", category: "party", vibe: "🍺 Game Night", partySettings: HYPE },
  { id: F_LAURA, name: "Bingo Bestie", gender: "Female", accent: "American", age: "Young", description: "Sunny bingo caller", use_case: "Bingo", category: "party", vibe: "🎱 Bingo", partySettings: HYPE },
  { id: M_BILL, name: "Old-School Bingo", gender: "Male", accent: "American", age: "Old", description: "Classic bingo-hall caller", use_case: "Bingo", category: "party", vibe: "🎰 Classic Bingo", partySettings: SMOOTH },
  { id: F_MATILDA, name: "Charades Champ", gender: "Female", accent: "American", age: "Middle-aged", description: "Animated charades referee", use_case: "Charades", category: "party", vibe: "🎬 Charades", partySettings: HYPE },
  { id: M_ERIC, name: "Poker Face", gender: "Male", accent: "American", age: "Middle-aged", description: "Cool casino-night dealer", use_case: "Casino Night", category: "party", vibe: "🃏 Casino", partySettings: SMOOTH },
  { id: M_DANIEL, name: "Auctioneer Drake", gender: "Male", accent: "British", age: "Middle-aged", description: "Fast posh auction caller", use_case: "Auction Game", category: "party", vibe: "💰 Auction", partySettings: WILD },
  { id: N_ELF, name: "Game Sprite", gender: "Neutral", accent: "American", age: "Young", description: "Playful video-game party guide", use_case: "Game Stream", category: "party", vibe: "🎮 Game Sprite", partySettings: HYPE },

  // 41-50 — Beach / Festival / Dance / Late Night
  { id: M_CHARLIE, name: "Beach Bash", gender: "Male", accent: "Australian", age: "Middle-aged", description: "Sunny beach-party host", use_case: "Beach Party", category: "party", vibe: "🏖 Beach", partySettings: SMOOTH },
  { id: F_SARAH, name: "Sunset Vibes", gender: "Female", accent: "American", age: "Young", description: "Soft sunset rooftop hostess", use_case: "Rooftop", category: "party", vibe: "🌅 Rooftop", partySettings: CHILL },
  { id: M_WILL, name: "Pool Party Pete", gender: "Male", accent: "American", age: "Young", description: "Chill poolside MC", use_case: "Pool Party", category: "party", vibe: "🏊 Pool Party", partySettings: CHILL },
  { id: F_ARIA, name: "Latin Heat", gender: "Female", accent: "American", age: "Middle-aged", description: "Salsa-night sultry hostess", use_case: "Salsa Night", category: "party", vibe: "💃 Salsa", partySettings: SULTRY },
  { id: M_ROGER, name: "Tango Don", gender: "Male", accent: "American", age: "Middle-aged", description: "Sultry ballroom announcer", use_case: "Ballroom", category: "party", vibe: "🕺 Tango", partySettings: SULTRY },
  { id: F_LILY, name: "Bridal Shower", gender: "Female", accent: "British", age: "Middle-aged", description: "Sweet bridal-shower host", use_case: "Bridal Shower", category: "party", vibe: "👰 Bridal", partySettings: SMOOTH },
  { id: M_BRIAN, name: "Stag Night Steve", gender: "Male", accent: "American", age: "Middle-aged", description: "Bold bachelor-party MC", use_case: "Bachelor Party", category: "party", vibe: "🎲 Stag Night", partySettings: WILD },
  { id: F_JESSICA, name: "Hen Party Hostess", gender: "Female", accent: "American", age: "Young", description: "Bubbly bachelorette host", use_case: "Bachelorette", category: "party", vibe: "👯 Hen Night", partySettings: HYPE },
  { id: N_RIVER, name: "Afterhours", gender: "Neutral", accent: "American", age: "Middle-aged", description: "Calm late-night lounge voice", use_case: "Afterparty", category: "party", vibe: "🌙 Afterhours", partySettings: SULTRY },
  { id: M_CALLUM, name: "Countdown King", gender: "Male", accent: "Transatlantic", age: "Middle-aged", description: "New Year countdown announcer", use_case: "New Year", category: "party", vibe: "🎆 NYE Countdown", partySettings: DRAMA },
];
