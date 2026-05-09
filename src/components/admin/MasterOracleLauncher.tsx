import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles, X, Minimize2, Mic } from "lucide-react";
import { toast } from "sonner";
import { MASTER_AI_AVATAR, MASTER_AI_AVATAR_ALT } from "@/assets/master-ai-avatar";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useDraggable } from "@/hooks/useDraggable";
import { isLowPowerMobile } from "@/lib/utils";

const OPEN_STORAGE_KEY = "master-oracle-open";
const EVER_ADMIN_KEY = "master-oracle-ever-admin";
const EVER_OPENED_KEY = "master-oracle-ever-opened";

/**
 * Admin-only floating launcher that opens the REAL master Oracle (/oracle)
 * full-screen inside an iframe.
 *
 * CRITICAL — INVINCIBLE IFRAME:
 *   Once the iframe has been mounted ONCE in a browser session, it must NEVER
 *   unmount, never reload, never key-bump, never lose its src — no matter what
 *   `useIsAdmin()` returns next render, no matter what AuthContext re-emits,
 *   no matter what route you're on. We track "has this user ever been admin in
 *   this session" via sessionStorage; once true, the iframe stays mounted and
 *   only its visibility CSS toggles. This is the only way to guarantee Oracle
 *   keeps full chat history, voice queue, mic stream and agents alive without
 *   ever starting a "second voice over the top".
 */
