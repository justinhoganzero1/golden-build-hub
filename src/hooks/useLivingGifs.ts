import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface LivingGif {
  id: string;
  user_id: string;
  source_avatar_id: string | null;
  source_image_url: string;
  prompt: string;
  title: string | null;
  gif_url: string | null;
  preview_mp4_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number;
  resolution: string;
  status: "pending_payment" | "queued" | "generating" | "running" | "upscaling" | "ready" | "failed";
  is_active_oracle: boolean;
  amount_paid_cents: number;
  error_message: string | null;
  created_at: string;
  generated_at: string | null;
}

export const useLivingGifs = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["living-gifs", user?.id],
    enabled: !!user?.id,
    refetchInterval: (q) => {
      const rows = (q.state.data ?? []) as LivingGif[];
      const active = rows.some((r) =>
        ["queued", "generating", "running", "upscaling"].includes(r.status),
      );
      return active ? 5000 : false;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from("living_gifs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LivingGif[];
    },
  });
};

export const useActiveOracleGif = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["active-oracle-gif", user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("living_gifs")
        .select("*")
        .eq("is_active_oracle", true)
        .eq("status", "ready")
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as LivingGif | null;
    },
  });
};

export const useSetActiveGif = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gifId: string | null) => {
      // Clear all
      await supabase
        .from("living_gifs")
        .update({ is_active_oracle: false })
        .eq("is_active_oracle", true);
      if (gifId) {
        const { error } = await supabase
          .from("living_gifs")
          .update({ is_active_oracle: true })
          .eq("id", gifId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["living-gifs"] });
      qc.invalidateQueries({ queryKey: ["active-oracle-gif"] });
    },
  });
};

export const useDeleteGif = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gifId: string) => {
      const { error } = await supabase.from("living_gifs").delete().eq("id", gifId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["living-gifs"] });
      qc.invalidateQueries({ queryKey: ["active-oracle-gif"] });
    },
  });
};
