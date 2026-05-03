import { getEdgeAuthTokenSync } from "@/lib/edgeAuth";
import { useState, useRef, useCallback } from "react";
import SEO from "@/components/SEO";
import { cleanTextForSpeech } from "@/lib/utils";
import { Brain, Smile, Frown, Meh, TrendingUp, Heart, Play, Pause, Volume2, MessageSquare, Wind, Eye, Loader2, Timer, Sparkles, Moon, Sun } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const moods = [
  { icon: <Smile className="w-8 h-8" />, label: "Great", color: "text-[hsl(var(--status-active))]" },
  { icon: <Smile className="w-8 h-8" />, label: "Good", color: "text-primary" },
  { icon: <Meh className="w-8 h-8" />, label: "Okay", color: "text-muted-foreground" },
  { icon: <Frown className="w-8 h-8" />, label: "Low", color: "text-destructive" },
];

interface Exercise {
  id: string;
  title: string;
  duration: string;
  category: string;
  icon: React.ReactNode;
  steps: string[];
  aiPrompt: string;
}

const exercises: Exercise[] = [
  {
    id: "box-breathing", title: "Box Breathing", duration: "5 min", category: "Breathing",
    icon: <Wind className="w-5 h-5" />,
    steps: [
      "Find a comfortable seated position and close your eyes.",
      "Breathe in slowly through your nose for 4 seconds.",
      "Hold your breath gently for 4 seconds.",
      "Exhale slowly through your mouth for 4 seconds.",
      "Hold with empty lungs for 4 seconds.",
      "Repeat this cycle 4-6 times.",
      "Notice the calm spreading through your body.",
    ],
    aiPrompt: "Guide me through box breathing. Be calm, supportive, and count for me. Give short encouraging feedback after each cycle."
  },
  {
    id: "body-scan", title: "Body Scan", duration: "10 min", category: "Relaxation",
    icon: <Eye className="w-5 h-5" />,
    steps: [
      "Lie down or sit comfortably. Close your eyes.",
      "Bring awareness to the top of your head. Notice any tension.",
      "Slowly scan down to your forehead, jaw, and neck. Release tension.",
      "Move attention to your shoulders and arms. Let them feel heavy.",
      "Notice your chest and belly rising and falling with each breath.",
      "Scan down through your hips, legs, and feet.",
      "Feel your entire body relaxed and supported.",
      "Take 3 deep breaths and gently open your eyes.",
    ],
    aiPrompt: "Guide me through a progressive body scan relaxation. Speak slowly and calmly. Name each body part and encourage releasing tension."
  },
  {
    id: "gratitude", title: "Gratitude Journal", duration: "3 min", category: "Journaling",
    icon: <Heart className="w-5 h-5" />,
    steps: [
      "Take a moment to settle into stillness.",
      "Think of one person you are grateful for today. Why?",
      "Think of one experience today that brought you joy, however small.",
      "Think of one thing about yourself that you appreciate.",
      "Write or say these three things aloud.",
      "Feel the warmth of gratitude in your chest.",
    ],
    aiPrompt: "Help me with a gratitude exercise. Ask me what I'm grateful for, respond warmly, and help me reflect deeper on each item."
  },
  {
    id: "meditation", title: "Guided Meditation", duration: "15 min", category: "Meditation",
    icon: <Moon className="w-5 h-5" />,
    steps: [
      "Sit comfortably with your spine straight but relaxed.",
      "Close your eyes and take 3 deep breaths.",
      "Let your breathing return to its natural rhythm.",
      "Focus on the sensation of air entering and leaving your nostrils.",
      "When thoughts arise, notice them without judgment and return to your breath.",
      "Imagine a warm, golden light filling your body with each inhale.",
      "With each exhale, release any stress or worry.",
      "Continue for 10-15 minutes, then slowly open your eyes.",
    ],
    aiPrompt: "Guide me through a mindfulness meditation. Use calming language, long pauses, and gentle reminders to return to the breath."
  },
  {
    id: "478-breathing", title: "4-7-8 Breathing", duration: "4 min", category: "Breathing",
    icon: <Wind className="w-5 h-5" />,
    steps: [
      "Sit upright and place the tip of your tongue behind your upper front teeth.",
      "Exhale completely through your mouth with a whoosh sound.",
      "Close your mouth and inhale quietly through your nose for 4 seconds.",
      "Hold your breath for 7 seconds.",
      "Exhale completely through your mouth for 8 seconds with a whoosh.",
      "This is one cycle. Repeat 3 more times for a total of 4 cycles.",
    ],
    aiPrompt: "Guide me through 4-7-8 breathing technique. Count each phase and give calm encouragement between cycles."
  },
  {
    id: "muscle-relaxation", title: "Progressive Muscle Relaxation", duration: "12 min", category: "Relaxation",
    icon: <Sparkles className="w-5 h-5" />,
    steps: [
      "Lie down comfortably. Take 3 deep breaths.",
      "Tense the muscles in your feet by curling your toes. Hold 5 seconds. Release.",
      "Tense your calf muscles. Hold 5 seconds. Release and notice the difference.",
      "Tense your thighs by pressing your knees together. Hold. Release.",
      "Tighten your abdominal muscles. Hold. Release.",
      "Make fists with your hands. Hold. Release.",
      "Shrug your shoulders to your ears. Hold. Release.",
      "Scrunch your face tightly. Hold. Release.",
      "Take a final deep breath and feel complete relaxation.",
    ],
    aiPrompt: "Guide me through progressive muscle relaxation. Name each muscle group, tell me when to tense and release, and describe the relaxation feeling."
  },
  {
    id: "morning-intention", title: "Morning Intention Setting", duration: "5 min", category: "Mindfulness",
    icon: <Sun className="w-5 h-5" />,
    steps: [
      "Before getting out of bed, take 3 slow breaths.",
      "Ask yourself: How do I want to feel today?",
      "Choose one word that captures your intention (e.g., calm, focused, joyful).",
      "Visualize yourself moving through the day embodying that word.",
      "Say aloud: 'Today I choose to be [your word].'",
      "Carry this intention with you throughout the day.",
    ],
    aiPrompt: "Help me set my morning intention. Ask what I want to focus on today and help me craft a powerful intention statement."
  },
  {
    id: "loving-kindness", title: "Loving-Kindness Meditation", duration: "10 min", category: "Meditation",
    icon: <Heart className="w-5 h-5" />,
    steps: [
      "Sit comfortably and close your eyes.",
      "Begin by directing kindness toward yourself: 'May I be happy. May I be healthy. May I be safe.'",
      "Think of someone you love. Direct the same wishes to them.",
      "Think of a neutral person (a stranger). Send them kindness too.",
      "Think of someone difficult. Try to wish them well.",
      "Expand your kindness to all beings everywhere.",
      "Rest in this feeling of universal compassion.",
    ],
    aiPrompt: "Guide me through a loving-kindness meditation. Lead me through each stage gently and help me genuinely feel compassion for each person."
  },
];

