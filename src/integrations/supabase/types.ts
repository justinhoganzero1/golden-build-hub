export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      calendar_events: {
        Row: {
          category: string | null
          color: string | null
          created_at: string
          description: string | null
          end_time: string | null
          event_date: string
          id: string
          remind_days_before: number | null
          start_time: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          event_date: string
          id?: string
          remind_days_before?: number | null
          start_time?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          event_date?: string
          id?: string
          remind_days_before?: number | null
          start_time?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_comments: {
        Row: {
          ai_moderation_notes: string | null
          commenter_email: string | null
          commenter_name: string
          created_at: string
          id: string
          message: string
          moderation_status: string
          updated_at: string
        }
        Insert: {
          ai_moderation_notes?: string | null
          commenter_email?: string | null
          commenter_name: string
          created_at?: string
          id?: string
          message: string
          moderation_status?: string
          updated_at?: string
        }
        Update: {
          ai_moderation_notes?: string | null
          commenter_email?: string | null
          commenter_name?: string
          created_at?: string
          id?: string
          message?: string
          moderation_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      diary_entries: {
        Row: {
          category: string | null
          content: string
          created_at: string
          entry_date: string
          id: string
          mood: string | null
          tags: string[] | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          entry_date: string
          id?: string
          mood?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          entry_date?: string
          id?: string
          mood?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      inquiry_leads: {
        Row: {
          ai_summary: string | null
          created_at: string
          email: string | null
          id: string
          interest: string | null
          message: string
          name: string | null
          phone: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interest?: string | null
          message: string
          name?: string | null
          phone?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interest?: string | null
          message?: string
          name?: string | null
          phone?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      install_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          platform: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          platform: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          platform?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      investment_offers: {
        Row: {
          ai_notes: string | null
          ai_score: number | null
          created_at: string
          id: string
          investor_email: string
          investor_name: string
          message: string
          offer_amount: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ai_notes?: string | null
          ai_score?: number | null
          created_at?: string
          id?: string
          investor_email: string
          investor_name: string
          message: string
          offer_amount?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ai_notes?: string | null
          ai_score?: number | null
          created_at?: string
          id?: string
          investor_email?: string
          investor_name?: string
          message?: string
          offer_amount?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      oracle_memories: {
        Row: {
          content: string
          context: string | null
          created_at: string
          id: string
          importance: number
          memory_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          context?: string | null
          created_at?: string
          id?: string
          importance?: number
          memory_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          context?: string | null
          created_at?: string
          id?: string
          importance?: number
          memory_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referral_code: string
          referred_email: string
          referrer_id: string
          reward_granted: boolean | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          referral_code: string
          referred_email: string
          referrer_id: string
          reward_granted?: boolean | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          referral_code?: string
          referred_email?: string
          referrer_id?: string
          reward_granted?: boolean | null
          status?: string
        }
        Relationships: []
      }
      saved_voices: {
        Row: {
          accent: string | null
          created_at: string
          gender: string | null
          id: string
          name: string
          profession: string | null
          source: string
          updated_at: string
          user_id: string
          voice_config: Json | null
          voice_style: string | null
        }
        Insert: {
          accent?: string | null
          created_at?: string
          gender?: string | null
          id?: string
          name: string
          profession?: string | null
          source?: string
          updated_at?: string
          user_id: string
          voice_config?: Json | null
          voice_style?: string | null
        }
        Update: {
          accent?: string | null
          created_at?: string
          gender?: string | null
          id?: string
          name?: string
          profession?: string | null
          source?: string
          updated_at?: string
          user_id?: string
          voice_config?: Json | null
          voice_style?: string | null
        }
        Relationships: []
      }
      special_occasions: {
        Row: {
          category: string | null
          created_at: string
          icon: string | null
          id: string
          notes: string | null
          occasion_date: string
          remind_days_before: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          notes?: string | null
          occasion_date: string
          remind_days_before?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          notes?: string | null
          occasion_date?: string
          remind_days_before?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suggestions: {
        Row: {
          ai_quality_score: number | null
          ai_response: string | null
          category: string
          created_at: string
          granted_free_access: boolean | null
          id: string
          status: string
          suggestion: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_quality_score?: number | null
          ai_response?: string | null
          category?: string
          created_at?: string
          granted_free_access?: boolean | null
          id?: string
          status?: string
          suggestion: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_quality_score?: number | null
          ai_response?: string | null
          category?: string
          created_at?: string
          granted_free_access?: boolean | null
          id?: string
          status?: string
          suggestion?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_ad_preferences: {
        Row: {
          ads_enabled: boolean
          created_at: string
          free_trials_used: Json
          id: string
          last_promo_shown_at: string | null
          promo_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ads_enabled?: boolean
          created_at?: string
          free_trials_used?: Json
          id?: string
          last_promo_shown_at?: string | null
          promo_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ads_enabled?: boolean
          created_at?: string
          free_trials_used?: Json
          id?: string
          last_promo_shown_at?: string | null
          promo_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_avatars: {
        Row: {
          art_style: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_default: boolean | null
          name: string
          personality: string | null
          purpose: string
          updated_at: string
          user_id: string
          voice_style: string | null
        }
        Insert: {
          art_style?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          personality?: string | null
          purpose?: string
          updated_at?: string
          user_id: string
          voice_style?: string | null
        }
        Update: {
          art_style?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          personality?: string | null
          purpose?: string
          updated_at?: string
          user_id?: string
          voice_style?: string | null
        }
        Relationships: []
      }
      user_media: {
        Row: {
          created_at: string
          id: string
          media_type: string
          metadata: Json | null
          source_page: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_type?: string
          metadata?: Json | null
          source_page?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          media_type?: string
          metadata?: Json | null
          source_page?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      creator_comments_public: {
        Row: {
          commenter_name: string | null
          created_at: string | null
          id: string | null
          message: string | null
          moderation_status: string | null
        }
        Insert: {
          commenter_name?: string | null
          created_at?: string | null
          id?: string | null
          message?: string | null
          moderation_status?: string | null
        }
        Update: {
          commenter_name?: string | null
          created_at?: string | null
          id?: string | null
          message?: string | null
          moderation_status?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_owner: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "investigator"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user", "investigator"],
    },
  },
} as const
