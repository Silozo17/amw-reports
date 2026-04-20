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
      client_portal_upsells: {
        Row: {
          category: Database["public"]["Enums"]["portal_upsell_category"]
          client_id: string
          created_at: string
          cta_label: string
          cta_url: string | null
          description: string | null
          id: string
          is_active: boolean
          org_id: string
          price_label: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["portal_upsell_category"]
          client_id: string
          created_at?: string
          cta_label?: string
          cta_url?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          org_id: string
          price_label?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["portal_upsell_category"]
          client_id?: string
          created_at?: string
          cta_label?: string
          cta_url?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          org_id?: string
          price_label?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_upsells_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_upsells_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_upsells_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_content_lab_churn_signals"
            referencedColumns: ["org_id"]
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
          {
            foreignKeyName: "client_share_tokens_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_content_lab_churn_signals"
            referencedColumns: ["org_id"]
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
          {
            foreignKeyName: "client_users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_content_lab_churn_signals"
            referencedColumns: ["org_id"]
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
          show_portal_upsells: boolean
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
          show_portal_upsells?: boolean
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
          show_portal_upsells?: boolean
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
          {
            foreignKeyName: "clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_content_lab_churn_signals"
            referencedColumns: ["org_id"]
          },
        ]
      }
      content_lab_benchmark_pool: {
        Row: {
          created_at: string
          display_name: string | null
          follower_count: number | null
          handle: string
          id: string
          last_post_at: string | null
          median_engagement_rate: number | null
          median_views: number | null
          niche_tag: string
          platform: string
          posts_analysed: number | null
          profile_url: string | null
          rejection_reason: string | null
          status: string
          thumbnail_url: string | null
          updated_at: string
          verified_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          follower_count?: number | null
          handle: string
          id?: string
          last_post_at?: string | null
          median_engagement_rate?: number | null
          median_views?: number | null
          niche_tag: string
          platform: string
          posts_analysed?: number | null
          profile_url?: string | null
          rejection_reason?: string | null
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
          verified_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          follower_count?: number | null
          handle?: string
          id?: string
          last_post_at?: string | null
          median_engagement_rate?: number | null
          median_views?: number | null
          niche_tag?: string
          platform?: string
          posts_analysed?: number | null
          profile_url?: string | null
          rejection_reason?: string | null
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
          verified_at?: string
        }
        Relationships: []
      }
      content_lab_credit_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          org_id: string
          reason: string
          run_id: string | null
          stripe_event_id: string | null
          stripe_payment_id: string | null
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          org_id: string
          reason: string
          run_id?: string | null
          stripe_event_id?: string | null
          stripe_payment_id?: string | null
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          org_id?: string
          reason?: string
          run_id?: string | null
          stripe_event_id?: string | null
          stripe_payment_id?: string | null
        }
        Relationships: []
      }
      content_lab_credits: {
        Row: {
          balance: number
          created_at: string
          lifetime_purchased: number
          lifetime_used: number
          org_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          lifetime_purchased?: number
          lifetime_used?: number
          org_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          lifetime_purchased?: number
          lifetime_used?: number
          org_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_lab_hooks: {
        Row: {
          created_at: string
          engagement_score: number | null
          hook_text: string
          id: string
          mechanism: string | null
          run_id: string
          source_post_id: string | null
          why_it_works: string | null
        }
        Insert: {
          created_at?: string
          engagement_score?: number | null
          hook_text: string
          id?: string
          mechanism?: string | null
          run_id: string
          source_post_id?: string | null
          why_it_works?: string | null
        }
        Update: {
          created_at?: string
          engagement_score?: number | null
          hook_text?: string
          id?: string
          mechanism?: string | null
          run_id?: string
          source_post_id?: string | null
          why_it_works?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_lab_hooks_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "content_lab_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_lab_hooks_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "v_content_lab_regen_rate"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "content_lab_hooks_source_post_id_fkey"
            columns: ["source_post_id"]
            isOneToOne: false
            referencedRelation: "content_lab_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_lab_ideas: {
        Row: {
          actual_comments: number | null
          actual_engagement_rate: number | null
          actual_likes: number | null
          actual_views: number | null
          based_on_post_id: string | null
          body: string | null
          caption: string | null
          caption_with_hashtag: string | null
          created_at: string
          cta: string | null
          duration_seconds: number | null
          filming_checklist: string[]
          hashtags: string[]
          hook: string | null
          hook_variants: Json
          id: string
          idea_number: number
          is_wildcard: boolean
          last_modified_via: string | null
          linked_at: string | null
          linked_post_id: string | null
          platform_style_notes: string | null
          rating: number | null
          regen_count: number
          remix_count: number
          run_id: string
          script_full: string | null
          status: string
          target_platform: string | null
          title: string
          visual_direction: string | null
          why_it_works: string | null
        }
        Insert: {
          actual_comments?: number | null
          actual_engagement_rate?: number | null
          actual_likes?: number | null
          actual_views?: number | null
          based_on_post_id?: string | null
          body?: string | null
          caption?: string | null
          caption_with_hashtag?: string | null
          created_at?: string
          cta?: string | null
          duration_seconds?: number | null
          filming_checklist?: string[]
          hashtags?: string[]
          hook?: string | null
          hook_variants?: Json
          id?: string
          idea_number: number
          is_wildcard?: boolean
          last_modified_via?: string | null
          linked_at?: string | null
          linked_post_id?: string | null
          platform_style_notes?: string | null
          rating?: number | null
          regen_count?: number
          remix_count?: number
          run_id: string
          script_full?: string | null
          status?: string
          target_platform?: string | null
          title: string
          visual_direction?: string | null
          why_it_works?: string | null
        }
        Update: {
          actual_comments?: number | null
          actual_engagement_rate?: number | null
          actual_likes?: number | null
          actual_views?: number | null
          based_on_post_id?: string | null
          body?: string | null
          caption?: string | null
          caption_with_hashtag?: string | null
          created_at?: string
          cta?: string | null
          duration_seconds?: number | null
          filming_checklist?: string[]
          hashtags?: string[]
          hook?: string | null
          hook_variants?: Json
          id?: string
          idea_number?: number
          is_wildcard?: boolean
          last_modified_via?: string | null
          linked_at?: string | null
          linked_post_id?: string | null
          platform_style_notes?: string | null
          rating?: number | null
          regen_count?: number
          remix_count?: number
          run_id?: string
          script_full?: string | null
          status?: string
          target_platform?: string | null
          title?: string
          visual_direction?: string | null
          why_it_works?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_lab_ideas_based_on_post_id_fkey"
            columns: ["based_on_post_id"]
            isOneToOne: false
            referencedRelation: "content_lab_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_lab_ideas_linked_post_id_fkey"
            columns: ["linked_post_id"]
            isOneToOne: false
            referencedRelation: "content_lab_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_lab_ideas_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "content_lab_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_lab_ideas_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "v_content_lab_regen_rate"
            referencedColumns: ["run_id"]
          },
        ]
      }
      content_lab_niches: {
        Row: {
          admired_accounts: Json
          brand_brief: Json
          brand_voice_snapshot: Json | null
          client_id: string
          competitor_accounts: Json
          competitor_urls: string[]
          content_styles: string[]
          created_at: string
          discovered_at: string | null
          do_not_use: string[]
          id: string
          industry_slug: string | null
          label: string
          language: string
          location: string | null
          media_types: string[]
          niche_description: string | null
          niche_tag: string | null
          org_id: string
          own_handle: string | null
          platforms_to_scrape: string[]
          pool_status: string
          posting_cadence: string | null
          producer_type: string | null
          tone_of_voice: string | null
          top_competitors: Json
          top_global_benchmarks: Json
          tracked_handles: Json
          tracked_hashtags: string[]
          tracked_keywords: string[]
          updated_at: string
          video_length_preference: string | null
          voice_built_at: string | null
          website: string | null
        }
        Insert: {
          admired_accounts?: Json
          brand_brief?: Json
          brand_voice_snapshot?: Json | null
          client_id: string
          competitor_accounts?: Json
          competitor_urls?: string[]
          content_styles?: string[]
          created_at?: string
          discovered_at?: string | null
          do_not_use?: string[]
          id?: string
          industry_slug?: string | null
          label: string
          language?: string
          location?: string | null
          media_types?: string[]
          niche_description?: string | null
          niche_tag?: string | null
          org_id: string
          own_handle?: string | null
          platforms_to_scrape?: string[]
          pool_status?: string
          posting_cadence?: string | null
          producer_type?: string | null
          tone_of_voice?: string | null
          top_competitors?: Json
          top_global_benchmarks?: Json
          tracked_handles?: Json
          tracked_hashtags?: string[]
          tracked_keywords?: string[]
          updated_at?: string
          video_length_preference?: string | null
          voice_built_at?: string | null
          website?: string | null
        }
        Update: {
          admired_accounts?: Json
          brand_brief?: Json
          brand_voice_snapshot?: Json | null
          client_id?: string
          competitor_accounts?: Json
          competitor_urls?: string[]
          content_styles?: string[]
          created_at?: string
          discovered_at?: string | null
          do_not_use?: string[]
          id?: string
          industry_slug?: string | null
          label?: string
          language?: string
          location?: string | null
          media_types?: string[]
          niche_description?: string | null
          niche_tag?: string | null
          org_id?: string
          own_handle?: string | null
          platforms_to_scrape?: string[]
          pool_status?: string
          posting_cadence?: string | null
          producer_type?: string | null
          tone_of_voice?: string | null
          top_competitors?: Json
          top_global_benchmarks?: Json
          tracked_handles?: Json
          tracked_hashtags?: string[]
          tracked_keywords?: string[]
          updated_at?: string
          video_length_preference?: string | null
          voice_built_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_lab_niches_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_lab_niches_industry_slug_fkey"
            columns: ["industry_slug"]
            isOneToOne: false
            referencedRelation: "content_lab_verticals"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "content_lab_niches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_lab_niches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_content_lab_churn_signals"
            referencedColumns: ["org_id"]
          },
        ]
      }
      content_lab_pool_refresh_jobs: {
        Row: {
          candidates_found: number | null
          candidates_verified: number | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          niche_tag: string
          platform: string
          started_at: string | null
          status: string
          triggered_by_org_id: string | null
          updated_at: string
        }
        Insert: {
          candidates_found?: number | null
          candidates_verified?: number | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          niche_tag: string
          platform: string
          started_at?: string | null
          status?: string
          triggered_by_org_id?: string | null
          updated_at?: string
        }
        Update: {
          candidates_found?: number | null
          candidates_verified?: number | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          niche_tag?: string
          platform?: string
          started_at?: string | null
          status?: string
          triggered_by_org_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      content_lab_posts: {
        Row: {
          ai_summary: string | null
          author_handle: string
          bucket: string | null
          caption: string | null
          comments: number
          created_at: string
          engagement_rate: number
          hashtags: string[]
          hook_text: string | null
          hook_type: string | null
          id: string
          likes: number
          mentions: string[]
          music_artist: string | null
          music_title: string | null
          platform: Database["public"]["Enums"]["content_lab_platform"]
          post_type: string | null
          post_url: string | null
          posted_at: string | null
          run_id: string
          shares: number
          source: Database["public"]["Enums"]["content_lab_post_source"]
          tagged_users: string[]
          thumbnail_url: string | null
          transcript: string | null
          video_duration_seconds: number | null
          views: number
        }
        Insert: {
          ai_summary?: string | null
          author_handle: string
          bucket?: string | null
          caption?: string | null
          comments?: number
          created_at?: string
          engagement_rate?: number
          hashtags?: string[]
          hook_text?: string | null
          hook_type?: string | null
          id?: string
          likes?: number
          mentions?: string[]
          music_artist?: string | null
          music_title?: string | null
          platform: Database["public"]["Enums"]["content_lab_platform"]
          post_type?: string | null
          post_url?: string | null
          posted_at?: string | null
          run_id: string
          shares?: number
          source: Database["public"]["Enums"]["content_lab_post_source"]
          tagged_users?: string[]
          thumbnail_url?: string | null
          transcript?: string | null
          video_duration_seconds?: number | null
          views?: number
        }
        Update: {
          ai_summary?: string | null
          author_handle?: string
          bucket?: string | null
          caption?: string | null
          comments?: number
          created_at?: string
          engagement_rate?: number
          hashtags?: string[]
          hook_text?: string | null
          hook_type?: string | null
          id?: string
          likes?: number
          mentions?: string[]
          music_artist?: string | null
          music_title?: string | null
          platform?: Database["public"]["Enums"]["content_lab_platform"]
          post_type?: string | null
          post_url?: string | null
          posted_at?: string | null
          run_id?: string
          shares?: number
          source?: Database["public"]["Enums"]["content_lab_post_source"]
          tagged_users?: string[]
          thumbnail_url?: string | null
          transcript?: string | null
          video_duration_seconds?: number | null
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_lab_posts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "content_lab_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_lab_posts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "v_content_lab_regen_rate"
            referencedColumns: ["run_id"]
          },
        ]
      }
      content_lab_run_share_tokens: {
        Row: {
          client_logo_url: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          last_viewed_at: string | null
          org_id: string
          run_id: string
          slug: string
          view_count: number
        }
        Insert: {
          client_logo_url?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_viewed_at?: string | null
          org_id: string
          run_id: string
          slug?: string
          view_count?: number
        }
        Update: {
          client_logo_url?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_viewed_at?: string | null
          org_id?: string
          run_id?: string
          slug?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_lab_run_share_tokens_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_lab_run_share_tokens_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_content_lab_churn_signals"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "content_lab_run_share_tokens_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "content_lab_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_lab_run_share_tokens_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "v_content_lab_regen_rate"
            referencedColumns: ["run_id"]
          },
        ]
      }
      content_lab_runs: {
        Row: {
          client_id: string
          completed_at: string | null
          cost_pence: number
          created_at: string
          email_on_complete: boolean
          error_message: string | null
          id: string
          niche_id: string
          org_id: string
          pdf_storage_path: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["content_lab_run_status"]
          summary: Json
          triggered_by: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          cost_pence?: number
          created_at?: string
          email_on_complete?: boolean
          error_message?: string | null
          id?: string
          niche_id: string
          org_id: string
          pdf_storage_path?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["content_lab_run_status"]
          summary?: Json
          triggered_by?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          cost_pence?: number
          created_at?: string
          email_on_complete?: boolean
          error_message?: string | null
          id?: string
          niche_id?: string
          org_id?: string
          pdf_storage_path?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["content_lab_run_status"]
          summary?: Json
          triggered_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_lab_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_lab_runs_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "content_lab_niches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_lab_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_lab_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_content_lab_churn_signals"
            referencedColumns: ["org_id"]
          },
        ]
      }
      content_lab_seed_pool: {
        Row: {
          avg_views_est: number | null
          created_at: string
          display_name: string | null
          followers_est: number | null
          geo: string | null
          handle: string
          id: string
          is_active: boolean
          notes: string | null
          platform: string
          sub_niche: string | null
          updated_at: string
          verified_at: string | null
          vertical_slug: string
        }
        Insert: {
          avg_views_est?: number | null
          created_at?: string
          display_name?: string | null
          followers_est?: number | null
          geo?: string | null
          handle: string
          id?: string
          is_active?: boolean
          notes?: string | null
          platform: string
          sub_niche?: string | null
          updated_at?: string
          verified_at?: string | null
          vertical_slug: string
        }
        Update: {
          avg_views_est?: number | null
          created_at?: string
          display_name?: string | null
          followers_est?: number | null
          geo?: string | null
          handle?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          platform?: string
          sub_niche?: string | null
          updated_at?: string
          verified_at?: string | null
          vertical_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_lab_seed_pool_vertical_slug_fkey"
            columns: ["vertical_slug"]
            isOneToOne: false
            referencedRelation: "content_lab_verticals"
            referencedColumns: ["slug"]
          },
        ]
      }
      content_lab_step_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          message: string | null
          payload: Json
          run_id: string
          started_at: string
          status: Database["public"]["Enums"]["content_lab_step_status"]
          step: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          message?: string | null
          payload?: Json
          run_id: string
          started_at?: string
          status: Database["public"]["Enums"]["content_lab_step_status"]
          step: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          message?: string | null
          payload?: Json
          run_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["content_lab_step_status"]
          step?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_lab_step_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "content_lab_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_lab_step_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "v_content_lab_regen_rate"
            referencedColumns: ["run_id"]
          },
        ]
      }
      content_lab_swipe_file: {
        Row: {
          client_id: string | null
          id: string
          idea_id: string
          niche_id: string | null
          notes: string | null
          org_id: string
          saved_at: string
          saved_by_user_id: string
          tags: string[]
        }
        Insert: {
          client_id?: string | null
          id?: string
          idea_id: string
          niche_id?: string | null
          notes?: string | null
          org_id: string
          saved_at?: string
          saved_by_user_id: string
          tags?: string[]
        }
        Update: {
          client_id?: string | null
          id?: string
          idea_id?: string
          niche_id?: string | null
          notes?: string | null
          org_id?: string
          saved_at?: string
          saved_by_user_id?: string
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "content_lab_swipe_file_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_lab_swipe_file_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "content_lab_ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_lab_swipe_file_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "content_lab_niches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_lab_swipe_file_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_lab_swipe_file_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_content_lab_churn_signals"
            referencedColumns: ["org_id"]
          },
        ]
      }
      content_lab_swipe_insights: {
        Row: {
          generated_at: string
          ideas_count: number
          org_id: string
          pattern_breakdown: Json
          summary: string
        }
        Insert: {
          generated_at?: string
          ideas_count?: number
          org_id: string
          pattern_breakdown?: Json
          summary: string
        }
        Update: {
          generated_at?: string
          ideas_count?: number
          org_id?: string
          pattern_breakdown?: Json
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_lab_swipe_insights_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_lab_swipe_insights_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "v_content_lab_churn_signals"
            referencedColumns: ["org_id"]
          },
        ]
      }
      content_lab_trends: {
        Row: {
          created_at: string
          description: string | null
          id: string
          label: string
          momentum: string | null
          recommendation: string | null
          run_id: string
          supporting_post_ids: string[]
          verification_source: string | null
          verification_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          label: string
          momentum?: string | null
          recommendation?: string | null
          run_id: string
          supporting_post_ids?: string[]
          verification_source?: string | null
          verification_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          momentum?: string | null
          recommendation?: string | null
          run_id?: string
          supporting_post_ids?: string[]
          verification_source?: string | null
          verification_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_lab_trends_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "content_lab_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_lab_trends_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "v_content_lab_regen_rate"
            referencedColumns: ["run_id"]
          },
        ]
      }
      content_lab_usage: {
        Row: {
          created_at: string
          id: string
          month: number
          org_id: string
          runs_count: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          month: number
          org_id: string
          runs_count?: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          month?: number
          org_id?: string
          runs_count?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      content_lab_verticals: {
        Row: {
          created_at: string
          display_name: string
          geo_focus: string | null
          keyword_queries: string[]
          min_posts_floor: number
          min_views_facebook: number
          min_views_instagram: number
          min_views_tiktok: number
          notes: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          geo_focus?: string | null
          keyword_queries?: string[]
          min_posts_floor?: number
          min_views_facebook?: number
          min_views_instagram?: number
          min_views_tiktok?: number
          notes?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          geo_focus?: string | null
          keyword_queries?: string[]
          min_posts_floor?: number
          min_views_facebook?: number
          min_views_instagram?: number
          min_views_tiktok?: number
          notes?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "custom_domains_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_content_lab_churn_signals"
            referencedColumns: ["org_id"]
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
            foreignKeyName: "email_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_content_lab_churn_signals"
            referencedColumns: ["org_id"]
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
          {
            foreignKeyName: "onboarding_responses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_content_lab_churn_signals"
            referencedColumns: ["org_id"]
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
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_content_lab_churn_signals"
            referencedColumns: ["org_id"]
          },
        ]
      }
      org_subscriptions: {
        Row: {
          additional_clients: number
          additional_connections: number
          content_lab_onboarded_at: string | null
          content_lab_tier: string | null
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
          content_lab_onboarded_at?: string | null
          content_lab_tier?: string | null
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
          content_lab_onboarded_at?: string | null
          content_lab_tier?: string | null
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
            foreignKeyName: "org_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "v_content_lab_churn_signals"
            referencedColumns: ["org_id"]
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
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_content_lab_churn_signals"
            referencedColumns: ["org_id"]
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
            foreignKeyName: "report_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_content_lab_churn_signals"
            referencedColumns: ["org_id"]
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
          {
            foreignKeyName: "report_upsells_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_content_lab_churn_signals"
            referencedColumns: ["org_id"]
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
          {
            foreignKeyName: "reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_content_lab_churn_signals"
            referencedColumns: ["org_id"]
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
          {
            foreignKeyName: "sync_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_content_lab_churn_signals"
            referencedColumns: ["org_id"]
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
          {
            foreignKeyName: "voice_briefings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_content_lab_churn_signals"
            referencedColumns: ["org_id"]
          },
        ]
      }
    }
    Views: {
      v_content_lab_churn_signals: {
        Row: {
          content_lab_tier: string | null
          current_credit_balance: number | null
          days_since_last_run: number | null
          last_run_at: string | null
          lifetime_runs: number | null
          org_id: string | null
          org_name: string | null
        }
        Relationships: []
      }
      v_content_lab_mrr_by_tier: {
        Row: {
          mrr_gbp: number | null
          org_count: number | null
          tier: string | null
        }
        Relationships: []
      }
      v_content_lab_pool_quality: {
        Row: {
          industry_slug: string | null
          limited_count: number | null
          limited_pct: number | null
          niche_count: number | null
        }
        Relationships: []
      }
      v_content_lab_regen_rate: {
        Row: {
          avg_regens_per_idea: number | null
          idea_count: number | null
          org_id: string | null
          run_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_lab_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_lab_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_content_lab_churn_signals"
            referencedColumns: ["org_id"]
          },
        ]
      }
      v_content_lab_run_completion: {
        Row: {
          completed: number | null
          completion_rate_pct: number | null
          failed: number | null
          industry_slug: string | null
          total: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_content_lab_credits: {
        Args: { _amount: number; _org_id: string; _stripe_payment_id?: string }
        Returns: number
      }
      consume_content_lab_credit: {
        Args: { _amount?: number; _org_id: string; _run_id: string }
        Returns: boolean
      }
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
      get_content_lab_analytics: { Args: never; Returns: Json }
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
      get_shared_run: { Args: { _slug: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_content_lab_usage: {
        Args: { _org_id: string }
        Returns: number
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
      record_share_view: { Args: { _slug: string }; Returns: undefined }
      refund_content_lab_credit: {
        Args: { _ledger_id: string; _refund_reason: string }
        Returns: undefined
      }
      slugify_niche_tag: { Args: { _label: string }; Returns: string }
      spend_content_lab_credit: {
        Args: {
          _amount: number
          _org_id: string
          _reason: string
          _run_id?: string
        }
        Returns: string
      }
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
      content_lab_platform: "instagram" | "tiktok" | "facebook"
      content_lab_post_source: "oauth" | "apify"
      content_lab_run_status:
        | "pending"
        | "scraping"
        | "analysing"
        | "ideating"
        | "rendering"
        | "completed"
        | "failed"
        | "discovering"
        | "completed_empty"
      content_lab_step_status: "started" | "ok" | "failed"
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
      portal_upsell_category:
        | "paid_ads"
        | "seo"
        | "organic_content"
        | "email"
        | "web"
        | "other"
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
      content_lab_platform: ["instagram", "tiktok", "facebook"],
      content_lab_post_source: ["oauth", "apify"],
      content_lab_run_status: [
        "pending",
        "scraping",
        "analysing",
        "ideating",
        "rendering",
        "completed",
        "failed",
        "discovering",
        "completed_empty",
      ],
      content_lab_step_status: ["started", "ok", "failed"],
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
      portal_upsell_category: [
        "paid_ads",
        "seo",
        "organic_content",
        "email",
        "web",
        "other",
      ],
      sync_job_status: ["pending", "processing", "completed", "failed"],
    },
  },
} as const