export const MasterOracleLauncher = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { pathname } = useLocation();
  const [open, setOpenState] = useState<boolean>(() => {
    try { return sessionStorage.getItem(OPEN_STORAGE_KEY) === "1"; } catch { return false; }
  });
  const { ref, style, dragHandlers, justDragged } = useDraggable("master-oracle-launcher-pos");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const lowPowerMode = useMemo(() => isLowPowerMobile(), []);

  // Sticky admin flag — once true in this session, stays true even if a
  // momentary re-fetch of the user_roles row briefly returns false.
  const [everAdmin, setEverAdmin] = useState<boolean>(() => {
    try { return sessionStorage.getItem(EVER_ADMIN_KEY) === "1"; } catch { return false; }
  });
  useEffect(() => {
    if (isAdmin && !everAdmin) {
      setEverAdmin(true);
      try { sessionStorage.setItem(EVER_ADMIN_KEY, "1"); } catch {}
    }
  }, [isAdmin, everAdmin]);

  const setOpen = (next: boolean) => {
    setOpenState(next);
    try {
      if (next) sessionStorage.setItem(OPEN_STORAGE_KEY, "1");
      else sessionStorage.removeItem(OPEN_STORAGE_KEY);
    } catch {}
  };

  // Block accidental closers — Escape after dictation should NOT collapse Oracle.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  // EFFECTIVE admin = is admin now OR has ever been admin in this session.
  // Critical: while admin role is still loading we ALSO trust the sticky flag,
  // so we never tear the iframe down during a refetch.
  const effectiveAdmin = isAdmin || everAdmin;

  // Render absolutely nothing only if we have NEVER been admin AND we're not
  // currently loading. This way, the very first paint for non-admins is a noop;
  // for any admin, once we mount, we never unmount.
  if (!effectiveAdmin && !adminLoading) return null;

  // On the actual /oracle route the user IS the Oracle page already.
  // Hide our launcher button + dialog chrome there, BUT keep the iframe
  // mounted so coming back to any other page resumes the same conversation.
  const onOracleRoute = pathname === "/oracle" || pathname === "/chat-oracle";
  const hiddenRoute = pathname === "/" || pathname === "/oracle-preview" || pathname.startsWith("/sign-in");

  // Until we know the user is admin, render nothing (no iframe yet).
  // Once admin has been confirmed once, ALWAYS render the iframe shell.
  if (!everAdmin) return null;

  return (
    <>
      {!open && !onOracleRoute && !hiddenRoute && (
        <button
          ref={ref}
          {...dragHandlers}
          onClick={() => { if (!justDragged) setOpen(true); }}
          aria-label="Open Master Oracle (drag to move)"
          style={style}
          className={`fixed z-50 flex items-center gap-2 pl-1 pr-4 py-1 rounded-full bg-gradient-to-br from-amber-500 to-primary text-primary-foreground transition-transform cursor-grab active:cursor-grabbing select-none ${lowPowerMode ? "shadow-lg" : "shadow-2xl shadow-primary/40 hover:scale-105"}`}
        >
          <span className="relative">
            <img
              src={MASTER_AI_AVATAR}
              alt={MASTER_AI_AVATAR_ALT}
              className="w-10 h-10 rounded-full object-cover border-2 border-primary-foreground/30"
            />
            <span className={`absolute inset-0 rounded-full ring-2 ring-amber-300/60 ${lowPowerMode ? "opacity-60" : "animate-pulse"}`} />
          </span>
          <span className="text-sm font-semibold flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            Master Oracle
          </span>
        </button>
      )}

      {/* Iframe shell. ALWAYS mounted once admin has been confirmed even ONCE
          in this session. Only visibility toggles via CSS. Never unmount. */}
      <div
        className={`fixed inset-0 z-[100] bg-background/95 flex-col ${lowPowerMode ? "" : "backdrop-blur-sm"} ${
          open && !onOracleRoute && !hiddenRoute ? "flex" : "hidden"
        }`}
        aria-hidden={!open || onOracleRoute}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/80">
          <div className="flex items-center gap-2">
            <img src={MASTER_AI_AVATAR} alt="" className="w-7 h-7 rounded-full object-cover" />
            <div>
              <div className="text-sm font-semibold">Master Oracle — Admin Mode</div>
              <div className="text-[11px] text-muted-foreground">
                Persistent · Never refreshes · Voice · Memory · 1GB uploads
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={async () => {
                try {
                  if (!navigator.mediaDevices?.getUserMedia) {
                    toast.error("Mic API unavailable. Use Chrome/Safari over HTTPS.");
                    return;
                  }
                  let state: PermissionState | "unknown" = "unknown";
                  try {
                    const p = await (navigator.permissions as any)?.query({ name: "microphone" as PermissionName });
                    state = p?.state ?? "unknown";
                  } catch {}

                  if (state === "denied") {
                    toast.error(
                      "Mic is BLOCKED in browser settings. Click the 🔒 padlock left of the URL → Site settings → Microphone → Allow, then reload.",
                      { duration: 12000 }
                    );
                    return;
                  }

                  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                  stream.getTracks().forEach((t) => t.stop());
                  toast.success("Mic permission granted. Oracle can hear you now.");
                  // Notify the iframe (no reload — we never want to lose state).
                  try {
                    iframeRef.current?.contentWindow?.postMessage(
                      { type: "ORACLE_MIC_GRANTED" },
                      window.location.origin,
                    );
                  } catch {}
                } catch {
                  toast.error(
                    "Mic prompt was dismissed or blocked. Open 🔒 padlock → Site settings → Microphone → Allow, then reload.",
                    { duration: 12000 }
                  );
                }
              }}
              className="p-2 rounded-full hover:bg-amber-500/20 text-amber-400 transition-colors"
              aria-label="Request microphone permission"
              title="Re-request microphone permission for Oracle"
            >
              <Mic className="w-5 h-5" />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Minimise Master Oracle"
              title="Minimise (Oracle keeps running in the background)"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Close Master Oracle"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <iframe
          ref={iframeRef}
          // Stable key — never changes, so React never recreates the element.
          key="master-oracle-iframe-singleton"
          src="/oracle"
          title="Master Oracle"
          className="flex-1 w-full border-0 bg-background"
          allow="microphone; camera; autoplay; clipboard-read; clipboard-write"
        />
      </div>
    </>
  );
};

export default MasterOracleLauncher;
