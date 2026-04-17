import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserAvatars } from "@/hooks/useUserAvatars";

/**
 * Master Avatar — the single avatar marked is_default=true with purpose='oracle'.
 * Persisted in the database so it survives across sign-outs and devices.
 */
export function useMasterAvatar() {
  const { data: avatars = [] } = useUserAvatars();
  const master = avatars.find((a) => a.is_default && a.purpose === "oracle")
    ?? avatars.find((a) => a.purpose === "oracle")
    ?? null;
  return master;
}

export function useSetMasterAvatar() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (avatarId: string) => {
      if (!user) throw new Error("Not authenticated");
      // Clear any existing default oracle avatars
      await supabase
        .from("user_avatars")
        .update({ is_default: false })
        .eq("user_id", user.id)
        .eq("purpose", "oracle");
      // Promote selected avatar (and ensure purpose is oracle)
      const { error } = await supabase
        .from("user_avatars")
        .update({ is_default: true, purpose: "oracle" })
        .eq("id", avatarId);
      if (error) throw error;
      // Mirror to localStorage so OraclePage picks it up immediately
      try {
        localStorage.setItem(
          "solace-oracle-mode",
          JSON.stringify({ mode: "avatar", avatarId })
        );
      } catch {}
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-avatars"] }),
  });
}
