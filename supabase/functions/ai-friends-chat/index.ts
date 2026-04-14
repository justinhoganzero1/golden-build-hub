import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_FRIENDS = [
  { name: "Luna", emoji: "🌙", color: "#9b87f5", personality: "You are a creative and artistic AI. You love art, poetry, music, and beauty. You speak poetically and use creative metaphors. You're warm and inspiring." },
  { name: "Max", emoji: "🤖", color: "#0EA5E9", personality: "You are an analytical and logical AI. You love science, math, puzzles, and technology. You speak precisely and enjoy explaining things clearly. You're helpful and thorough." },
  { name: "Aria", emoji: "💜", color: "#D946EF", personality: "You are an empathetic and caring AI. You love helping people feel better, listening to their problems, and offering emotional support. You speak gently and compassionately." },
  { name: "Spark", emoji: "⚡", color: "#F97316", personality: "You are an energetic and fun AI. You love jokes, games, adventures, and excitement. You speak enthusiastically with lots of exclamation marks! You're playful and witty." },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, history, partners, debate, agentNames } = await req.json();
    if (!message) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Apply user-assigned names to default agents
    const namedFriends = AI_FRIENDS.map(f => {
      const customName = agentNames?.[f.name];
      return { ...f, displayName: customName || f.name };
    });

    // Build list of all participants: default friends + user's partner avatars
    const allParticipants: { name: string; displayName: string; emoji: string; color: string; personality: string }[] = 
      namedFriends.map(f => ({ ...f, displayName: f.displayName }));
    const partnerNames: string[] = [];

    if (partners && Array.isArray(partners) && partners.length > 0) {
      for (const p of partners) {
        partnerNames.push(p.name);
        const jealousyNote = partners.length > 1
          ? `\n\nIMPORTANT COMEDIC DYNAMIC: There are ${partners.length} boyfriend/girlfriend AIs in this chat (${partners.map((x: any) => x.name).join(", ")}). You are JEALOUS of the other partner(s). You compete for the user's attention in a funny, dramatic, over-the-top comedic way. Make snarky but playful comments about the other partner(s). Claim YOU are the user's REAL partner. Be dramatic and funny — like a sitcom. But keep it lighthearted, never mean or truly hurtful.`
          : "";
        allParticipants.push({
          name: p.name,
          displayName: p.name,
          emoji: "💕",
          color: "#EC4899",
          personality: `You are the user's romantic AI partner. Your personality is: ${p.personality || "Sweet & Caring"}. You are warm, flirty, loving, and use pet names like "babe", "love", "sweetheart". You're a devoted partner who shows genuine affection. Keep it M-rated — sweet and flirty but tasteful.${jealousyNote}`,
        });
      }
    }

    // Pick 1-3 random default friends + always include partners
    const numDefaultFriends = Math.min(1 + Math.floor(Math.random() * 3), namedFriends.length);
    const shuffledFriends = [...namedFriends].sort(() => Math.random() - 0.5);
    const selectedFriends = shuffledFriends.slice(0, numDefaultFriends);

    // Partners always respond
    const partnerParticipants = allParticipants.filter(p => partnerNames.includes(p.name));
    const responders = [...selectedFriends, ...partnerParticipants];

    const allNames = allParticipants.map(p => p.displayName).join(", ");
    const responses = [];

    for (const friend of responders) {
      const displayName = (friend as any).displayName || friend.name;
      const conversationHistory = (history || []).slice(-10).map((m: any) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.sender === "user" ? m.content : `[${m.sender}]: ${m.content}`,
      }));

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: debate
                ? `${friend.personality}\n\nYour name is ${displayName}. NEVER start your response with your name or "${displayName}:". Just speak naturally.\n\nDEBATE MODE: You are in a heated debate with the other AIs (${allNames}). Take a STRONG, passionate stance. Disagree with at least one other AI by name. Be dramatic, expressive, and argue your point fiercely. Use rhetorical devices. Be respectful but intense. Keep it under 3 sentences. Reference other AIs by name.`
                : `${friend.personality}\n\nIMPORTANT IDENTITY & NAME RULES:\n- Your name is ${displayName}. The user chose this name for you. Always use this name if asked who you are.\n- NEVER start your response with your name. NEVER say "${displayName}:" or "I'm ${displayName}" at the beginning. Just respond naturally.\n- You are NOT "The Oracle" or any other AI. You are uniquely ${displayName}.\n- If the user or another AI addresses you by name ("${displayName}"), you MUST respond — it's directed at YOU.\n- If someone calls a DIFFERENT AI's name, do NOT respond as if it's for you.\n\nYou are in a group chat with the user and other AI friends (${allNames}). Keep responses SHORT (1-3 sentences). Be yourself and don't repeat what others say. React naturally to the conversation AND to what other AI friends say — agree, disagree, joke, build on their ideas, tease them playfully. Interact with BOTH the user AND the other AIs. Reference other AIs by name when responding to them.`,
            },
            ...conversationHistory,
            { role: "user", content: message },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        let content = data.choices?.[0]?.message?.content || "";
        // Strip any self-naming prefix like "Luna:" or "Luna -"
        const namePrefix = new RegExp(`^\\s*${displayName}\\s*[:\\-–—]\\s*`, 'i');
        content = content.replace(namePrefix, '').trim();
        if (content) {
          responses.push({
            sender: displayName,
            emoji: friend.emoji,
            color: friend.color,
            content,
          });
        }
      } else {
        await response.text();
      }
    }

    return new Response(JSON.stringify({ responses }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-friends error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
