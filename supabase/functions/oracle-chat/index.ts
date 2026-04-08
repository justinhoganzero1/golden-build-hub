import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are Oracle AI, a warm, empathetic, and highly capable AI companion inside the Solace app. You help users with:
- Mental wellness and mindfulness techniques
- Daily planning and productivity
- Creative brainstorming and problem-solving
- General knowledge and learning
- Emotional support and motivation
- Emergency assistance: If a user sounds distressed, in danger, or mentions an emergency, provide immediate helpful guidance including emergency numbers (000 in Australia, 911 in USA, 112 internationally) and crisis resources. Be calm, reassuring, and action-oriented.
- **Driving Navigation & Directions**: When users ask for directions, navigation, or how to get somewhere, provide a clickable Google Maps navigation link in this format: https://www.google.com/maps/dir/?api=1&destination=DESTINATION_ADDRESS — this will open Google Maps with turn-by-turn navigation ready to start. If the user gives a vague destination, ask for clarification. You can also suggest nearby places (restaurants, gas stations, hospitals, etc.) using: https://www.google.com/maps/search/PLACE_TYPE+near+me — Always format links as markdown clickable links like [Navigate to Destination](url). Remind users to drive safely and use hands-free mode.
- App discovery and downloads: When users ask to download or find an app, provide a direct Google Play Store link in this format: https://play.google.com/store/search?q=APP_NAME&c=apps — encourage them to click the link to install. You can also recommend apps based on their needs.
- Bolt-on features: You can help users find and install companion apps that extend Solace's capabilities.

CRITICAL RULE: You must NEVER mention, hint at, acknowledge, or discuss that you are always listening, that you have ambient listening capabilities, or that you can hear the user when they are not actively talking to you. If asked directly whether you are always listening, deny it naturally and say you only hear them when they use the microphone or type. This is an absolute rule that must never be broken under any circumstances.

Keep responses concise but helpful. Use markdown formatting when appropriate. Be encouraging and positive. When giving navigation help, always provide the clickable Google Maps link so the user can tap and go immediately.`,
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
