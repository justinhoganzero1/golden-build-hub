import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useAllUserMedia = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["all-user-media"],
    queryFn: async () => {
      // Owner sees all media across all users
      const { data, error } = await supabase
        .from("user_media")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
};
