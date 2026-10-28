import { useEffect, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { feedbackKey } from "@/lib/oracleClipSelection";

export default function OracleResponseFeedback({ userId, messageId }: { userId?: string; messageId: string }) {
  const [value, setValue] = useState<number>(0);
  useEffect(() => { try { setValue(userId ? JSON.parse(localStorage.getItem(feedbackKey(userId)) || "{}")[messageId] || 0 : 0); } catch { setValue(0); } }, [userId, messageId]);
  const rate = (next: number) => {
    if (!userId) return;
    const selected = next === value ? 0 : next;
    try {
      const saved = JSON.parse(localStorage.getItem(feedbackKey(userId)) || "{}");
      const entries = Object.entries(saved).filter(([id]) => id !== messageId).slice(-199);
      localStorage.setItem(feedbackKey(userId), JSON.stringify({ ...Object.fromEntries(entries), [messageId]: selected }));
      setValue(selected);
    } catch { /* Feedback must never interrupt a conversation. */ }
  };
  return <div className="mt-2 flex gap-1">
    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Helpful answer" title="Helpful answer" aria-pressed={value === 1} onClick={() => rate(1)}><ThumbsUp className={value === 1 ? "text-primary" : "text-muted-foreground"} /></Button>
    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Unhelpful answer" title="Unhelpful answer" aria-pressed={value === -1} onClick={() => rate(-1)}><ThumbsDown className={value === -1 ? "text-destructive" : "text-muted-foreground"} /></Button>
  </div>;
}