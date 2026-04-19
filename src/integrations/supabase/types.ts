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
      advertiser_inquiries: {
        Row: {
          ad_type: string | null
          ai_notes: string | null
          budget: string | null
          company: string
          contact_name: string
          created_at: string
          email: string
          id: string
          message: string
          phone: string | null
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          ad_type?: string | null
          ai_notes?: string | null
          budget?: string | null
          company: string
          contact_name: string
          created_at?: string
          email: string
          id?: string
          message: string
          phone?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          ad_type?: string | null
          ai_notes?: string | null
          budget?: string | null
          company?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          message?: string
          phone?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      app_unlocks: {
        Row: {
          amount_cents: number
          app_key: string
          created_at: string
          currency: string
          id: string
          stripe_payment_intent: string | null
          stripe_session_id: string | null
          unlocked_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          app_key: string
          created_at?: string
          currency?: string
          id?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          unlocked_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          app_key?: string
          created_at?: string
          currency?: string
          id?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
      movie_character_bible: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          personality: string | null
          project_id: string
          reference_image_url: string | null
          updated_at: string
          user_id: string
          visual_seed: string | null
          voice_id: string | null
          voice_name: string | null
          wardrobe: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          personality?: string | null
          project_id: string
          reference_image_url?: string | null
          updated_at?: string
          user_id: string
          visual_seed?: string | null
          voice_id?: string | null
          voice_name?: string | null
          wardrobe?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          personality?: string | null
          project_id?: string
          reference_image_url?: string | null
          updated_at?: string
          user_id?: string
          visual_seed?: string | null
          voice_id?: string | null
          voice_name?: string | null
          wardrobe?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movie_character_bible_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      movie_projects: {
        Row: {
          brief: Json
          completed_at: string | null
          completed_scenes: number | null
          created_at: string
          director_intent: string | null
          error_count: number | null
          estimated_cost_cents: number | null
          failed_scenes: number | null
          final_video_url: string | null
          full_script: string | null
          genre: string | null
          id: string
          last_error: string | null
          logline: string | null
          paid_at: string | null
          payment_status: string
          quality_tier: Database["public"]["Enums"]["movie_quality_tier"]
          shotstack_render_id: string | null
          shotstack_status: string | null
          spent_cost_cents: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["movie_project_status"]
          stripe_payment_intent: string | null
          stripe_session_id: string | null
          target_duration_minutes: number
          thumbnail_status: string | null
          thumbnail_url: string | null
          title: string
          total_scenes: number | null
          trailer_status: string | null
          trailer_url: string | null
          updated_at: string
          user_id: string
          user_paid_cents: number | null
          youtube_metadata: Json | null
          youtube_video_id: string | null
        }
        Insert: {
          brief?: Json
          completed_at?: string | null
          completed_scenes?: number | null
          created_at?: string
          director_intent?: string | null
          error_count?: number | null
          estimated_cost_cents?: number | null
          failed_scenes?: number | null
          final_video_url?: string | null
          full_script?: string | null
          genre?: string | null
          id?: string
          last_error?: string | null
          logline?: string | null
          paid_at?: string | null
          payment_status?: string
          quality_tier?: Database["public"]["Enums"]["movie_quality_tier"]
          shotstack_render_id?: string | null
          shotstack_status?: string | null
          spent_cost_cents?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["movie_project_status"]
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          target_duration_minutes?: number
          thumbnail_status?: string | null
          thumbnail_url?: string | null
          title?: string
          total_scenes?: number | null
          trailer_status?: string | null
          trailer_url?: string | null
          updated_at?: string
          user_id: string
          user_paid_cents?: number | null
          youtube_metadata?: Json | null
          youtube_video_id?: string | null
        }
        Update: {
          brief?: Json
          completed_at?: string | null
          completed_scenes?: number | null
          created_at?: string
          director_intent?: string | null
          error_count?: number | null
          estimated_cost_cents?: number | null
          failed_scenes?: number | null
          final_video_url?: string | null
          full_script?: string | null
          genre?: string | null
          id?: string
          last_error?: string | null
          logline?: string | null
          paid_at?: string | null
          payment_status?: string
          quality_tier?: Database["public"]["Enums"]["movie_quality_tier"]
          shotstack_render_id?: string | null
          shotstack_status?: string | null
          spent_cost_cents?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["movie_project_status"]
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          target_duration_minutes?: number
          thumbnail_status?: string | null
          thumbnail_url?: string | null
          title?: string
          total_scenes?: number | null
          trailer_status?: string | null
          trailer_url?: string | null
          updated_at?: string
          user_id?: string
          user_paid_cents?: number | null
          youtube_metadata?: Json | null
          youtube_video_id?: string | null
        }
        Relationships: []
      }
      movie_render_jobs: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          job_type: string
          locked_at: string | null
          locked_by: string | null
          max_attempts: number | null
          payload: Json | null
          priority: number | null
          project_id: string
          result: Json | null
          scene_id: string | null
          scheduled_for: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type: string
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number | null
          payload?: Json | null
          priority?: number | null
          project_id: string
          result?: Json | null
          scene_id?: string | null
          scheduled_for?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number | null
          payload?: Json | null
          priority?: number | null
          project_id?: string
          result?: Json | null
          scene_id?: string | null
          scheduled_for?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movie_render_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movie_render_jobs_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "movie_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      movie_scenes: {
        Row: {
          audio_url: string | null
          characters: string[] | null
          completed_at: string | null
          created_at: string
          dialogue: Json | null
          duration_seconds: number
          final_scene_url: string | null
          id: string
          last_error: string | null
          lipsync_url: string | null
          location: string | null
          mood: string | null
          music_url: string | null
          project_id: string
          provider_cost_cents: number | null
          retry_count: number | null
          scene_number: number
          script_text: string
          sfx_url: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["movie_scene_status"]
          time_of_day: string | null
          updated_at: string
          user_id: string
          video_1080p_url: string | null
          video_4k_url: string | null
          video_8k_url: string | null
          visual_prompt: string | null
        }
        Insert: {
          audio_url?: string | null
          characters?: string[] | null
          completed_at?: string | null
          created_at?: string
          dialogue?: Json | null
          duration_seconds?: number
          final_scene_url?: string | null
          id?: string
          last_error?: string | null
          lipsync_url?: string | null
          location?: string | null
          mood?: string | null
          music_url?: string | null
          project_id: string
          provider_cost_cents?: number | null
          retry_count?: number | null
          scene_number: number
          script_text: string
          sfx_url?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["movie_scene_status"]
          time_of_day?: string | null
          updated_at?: string
          user_id: string
          video_1080p_url?: string | null
          video_4k_url?: string | null
          video_8k_url?: string | null
          visual_prompt?: string | null
        }
        Update: {
          audio_url?: string | null
          characters?: string[] | null
          completed_at?: string | null
          created_at?: string
          dialogue?: Json | null
          duration_seconds?: number
          final_scene_url?: string | null
          id?: string
          last_error?: string | null
          lipsync_url?: string | null
          location?: string | null
          mood?: string | null
          music_url?: string | null
          project_id?: string
          provider_cost_cents?: number | null
          retry_count?: number | null
          scene_number?: number
          script_text?: string
          sfx_url?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["movie_scene_status"]
          time_of_day?: string | null
          updated_at?: string
          user_id?: string
          video_1080p_url?: string | null
          video_4k_url?: string | null
          video_8k_url?: string | null
          visual_prompt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movie_scenes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects"
            referencedColumns: ["id"]
          },
        ]
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
          friend_subscribed_at: string | null
          granted_to_user_id: string | null
          id: string
          qualifies_at: string | null
          qualifying_subscription_id: string | null
          referral_code: string
          referred_email: string
          referrer_id: string
          reward_granted: boolean | null
          reward_granted_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          friend_subscribed_at?: string | null
          granted_to_user_id?: string | null
          id?: string
          qualifies_at?: string | null
          qualifying_subscription_id?: string | null
          referral_code: string
          referred_email: string
          referrer_id: string
          reward_granted?: boolean | null
          reward_granted_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          friend_subscribed_at?: string | null
          granted_to_user_id?: string | null
          id?: string
          qualifies_at?: string | null
          qualifying_subscription_id?: string | null
          referral_code?: string
          referred_email?: string
          referrer_id?: string
          reward_granted?: boolean | null
          reward_granted_at?: string | null
          status?: string
        }
        Relationships: []
      }
      reward_grants: {
        Row: {
          active: boolean
          created_at: string
          expires_at: string
          id: string
          reason: string
          reward_type: string
          source_referral_id: string | null
          starts_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          expires_at: string
          id?: string
          reason: string
          reward_type?: string
          source_referral_id?: string | null
          starts_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          expires_at?: string
          id?: string
          reason?: string
          reward_type?: string
          source_referral_id?: string | null
          starts_at?: string
          updated_at?: string
          user_id?: string
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
      security_alerts: {
        Row: {
          action_taken: string
          alert_type: string
          created_at: string
          detected_phrase: string | null
          id: string
          severity: string
          user_email: string | null
          user_id: string | null
          user_message: string
          warning_number: number
        }
        Insert: {
          action_taken?: string
          alert_type?: string
          created_at?: string
          detected_phrase?: string | null
          id?: string
          severity?: string
          user_email?: string | null
          user_id?: string | null
          user_message: string
          warning_number?: number
        }
        Update: {
          action_taken?: string
          alert_type?: string
          created_at?: string
          detected_phrase?: string | null
          id?: string
          severity?: string
          user_email?: string | null
          user_id?: string | null
          user_message?: string
          warning_number?: number
        }
        Relationships: []
      }
      site_announcements: {
        Row: {
          active: boolean
          created_at: string
          cta_label: string | null
          cta_url: string | null
          id: string
          message: string
          style: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          id?: string
          message: string
          style?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          id?: string
          message?: string
          style?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          created_at: string
          id: string
          kind: string
          notes: string | null
          page: string
          slot: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          notes?: string | null
          page: string
          slot: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          notes?: string | null
          page?: string
          slot?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
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
      _reschedule_cron: {
        Args: { _command: string; _name: string; _schedule: string }
        Returns: undefined
      }
      claim_next_render_job: {
        Args: { _worker_id: string }
        Returns: {
          attempts: number
          job_id: string
          job_type: string
          payload: Json
          project_id: string
          scene_id: string
          user_id: string
        }[]
      }
      count_user_jailbreak_attempts: {
        Args: { _user_id: string }
        Returns: number
      }
      delete_user_account: { Args: { _user_id: string }; Returns: boolean }
      grant_referral_reward: { Args: { _referral_id: string }; Returns: string }
      grant_signup_welcome: { Args: { _user_id: string }; Returns: string }
      has_active_reward: { Args: { _user_id: string }; Returns: boolean }
      has_app_unlock: {
        Args: { _app_key: string; _user_id: string }
        Returns: boolean
      }
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
      recalc_project_progress: {
        Args: { _project_id: string }
        Returns: undefined
      }
      retry_failed_scene: { Args: { _scene_id: string }; Returns: boolean }
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
      movie_project_status:
        | "draft"
        | "chunking"
        | "queued"
        | "rendering"
        | "stitching"
        | "mixing"
        | "upscaling"
        | "completed"
        | "failed"
        | "paused"
      movie_quality_tier: "sd" | "hd" | "4k" | "8k_ultimate"
      movie_scene_status:
        | "pending"
        | "rendering_video"
        | "rendering_audio"
        | "lip_syncing"
        | "upscaling"
        | "completed"
        | "failed"
        | "skipped"
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
      movie_project_status: [
        "draft",
        "chunking",
        "queued",
        "rendering",
        "stitching",
        "mixing",
        "upscaling",
        "completed",
        "failed",
        "paused",
      ],
      movie_quality_tier: ["sd", "hd", "4k", "8k_ultimate"],
      movie_scene_status: [
        "pending",
        "rendering_video",
        "rendering_audio",
        "lip_syncing",
        "upscaling",
        "completed",
        "failed",
        "skipped",
      ],
    },
  },
} as const