const categories = ["All", ...Array.from(new Set(exercises.map(e => e.category)))];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-chat`;

const MindHubPage = () => {
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [aiMessage, setAiMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<{role:string;content:string}[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const speak = useCallback((text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(cleanTextForSpeech(text));
      u.rate = 0.85; u.pitch = 0.95; u.volume = 1;
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => v.name.includes("Samantha") || v.name.includes("Google UK English Female") || v.lang === "en-GB");
      if (preferred) u.voice = preferred;
      window.speechSynthesis.speak(u);
    }
  }, []);

  const askAI = async (prompt: string) => {
    setAiLoading(true);
    try {
      const msgs = [...chatHistory, { role: "user", content: prompt }];
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getEdgeAuthTokenSync()}` },
        body: JSON.stringify({ messages: [{ role: "system", content: `You are a calm, supportive wellness AI guide. ${activeExercise?.aiPrompt || "Help the user with mindfulness."}. Keep responses under 80 words. Be warm and encouraging.` }, ...msgs] }),
      });
      if (!resp.ok) throw new Error("AI unavailable");
      const text = await resp.text();
      let content = "";
      for (const line of text.split("\n")) {
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try { const j = JSON.parse(line.slice(6)); content += j.choices?.[0]?.delta?.content || ""; } catch {}
        }
      }
      if (!content) content = "Take a deep breath. You're doing wonderful.";
      setAiMessage(content);
      setChatHistory([...msgs, { role: "assistant", content }]);
      speak(content);
    } catch {
      setAiMessage("I'm here with you. Take a deep breath and continue at your own pace.");
    } finally { setAiLoading(false); }
  };

  const startExercise = (ex: Exercise) => {
    setActiveExercise(ex);
    setCurrentStep(0);
    setIsPlaying(true);
    setChatHistory([]);
    setAiMessage("");
    speak(ex.steps[0]);
    askAI(`I'm starting the ${ex.title} exercise. Please welcome me and guide me through step 1: "${ex.steps[0]}"`);
  };

  const nextStep = () => {
    if (!activeExercise) return;
    if (currentStep < activeExercise.steps.length - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      speak(activeExercise.steps[next]);
      askAI(`I just completed step ${currentStep + 1}. Now guide me through step ${next + 1}: "${activeExercise.steps[next]}"`);
    } else {
      speak("Wonderful job completing this exercise. You should feel proud of yourself.");
      askAI("I've completed all steps. Please congratulate me and suggest how I can carry this feeling through my day.");
      setIsPlaying(false);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      speak(activeExercise!.steps[currentStep - 1]);
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      window.speechSynthesis?.cancel();
      if (timerRef.current) clearTimeout(timerRef.current);
    } else {
      speak(activeExercise!.steps[currentStep]);
    }
    setIsPlaying(!isPlaying);
  };

  const filtered = categoryFilter === "All" ? exercises : exercises.filter(e => e.category === categoryFilter);

  if (activeExercise) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <UniversalBackButton />
        <div className="px-4 pt-14 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-primary/10">{activeExercise.icon}</div>
            <div>
              <h1 className="text-xl font-bold text-primary">{activeExercise.title}</h1>
              <p className="text-muted-foreground text-xs">{activeExercise.category} • {activeExercise.duration}</p>
            </div>
          </div>

          {/* Progress */}
          <div className="flex gap-1 mb-4">
            {activeExercise.steps.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= currentStep ? "bg-primary" : "bg-secondary"}`} />
            ))}
          </div>

          {/* Current Step Card */}
          <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-2xl p-6 mb-4">
            <p className="text-xs text-primary font-medium mb-2">Step {currentStep + 1} of {activeExercise.steps.length}</p>
            <p className="text-foreground text-base leading-relaxed">{activeExercise.steps[currentStep]}</p>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <button onClick={prevStep} disabled={currentStep === 0} className="p-3 rounded-full bg-card border border-border disabled:opacity-30">
              <Play className="w-5 h-5 text-primary rotate-180" />
            </button>
            <button onClick={togglePlay} className="p-4 rounded-full bg-primary text-primary-foreground">
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>
            <button onClick={nextStep} className="p-3 rounded-full bg-card border border-border">
              <Play className="w-5 h-5 text-primary" />
            </button>
          </div>

          {/* AI Comment */}
          <div className="bg-card border border-border rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-primary">AI Wellness Guide</span>
              {aiLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {aiMessage || "Starting your wellness session..."}
            </p>
            <button onClick={() => speak(aiMessage)} className="mt-2 flex items-center gap-1 text-xs text-primary">
              <Volume2 className="w-3 h-3" /> Replay voice
            </button>
          </div>

          {/* All Steps */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-foreground mb-3">All Steps</h3>
            <div className="space-y-2">
              {activeExercise.steps.map((step, i) => (
                <button key={i} onClick={() => { setCurrentStep(i); speak(step); }}
                  className={`w-full text-left text-xs p-2 rounded-lg transition-colors ${i === currentStep ? "bg-primary/10 text-primary font-medium" : i < currentStep ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {i + 1}. {step}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => { setActiveExercise(null); window.speechSynthesis?.cancel(); }}
            className="w-full mt-4 py-3 bg-secondary text-foreground rounded-xl text-sm font-medium">
            Back to Exercises
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
    <SEO
      title="Mind Hub — Free AI Mental Wellness & Therapy Companion"
      description="ORACLE LUNAR Mind Hub: free guided breathing, meditation, mood tracking and a caring AI to talk through anxiety and stress. 24/7."
      path="/mind-hub"
    />
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Brain className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">Mind Hub</h1><p className="text-muted-foreground text-xs">Your mental wellness center</p></div>
        </div>

        {/* Mood Tracker */}
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">How are you feeling?</h2>
          <div className="flex justify-around">
            {moods.map((m, i) => (
              <button key={i} onClick={() => { setSelectedMood(i); toast.success(`Mood logged: ${m.label}`); }}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${selectedMood === i ? "bg-primary/10 scale-110" : "hover:bg-secondary"}`}>
                <span className={m.color}>{m.icon}</span>
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-primary" /><h2 className="text-sm font-semibold text-foreground">This Week</h2></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-secondary/50"><p className="text-lg font-bold text-primary">5</p><p className="text-[10px] text-muted-foreground">Check-ins</p></div>
            <div className="text-center p-3 rounded-lg bg-secondary/50"><p className="text-lg font-bold text-primary">3h</p><p className="text-[10px] text-muted-foreground">Mindfulness</p></div>
            <div className="text-center p-3 rounded-lg bg-secondary/50"><p className="text-lg font-bold text-[hsl(var(--status-active))]">↑12%</p><p className="text-[10px] text-muted-foreground">Improvement</p></div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
          {categories.map(c => (
            <button key={c} onClick={() => setCategoryFilter(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${categoryFilter === c ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
              {c}
            </button>
          ))}
        </div>

        {/* Exercises */}
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Heart className="w-4 h-4 text-primary" />Wellness Exercises</h2>
        <div className="space-y-3">
          {filtered.map(ex => (
            <button key={ex.id} onClick={() => startExercise(ex)}
              className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary transition-colors text-left">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">{ex.icon}</div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">{ex.title}</h3>
                <p className="text-xs text-muted-foreground">{ex.category}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-primary font-medium">{ex.duration}</span>
                <Play className="w-4 h-4 text-primary" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
    </>
  );
};

export default MindHubPage;
