import { UserRound, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
export default function OracleAccountMenu() {
  const navigate = useNavigate(); const { signOut } = useAuth();
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Oracle account" title="Account" className="bg-background/80"><UserRound /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="max-h-[75dvh] overflow-y-auto">
      {[["My Library", "/media-library"], ["My account", "/my-account"], ["Membership", "/membership"], ["Wallet", "/wallet"], ["Settings", "/settings"], ["Connected apps", "/settings/authorizations"], ["Help & feedback", "/suggestion-box"], ["Privacy", "/privacy-policy"], ["Terms", "/terms-of-service"]].map(([label, path]) => <DropdownMenuItem key={path} onSelect={() => navigate(path, { state: { oracleWorkspace: true } })}>{label}</DropdownMenuItem>)}
      <DropdownMenuSeparator /><DropdownMenuItem onSelect={() => { void signOut().then(() => navigate("/sign-in", { replace: true })); }}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
    </DropdownMenuContent></DropdownMenu>;
}