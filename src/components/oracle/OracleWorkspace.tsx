import { lazy, Suspense, useRef, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import RequireAuth from "@/components/RequireAuth";
import { useMembership } from "@/hooks/useMembership";
import { useAuth } from "@/contexts/AuthContext";
const OraclePage = lazy(() => import("@/pages/OraclePage"));

export default function OracleWorkspace({ children }: { children: ReactNode }) {
  const location = useLocation(); const navigate = useNavigate();
  const { active: memberActive, exempt, loading } = useMembership();
  const { user } = useAuth();
  const stageContainer = useRef<HTMLDivElement>(null);
  const entered = useRef(false);
  const isOracle = location.pathname === "/oracle";
  if (isOracle || location.state?.oracleWorkspace) entered.current = true;
  if (/^\/(sign-in|auth|ad|website|reimagined|workcover|\.lovable)(\/|$)/.test(location.pathname)) entered.current = false;
  const active = entered.current;
  if (!active) return <>{children}</>;
  return <>
    <div ref={element => { stageContainer.current = element; element?.toggleAttribute("inert", !isOracle); }} aria-hidden={!isOracle}>
      {(isOracle || (!loading && (memberActive || exempt))) && <RequireAuth><Suspense fallback={<div className="h-[100dvh] bg-background" />}><OraclePage key={user?.id || "signed-out"} /></Suspense></RequireAuth>}
    </div>
    {!isOracle && <section role="dialog" aria-modal="true" aria-label="Oracle workspace tool" className="fixed inset-0 z-40 flex flex-col bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-background px-3 py-2">
        <Button variant="outline" onClick={() => navigate("/oracle", { replace: true })}><ArrowLeft className="h-4 w-4" />Back to Oracle</Button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>}
  </>;
}