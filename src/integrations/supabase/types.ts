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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_token_grants: {
        Row: {
          acknowledged: boolean
          created_at: string
          duration_hours: number
          expires_at: string
          granted_at: string
          granted_by: string
          id: string
          user_id: string
        }
        Insert: {
          acknowledged?: boolean
          created_at?: string
          duration_hours?: number
          expires_at?: string
          granted_at?: string
          granted_by: string
          id?: string
          user_id: string
        }
        Update: {
          acknowledged?: boolean
          created_at?: string
          duration_hours?: number
          expires_at?: string
          granted_at?: string
          granted_by?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      allowed_short_uploaders: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      allowed_uploaders: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      anime: {
        Row: {
          banner_image: string | null
          content_rating: string | null
          cover_image: string | null
          created_at: string
          description: string | null
          genres: string[] | null
          id: string
          is_crunchyroll: boolean
          is_eng_dub: boolean
          is_featured: boolean | null
          is_muse: boolean
          like_count: number | null
          release_year: number | null
          schedule_day: number | null
          source_material: string | null
          status: string | null
          studio: string | null
          title: string
          total_episodes: number | null
          trailer_url: string | null
          type: string | null
          updated_at: string
          uploader_id: string | null
          view_count: number | null
        }
        Insert: {
          banner_image?: string | null
          content_rating?: string | null
          cover_image?: string | null
          created_at?: string
          description?: string | null
          genres?: string[] | null
          id?: string
          is_crunchyroll?: boolean
          is_eng_dub?: boolean
          is_featured?: boolean | null
          is_muse?: boolean
          like_count?: number | null
          release_year?: number | null
          schedule_day?: number | null
          source_material?: string | null
          status?: string | null
          studio?: string | null
          title: string
          total_episodes?: number | null
          trailer_url?: string | null
          type?: string | null
          updated_at?: string
          uploader_id?: string | null
          view_count?: number | null
        }
        Update: {
          banner_image?: string | null
          content_rating?: string | null
          cover_image?: string | null
          created_at?: string
          description?: string | null
          genres?: string[] | null
          id?: string
          is_crunchyroll?: boolean
          is_eng_dub?: boolean
          is_featured?: boolean | null
          is_muse?: boolean
          like_count?: number | null
          release_year?: number | null
          schedule_day?: number | null
          source_material?: string | null
          status?: string | null
          studio?: string | null
          title?: string
          total_episodes?: number | null
          trailer_url?: string | null
          type?: string | null
          updated_at?: string
          uploader_id?: string | null
          view_count?: number | null
        }
        Relationships: []
      }
      anime_reviews: {
        Row: {
          anime_id: string
          created_at: string
          id: string
          rating: number
          review_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          anime_id: string
          created_at?: string
          id?: string
          rating: number
          review_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          anime_id?: string
          created_at?: string
          id?: string
          rating?: number
          review_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anime_reviews_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anime_reviews_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime_public"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          is_like: boolean
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          is_like?: boolean
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          is_like?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_notifications: {
        Row: {
          comment_id: string
          created_at: string
          episode_id: string
          id: string
          is_read: boolean
          replier_id: string
          reply_id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          episode_id: string
          id?: string
          is_read?: boolean
          replier_id: string
          reply_id: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          episode_id?: string
          id?: string
          is_read?: boolean
          replier_id?: string
          reply_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_notifications_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_notifications_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_reports: {
        Row: {
          admin_notes: string | null
          comment_id: string
          created_at: string
          id: string
          reason: string
          reporter_id: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          comment_id: string
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          comment_id?: string
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          episode_id: string
          id: string
          parent_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          episode_id: string
          id?: string
          parent_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          episode_id?: string
          id?: string
          parent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      episodes: {
        Row: {
          ai_recap: string | null
          ai_recap_generated_at: string | null
          audio_language: string | null
          captions_url: string | null
          created_at: string
          description: string | null
          duration: number | null
          episode_number: number
          external_url: string | null
          id: string
          intro_end_time: number | null
          intro_start_time: number | null
          outro_end_time: number | null
          outro_start_time: number | null
          season_id: string
          short_id: string | null
          thumbnail: string | null
          title: string
          video_url: string | null
        }
        Insert: {
          ai_recap?: string | null
          ai_recap_generated_at?: string | null
          audio_language?: string | null
          captions_url?: string | null
          created_at?: string
          description?: string | null
          duration?: number | null
          episode_number: number
          external_url?: string | null
          id?: string
          intro_end_time?: number | null
          intro_start_time?: number | null
          outro_end_time?: number | null
          outro_start_time?: number | null
          season_id: string
          short_id?: string | null
          thumbnail?: string | null
          title: string
          video_url?: string | null
        }
        Update: {
          ai_recap?: string | null
          ai_recap_generated_at?: string | null
          audio_language?: string | null
          captions_url?: string | null
          created_at?: string
          description?: string | null
          duration?: number | null
          episode_number?: number
          external_url?: string | null
          id?: string
          intro_end_time?: number | null
          intro_start_time?: number | null
          outro_end_time?: number | null
          outro_start_time?: number | null
          season_id?: string
          short_id?: string | null
          thumbnail?: string | null
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "episodes_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_hero_lineup: {
        Row: {
          anime_id: string
          created_at: string
          custom_banner_url: string | null
          custom_cover_url: string | null
          custom_title: string | null
          id: string
          is_active: boolean
          position: number
          updated_at: string
        }
        Insert: {
          anime_id: string
          created_at?: string
          custom_banner_url?: string | null
          custom_cover_url?: string | null
          custom_title?: string | null
          id?: string
          is_active?: boolean
          position: number
          updated_at?: string
        }
        Update: {
          anime_id?: string
          created_at?: string
          custom_banner_url?: string | null
          custom_cover_url?: string | null
          custom_title?: string | null
          id?: string
          is_active?: boolean
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_hero_lineup_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: true
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_hero_lineup_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: true
            referencedRelation: "anime_public"
            referencedColumns: ["id"]
          },
        ]
      }
      flox_content: {
        Row: {
          banner_url: string | null
          created_at: string
          description: string | null
          episode_number: number | null
          id: string
          is_featured: boolean
          poster_url: string | null
          season_number: number | null
          sort_order: number
          source_type: string
          source_url: string
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          episode_number?: number | null
          id?: string
          is_featured?: boolean
          poster_url?: string | null
          season_number?: number | null
          sort_order?: number
          source_type: string
          source_url: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          episode_number?: number | null
          id?: string
          is_featured?: boolean
          poster_url?: string | null
          season_number?: number | null
          sort_order?: number
          source_type?: string
          source_url?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      notification_queue: {
        Row: {
          anime_id: string | null
          body: string
          created_at: string
          delivered_via: string
          episode_id: string | null
          id: string
          image_url: string | null
          is_read: boolean
          link: string | null
          title: string
          user_id: string
        }
        Insert: {
          anime_id?: string | null
          body: string
          created_at?: string
          delivered_via?: string
          episode_id?: string | null
          id?: string
          image_url?: string | null
          is_read?: boolean
          link?: string | null
          title: string
          user_id: string
        }
        Update: {
          anime_id?: string | null
          body?: string
          created_at?: string
          delivered_via?: string
          episode_id?: string | null
          id?: string
          image_url?: string | null
          is_read?: boolean
          link?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recap_analytics: {
        Row: {
          completed: boolean
          context: string
          created_at: string
          duration_seconds: number
          episode_id: string
          id: string
          opened_at: string
          user_id: string | null
          watch_party_id: string | null
        }
        Insert: {
          completed?: boolean
          context?: string
          created_at?: string
          duration_seconds?: number
          episode_id: string
          id?: string
          opened_at?: string
          user_id?: string | null
          watch_party_id?: string | null
        }
        Update: {
          completed?: boolean
          context?: string
          created_at?: string
          duration_seconds?: number
          episode_id?: string
          id?: string
          opened_at?: string
          user_id?: string | null
          watch_party_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recap_analytics_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recap_analytics_watch_party_id_fkey"
            columns: ["watch_party_id"]
            isOneToOne: false
            referencedRelation: "watch_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          anime_id: string
          created_at: string
          id: string
          is_upcoming: boolean
          release_date: string | null
          season_number: number
          title: string | null
        }
        Insert: {
          anime_id: string
          created_at?: string
          id?: string
          is_upcoming?: boolean
          release_date?: string | null
          season_number: number
          title?: string | null
        }
        Update: {
          anime_id?: string
          created_at?: string
          id?: string
          is_upcoming?: boolean
          release_date?: string | null
          season_number?: number
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seasons_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seasons_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime_public"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_push_log: {
        Row: {
          episode_id: string
          id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          episode_id: string
          id?: string
          sent_at?: string
          user_id: string
        }
        Update: {
          episode_id?: string
          id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shadow_flix_content: {
        Row: {
          banner_url: string | null
          created_at: string
          description: string | null
          episode_number: number | null
          genre: string | null
          genres: string[] | null
          id: string
          is_featured: boolean
          season_number: number | null
          sort_order: number
          thumbnail_url: string | null
          title: string
          updated_at: string
          uploaded_by: string
          video_url: string | null
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          episode_number?: number | null
          genre?: string | null
          genres?: string[] | null
          id?: string
          is_featured?: boolean
          season_number?: number | null
          sort_order?: number
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          uploaded_by: string
          video_url?: string | null
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          episode_number?: number | null
          genre?: string | null
          genres?: string[] | null
          id?: string
          is_featured?: boolean
          season_number?: number | null
          sort_order?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string
          video_url?: string | null
        }
        Relationships: []
      }
      shadow_flix_continue_watching: {
        Row: {
          created_at: string
          duration: number
          episode_id: string
          id: string
          position: number
          series_title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration?: number
          episode_id: string
          id?: string
          position?: number
          series_title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration?: number
          episode_id?: string
          id?: string
          position?: number
          series_title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shadow_flix_player_preferences: {
        Row: {
          created_at: string
          id: string
          theme_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          theme_key?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          theme_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shadow_flix_player_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_collection_likes: {
        Row: {
          collection_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_collection_likes_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "shared_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_collections: {
        Row: {
          anime_ids: string[]
          created_at: string
          description: string | null
          id: string
          likes: number
          share_token: string
          title: string
          updated_at: string
          user_id: string
          views: number
        }
        Insert: {
          anime_ids?: string[]
          created_at?: string
          description?: string | null
          id?: string
          likes?: number
          share_token?: string
          title: string
          updated_at?: string
          user_id: string
          views?: number
        }
        Update: {
          anime_ids?: string[]
          created_at?: string
          description?: string | null
          id?: string
          likes?: number
          share_token?: string
          title?: string
          updated_at?: string
          user_id?: string
          views?: number
        }
        Relationships: []
      }
      shorts: {
        Row: {
          created_at: string
          description: string | null
          duration: number
          end_time: number
          episode_id: string | null
          id: string
          start_time: number
          tags: string[] | null
          thumbnail: string | null
          title: string
          updated_at: string
          uploader_id: string
          video_url: string
          view_count: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration: number
          end_time?: number
          episode_id?: string | null
          id?: string
          start_time?: number
          tags?: string[] | null
          thumbnail?: string | null
          title: string
          updated_at?: string
          uploader_id: string
          video_url: string
          view_count?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          duration?: number
          end_time?: number
          episode_id?: string | null
          id?: string
          start_time?: number
          tags?: string[] | null
          thumbnail?: string | null
          title?: string
          updated_at?: string
          uploader_id?: string
          video_url?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shorts_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      shorts_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          short_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          short_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          short_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shorts_comments_short_id_fkey"
            columns: ["short_id"]
            isOneToOne: false
            referencedRelation: "shorts"
            referencedColumns: ["id"]
          },
        ]
      }
      shorts_likes: {
        Row: {
          created_at: string
          id: string
          short_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          short_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          short_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shorts_likes_short_id_fkey"
            columns: ["short_id"]
            isOneToOne: false
            referencedRelation: "shorts"
            referencedColumns: ["id"]
          },
        ]
      }
      token_usage: {
        Row: {
          expires_at: number | null
          id: string
          token_id: string
          used_at: string
          user_agent: string | null
          user_id: string | null
          user_ip: string | null
        }
        Insert: {
          expires_at?: number | null
          id?: string
          token_id: string
          used_at?: string
          user_agent?: string | null
          user_id?: string | null
          user_ip?: string | null
        }
        Update: {
          expires_at?: number | null
          id?: string
          token_id?: string
          used_at?: string
          user_agent?: string | null
          user_id?: string | null
          user_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "token_usage_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "unlock_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      unlock_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          duration_hours: number
          id: string
          is_active: boolean
          token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duration_hours?: number
          id?: string
          is_active?: boolean
          token?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duration_hours?: number
          id?: string
          is_active?: boolean
          token?: string
        }
        Relationships: []
      }
      upload_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      uploader_applications: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          reason: string
          sample_work: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          reason: string
          sample_work?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          reason?: string
          sample_work?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_bans: {
        Row: {
          banned_at: string
          created_at: string
          expires_at: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          banned_at?: string
          created_at?: string
          expires_at: string
          id?: string
          reason?: string
          user_id: string
        }
        Update: {
          banned_at?: string
          created_at?: string
          expires_at?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      user_favorites: {
        Row: {
          anime_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          anime_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          anime_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorites_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorites_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_genre_preferences: {
        Row: {
          genre: string
          id: string
          updated_at: string
          user_id: string
          watch_count: number | null
        }
        Insert: {
          genre: string
          id?: string
          updated_at?: string
          user_id: string
          watch_count?: number | null
        }
        Update: {
          genre?: string
          id?: string
          updated_at?: string
          user_id?: string
          watch_count?: number | null
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
          role?: Database["public"]["Enums"]["app_role"]
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
      video_conversions: {
        Row: {
          audio_channels: number | null
          audio_codec: string | null
          audio_sample_rate: number | null
          compatibility_details: Json | null
          container_format: string | null
          conversion_completed_at: string | null
          conversion_progress: number | null
          conversion_stage: string | null
          conversion_started_at: string | null
          created_at: string
          episode_id: string | null
          error_message: string | null
          estimated_seconds_remaining: number | null
          file_size_bytes: number | null
          hls_path: string | null
          hls_url: string | null
          id: string
          ios_compatible: boolean | null
          ios_file_size_bytes: number | null
          ios_ready_path: string | null
          ios_ready_url: string | null
          is_10bit: boolean | null
          is_hevc: boolean | null
          max_retries: number | null
          needs_conversion: boolean | null
          original_path: string | null
          original_url: string
          pixel_format: string | null
          retry_count: number | null
          status: string
          subtitle_format: string | null
          updated_at: string
          video_codec: string | null
          video_profile: string | null
          worker_id: string | null
        }
        Insert: {
          audio_channels?: number | null
          audio_codec?: string | null
          audio_sample_rate?: number | null
          compatibility_details?: Json | null
          container_format?: string | null
          conversion_completed_at?: string | null
          conversion_progress?: number | null
          conversion_stage?: string | null
          conversion_started_at?: string | null
          created_at?: string
          episode_id?: string | null
          error_message?: string | null
          estimated_seconds_remaining?: number | null
          file_size_bytes?: number | null
          hls_path?: string | null
          hls_url?: string | null
          id?: string
          ios_compatible?: boolean | null
          ios_file_size_bytes?: number | null
          ios_ready_path?: string | null
          ios_ready_url?: string | null
          is_10bit?: boolean | null
          is_hevc?: boolean | null
          max_retries?: number | null
          needs_conversion?: boolean | null
          original_path?: string | null
          original_url: string
          pixel_format?: string | null
          retry_count?: number | null
          status?: string
          subtitle_format?: string | null
          updated_at?: string
          video_codec?: string | null
          video_profile?: string | null
          worker_id?: string | null
        }
        Update: {
          audio_channels?: number | null
          audio_codec?: string | null
          audio_sample_rate?: number | null
          compatibility_details?: Json | null
          container_format?: string | null
          conversion_completed_at?: string | null
          conversion_progress?: number | null
          conversion_stage?: string | null
          conversion_started_at?: string | null
          created_at?: string
          episode_id?: string | null
          error_message?: string | null
          estimated_seconds_remaining?: number | null
          file_size_bytes?: number | null
          hls_path?: string | null
          hls_url?: string | null
          id?: string
          ios_compatible?: boolean | null
          ios_file_size_bytes?: number | null
          ios_ready_path?: string | null
          ios_ready_url?: string | null
          is_10bit?: boolean | null
          is_hevc?: boolean | null
          max_retries?: number | null
          needs_conversion?: boolean | null
          original_path?: string | null
          original_url?: string
          pixel_format?: string | null
          retry_count?: number | null
          status?: string
          subtitle_format?: string | null
          updated_at?: string
          video_codec?: string | null
          video_profile?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_conversions_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: true
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_history: {
        Row: {
          anime_id: string
          completed: boolean | null
          completed_at: string | null
          duration: number | null
          episode_id: string
          id: string
          last_position: number | null
          progress: number | null
          user_id: string
          watched_at: string
        }
        Insert: {
          anime_id: string
          completed?: boolean | null
          completed_at?: string | null
          duration?: number | null
          episode_id: string
          id?: string
          last_position?: number | null
          progress?: number | null
          user_id: string
          watched_at?: string
        }
        Update: {
          anime_id?: string
          completed?: boolean | null
          completed_at?: string | null
          duration?: number | null
          episode_id?: string
          id?: string
          last_position?: number | null
          progress?: number | null
          user_id?: string
          watched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_history_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_history_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_history_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_later: {
        Row: {
          created_at: string
          episode_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          episode_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          episode_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_later_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_parties: {
        Row: {
          anime_id: string
          anime_title: string
          code: string
          created_at: string
          episode_id: string
          episode_number: number
          host_id: string
          id: string
          is_active: boolean
          is_playing: boolean
          playback_time: number
          recap_is_playing: boolean | null
          recap_position_seconds: number | null
          recap_started_at: string | null
          season_number: number
          updated_at: string
        }
        Insert: {
          anime_id: string
          anime_title: string
          code: string
          created_at?: string
          episode_id: string
          episode_number: number
          host_id: string
          id?: string
          is_active?: boolean
          is_playing?: boolean
          playback_time?: number
          recap_is_playing?: boolean | null
          recap_position_seconds?: number | null
          recap_started_at?: string | null
          season_number?: number
          updated_at?: string
        }
        Update: {
          anime_id?: string
          anime_title?: string
          code?: string
          created_at?: string
          episode_id?: string
          episode_number?: number
          host_id?: string
          id?: string
          is_active?: boolean
          is_playing?: boolean
          playback_time?: number
          recap_is_playing?: boolean | null
          recap_position_seconds?: number | null
          recap_started_at?: string | null
          season_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_parties_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_parties_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_parties_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_party_members: {
        Row: {
          id: string
          joined_at: string
          party_id: string
          user_id: string
          username: string | null
        }
        Insert: {
          id?: string
          joined_at?: string
          party_id: string
          user_id: string
          username?: string | null
        }
        Update: {
          id?: string
          joined_at?: string
          party_id?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "watch_party_members_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "watch_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_party_messages: {
        Row: {
          created_at: string
          id: string
          is_host: boolean
          message: string
          party_id: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_host?: boolean
          message: string
          party_id: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          is_host?: boolean
          message?: string
          party_id?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_party_messages_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "watch_parties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      anime_public: {
        Row: {
          banner_image: string | null
          cover_image: string | null
          created_at: string | null
          description: string | null
          genres: string[] | null
          id: string | null
          is_featured: boolean | null
          like_count: number | null
          release_year: number | null
          status: string | null
          title: string | null
          type: string | null
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          banner_image?: string | null
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          genres?: string[] | null
          id?: string | null
          is_featured?: boolean | null
          like_count?: number | null
          release_year?: number | null
          status?: string | null
          title?: string | null
          type?: string | null
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          banner_image?: string | null
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          genres?: string[] | null
          id?: string | null
          is_featured?: boolean | null
          like_count?: number | null
          release_year?: number | null
          status?: string | null
          title?: string | null
          type?: string | null
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      end_watch_party: { Args: { party_uuid: string }; Returns: boolean }
      get_token_duration: { Args: { _token_id: string }; Returns: number }
      get_token_system_status: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_allowed_short_uploader: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_flox_admin: { Args: { _user_id: string }; Returns: boolean }
      mark_continue_watching_done: {
        Args: {
          _anime_id: string
          _duration?: number
          _episode_id: string
          _last_position?: number
        }
        Returns: {
          action: string
          completed_history_id: string
          next_episode_id: string
          next_episode_number: number
          next_history_id: string
          next_season_id: string
          next_season_number: number
        }[]
      }
      redeem_unlock_token: {
        Args: { _token: string; _user_agent?: string; _user_id?: string }
        Returns: {
          duration_hours: number
          expires_at: number
          id: string
        }[]
      }
      verify_unlock_token: {
        Args: { _token: string }
        Returns: {
          duration_hours: number
          id: string
          is_active: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "viewer" | "uploader"
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
      app_role: ["admin", "viewer", "uploader"],
    },
  },
} as const
