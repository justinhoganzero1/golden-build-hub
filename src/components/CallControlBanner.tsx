import { useState } from "react";
import { Phone, PhoneIncoming, PhoneOff, Send } from "lucide-react";
import { useActiveCallSession, submitCallReply } from "@/hooks/useActiveCallSession";
import { toast } from "sonner";

/**
 * Floating banner shown whenever an active call session exists for the user.
 * When a caller is on hold (status = awaiting_user), surfaces an inline form
 * to type a reply, which is then read back to the caller via TTS.
 */
const CallControlBanner = () => {
  const session = useActiveCallSession();
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  if (!session) return null;

  const isAwaiting = session.status === "awaiting_user";
  const isReplying = session.status === "replying";

  const handleSend = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      await submitCallReply(session.id, reply.trim());
      toast.success("Reply sent — unmuting caller");
      setReply("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)] rounded-lg border border-primary/50 bg-card/95 backdrop-blur shadow-lg p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {isAwaiting ? (
          <PhoneIncoming className="w-4 h-4 text-primary animate-pulse" />
        ) : (
          <Phone className="w-4 h-4 text-primary" />
        )}
        {session.direction === "inbound" ? "Incoming call" : "Outbound call"}
        {session.caller_number && (
          <span className="text-xs text-muted-foreground">— {session.caller_number}</span>
        )}
        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
          {session.status.replace("_", " ")}
        </span>
      </div>

      {session.intent && (
        <div className="text-xs text-muted-foreground italic">About: {session.intent}</div>
      )}

      {session.last_caller_message && (
        <div className="text-xs bg-background/60 border border-border rounded px-2 py-1 text-foreground">
          <span className="text-muted-foreground">Caller said:</span> {session.last_caller_message}
        </div>
      )}

      {isAwaiting && (
        <div className="flex gap-2">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type your reply…"
            className="flex-1 bg-background border border-border rounded-md px-2 py-1.5 text-sm text-foreground"
            autoFocus
          />
          <button
            onClick={handleSend}
            disabled={!reply.trim() || sending}
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40 flex items-center gap-1"
          >
            <Send className="w-3 h-3" /> Send
          </button>
        </div>
      )}

      {isReplying && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <PhoneOff className="w-3 h-3" /> Reading your reply to caller…
        </div>
      )}
    </div>
  );
};

export default CallControlBanner;
