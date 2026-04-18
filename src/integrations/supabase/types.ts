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
      call_charges: {
        Row: {
          created_at: string
          destination: string
          duration_seconds: number
          id: string
          rate_per_minute_cents: number
          service_fee_cents: number
          status: string
          total_billed_cents: number
          twilio_call_sid: string | null
          twilio_cost_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          destination: string
          duration_seconds?: number
          id?: string
          rate_per_minute_cents?: number
          service_fee_cents?: number
          status?: string
          total_billed_cents?: number
          twilio_call_sid?: string | null
          twilio_cost_cents?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          destination?: string
          duration_seconds?: number
          id?: string
          rate_per_minute_cents?: number
          service_fee_cents?: number
          status?: string
          total_billed_cents?: number
          twilio_call_sid?: string | null
          twilio_cost_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      call_sessions: {
        Row: {
          caller_name: string | null
          caller_number: string | null
          created_at: string
          direction: string
          ended_at: string | null
          hold_started_at: string | null
          id: string
          intent: string | null
          last_caller_message: string | null
          pending_user_reply: string | null
          status: string
          transcript: Json
          twilio_call_sid: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          caller_name?: string | null
          caller_number?: string | null
          created_at?: string
          direction: string
          ended_at?: string | null
          hold_started_at?: string | null
          id?: string
          intent?: string | null
          last_caller_message?: string | null
          pending_user_reply?: string | null
          status?: string
          transcript?: Json
          twilio_call_sid?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          caller_name?: string | null
          caller_number?: string | null
          created_at?: string
          direction?: string
          ended_at?: string | null
          hold_started_at?: string | null
          id?: string
          intent?: string | null
          last_caller_message?: string | null
          pending_user_reply?: string | null
          status?: string
          transcript?: Json
          twilio_call_sid?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      connect_accounts: {
        Row: {
          contact_email: string | null
          created_at: string
          display_name: string | null
          id: string
          stripe_account_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          stripe_account_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          stripe_account_id?: string
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
      lead_magnet_uses: {
        Row: {
          converted_to_signup: boolean | null
          created_at: string
          id: string
          prompt: string | null
          result_preview: string | null
          tool: string
          visitor_id: string | null
        }
        Insert: {
          converted_to_signup?: boolean | null
          created_at?: string
          id?: string
          prompt?: string | null
          result_preview?: string | null
          tool: string
          visitor_id?: string | null
        }
        Update: {
          converted_to_signup?: boolean | null
          created_at?: string
          id?: string
          prompt?: string | null
          result_preview?: string | null
          tool?: string
          visitor_id?: string | null
        }
        Relationships: []
      }
      oracle_chat_usage: {
        Row: {
          created_at: string
          id: string
          message_count: number
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_count?: number
          updated_at?: string
          usage_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_count?: number
          updated_at?: string
          usage_date?: string
          user_id?: string
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
      page_views: {
        Row: {
          created_at: string
          id: string
          page: string
          referrer: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          page?: string
          referrer?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          page?: string
          referrer?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
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
      site_edits: {
        Row: {
          after_text: string
          before_text: string | null
          change_type: string
          created_at: string
          id: string
          notes: string | null
          page: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          after_text: string
          before_text?: string | null
          change_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          page: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          after_text?: string
          before_text?: string | null
          change_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          page?: string
          status?: string
          updated_at?: string
          user_id?: string
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
      user_assistant_settings: {
        Row: {
          call_answering_enabled: boolean
          created_at: string
          greeting: string
          hold_message: string
          id: string
          outbound_calls_enabled: boolean
          personal_phone: string | null
          reply_channel: string
          twilio_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          call_answering_enabled?: boolean
          created_at?: string
          greeting?: string
          hold_message?: string
          id?: string
          outbound_calls_enabled?: boolean
          personal_phone?: string | null
          reply_channel?: string
          twilio_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          call_answering_enabled?: boolean
          created_at?: string
          greeting?: string
          hold_message?: string
          id?: string
          outbound_calls_enabled?: boolean
          personal_phone?: string | null
          reply_channel?: string
          twilio_number?: string | null
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
      user_claims: {
        Row: {
          address: string | null
          ai_draft: string | null
          ai_research: Json | null
          bank_account: string | null
          body_parts: string | null
          claim_type: string
          created_at: string
          date_of_birth: string | null
          doctor_name: string | null
          doctor_phone: string | null
          email: string | null
          employer: string | null
          employment_start: string | null
          full_name: string | null
          hospital: string | null
          id: string
          income_amount: string | null
          injury_date: string | null
          injury_description: string | null
          job_title: string | null
          last_worked_date: string | null
          member_number: string | null
          notes: string | null
          phone: string | null
          provider: string
          status: string
          super_member_number: string | null
          updated_at: string
          user_id: string
          workcover_claim_number: string | null
        }
        Insert: {
          address?: string | null
          ai_draft?: string | null
          ai_research?: Json | null
          bank_account?: string | null
          body_parts?: string | null
          claim_type?: string
          created_at?: string
          date_of_birth?: string | null
          doctor_name?: string | null
          doctor_phone?: string | null
          email?: string | null
          employer?: string | null
          employment_start?: string | null
          full_name?: string | null
          hospital?: string | null
          id?: string
          income_amount?: string | null
          injury_date?: string | null
          injury_description?: string | null
          job_title?: string | null
          last_worked_date?: string | null
          member_number?: string | null
          notes?: string | null
          phone?: string | null
          provider?: string
          status?: string
          super_member_number?: string | null
          updated_at?: string
          user_id: string
          workcover_claim_number?: string | null
        }
        Update: {
          address?: string | null
          ai_draft?: string | null
          ai_research?: Json | null
          bank_account?: string | null
          body_parts?: string | null
          claim_type?: string
          created_at?: string
          date_of_birth?: string | null
          doctor_name?: string | null
          doctor_phone?: string | null
          email?: string | null
          employer?: string | null
          employment_start?: string | null
          full_name?: string | null
          hospital?: string | null
          id?: string
          income_amount?: string | null
          injury_date?: string | null
          injury_description?: string | null
          job_title?: string | null
          last_worked_date?: string | null
          member_number?: string | null
          notes?: string | null
          phone?: string | null
          provider?: string
          status?: string
          super_member_number?: string | null
          updated_at?: string
          user_id?: string
          workcover_claim_number?: string | null
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
      wallet_balances: {
        Row: {
          balance_cents: number
          created_at: string
          currency: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_cents?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_cents?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
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
      increment_oracle_usage: {
        Args: { _limit: number; _user_id: string }
        Returns: {
          daily_limit: number
          new_count: number
          over_limit: boolean
        }[]
      }
      is_owner: { Args: never; Returns: boolean }
      wallet_charge_call: {
        Args: {
          _destination: string
          _duration_seconds: number
          _twilio_call_sid: string
          _twilio_cost_cents: number
          _user_id: string
        }
        Returns: {
          charge_id: string
          insufficient: boolean
          new_balance_cents: number
          total_billed_cents: number
        }[]
      }
      wallet_topup: {
        Args: { _amount_cents: number; _user_id: string }
        Returns: number
      }
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
