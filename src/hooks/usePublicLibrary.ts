import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PublicItemKind = "media" | "gif" | "movie";

export interface PublicLibraryItem {
  id: string;
  kind: PublicItemKind;
  user_id: string;
  title: string | null;
  url: string;
  thumbnail_url: string | null;
  media_type: string;
  created_at: string;
  shop_enabled: boolean;
  shop_price_cents: number;
  creator_display_name: string | null;
  download_count: number;
  view_count: number;
  source_page?: string | null;
}

const PAGE_SIZE = 60;

export const usePublicLibrary = (filter: "all" | "shop" | PublicItemKind = "all") => {
  return useQuery({
    queryKey: ["public-library", filter],
    queryFn: async (): Promise<PublicLibraryItem[]> => {
      const [mediaRes, gifsRes, moviesRes] = await Promise.all([
        supabase
          .from("user_media")
          .select(
            "id,user_id,title,url,thumbnail_url,media_type,created_at,shop_enabled,shop_price_cents,creator_display_name,download_count,view_count,source_page"
          )
          .eq("is_public", true)
          .order("created_at", { ascending: false })
          .limit(PAGE_SIZE),
        supabase
          .from("living_gifs")
          .select(
            "id,user_id,title,gif_url,preview_mp4_url,thumbnail_url,created_at,shop_enabled,shop_price_cents,creator_display_name,download_count,view_count"
          )
          .eq("is_public", true)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(PAGE_SIZE),
        supabase
          .from("movie_projects")
          .select(
            "id,user_id,title,final_video_url,thumbnail_url,created_at,shop_enabled,shop_price_cents,creator_display_name,download_count,view_count"
          )
          .eq("is_public", true)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(PAGE_SIZE),
      ]);

      if (mediaRes.error) throw mediaRes.error;
      if (gifsRes.error) throw gifsRes.error;
      if (moviesRes.error) throw moviesRes.error;

      const items: PublicLibraryItem[] = [];

      (mediaRes.data || []).forEach((m: any) =>
        items.push({
          id: m.id,
          kind: "media",
          user_id: m.user_id,
          title: m.title,
          url: m.url,
          thumbnail_url: m.thumbnail_url,
          media_type: m.media_type,
          created_at: m.created_at,
          shop_enabled: !!m.shop_enabled,
          shop_price_cents: m.shop_price_cents || 0,
          creator_display_name: m.creator_display_name,
          download_count: m.download_count || 0,
          view_count: m.view_count || 0,
          source_page: m.source_page,
        })
      );

      (gifsRes.data || []).forEach((g: any) =>
        items.push({
          id: g.id,
          kind: "gif",
          user_id: g.user_id,
          title: g.title,
          url: g.gif_url || g.preview_mp4_url || "",
          thumbnail_url: g.thumbnail_url,
          media_type: g.gif_url ? "gif" : "video",
          created_at: g.created_at,
          shop_enabled: !!g.shop_enabled,
          shop_price_cents: g.shop_price_cents || 0,
          creator_display_name: g.creator_display_name,
          download_count: g.download_count || 0,
          view_count: g.view_count || 0,
        })
      );

      (moviesRes.data || []).forEach((mv: any) =>
        items.push({
          id: mv.id,
          kind: "movie",
          user_id: mv.user_id,
          title: mv.title,
          url: mv.final_video_url || "",
          thumbnail_url: mv.thumbnail_url,
          media_type: "video",
          created_at: mv.created_at,
          shop_enabled: !!mv.shop_enabled,
          shop_price_cents: mv.shop_price_cents || 0,
          creator_display_name: mv.creator_display_name,
          download_count: mv.download_count || 0,
          view_count: mv.view_count || 0,
        })
      );

      // Filter
      const filtered =
        filter === "all"
          ? items
          : filter === "shop"
          ? items.filter((i) => i.shop_enabled && i.shop_price_cents > 0)
          : items.filter((i) => i.kind === filter);

      // Sort newest first across all sources
      filtered.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return filtered;
    },
    staleTime: 30_000,
  });
};
