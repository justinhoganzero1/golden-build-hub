import { LayoutGrid, Mic, Paperclip, Send, Sparkles, Users, Volume2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import SEO from "@/components/SEO";
import LivingAvatar from "@/components/LivingAvatar";
import { MASTER_AI_AVATAR, MASTER_AI_AVATAR_ALT } from "@/assets/master-ai-avatar";

const previewMessages = [
  {
    id: "assistant-1",
    sender: "Oracle",
    role: "assistant" as const,
    content: "Welcome back — I can help with ideas, images, study, planning, and everyday support.",
  },
  {
    id: "user-1",
    sender: "user",
    role: "user" as const,
    content: "Can you help me organise my day and start a photo edit after that?",
  },
  {
    id: "assistant-2",
    sender: "Oracle",
    role: "assistant" as const,
    content: "Absolutely. We can map out your schedule first, then jump straight into Photography Hub with your image ready to go.",
  },
];

const OraclePreviewPage = () => {
  const navigate = useNavigate();
  const [input, setInput] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    navigate(`/oracle${text ? `?q=${encodeURIComponent(text)}` : ""}`);
  };

  return (
    <>
      <SEO
        title="Oracle AI Preview"
        description="Preview the Oracle AI experience inside ORACLE LUNAR."
        path="/oracle-preview"
      />

      <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground">
        <div className="flex items-center justify-between border-b border-border/70 px-4 pt-3 pb-2 bg-background/95 backdrop-blur-sm">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-semibold text-primary">
            <Sparkles className="w-3.5 h-3.5" />
            Oracle AI live preview
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-primary/20 bg-card px-2.5 py-1 text-[10px] text-muted-foreground">
              <Users className="w-3.5 h-3.5 text-primary" />
              2 agents
            </div>
            <div className="flex items-center gap-1 rounded-full border border-primary/20 bg-card px-2.5 py-1 text-[10px] text-muted-foreground">
              <Volume2 className="w-3.5 h-3.5 text-primary" />
              Ready
            </div>
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.2),transparent_45%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--card))_50%,hsl(var(--background)))]">
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/10 to-transparent" />

          <div className="relative flex h-full flex-col">
            <div className="flex min-h-[38%] items-center justify-center px-6 pt-6 pb-4">
              <div className="relative flex flex-col items-center gap-3">
                <div className="absolute -left-12 top-8 h-10 w-10 rounded-full border border-primary/40 bg-card/80 backdrop-blur flex items-center justify-center text-lg shadow-[0_0_20px_hsl(var(--primary)/0.18)]">
                  ✨
                </div>
                <div className="absolute -right-12 top-12 h-10 w-10 rounded-full border border-primary/40 bg-card/80 backdrop-blur flex items-center justify-center text-lg shadow-[0_0_20px_hsl(var(--primary)/0.18)]">
                  💡
                </div>

                <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-primary/40 shadow-[0_0_45px_hsl(var(--primary)/0.3)] bg-card">
                  <LivingAvatar
                    imageUrl={MASTER_AI_AVATAR}
                    alt={MASTER_AI_AVATAR_ALT}
                    intensity="normal"
                    className="w-full h-full"
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">Oracle</p>
                  <p className="text-xs text-muted-foreground">Voice, chat, planning, images, and live help</p>
                </div>
              </div>
            </div>

            <div className="flex-1 px-4 pb-4 min-h-0">
              <div className="h-full rounded-[1.75rem] border border-border/80 bg-card/75 backdrop-blur-md shadow-2xl overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {previewMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={message.role === "user"
                          ? "max-w-[78%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                          : "max-w-[78%] rounded-2xl rounded-bl-sm border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-foreground"
                        }
                      >
                        {message.role !== "user" && (
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-primary">{message.sender}</p>
                        )}
                        <p>{message.content}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border/80 bg-background/80 px-4 py-3">
                  <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-background px-3 py-2 shadow-inner">
                    <button className="rounded-full p-2 text-primary bg-primary/10" aria-label="Microphone preview">
                      <Mic className="w-5 h-5" />
                    </button>
                    <button className="rounded-full p-2 text-primary/80 bg-primary/5" aria-label="Attachment preview">
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <div className="flex-1 text-sm text-muted-foreground">Speak, type, or attach for Oracle...</div>
                    <button className="rounded-full bg-primary p-2 text-primary-foreground" aria-label="Send preview">
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="fixed bottom-4 right-4 z-10 rounded-full border-2 border-primary/50 bg-card/90 p-3 text-primary shadow-[0_0_20px_hsl(var(--primary)/0.2)] backdrop-blur"
          aria-label="Dashboard preview"
        >
          <LayoutGrid className="w-6 h-6" />
        </button>
      </div>
    </>
  );
};

export default OraclePreviewPage;