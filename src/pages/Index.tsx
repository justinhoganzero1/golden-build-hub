import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { needsGuidedUnlock } from "@/lib/oracleDiscovery";
import { welcomeKey } from "@/lib/productionStages";

/**
 * Root route: every visitor — signed in or not — flows straight into the
 * Oracle Lunar dashboard. No sound gate, no intro splash, no sign-in wall.
 * The sign-in / sign-up flow is reachable from inside the dashboard when
 * a user chooses to save their work or unlock a paid feature.
 */
const Index = () => {
  const { loading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    // New members meet Oracle first until they've seen her welcome.
    const isOwner = user?.email?.toLowerCase() === "justinbretthogan@gmail.com";
    const newMember = !!user && needsGuidedUnlock(user.created_at, isOwner) && !localStorage.getItem(welcomeKey(user.id));
    navigate(newMember ? "/oracle" : "/dashboard", { replace: true });
  }, [loading, navigate, user]);

  return null;
};

export default Index;

