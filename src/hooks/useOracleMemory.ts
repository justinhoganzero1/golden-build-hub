import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OracleMemory {
  id: string;
  user_id: string;
  memory_type: string;
  content: string;
  importance: number;
  context: string | null;
  created_at: string;
  updated_at: string;
}

export function useOracleMemories() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["oracle-memories", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("oracle_memories" as any)
        .select("*")
        .order("importance", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as OracleMemory[];
    },
    enabled: !!user,
  });
}

export function useSaveOracleMemory() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (memory: {
      memory_type: string;
      content: string;
      importance?: number;
      context?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("oracle_memories" as any)
        .insert([{ ...memory, user_id: user.id }] as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["oracle-memories"] }),
  });
}

export function useAdPreferences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ad-preferences", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_ad_preferences" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      // If no record exists, create one with defaults
      if (!data) {
        const { data: newData, error: insertError } = await supabase
          .from("user_ad_preferences" as any)
          .insert([{ user_id: user.id, ads_enabled: true }] as any)
          .select()
          .single();
        if (insertError) throw insertError;
        return newData as any;
      }
      return data as any;
    },
    enabled: !!user,
  });
}

export function useUpdateAdPreferences() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("user_ad_preferences" as any)
        .update(updates as any)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ad-preferences"] }),
  });
}

// Check if ~24 hours since last promo
export function shouldShowPromo(lastShown: string | null): boolean {
  if (!lastShown) return true;
  const lastDate = new Date(lastShown);
  const now = new Date();
  const hoursDiff = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
  return hoursDiff >= 24;
}

// Format memories for injection into Oracle system prompt
export function formatMemoriesForPrompt(memories: OracleMemory[]): string {
  if (!memories || memories.length === 0) return "";
  const grouped: Record<string, string[]> = {};
  memories.forEach(m => {
    if (!grouped[m.memory_type]) grouped[m.memory_type] = [];
    grouped[m.memory_type].push(m.content);
  });
  let result = "\n\nYOUR MEMORIES ABOUT THIS USER (use these to personalize interactions):\n";
  for (const [type, items] of Object.entries(grouped)) {
    result += `[${type.toUpperCase()}]: ${items.join("; ")}\n`;
  }
  return result;
}
