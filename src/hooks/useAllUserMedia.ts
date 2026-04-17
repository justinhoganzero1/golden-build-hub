import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useAllUserMedia = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["all-user-media", user?.id],
    queryFn: async () => {
      // Owner sees all media across all users
      const { data, error } = await supabase
        .from("user_media")
        .select("id,user_id,media_type,title,url,thumbnail_url,source_page,metadata,created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 30_000,
  });
};
