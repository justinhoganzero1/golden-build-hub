import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";

/** Light-blue "Founding Member" entry bubble. Hidden once all 500 seats are taken. */
const FounderBubble = () => {
  const [left, setLeft] = useState<number | null>(null);
  const { user } = useAuth();
  const { membership } = useMembership();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.rpc("public_founder_seats_left" as any).then(({ data }) => setLeft(typeof data === "number" ? data : null));
  }, []);

  if (left === null || left <= 0 || membership?.founder_number) return null;

  const go = () => navigate(user ? "/membership" : "/sign-in?mode=signup&redirect=/membership");

  return (
    <button
      onClick={go}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-founder text-founder-foreground px-6 py-3 font-semibold shadow-lg hover:brightness-110 transition animate-fade-in"
    >
      Become a Founding Member — only {left} of 500 seats left
    </button>
  );
};

export default FounderBubble;
