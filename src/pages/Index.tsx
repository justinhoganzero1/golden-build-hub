import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Root route: every visitor — signed in or not — flows straight into the
 * Oracle Lunar dashboard. No sound gate, no intro splash, no sign-in wall.
 * The sign-in / sign-up flow is reachable from inside the dashboard when
 * a user chooses to save their work or unlock a paid feature.
 */
const Index = () => {
  const { loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    navigate("/dashboard", { replace: true });
  }, [loading, navigate]);

  return null;
};

export default Index;

