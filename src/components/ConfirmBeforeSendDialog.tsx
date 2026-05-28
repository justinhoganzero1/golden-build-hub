import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Send, Sparkles, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useStyleLearning } from "@/hooks/useStyleLearning";

export type OutgoingChannel = "email" | "sms" | "chat" | "dm" | "whatsapp" | "messenger";

export interface OutgoingDraft {
  channel: OutgoingChannel;
  recipient?: string;
  subject?: string | null;
  body: string;
  /** Free-form note shown to the user explaining what will happen on confirm. */
  externalDestination?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  draft: OutgoingDraft | null;
  /** Called only AFTER the user explicitly clicks "Send" with the final edited content. */
  onConfirm: (finalDraft: OutgoingDraft) => Promise<void> | void;
}

/**
 * Hard gate for every message that leaves Oracle Lunar.
 *
 * NOTHING is sent to email, SMS, WhatsApp, Messenger, or any external
 * channel without the user reading the final text and tapping "Send".
 * The user can edit the subject, body, and recipient inline. The final
 * version is also fed back into the style-learning loop so the AI keeps
 * improving its match of their voice.
 */
const ConfirmBeforeSendDialog = ({ open, onOpenChange, draft, onConfirm }: Props) => {
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const { learn } = useStyleLearning();

  useEffect(() => {
    if (draft) {
      setRecipient(draft.recipient ?? "");
      setSubject(draft.subject ?? "");
      setBody(draft.body ?? "");
    }
  }, [draft]);

  const isEmail = draft?.channel === "email";
  const destinationLabel = useMemo(() => {
    if (!draft) return "";
    if (draft.externalDestination) return draft.externalDestination;
    switch (draft.channel) {
      case "email": return "an outside email inbox";
      case "sms": return "an outside phone number (SMS)";
      case "whatsapp": return "WhatsApp";
      case "messenger": return "Facebook Messenger";
      case "dm": return "a direct message outside this app";
      default: return "another app";
    }
  }, [draft]);

  const handleSend = async () => {
    if (!draft) return;
    const finalBody = body.trim();
    if (!finalBody) {
      toast.error("Message body can't be empty.");
      return;
    }
    if ((draft.channel === "email" || draft.channel === "sms") && !recipient.trim()) {
      toast.error("Please add a recipient first.");
      return;
    }
    setSending(true);
    try {
      await onConfirm({
        ...draft,
        recipient: recipient.trim() || draft.recipient,
        subject: isEmail ? subject.trim() : null,
        body: finalBody,
      });
      // Feed the FINAL approved version back into the style profile —
      // this is what the user actually said in their own voice.
      learn(finalBody, { source: draft.channel === "email" ? "email" : "chat", silent: true });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't send. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !sending && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Review before sending
          </DialogTitle>
          <DialogDescription>
            This message is about to leave Oracle Lunar and go to{" "}
            <span className="font-semibold text-foreground">{destinationLabel}</span>. Read it,
            edit it, then tap Send. Nothing leaves the app until you do.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {(draft?.channel === "email" || draft?.channel === "sms") && (
            <div className="space-y-1.5">
              <Label htmlFor="cbs-recipient" className="text-xs">
                {isEmail ? "To (email)" : "To (number)"}
              </Label>
              <Input
                id="cbs-recipient"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={isEmail ? "name@example.com" : "+61…"}
                disabled={sending}
                inputMode={isEmail ? "email" : "tel"}
                autoComplete="off"
              />
            </div>
          )}

          {isEmail && (
            <div className="space-y-1.5">
              <Label htmlFor="cbs-subject" className="text-xs">Subject</Label>
              <Input
                id="cbs-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={sending}
                maxLength={200}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="cbs-body" className="text-xs flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-primary" />
              Message — edit freely
            </Label>
            <Textarea
              id="cbs-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              disabled={sending}
              maxLength={8000}
              className="resize-y"
            />
            <p className="text-[10px] text-muted-foreground">
              Drafted in your voice from what your AI has learned about how you write. Your edits teach it more.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            <X className="w-4 h-4" /> Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            <Send className="w-4 h-4" />
            {sending ? "Sending…" : `Send to ${destinationLabel}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmBeforeSendDialog;
