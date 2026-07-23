import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const PAGE_SIZE = 60;
// NOTE: `url` and `metadata` are intentionally excluded from list queries.
// Some rows store base64 data URIs directly in `url` (avatars, stories) that
// balloon the payload past PostgREST's statement timeout. The list only needs
// `thumbnail_url` for the grid; the detail modal re-fetches `url`/`metadata`
// by id when a card is opened.
const COLS = "id,user_id,media_type,title,thumbnail_url,source_page,created_at";

// Backward-compatible flat hook (now capped + indexed for speed)
export const useAllUserMedia = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["all-user-media", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_media")
        .select(COLS)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 30_000,
  });
};

// Cursor-paginated hook for the admin library
export const useAllUserMediaPaginated = (enabledOverride = true, pageSize = PAGE_SIZE) => {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ["all-user-media-paginated", user?.id, pageSize],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      let q = supabase
        .from("user_media")
        .select(COLS)
        .order("created_at", { ascending: false })
        .limit(pageSize);
      if (pageParam) q = q.lt("created_at", pageParam);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    getNextPageParam: (lastPage) =>
      lastPage.length === pageSize ? lastPage[lastPage.length - 1].created_at : undefined,
    enabled: !!user && enabledOverride,
    staleTime: 30_000,
  });
};
