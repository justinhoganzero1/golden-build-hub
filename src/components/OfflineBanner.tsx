import { WifiOff, Wifi } from "lucide-react";
import { useOffline } from "@/hooks/useOffline";
import { useEffect, useState } from "react";

const OfflineBanner = () => {
  const { isOnline, wasOffline } = useOffline();
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnected(true);
      const t = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(t);
    }
  }, [isOnline, wasOffline]);

  if (isOnline && !showReconnected) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-[100] px-4 py-2 text-center text-xs font-medium flex items-center justify-center gap-2 transition-all ${
      isOnline
        ? "bg-[hsl(var(--status-active))] text-primary-foreground"
        : "bg-destructive text-destructive-foreground"
    }`}>
      {isOnline ? (
        <><Wifi className="w-3.5 h-3.5" /> Back online</>
      ) : (
        <><WifiOff className="w-3.5 h-3.5" /> You're offline — some features may be limited</>
      )}
    </div>
  );
};

export default OfflineBanner;
