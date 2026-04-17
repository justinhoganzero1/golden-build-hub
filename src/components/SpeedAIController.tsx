import { useEffect } from "react";
import {
  installGlobalPrefetchDelegate,
  startIdleWarmup,
} from "@/lib/speedAI";

/**
 * SpeedAIController
 * Mounts once at the app root. Installs a global hover/touch/focus prefetch
 * delegate and warms high-priority routes during browser idle time so that
 * tapping any tile feels instant.
 *
 * Route loaders are registered from src/App.tsx via registerRoutes().
 */
const SpeedAIController = () => {
  useEffect(() => {
    installGlobalPrefetchDelegate();
    // Most-likely first destinations after the portal/welcome flow.
    startIdleWarmup([
      "/dashboard",
      "/oracle",
      "/welcome",
      "/sign-in",
      "/crisis-hub",
      "/safety-center",
      "/settings",
      "/profile",
    ]);
  }, []);

  return null;
};

export default SpeedAIController;
