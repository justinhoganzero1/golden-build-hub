import PageShell from "@/components/PageShell";
import { User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const ProfilePage = () => {
  const { user, signOut } = useAuth();

  return (
    <PageShell title="Profile" subtitle="Manage your account" icon={<User className="w-6 h-6" />}>
      <div className="space-y-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-muted-foreground text-sm">Email</p>
          <p className="text-foreground">{user?.email || "Not signed in"}</p>
        </div>
        <button
          onClick={signOut}
          className="w-full py-3 bg-destructive text-destructive-foreground rounded-lg font-medium hover:brightness-110 transition-all"
        >
          Sign Out
        </button>
      </div>
    </PageShell>
  );
};

export default ProfilePage;
