import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { saveToLibrary } from "@/lib/saveToLibrary";

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
      thumbnail_url?: string;
      metadata?: Record<string, unknown>;
      is_public?: boolean;
    }) => {
      if (!user) throw new Error("Sign in to save to your library");
      const id = await saveToLibrary({
        media_type: media.media_type as any,
        title: media.title,
        url: media.url,
        source_page: media.source_page,
        thumbnail_url: media.thumbnail_url,
        metadata: media.metadata,
        is_public: media.is_public,
      });
      if (!id) throw new Error("Could not save to library");
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-media"] });
      qc.invalidateQueries({ queryKey: ["all-user-media"] });
      try { window.dispatchEvent(new CustomEvent("library:updated")); } catch { /* noop */ }
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
      // `user_media` is the single source of truth for My Library. Dedicated
      // creation tables auto-copy finished assets into this table via database
      // triggers, so library controls always update/delete a real library row.
      const { data, error } = await supabase
        .from("user_media")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}
