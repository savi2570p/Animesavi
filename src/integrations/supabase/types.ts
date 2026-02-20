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
          cover_image: string | null
          created_at: string
          description: string | null
          genres: string[] | null
          id: string
          is_crunchyroll: boolean
          is_featured: boolean | null
          like_count: number | null
          release_year: number | null
          status: string | null
          title: string
          trailer_url: string | null
          type: string | null
          updated_at: string
          uploader_id: string | null
          view_count: number | null
        }
        Insert: {
          banner_image?: string | null
          cover_image?: string | null
          created_at?: string
          description?: string | null
          genres?: string[] | null
          id?: string
          is_crunchyroll?: boolean
          is_featured?: boolean | null
          like_count?: number | null
          release_year?: number | null
          status?: string | null
          title: string
          trailer_url?: string | null
          type?: string | null
          updated_at?: string
          uploader_id?: string | null
          view_count?: number | null
        }
        Update: {
          banner_image?: string | null
          cover_image?: string | null
          created_at?: string
          description?: string | null
          genres?: string[] | null
          id?: string
          is_crunchyroll?: boolean
          is_featured?: boolean | null
          like_count?: number | null
          release_year?: number | null
          status?: string | null
          title?: string
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
          thumbnail: string | null
          title: string
          video_url: string | null
        }
        Insert: {
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
          thumbnail?: string | null
          title: string
          video_url?: string | null
        }
        Update: {
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
      seasons: {
        Row: {
          anime_id: string
          created_at: string
          id: string
          release_date: string | null
          season_number: number
          title: string | null
        }
        Insert: {
          anime_id: string
          created_at?: string
          id?: string
          release_date?: string | null
          season_number: number
          title?: string | null
        }
        Update: {
          anime_id?: string
          created_at?: string
          id?: string
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
          episode_id: string
          id: string
          progress: number | null
          user_id: string
          watched_at: string
        }
        Insert: {
          anime_id: string
          completed?: boolean | null
          episode_id: string
          id?: string
          progress?: number | null
          user_id: string
          watched_at?: string
        }
        Update: {
          anime_id?: string
          completed?: boolean | null
          episode_id?: string
          id?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
