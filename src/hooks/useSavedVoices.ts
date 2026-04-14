import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SavedVoice {
  id: string;
  user_id: string;
  name: string;
  gender: string;
  accent: string | null;
  profession: string | null;
  voice_style: string | null;
  source: string;
  voice_config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export function useSavedVoices() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["saved-voices", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("saved_voices" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SavedVoice[];
    },
    enabled: !!user,
  });
}

export function useSaveVoice() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (voice: {
      name: string;
      gender?: string;
      accent?: string;
      profession?: string;
      voice_style?: string;
      source: string;
      voice_config?: Record<string, unknown>;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("saved_voices" as any)
        .insert([{ ...voice, user_id: user.id }] as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as SavedVoice;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-voices"] }),
  });
}

export function useDeleteSavedVoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_voices" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-voices"] }),
  });
}
