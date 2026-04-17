import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Crown, Send, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface FeaturePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  desc: string;
  icon: LucideIcon;
}

const SAMPLE_INTERACTIONS: Record<string, { placeholder: string; sampleReply: (input: string) => string }> = {
  "Oracle AI": {
    placeholder: "Ask the Oracle anything...",
    sampleReply: (i) => `(Preview) The Oracle would thoughtfully respond to: "${i}". Upgrade to unlock real conversations with memory.`,
  },
  "Crisis Hub": {
    placeholder: "Describe how you're feeling...",
    sampleReply: () => `(Preview) Crisis Hub would connect you to local emergency contacts and grounding exercises immediately. Always free in the live app.`,
  },
  "Mind Hub": {
    placeholder: "Pick a wellness topic (sleep, anxiety, focus)...",
    sampleReply: (i) => `(Preview) A guided "${i}" session with AI voice coaching would start now. Upgrade to access all 8 exercises.`,
  },
  "Photography & Live Vision": {
    placeholder: "Describe a photo to transform...",
    sampleReply: (i) => `(Preview) AI would transform your photo using: "${i}". Upgrade to generate real images.`,
  },
  "Voice Studio": {
    placeholder: "Type text to hear in a chosen voice...",
    sampleReply: (i) => `(Preview) "${i}" — would be spoken in 1 of 120+ premium voices. Upgrade to unlock voice cloning.`,
  },
  "AI Companion": {
    placeholder: "Say hi to your AI companion...",
    sampleReply: (i) => `(Preview) Your companion would remember "${i}" and build a real personality over time. Upgrade for full access.`,
  },
  "Magic & Marketing Hubs": {
    placeholder: "Try: 'Write an Instagram ad for coffee'...",
    sampleReply: (i) => `(Preview) Marketing AI would generate copy for: "${i}". Upgrade to export real campaigns.`,
  },
  "AI Security Fortress": {
    placeholder: "Ask about your account security...",
    sampleReply: () => `(Preview) 101 AI guards would scan your account in real time. Always-on protection in the live app.`,
  },
  "Web Wrapper": {
    placeholder: "Paste a website URL...",
    sampleReply: (i) => `(Preview) Would package "${i}" into an Android APK ready for the Play Store. Upgrade to download builds.`,
  },
};

const FeaturePreviewDialog = ({ open, onOpenChange, title, desc, icon: Icon }: FeaturePreviewDialogProps) => {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const sample = SAMPLE_INTERACTIONS[title] ?? {
    placeholder: "Try this feature...",
    sampleReply: (i: string) => `(Preview) "${i}" — upgrade to unlock the real ${title}.`,
  };
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMessages([
        { role: "ai", text: `Welcome to the ${title} preview! Try it out — but remember, nothing here is saved or generated for real.` },
      ]);
      setInput("");
    }
  }, [open, title]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userText = input.trim();
    setMessages((m) => [...m, { role: "user", text: userText }]);
    setInput("");
    setTimeout(() => {
      setMessages((m) => [...m, { role: "ai", text: sample.sampleReply(userText) }]);
    }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col bg-background border-primary/30">
        {/* Flashing red display-only banner */}
        <div
          className="rounded-md border border-destructive/60 bg-destructive/10 p-2 text-center text-destructive text-xs font-bold tracking-wide animate-pulse"
          role="alert"
        >
          <AlertTriangle className="inline-block w-4 h-4 mr-1 -mt-0.5" />
          DISPLAY ONLY — This is a preview. Nothing is generated or saved.
        </div>

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Icon className="w-5 h-5 text-primary" />
            {title} <span className="text-xs font-normal text-muted-foreground">· Preview</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </DialogHeader>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto space-y-2 rounded-md border border-border bg-card/40 p-3 min-h-[200px] max-h-[300px]">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`text-sm rounded-lg px-3 py-2 max-w-[85%] ${
                m.role === "user"
                  ? "ml-auto bg-primary/20 text-foreground"
                  : "mr-auto bg-muted text-muted-foreground"
              }`}
            >
              {m.role === "ai" && <Sparkles className="inline w-3 h-3 mr-1 text-primary" />}
              {m.text}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={sample.placeholder}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <Button onClick={handleSend} size="icon" variant="default">
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {/* Upgrade CTA */}
        <button
          onClick={() => {
            onOpenChange(false);
            navigate("/subscribe");
          }}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-primary to-amber-500 text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <Crown className="w-4 h-4" />
          Upgrade to unlock {title} for real
        </button>
      </DialogContent>
    </Dialog>
  );
};

export default FeaturePreviewDialog;
