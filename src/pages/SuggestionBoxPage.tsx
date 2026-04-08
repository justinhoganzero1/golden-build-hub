import { useState } from "react";
import { Bell, Send, MessageCircle } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
const SuggestionBoxPage = () => {
  const [suggestion, setSuggestion] = useState("");
  const [category, setCategory] = useState("Feature");
  const handleSubmit = () => { if (!suggestion.trim()) return; toast.success("Thank you for your feedback!"); setSuggestion(""); };
  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4"><div className="p-2 rounded-xl bg-primary/10"><Bell className="w-7 h-7 text-primary" /></div><div><h1 className="text-xl font-bold text-primary">Suggestion Box</h1><p className="text-muted-foreground text-xs">Help us improve Solace</p></div></div>
        <div className="flex gap-2 mb-4">{["Feature", "Bug", "Design", "Other"].map(c => (<button key={c} onClick={() => setCategory(c)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${category === c ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>{c}</button>))}</div>
        <textarea value={suggestion} onChange={e => setSuggestion(e.target.value)} placeholder="Share your ideas, feedback, or report issues..." rows={6} className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none focus:border-primary mb-4" />
        <button onClick={handleSubmit} disabled={!suggestion.trim()} className="w-full py-4 bg-primary text-primary-foreground font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"><Send className="w-5 h-5" /> Submit Suggestion</button>
        <div className="mt-6"><h2 className="text-sm font-semibold text-foreground mb-3">Recent Suggestions</h2><div className="space-y-2">{["Dark mode improvements", "Add workout tracker", "More AI voices"].map(s => (<div key={s} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3"><MessageCircle className="w-4 h-4 text-primary" /><span className="text-sm text-foreground">{s}</span></div>))}</div></div>
      </div>
    </div>
  );
};
export default SuggestionBoxPage;
