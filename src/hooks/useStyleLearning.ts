import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Style-learning hook. Feeds the AI samples of how the user actually writes
 * (emails, chats, voice transcripts) so it can later draft outgoing messages
 * in their voice. Silent-by-default — only toasts on hard failures.
 */
export const useStyleLearning = () => {
  const learn = useCallback(
    async (
      content: string,
      opts?: { source?: "email" | "chat" | "paste" | "voice" | "oracle"; recipientHint?: string; silent?: boolean },
    ) => {
      const trimmed = (content || "").trim();
      if (trimmed.length < 8) return { ok: false, reason: "too_short" as const };
      try {
        const { data, error } = await supabase.functions.invoke("learn-user-style", {
          body: {
            content: trimmed.slice(0, 8000),
            source: opts?.source ?? "paste",
            recipientHint: opts?.recipientHint,
          },
        });
        if (error) throw error;
        if (!opts?.silent) {
          const n = (data as any)?.sample_count;
          toast.success(`Got it — learned from sample #${n}. Your AI sounds more like you now.`);
        }
        return { ok: true, data };
      } catch (e: any) {
        if (!opts?.silent) {
          toast.error("Couldn't learn from that sample. I'll try again next time.");
        }
        console.warn("learn-user-style failed:", e);
        return { ok: false, reason: "failed" as const };
      }
    },
    [],
  );

  const draft = useCallback(
    async (input: {
      intent: string;
      channel: "email" | "sms" | "chat" | "dm";
      recipient?: string;
      tone?: string;
      context?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("draft-with-style", { body: input });
      if (error) throw error;
      return data as {
        ok: boolean;
        requires_user_review: true;
        channel: string;
        recipient: string | null;
        draft: { subject: string | null; body: string; notes: string };
        profile_used: boolean;
        sample_count: number;
      };
    },
    [],
  );

  return { learn, draft };
};
