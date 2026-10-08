/** App-wide shortcut to the single Oracle chat; no separate microphone or chat engine. */
import { useLocation, useNavigate } from "react-router-dom";
import { Bot } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDraggable } from "@/hooks/useDraggable";

export default function OracleAgent() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const drag = useDraggable("oracle-agent-orb-pos", 16, 120);
  if (!user || ["/oracle", "/chat-oracle", "/sign-in", "/auth", "/age-required", "/consent"].some(p => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return <button ref={drag.ref} style={drag.style} {...drag.dragHandlers}
    onClick={() => { if (!drag.justDragged) navigate("/oracle"); }}
    aria-label="Open main Oracle chat" title="Open main Oracle chat"
    className="fixed z-40 h-11 w-11 rounded-full bg-blue-600 border border-sky-300/50 text-white shadow-lg flex items-center justify-center">
    <Bot className="h-5 w-5" />
  </button>;
}
