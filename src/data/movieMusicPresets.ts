// Curated catalogue of 100 instrumental music presets inspired by *current* trending
// genres on Spotify/Apple/TikTok charts (2025-2026). These are PROMPTS sent to
// ElevenLabs Music — every preset enforces "instrumental only, NO vocals, NO singing,
// NO lyrics, NO vocal stems". We cannot legally stream actual copyrighted top-100
// tracks, but we CAN generate fresh AI tracks in the same vibe.

export interface MusicPreset {
  id: string;
  name: string;
  genre: string;
  mood: string;
  prompt: string; // sent to elevenlabs-music
}

// Helper to enforce instrumental-only on every preset
const INSTRUMENTAL_GUARD =
  "Strictly instrumental backing track. NO vocals, NO singing, NO lyrics, NO vocal samples, NO chants, NO 'oohs' or 'aahs', no human voice of any kind.";

const make = (id: string, name: string, genre: string, mood: string, vibe: string): MusicPreset => ({
  id,
  name,
  genre,
  mood,
  prompt: `${vibe}. ${INSTRUMENTAL_GUARD}`,
});

export const MUSIC_PRESETS: MusicPreset[] = [
  // --- Afrobeats / Amapiano (Rema, Tems, Tyla, Asake style) ---
  make("afro-1", "Lagos Sunset", "Afrobeats", "Warm", "Modern Afrobeats instrumental, log drums, melodic shaker, sub bass, smooth marimba lead, 102 BPM"),
  make("afro-2", "Amapiano Groove", "Amapiano", "Hypnotic", "South-African Amapiano backing track, deep log drum, soft piano stabs, airy pads, 115 BPM"),
  make("afro-3", "Calm Down Riddim", "Afrobeats", "Romantic", "Mellow Afro-pop instrumental, plucked guitar, soft kick, light percussion, dreamy"),
  make("afro-4", "Asake Street", "Afro-Fusion", "Energetic", "Afro-fusion drums, fuji-inspired percussion, bright synth lead, anthemic"),

  // --- Phonk / Drift (TikTok viral) ---
  make("phonk-1", "Midnight Drift", "Phonk", "Dark", "Drift phonk instrumental, distorted 808 cowbell, lo-fi memphis sample chops, heavy bass, 140 BPM"),
  make("phonk-2", "Tokyo Nights", "Phonk", "Aggressive", "Aggressive Brazilian phonk, hard cowbell, distorted bass slide, anime drift energy"),
  make("phonk-3", "Slowed & Reverb", "Phonk", "Hazy", "Slowed phonk underscore, deep reverb, dusty drums, melancholic memphis vibe"),

  // --- Drill (NY / UK drill, Central Cee, Ice Spice style) ---
  make("drill-1", "Bronx Drill", "Drill", "Hard", "NY drill instrumental, sliding 808s, dark piano melody, sliced hi-hats, 145 BPM"),
  make("drill-2", "London Drill", "UK Drill", "Cold", "UK drill backing track, sliding bass, eerie bell lead, tight snare, 142 BPM"),
  make("drill-3", "Jersey Club Bounce", "Jersey Club", "Bouncy", "Jersey club instrumental, bed-squeak kick pattern, staccato chops, 135 BPM"),

  // --- Hyperpop / PluggnB ---
  make("hyper-1", "Glitch Heartbreak", "Hyperpop", "Euphoric", "Hyperpop instrumental, pitched-up synth bells, distorted 808, fast hats, sparkly"),
  make("hyper-2", "PluggnB Dream", "PluggnB", "Floaty", "PluggnB beat, plucked synths, dreamy chords, 808 glide, 130 BPM, ethereal"),

  // --- Lo-Fi / Chillhop ---
  make("lofi-1", "Study Hall", "Lo-Fi", "Calm", "Lo-fi hip-hop instrumental, dusty drums, jazzy piano chords, vinyl crackle, mellow"),
  make("lofi-2", "Rainy Tokyo", "Lo-Fi", "Melancholic", "Lo-fi beat with rain ambience, soft Rhodes piano, muted trumpet, slow swing"),
  make("lofi-3", "Coffee Shop", "Chillhop", "Cozy", "Chillhop instrumental, warm bass, brushed snares, mellow guitar, café ambience"),

  // --- Synthwave / Retrowave ---
  make("synth-1", "Neon Highway", "Synthwave", "Nostalgic", "1980s synthwave instrumental, gated reverb drums, analog bass, neon lead, 110 BPM"),
  make("synth-2", "Outrun", "Retrowave", "Driving", "Retrowave driving instrumental, arpeggiated synth, punchy linn drums, sunset vibe"),
  make("synth-3", "Vaporwave Mall", "Vaporwave", "Dreamy", "Vaporwave instrumental, slowed jazz chords, glassy pads, slowed drums, surreal"),

  // --- Cinematic Score ---
  make("cine-1", "Hero's Rise", "Cinematic", "Heroic", "Epic orchestral score, soaring strings, taiko drums, brass swells, triumphant"),
  make("cine-2", "Final Battle", "Cinematic", "Intense", "Hans Zimmer-style action score, ostinato strings, big brass, war drums, urgent"),
  make("cine-3", "Quiet Tears", "Cinematic", "Sad", "Emotional film score, solo piano, sustained strings, melancholic, tear-jerking"),
  make("cine-4", "First Light", "Cinematic", "Hopeful", "Hopeful orchestral underscore, warm strings, soft piano, gentle brass, sunrise"),
  make("cine-5", "Cold Suspense", "Cinematic", "Tense", "Tense thriller score, low drone, plucked strings, ticking percussion, ominous"),
  make("cine-6", "Trailer Hit", "Trailer", "Epic", "Hollywood trailer instrumental, big braams, riser, hit-stab, percussion build"),

  // --- House / Deep House / Tech ---
  make("house-1", "Sunset Beach Club", "Deep House", "Smooth", "Deep house instrumental, smooth Rhodes, four-on-the-floor kick, warm bass, 122 BPM"),
  make("house-2", "Ibiza 5AM", "Tech House", "Driving", "Tech house instrumental, percussive groove, rolling bassline, bright stab, 126 BPM"),
  make("house-3", "Melodic Techno", "Melodic Techno", "Hypnotic", "Anjunadeep-style melodic techno, hypnotic arp, deep kick, atmospheric pads"),
  make("house-4", "Afro House", "Afro House", "Tribal", "Afro house instrumental, tribal percussion, marimba lead, deep kick, 124 BPM"),

  // --- Trap / Hip-Hop ---
  make("trap-1", "Trap Boss", "Trap", "Hard", "Modern trap instrumental, 808 slides, dark piano, triplet hats, 140 BPM"),
  make("trap-2", "Lavish Trap", "Trap", "Flexy", "Luxury trap beat, flute lead, glossy 808, snappy snare, flexing energy"),
  make("trap-3", "Memphis Soul", "Trap Soul", "Smooth", "Trap soul instrumental, soulful chops, smooth 808, slow hats, romantic"),
  make("trap-4", "Boom Bap Throwback", "Boom Bap", "Classic", "90s boom bap instrumental, jazzy sample, dusty drums, vinyl scratches"),

  // --- R&B / Soul ---
  make("rnb-1", "Velvet Night", "R&B", "Sensual", "Modern R&B instrumental, smooth Rhodes, soft kick, late-night vibe, 80 BPM"),
  make("rnb-2", "Neo-Soul Groove", "Neo-Soul", "Warm", "Neo-soul instrumental, live drums, jazz chords, warm bass, organic"),
  make("rnb-3", "Slow Jam", "R&B", "Romantic", "Slow R&B groove, lush pads, finger-snap percussion, romantic Rhodes"),

  // --- Pop / Dance Pop ---
  make("pop-1", "Stadium Pop", "Pop", "Anthemic", "Stadium pop instrumental, big drums, pluck synth, anthemic chord progression"),
  make("pop-2", "Dance Pop Anthem", "Dance Pop", "Energetic", "Modern dance-pop instrumental, four-on-floor kick, sidechained synths, 124 BPM"),
  make("pop-3", "Indie Pop Sun", "Indie Pop", "Bright", "Indie pop instrumental, bright guitar, tight drums, claps, summery"),
  make("pop-4", "Bedroom Pop", "Bedroom Pop", "Dreamy", "Lo-fi bedroom pop instrumental, reverbed guitar, soft drums, hazy"),

  // --- Country / Americana ---
  make("country-1", "Modern Country", "Country", "Driving", "Modern country instrumental, acoustic guitar, banjo, kick drum, road-trip energy"),
  make("country-2", "Western Sunset", "Country", "Cinematic", "Cinematic Americana, slide guitar, soft strings, cowboy nostalgia"),

  // --- Rock / Metal ---
  make("rock-1", "Stadium Rock", "Rock", "Powerful", "Anthemic rock instrumental, distorted guitars, big drums, soaring lead"),
  make("rock-2", "Indie Rock", "Indie Rock", "Driving", "Indie rock instrumental, jangly guitar, driving drums, bass groove"),
  make("rock-3", "Metal Onslaught", "Metal", "Aggressive", "Heavy metal instrumental, palm-muted riffs, double-kick drums, blistering"),
  make("rock-4", "Punk Energy", "Punk", "Fast", "Pop-punk instrumental, fast power chords, snappy drums, energetic"),

  // --- Jazz / Lounge ---
  make("jazz-1", "Smoky Lounge", "Jazz", "Smooth", "Smooth jazz instrumental, walking bass, brushed drums, smoky sax-feel piano lead"),
  make("jazz-2", "Bossa Nova Café", "Bossa Nova", "Relaxed", "Bossa nova instrumental, nylon guitar, soft brushed percussion, warm"),
  make("jazz-3", "Swing Big Band", "Swing", "Lively", "Big band swing instrumental, brass section, walking bass, energetic"),

  // --- Classical ---
  make("class-1", "Baroque Strings", "Classical", "Elegant", "Baroque-style chamber strings, harpsichord, elegant counterpoint"),
  make("class-2", "Romantic Piano", "Classical", "Emotional", "Romantic-era solo piano, expressive dynamics, sweeping melody"),
  make("class-3", "Modern Minimalism", "Minimalist", "Hypnotic", "Minimalist piano + strings, repeating motifs, Philip Glass style"),

  // --- World ---
  make("world-1", "Bollywood Dance", "Bollywood", "Festive", "Bollywood instrumental, dhol drums, bansuri flute, festive strings"),
  make("world-2", "Latin Reggaeton", "Reggaeton", "Bouncy", "Reggaeton instrumental, dembow rhythm, plucked synth, Latin percussion, 95 BPM"),
  make("world-3", "K-Pop Dance", "K-Pop", "Energetic", "K-pop instrumental, glossy synths, hard-hitting drums, addictive hook"),
  make("world-4", "J-Pop Anime", "J-Pop", "Bright", "Anime-style J-pop instrumental, bright pluck synth, energetic drums, uplifting"),
  make("world-5", "Celtic Journey", "Celtic", "Adventurous", "Celtic instrumental, fiddle, bodhrán drum, tin whistle, journey vibe"),
  make("world-6", "Middle Eastern Bazaar", "Arabic", "Mystical", "Middle-Eastern instrumental, oud, darbuka, ney flute, mystical bazaar"),
  make("world-7", "Reggae Sunshine", "Reggae", "Chill", "Classic reggae instrumental, off-beat skank guitar, deep bass, easy groove"),
  make("world-8", "Flamenco Fire", "Flamenco", "Passionate", "Flamenco instrumental, fast nylon guitar, palmas claps, passionate"),

  // --- EDM / Festival ---
  make("edm-1", "Big Room Drop", "EDM", "Massive", "Big room EDM instrumental, festival lead, huge kick, white-noise riser, drop"),
  make("edm-2", "Future Bass", "Future Bass", "Euphoric", "Future bass instrumental, supersaw chords, snappy snare, euphoric drop"),
  make("edm-3", "Dubstep Drop", "Dubstep", "Heavy", "Heavy dubstep instrumental, wobble bass, 140 BPM half-time, brutal drop"),
  make("edm-4", "Trance Uplift", "Trance", "Uplifting", "Uplifting trance instrumental, plucked arp, supersaw lead, 138 BPM"),
  make("edm-5", "Drum & Bass", "DnB", "Fast", "Liquid drum & bass instrumental, rolling breakbeat, lush pads, 174 BPM"),

  // --- Ambient / New Age ---
  make("amb-1", "Deep Space", "Ambient", "Vast", "Ambient space instrumental, vast pads, distant drones, no rhythm"),
  make("amb-2", "Forest Meditation", "Ambient", "Peaceful", "Meditative ambient, soft pads, nature ambience, healing tones"),
  make("amb-3", "Glacier", "Ambient", "Cold", "Cold ambient instrumental, frozen drones, sparse piano, icy"),
  make("amb-4", "Ocean Drift", "Ambient", "Floating", "Ocean ambient, gentle wave layers, sustained pads, dreamy"),

  // --- Game / 8-bit ---
  make("game-1", "Retro Adventure", "Chiptune", "Adventurous", "8-bit chiptune instrumental, square-wave melody, retro bleeps, NES-style"),
  make("game-2", "Boss Battle", "Game", "Intense", "Video game boss battle instrumental, driving synths, urgent percussion"),
  make("game-3", "RPG Town", "Game", "Cozy", "Cozy JRPG town theme, gentle flute, plucked strings, peaceful"),

  // --- Horror / Tension ---
  make("horror-1", "Whispers in the Dark", "Horror", "Scary", "Horror score, dissonant strings, creaking textures, sudden stings"),
  make("horror-2", "Slasher Synth", "Horror", "Eerie", "John Carpenter-style synth horror, pulsing bass arp, eerie pad"),
  make("horror-3", "Jump Scare", "Horror", "Terrifying", "Tense horror underscore building to sudden orchestral hit"),

  // --- Documentary / Corporate ---
  make("doc-1", "Inspiring Corporate", "Corporate", "Uplifting", "Inspiring corporate instrumental, plucked piano, soft strings, motivational"),
  make("doc-2", "Tech Innovation", "Corporate", "Modern", "Modern tech instrumental, pulsing synths, clean drums, innovative"),
  make("doc-3", "Nature Documentary", "Documentary", "Majestic", "Majestic nature documentary score, sweeping strings, French horn, wonder"),
  make("doc-4", "News Bed", "News", "Neutral", "Neutral news bed instrumental, subtle pulse, light strings, broadcast-ready"),

  // --- Kids / Comedy ---
  make("kids-1", "Playful Day", "Kids", "Happy", "Playful kids instrumental, ukulele, whistling, hand claps, cheerful"),
  make("kids-2", "Sneaky Cartoon", "Comedy", "Funny", "Sneaky cartoon instrumental, pizzicato strings, bassoon, comedic"),
  make("kids-3", "Silly Bounce", "Comedy", "Quirky", "Quirky comedic instrumental, slide whistle, tuba, marimba, funny"),

  // --- Hip-Hop subgenres trending ---
  make("hip-1", "Detroit Bounce", "Detroit Rap", "Bouncy", "Detroit-style instrumental, glossy synth, bouncy 808, fast hats"),
  make("hip-2", "Atlanta Trap", "Trap", "Bouncy", "Atlanta trap instrumental, snappy snare, glossy synth, slick 808"),
  make("hip-3", "Memphis Underground", "Memphis Rap", "Dark", "Underground Memphis rap instrumental, dusty drums, dark sample"),

  // --- Indie / Folk ---
  make("indie-1", "Folk Campfire", "Folk", "Warm", "Acoustic folk instrumental, fingerpicked guitar, soft strings, campfire warmth"),
  make("indie-2", "Indie Acoustic", "Indie", "Wistful", "Wistful indie acoustic, gentle guitar, soft brushed drums, wistful"),

  // --- Sport / Action ---
  make("sport-1", "Workout Pump", "Sport", "Pumping", "High-energy workout instrumental, hard kick, motivating synths, 128 BPM"),
  make("sport-2", "Highlight Reel", "Sport", "Triumphant", "Sports highlight instrumental, big drums, anthemic synth, victorious"),

  // --- Meditation / Healing ---
  make("med-1", "Crystal Bowls", "Healing", "Healing", "Crystal singing bowl meditation, sustained tones, healing frequencies"),
  make("med-2", "Tibetan Monastery", "Healing", "Sacred", "Tibetan instrumental, singing bowls, low drone, sacred ambience"),
  make("med-3", "Yoga Flow", "Yoga", "Calm", "Yoga flow instrumental, gentle tabla, soft flute, peaceful"),

  // --- Holiday / Special ---
  make("holiday-1", "Christmas Magic", "Holiday", "Festive", "Festive Christmas instrumental, sleigh bells, orchestra, magical"),
  make("holiday-2", "Halloween Spooky", "Holiday", "Spooky", "Spooky Halloween instrumental, organ, eerie strings, theremin"),
  make("holiday-3", "Wedding Romance", "Wedding", "Romantic", "Romantic wedding instrumental, warm strings, soft piano, heartfelt"),
  make("holiday-4", "Birthday Party", "Party", "Celebratory", "Upbeat birthday party instrumental, claps, kazoo, festive"),

  // --- Misc trending vibes ---
  make("misc-1", "Sad Girl Aesthetic", "Indie Pop", "Melancholic", "Sad girl aesthetic instrumental, reverbed guitar, soft drums, melancholy"),
  make("misc-2", "Y2K Throwback", "Pop", "Nostalgic", "Y2K throwback pop instrumental, glossy synths, tight drums, nostalgic"),
  make("misc-3", "Dark Academia", "Classical", "Mysterious", "Dark academia instrumental, solo cello, candlelit piano, mysterious"),
  make("misc-4", "Cottagecore", "Folk", "Pastoral", "Cottagecore instrumental, harp, flute, gentle strings, pastoral"),
  make("misc-5", "Cyberpunk Night", "Synthwave", "Dystopian", "Cyberpunk instrumental, dark synth bass, neon arps, rain ambience"),
  make("misc-6", "Spaghetti Western", "Western", "Cinematic", "Ennio Morricone-style western, twangy guitar, whistle melody, harmonica"),
  make("misc-7", "French Café", "Jazz", "Charming", "French café instrumental, accordion, walking bass, gypsy guitar"),
  make("misc-8", "Beach Surf", "Surf Rock", "Sunny", "Surf rock instrumental, twangy reverb guitar, snappy drums, sunny"),
];

// Sanity: keep at 100
export const MUSIC_PRESETS_TOP_100 = MUSIC_PRESETS.slice(0, 100);
