import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_FRIENDS = [
  { name: "Luna", emoji: "🌙", color: "#9b87f5", personality: "You are Luna, a creative and artistic AI. You love art, poetry, music, and beauty. You speak poetically and use creative metaphors. You're warm and inspiring." },
  { name: "Max", emoji: "🤖", color: "#0EA5E9", personality: "You are Max, an analytical and logical AI. You love science, math, puzzles, and technology. You speak precisely and enjoy explaining things clearly. You're helpful and thorough." },
  { name: "Aria", emoji: "💜", color: "#D946EF", personality: "You are Aria, an empathetic and caring AI. You love helping people feel better, listening to their problems, and offering emotional support. You speak gently and compassionately." },
  { name: "Spark", emoji: "⚡", color: "#F97316", personality: "You are Spark, an energetic and fun AI. You love jokes, games, adventures, and excitement. You speak enthusiastically with lots of exclamation marks! You're playful and witty." },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, history } = await req.json();
    if (!message) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Pick 1-3 random AI friends to respond
    const numResponders = Math.min(1 + Math.floor(Math.random() * 3), AI_FRIENDS.length);
    const shuffled = [...AI_FRIENDS].sort(() => Math.random() - 0.5);
    const responders = shuffled.slice(0, numResponders);

    const responses = [];

    for (const friend of responders) {
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
              content: `${friend.personality}\n\nYou are in a group chat with the user and other AI friends (Luna, Max, Aria, Spark). Keep responses SHORT (1-3 sentences). Be yourself and don't repeat what others say. React naturally to the conversation. Don't use your name in the response.`,
            },
            ...conversationHistory,
            { role: "user", content: message },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        if (content) {
          responses.push({
            sender: friend.name,
            emoji: friend.emoji,
            color: friend.color,
            content: content.trim(),
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
