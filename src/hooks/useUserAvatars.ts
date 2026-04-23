import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserAvatar {
  id: string;
  user_id: string;
  name: string;
  purpose: string;
  voice_style: string;
  personality: string;
  image_url: string | null;
  art_style: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useUserAvatars() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["user-avatars", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_avatars")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as UserAvatar[];
    },
    enabled: !!user,
  });

  return query;
}

export function useCreateAvatar() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (avatar: {
      name: string;
      purpose: string;
      voice_style: string;
      personality: string;
      image_url: string | null;
      art_style: string;
      description: string | null;
      is_default?: boolean;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("user_avatars")
        .insert({ ...avatar, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data as UserAvatar;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-avatars"] }),
  });
}

export function useDeleteAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_avatars").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-avatars"] }),
  });
}

export function useSaveMedia() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (media: {
      media_type: string;
      title: string;
      url: string;
      source_page: string;
      metadata?: Record<string, unknown>;
    }) => {
      if (!user) throw new Error("Sign in to save to your library");
      const { error } = await supabase
        .from("user_media")
        .insert([{ ...media, user_id: user.id }] as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-media"] });
      qc.invalidateQueries({ queryKey: ["all-user-media"] });
    },
    onError: (e: any) => {
      console.error("[useSaveMedia] failed:", e?.message || e);
    },
  });
}

export function useUserMedia() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-media", user?.id],
    queryFn: async () => {
      if (!user) return [];
      // Pull user_media + completed living_gifs + completed movie_projects in parallel
      // so EVERY creation surfaces in the Library, even modules that store output
      // in their own dedicated tables.
      const [mediaRes, gifsRes, moviesRes] = await Promise.all([
        supabase.from("user_media").select("*").order("created_at", { ascending: false }),
        supabase.from("living_gifs")
          .select("id,user_id,title,prompt,gif_url,preview_mp4_url,thumbnail_url,created_at,status")
          .eq("status", "completed"),
        supabase.from("movie_projects")
          .select("id,user_id,title,final_video_url,thumbnail_url,trailer_url,created_at,status")
          .eq("status", "completed"),
      ]);
      if (mediaRes.error) throw mediaRes.error;

      const mediaItems = mediaRes.data || [];
      const gifItems = (gifsRes.data || [])
        .filter((g: any) => g.gif_url || g.preview_mp4_url)
        .map((g: any) => ({
          id: `gif:${g.id}`,
          user_id: g.user_id,
          media_type: "video",
          title: g.title || (g.prompt ? g.prompt.slice(0, 60) : "Living GIF"),
          url: g.gif_url || g.preview_mp4_url,
          thumbnail_url: g.thumbnail_url,
          source_page: "living-gif-studio",
          metadata: { source: "living_gifs" },
          created_at: g.created_at,
        }));
      const movieItems = (moviesRes.data || [])
        .filter((m: any) => m.final_video_url)
        .map((m: any) => ({
          id: `movie:${m.id}`,
          user_id: m.user_id,
          media_type: "video",
          title: m.title || "Movie",
          url: m.final_video_url,
          thumbnail_url: m.thumbnail_url || m.trailer_url,
          source_page: "movie-studio",
          metadata: { source: "movie_projects" },
          created_at: m.created_at,
        }));

      return [...mediaItems, ...gifItems, ...movieItems].sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: !!user,
  });
}
