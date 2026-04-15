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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      client_platform_config: {
        Row: {
          client_id: string
          created_at: string
          enabled_metrics: string[] | null
          id: string
          is_enabled: boolean
          platform: Database["public"]["Enums"]["platform_type"]
          section_order: number | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          enabled_metrics?: string[] | null
          id?: string
          is_enabled?: boolean
          platform: Database["public"]["Enums"]["platform_type"]
          section_order?: number | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          enabled_metrics?: string[] | null
          id?: string
          is_enabled?: boolean
          platform?: Database["public"]["Enums"]["platform_type"]
          section_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_platform_config_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_recipients: {
        Row: {
          client_id: string
          created_at: string
          email: string
          id: string
          is_primary: boolean | null
          name: string
        }
        Insert: {
          client_id: string
          created_at?: string
          email: string
          id?: string
          is_primary?: boolean | null
          name: string
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string
          id?: string
          is_primary?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_recipients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_share_tokens: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          last_accessed_at: string | null
          org_id: string
          token: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          org_id: string
          token?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          org_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_share_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_share_tokens_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_users: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          invited_email: string | null
          org_id: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          invited_email?: string | null
          org_id: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          invited_email?: string | null
          org_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          account_manager: string | null
          brand_voice: string | null
          business_address: string | null
          business_goals: string | null
          company_name: string
          competitors: string | null
          created_at: string
          created_by: string | null
          email: string | null
          email_alert_warnings: boolean
          email_monthly_digest: boolean
          email_recipient_mode: string
          email_report_delivery: boolean
          email_weekly_update: boolean
          enable_explanations: boolean | null
          enable_mom_comparison: boolean | null
          enable_upsell: boolean | null
          enable_yoy_comparison: boolean | null
          full_name: string
          id: string
          industry: string | null
          is_active: boolean
          logo_url: string | null
          notes: string | null
          org_id: string
          phone: string | null
          position: string | null
          preferred_currency: string | null
          preferred_timezone: string | null
          report_detail_level: string | null
          report_language: string
          reporting_start_date: string | null
          scheduled_deletion_at: string | null
          service_area_type: string
          service_areas: string | null
          services_subscribed: string[] | null
          show_health_score: boolean
          social_handles: Json | null
          target_audience: string | null
          unique_selling_points: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          account_manager?: string | null
          brand_voice?: string | null
          business_address?: string | null
          business_goals?: string | null
          company_name: string
          competitors?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          email_alert_warnings?: boolean
          email_monthly_digest?: boolean
          email_recipient_mode?: string
          email_report_delivery?: boolean
          email_weekly_update?: boolean
          enable_explanations?: boolean | null
          enable_mom_comparison?: boolean | null
          enable_upsell?: boolean | null
          enable_yoy_comparison?: boolean | null
          full_name: string
          id?: string
          industry?: string | null
          is_active?: boolean
          logo_url?: string | null
          notes?: string | null
          org_id: string
          phone?: string | null
          position?: string | null
          preferred_currency?: string | null
          preferred_timezone?: string | null
          report_detail_level?: string | null
          report_language?: string
          reporting_start_date?: string | null
          scheduled_deletion_at?: string | null
          service_area_type?: string
          service_areas?: string | null
          services_subscribed?: string[] | null
          show_health_score?: boolean
          social_handles?: Json | null
          target_audience?: string | null
          unique_selling_points?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          account_manager?: string | null
          brand_voice?: string | null
          business_address?: string | null
          business_goals?: string | null
          company_name?: string
          competitors?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          email_alert_warnings?: boolean
          email_monthly_digest?: boolean
          email_recipient_mode?: string
          email_report_delivery?: boolean
          email_weekly_update?: boolean
          enable_explanations?: boolean | null
          enable_mom_comparison?: boolean | null
          enable_upsell?: boolean | null
          enable_yoy_comparison?: boolean | null
          full_name?: string
          id?: string
          industry?: string | null
          is_active?: boolean
          logo_url?: string | null
          notes?: string | null
          org_id?: string
          phone?: string | null
          position?: string | null
          preferred_currency?: string | null
          preferred_timezone?: string | null
          report_detail_level?: string | null
          report_language?: string
          reporting_start_date?: string | null
          scheduled_deletion_at?: string | null
          service_area_type?: string
          service_areas?: string | null
          services_subscribed?: string[] | null
          show_health_score?: boolean
          social_handles?: Json | null
          target_audience?: string | null
          unique_selling_points?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          is_active: boolean
          org_id: string
          verification_token: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          is_active?: boolean
          org_id: string
          verification_token?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          is_active?: boolean
          org_id?: string
          verification_token?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_domains_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          client_id: string | null
          created_at: string
          email_type: string | null
          error_message: string | null
          id: string
          org_id: string
          recipient_email: string
          report_id: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          email_type?: string | null
          error_message?: string | null
          id?: string
          org_id: string
          recipient_email: string
          report_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          email_type?: string | null
          error_message?: string | null
          id?: string
          org_id?: string
          recipient_email?: string
          report_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      known_devices: {
        Row: {
          first_seen_at: string
          id: string
          ip_hash: string
          ua_hash: string
          user_id: string
        }
        Insert: {
          first_seen_at?: string
          id?: string
          ip_hash: string
          ua_hash: string
          user_id: string
        }
        Update: {
          first_seen_at?: string
          id?: string
          ip_hash?: string
          ua_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      metric_defaults: {
        Row: {
          available_metrics: string[]
          created_at: string
          default_metrics: string[]
          id: string
          platform: Database["public"]["Enums"]["platform_type"]
        }
        Insert: {
          available_metrics?: string[]
          created_at?: string
          default_metrics?: string[]
          id?: string
          platform: Database["public"]["Enums"]["platform_type"]
        }
        Update: {
          available_metrics?: string[]
          created_at?: string
          default_metrics?: string[]
          id?: string
          platform?: Database["public"]["Enums"]["platform_type"]
        }
        Relationships: []
      }
      monthly_snapshots: {
        Row: {
          client_id: string
          created_at: string
          id: string
          metrics_data: Json
          platform: Database["public"]["Enums"]["platform_type"]
          raw_data: Json | null
          report_month: number
          report_year: number
          snapshot_locked: boolean
          top_content: Json | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          metrics_data?: Json
          platform: Database["public"]["Enums"]["platform_type"]
          raw_data?: Json | null
          report_month: number
          report_year: number
          snapshot_locked?: boolean
          top_content?: Json | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          metrics_data?: Json
          platform?: Database["public"]["Enums"]["platform_type"]
          raw_data?: Json | null
          report_month?: number
          report_year?: number
          snapshot_locked?: boolean
          top_content?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_tracking: {
        Row: {
          id: string
          notification_type: string
          reference_id: string
          sent_at: string
        }
        Insert: {
          id?: string
          notification_type: string
          reference_id: string
          sent_at?: string
        }
        Update: {
          id?: string
          notification_type?: string
          reference_id?: string
          sent_at?: string
        }
        Relationships: []
      }
      onboarding_responses: {
        Row: {
          account_type: string
          biggest_challenge: string | null
          client_count: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          org_id: string
          platforms_used: string[] | null
          primary_reason: string | null
          referral_source: string | null
          user_id: string
        }
        Insert: {
          account_type: string
          biggest_challenge?: string | null
          client_count?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          org_id: string
          platforms_used?: string[] | null
          primary_reason?: string | null
          referral_source?: string | null
          user_id: string
        }
        Update: {
          account_type?: string
          biggest_challenge?: string | null
          client_count?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          org_id?: string
          platforms_used?: string[] | null
          primary_reason?: string | null
          referral_source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_responses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_at: string | null
          invited_email: string | null
          org_id: string
          role: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_email?: string | null
          org_id: string
          role?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_email?: string | null
          org_id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_subscriptions: {
        Row: {
          additional_clients: number
          additional_connections: number
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          grace_period_end: string | null
          id: string
          is_custom: boolean
          org_id: string
          override_max_clients: number | null
          override_max_connections: number | null
          plan_id: string
          status: string
          updated_at: string
        }
        Insert: {
          additional_clients?: number
          additional_connections?: number
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_period_end?: string | null
          id?: string
          is_custom?: boolean
          org_id: string
          override_max_clients?: number | null
          override_max_connections?: number | null
          plan_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          additional_clients?: number
          additional_connections?: number
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_period_end?: string | null
          id?: string
          is_custom?: boolean
          org_id?: string
          override_max_clients?: number | null
          override_max_connections?: number | null
          plan_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          accent_color: string | null
          address: string | null
          body_font: string | null
          button_color: string | null
          button_text_color: string | null
          chart_color_1: string | null
          chart_color_2: string | null
          chart_color_3: string | null
          chart_color_4: string | null
          created_at: string
          created_by: string | null
          digest_enabled: boolean
          email: string | null
          heading_font: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          primary_color: string | null
          report_settings: Json | null
          secondary_color: string | null
          show_org_name: boolean | null
          slug: string | null
          team_size: string | null
          text_on_dark: string | null
          text_on_light: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          accent_color?: string | null
          address?: string | null
          body_font?: string | null
          button_color?: string | null
          button_text_color?: string | null
          chart_color_1?: string | null
          chart_color_2?: string | null
          chart_color_3?: string | null
          chart_color_4?: string | null
          created_at?: string
          created_by?: string | null
          digest_enabled?: boolean
          email?: string | null
          heading_font?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          primary_color?: string | null
          report_settings?: Json | null
          secondary_color?: string | null
          show_org_name?: boolean | null
          slug?: string | null
          team_size?: string | null
          text_on_dark?: string | null
          text_on_light?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          accent_color?: string | null
          address?: string | null
          body_font?: string | null
          button_color?: string | null
          button_text_color?: string | null
          chart_color_1?: string | null
          chart_color_2?: string | null
          chart_color_3?: string | null
          chart_color_4?: string | null
          created_at?: string
          created_by?: string | null
          digest_enabled?: boolean
          email?: string | null
          heading_font?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          primary_color?: string | null
          report_settings?: Json | null
          secondary_color?: string | null
          show_org_name?: boolean | null
          slug?: string | null
          team_size?: string | null
          text_on_dark?: string | null
          text_on_light?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_connections: {
        Row: {
          access_token: string | null
          account_id: string | null
          account_name: string | null
          client_id: string
          created_at: string
          id: string
          is_connected: boolean
          last_error: string | null
          last_sync_at: string | null
          last_sync_status: Database["public"]["Enums"]["job_status"] | null
          metadata: Json | null
          platform: Database["public"]["Enums"]["platform_type"]
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          account_id?: string | null
          account_name?: string | null
          client_id: string
          created_at?: string
          id?: string
          is_connected?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          last_sync_status?: Database["public"]["Enums"]["job_status"] | null
          metadata?: Json | null
          platform: Database["public"]["Enums"]["platform_type"]
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          account_id?: string | null
          account_name?: string | null
          client_id?: string
          created_at?: string
          id?: string
          is_connected?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          last_sync_status?: Database["public"]["Enums"]["job_status"] | null
          metadata?: Json | null
          platform?: Database["public"]["Enums"]["platform_type"]
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_connections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string | null
          avatar_url: string | null
          created_at: string
          default_org_id: string | null
          email: string | null
          full_name: string | null
          id: string
          onboarding_completed: boolean | null
          org_id: string | null
          phone: string | null
          position: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: string | null
          avatar_url?: string | null
          created_at?: string
          default_org_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          org_id?: string | null
          phone?: string | null
          position?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string | null
          avatar_url?: string | null
          created_at?: string
          default_org_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          org_id?: string | null
          phone?: string | null
          position?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      report_logs: {
        Row: {
          client_id: string
          created_at: string
          error_message: string | null
          id: string
          org_id: string
          report_id: string | null
          status: Database["public"]["Enums"]["job_status"]
          triggered_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          org_id: string
          report_id?: string | null
          status: Database["public"]["Enums"]["job_status"]
          triggered_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          org_id?: string
          report_id?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_logs_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_upsells: {
        Row: {
          body_content: string
          client_id: string
          comparison_data: Json | null
          created_at: string
          created_by: string | null
          headline: string
          id: string
          is_active: boolean
          org_id: string
          report_month: number
          report_year: number
          service_name: string
        }
        Insert: {
          body_content: string
          client_id: string
          comparison_data?: Json | null
          created_at?: string
          created_by?: string | null
          headline: string
          id?: string
          is_active?: boolean
          org_id: string
          report_month: number
          report_year: number
          service_name: string
        }
        Update: {
          body_content?: string
          client_id?: string
          comparison_data?: Json | null
          created_at?: string
          created_by?: string | null
          headline?: string
          id?: string
          is_active?: boolean
          org_id?: string
          report_month?: number
          report_year?: number
          service_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_upsells_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_upsells_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "report_upsells_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          ai_executive_summary: string | null
          ai_insights: string | null
          ai_upsell_recommendations: string | null
          client_id: string
          created_at: string
          date_from: string | null
          date_to: string | null
          generated_at: string | null
          id: string
          org_id: string
          pdf_storage_path: string | null
          report_month: number
          report_year: number
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }
        Insert: {
          ai_executive_summary?: string | null
          ai_insights?: string | null
          ai_upsell_recommendations?: string | null
          client_id: string
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          generated_at?: string | null
          id?: string
          org_id: string
          pdf_storage_path?: string | null
          report_month: number
          report_year: number
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Update: {
          ai_executive_summary?: string | null
          ai_insights?: string | null
          ai_upsell_recommendations?: string | null
          client_id?: string
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          generated_at?: string | null
          id?: string
          org_id?: string
          pdf_storage_path?: string | null
          report_month?: number
          report_year?: number
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          additional_client_price: number
          additional_connection_price: number
          base_price: number
          created_at: string
          has_whitelabel: boolean
          id: string
          included_clients: number
          included_connections: number
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          additional_client_price?: number
          additional_connection_price?: number
          base_price?: number
          created_at?: string
          has_whitelabel?: boolean
          id?: string
          included_clients?: number
          included_connections?: number
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          additional_client_price?: number
          additional_connection_price?: number
          base_price?: number
          created_at?: string
          has_whitelabel?: boolean
          id?: string
          included_clients?: number
          included_connections?: number
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      sync_jobs: {
        Row: {
          client_id: string
          completed_at: string | null
          connection_id: string
          created_at: string
          current_month: number | null
          current_year: number | null
          error_message: string | null
          force_resync: boolean
          id: string
          months: number
          org_id: string
          platform: Database["public"]["Enums"]["platform_type"]
          priority: number
          progress_completed: number
          progress_total: number
          started_at: string | null
          status: Database["public"]["Enums"]["sync_job_status"]
          target_months: Json | null
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          connection_id: string
          created_at?: string
          current_month?: number | null
          current_year?: number | null
          error_message?: string | null
          force_resync?: boolean
          id?: string
          months?: number
          org_id: string
          platform: Database["public"]["Enums"]["platform_type"]
          priority?: number
          progress_completed?: number
          progress_total?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_job_status"]
          target_months?: Json | null
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          connection_id?: string
          created_at?: string
          current_month?: number | null
          current_year?: number | null
          error_message?: string | null
          force_resync?: boolean
          id?: string
          months?: number
          org_id?: string
          platform?: Database["public"]["Enums"]["platform_type"]
          priority?: number
          progress_completed?: number
          progress_total?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_job_status"]
          target_months?: Json | null
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          client_id: string
          completed_at: string | null
          error_message: string | null
          id: string
          org_id: string
          platform: Database["public"]["Enums"]["platform_type"]
          report_month: number
          report_year: number
          started_at: string
          status: Database["public"]["Enums"]["job_status"]
          triggered_by: string | null
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          error_message?: string | null
          id?: string
          org_id: string
          platform: Database["public"]["Enums"]["platform_type"]
          report_month: number
          report_year: number
          started_at?: string
          status: Database["public"]["Enums"]["job_status"]
          triggered_by?: string | null
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          error_message?: string | null
          id?: string
          org_id?: string
          platform?: Database["public"]["Enums"]["platform_type"]
          report_month?: number
          report_year?: number
          started_at?: string
          status?: Database["public"]["Enums"]["job_status"]
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      voice_briefings: {
        Row: {
          client_id: string
          generated_at: string
          generated_by: string | null
          id: string
          org_id: string
          report_month: number
          report_year: number
          storage_path: string
        }
        Insert: {
          client_id: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          org_id: string
          report_month: number
          report_year: number
          storage_path: string
        }
        Update: {
          client_id?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          org_id?: string
          report_month?: number
          report_year?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_briefings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_briefings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_child_platform_connection: {
        Args: {
          _account_id: string
          _account_name: string
          _client_id: string
          _direct_access_token?: string
          _metadata?: Json
          _platform: Database["public"]["Enums"]["platform_type"]
          _source_connection_id: string
        }
        Returns: string
      }
      get_client_user_info: {
        Args: { _user_id: string }
        Returns: {
          client_id: string
          org_id: string
        }[]
      }
      get_org_by_domain: { Args: { _domain: string }; Returns: string }
      get_portal_client: { Args: { _client_id: string }; Returns: Json }
      get_portal_org: { Args: { _org_id: string }; Returns: Json }
      get_portal_snapshots: {
        Args: { _client_id: string; _month: number; _year: number }
        Returns: Json
      }
      get_recent_auth_events: {
        Args: { _since: string }
        Returns: {
          created_at: string
          factor_type: string
          id: string
          ip: string
          payload: Json
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_client_user: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_owner: { Args: { _user_id: string }; Returns: boolean }
      is_org_owner_of: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      user_belongs_to_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      user_email: { Args: { _user_id: string }; Returns: string }
      user_org_id: { Args: { _user_id: string }; Returns: string }
      validate_share_token: {
        Args: { _token: string }
        Returns: {
          client_id: string
          org_id: string
        }[]
      }
    }
    Enums: {
      app_role: "owner" | "manager"
      job_status: "pending" | "running" | "success" | "failed" | "partial"
      platform_type:
        | "google_ads"
        | "meta_ads"
        | "facebook"
        | "instagram"
        | "tiktok"
        | "linkedin"
        | "google_search_console"
        | "google_analytics"
        | "google_business_profile"
        | "youtube"
        | "pinterest"
        | "tiktok_ads"
        | "linkedin_ads"
        | "threads"
      sync_job_status: "pending" | "processing" | "completed" | "failed"
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
      app_role: ["owner", "manager"],
      job_status: ["pending", "running", "success", "failed", "partial"],
      platform_type: [
        "google_ads",
        "meta_ads",
        "facebook",
        "instagram",
        "tiktok",
        "linkedin",
        "google_search_console",
        "google_analytics",
        "google_business_profile",
        "youtube",
        "pinterest",
        "tiktok_ads",
        "linkedin_ads",
        "threads",
      ],
      sync_job_status: ["pending", "processing", "completed", "failed"],
    },
  },
} as const
