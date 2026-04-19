import { useState, useEffect } from "react";
import { Bell, Send, MessageCircle, Sparkles, Loader2, Star } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const TOOLS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tools`;

interface Suggestion { id: string; suggestion: string; category: string; ai_response: string | null; status: string; created_at: string; }

const SuggestionBoxPage = () => {
  const { user } = useAuth();
  const [suggestion, setSuggestion] = useState("");
  const [category, setCategory] = useState("Feature");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mySuggestions, setMySuggestions] = useState<Suggestion[]>([]);
  const [aiReply, setAiReply] = useState<string | null>(null);

  const loadSuggestions = async () => {
    if (!user) return;
    const { data } = await supabase.from("suggestions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    if (data) setMySuggestions(data as Suggestion[]);
  };

  useEffect(() => { loadSuggestions(); }, [user]);

  const handleSubmit = async () => {
    if (!suggestion.trim() || !user) return;
    setIsSubmitting(true);
    setAiReply(null);
    try {
      // Get AI response
      const resp = await fetch(TOOLS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ type: "assistant", prompt: `You are the Oracle Lunar AI assistant. A user just submitted this suggestion for the app: "${suggestion.trim()}" (Category: ${category}). Thank them warmly and enthusiastically. Mention that if their idea gets implemented, they'll receive FREE LIFETIME ACCESS to all non-external-paid features of the app! Encourage them to submit more ideas. Be genuine and excited. Keep it under 100 words.` }),
      });
      let aiText = "Thank you so much for your amazing suggestion! We truly value your input. If your idea gets implemented, you'll earn FREE LIFETIME ACCESS to all Oracle Lunar features! Keep the great ideas coming! 🌟";
      if (resp.ok) {
        const data = await resp.json();
        if (data.result) aiText = data.result;
      }
      // Save to database
      await supabase.from("suggestions").insert({ user_id: user.id, category, suggestion: suggestion.trim(), ai_response: aiText, ai_quality_score: 50 });
      setAiReply(aiText);
      toast.success("Suggestion submitted! 🎉");
      setSuggestion("");
      loadSuggestions();
    } catch { toast.error("Failed to submit"); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-primary/10"><Bell className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">Suggestion Box</h1><p className="text-muted-foreground text-xs">Help us improve Oracle Lunar</p></div>
        </div>

        {/* Incentive Banner */}
        <div className="bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-4 mb-4 flex items-start gap-3">
          <Star className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div><p className="text-xs text-foreground font-medium">Submit a great idea that gets implemented and earn <span className="text-primary font-bold">FREE LIFETIME ACCESS</span> to all Oracle Lunar features!</p></div>
        </div>

        <div className="flex gap-2 mb-4">{["Feature", "Bug", "Design", "Other"].map(c => (
          <button key={c} onClick={() => setCategory(c)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${category === c ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>{c}</button>
        ))}</div>

        <textarea value={suggestion} onChange={e => setSuggestion(e.target.value)} placeholder="Share your ideas, feedback, or report issues..." rows={5}
          className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none focus:border-primary mb-4" />

        <button onClick={handleSubmit} disabled={!suggestion.trim() || isSubmitting}
          className="w-full py-4 bg-primary text-primary-foreground font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
          {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</> : <><Send className="w-5 h-5" /> Submit Suggestion</>}
        </button>

        {/* AI Reply */}
        {aiReply && (
          <div className="mt-4 bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-primary" /><span className="text-xs font-semibold text-primary">Oracle says...</span></div>
            <p className="text-sm text-foreground/90">{aiReply}</p>
          </div>
        )}

        {/* My Suggestions */}
        {mySuggestions.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-foreground mb-3">Your Suggestions</h2>
            <div className="space-y-2">
              {mySuggestions.map(s => (
                <div key={s.id} className="bg-card border border-border rounded-xl p-3">
                  <div className="flex items-start gap-3">
                    <MessageCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-foreground">{s.suggestion}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{s.category}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.status === "implemented" ? "bg-[hsl(var(--status-active))]/20 text-[hsl(var(--status-active))]" : s.status === "approved" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>{s.status}</span>
                      </div>
                      {s.ai_response && <p className="text-[10px] text-muted-foreground mt-2 italic">🤖 {s.ai_response.slice(0, 120)}...</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default SuggestionBoxPage;
