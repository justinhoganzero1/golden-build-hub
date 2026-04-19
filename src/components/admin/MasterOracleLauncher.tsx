import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { MASTER_AI_AVATAR, MASTER_AI_AVATAR_ALT } from "@/assets/master-ai-avatar";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useDraggable } from "@/hooks/useDraggable";

/**
 * Admin-only floating launcher that opens the REAL master Oracle (/oracle)
 * full-screen, so every admin page uses the exact same Oracle (same memory,
 * voice, 1GB uploads, navigation, avatars). Self-hides for non-admins and
 * on the Oracle page itself to avoid duplication.
 */
export const MasterOracleLauncher = () => {
  const { isAdmin } = useIsAdmin();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { ref, style, dragHandlers, justDragged } = useDraggable("master-oracle-launcher-pos");

  if (!isAdmin) return null;
  if (pathname === "/oracle" || pathname === "/chat-oracle") return null;

  return (
    <>
      <button
        ref={ref}
        {...dragHandlers}
        onClick={() => { if (!justDragged) setOpen(true); }}
        aria-label="Open Master Oracle (drag to move)"
        style={style}
        className="fixed z-50 flex items-center gap-2 pl-1 pr-4 py-1 rounded-full bg-gradient-to-br from-amber-500 to-primary text-primary-foreground shadow-2xl shadow-primary/40 hover:scale-105 transition-transform cursor-grab active:cursor-grabbing select-none"
      >
        <span className="relative">
          <img
            src={MASTER_AI_AVATAR}
            alt={MASTER_AI_AVATAR_ALT}
            className="w-10 h-10 rounded-full object-cover border-2 border-primary-foreground/30"
          />
          <span className="absolute inset-0 rounded-full ring-2 ring-amber-300/60 animate-pulse" />
        </span>
        <span className="text-sm font-semibold flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5" />
          Master Oracle
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/80">
            <div className="flex items-center gap-2">
              <img src={MASTER_AI_AVATAR} alt="" className="w-7 h-7 rounded-full object-cover" />
              <div>
                <div className="text-sm font-semibold">Master Oracle — Admin Mode</div>
                <div className="text-[11px] text-muted-foreground">
                  Full app control · Uploads up to 1GB · Voice · Memory
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Close Master Oracle"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <iframe
            src="/oracle"
            title="Master Oracle"
            className="flex-1 w-full border-0 bg-background"
            allow="microphone; camera; autoplay; clipboard-read; clipboard-write"
          />
        </div>
      )}
    </>
  );
};

export default MasterOracleLauncher;
