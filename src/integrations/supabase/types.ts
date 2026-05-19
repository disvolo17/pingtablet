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
      achievement_points: {
        Row: {
          balance: number
          lifetime_earned: number
          lifetime_spent: number
          player_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          lifetime_earned?: number
          lifetime_spent?: number
          player_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          lifetime_earned?: number
          lifetime_spent?: number
          player_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      achievements: {
        Row: {
          code: string
          condition_type: string
          condition_value: Json
          created_at: string
          description: string
          glow_color: string
          icon: string
          id: string
          is_active: boolean
          rarity: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          condition_type?: string
          condition_value?: Json
          created_at?: string
          description?: string
          glow_color?: string
          icon?: string
          id?: string
          is_active?: boolean
          rarity?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          condition_type?: string
          condition_value?: Json
          created_at?: string
          description?: string
          glow_color?: string
          icon?: string
          id?: string
          is_active?: boolean
          rarity?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          created_at: string
          id: string
          is_bye: boolean
          player1_id: string | null
          player2_id: string | null
          position: number
          rating_applied: boolean
          round: number
          tournament_id: string
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_bye?: boolean
          player1_id?: string | null
          player2_id?: string | null
          position: number
          rating_applied?: boolean
          round: number
          tournament_id: string
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_bye?: boolean
          player1_id?: string | null
          player2_id?: string | null
          position?: number
          rating_applied?: boolean
          round?: number
          tournament_id?: string
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          author_name: string
          content: string
          created_at: string
          id: string
          tournament_id: string
        }
        Insert: {
          author_name: string
          content: string
          created_at?: string
          id?: string
          tournament_id: string
        }
        Update: {
          author_name?: string
          content?: string
          created_at?: string
          id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          handicap: number
          handle: string
          has_password: boolean
          id: string
          is_guest: boolean
          last_login_at: string | null
          losses: number
          migration_completed: boolean
          name: string
          password_changed_at: string | null
          password_reset_required: boolean
          photo_url: string | null
          rating: number
          status: string
          telegram_id: number | null
          telegram_username: string | null
          updated_at: string
          user_id: string | null
          wins: number
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          handicap?: number
          handle: string
          has_password?: boolean
          id?: string
          is_guest?: boolean
          last_login_at?: string | null
          losses?: number
          migration_completed?: boolean
          name: string
          password_changed_at?: string | null
          password_reset_required?: boolean
          photo_url?: string | null
          rating?: number
          status?: string
          telegram_id?: number | null
          telegram_username?: string | null
          updated_at?: string
          user_id?: string | null
          wins?: number
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          handicap?: number
          handle?: string
          has_password?: boolean
          id?: string
          is_guest?: boolean
          last_login_at?: string | null
          losses?: number
          migration_completed?: boolean
          name?: string
          password_changed_at?: string | null
          password_reset_required?: boolean
          photo_url?: string | null
          rating?: number
          status?: string
          telegram_id?: number | null
          telegram_username?: string | null
          updated_at?: string
          user_id?: string | null
          wins?: number
        }
        Relationships: []
      }
      point_transactions: {
        Row: {
          created_at: string
          delta: number
          id: string
          meta: Json
          player_id: string
          reason: string
          ref_id: string | null
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          meta?: Json
          player_id: string
          reason: string
          ref_id?: string | null
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          meta?: Json
          player_id?: string
          reason?: string
          ref_id?: string | null
        }
        Relationships: []
      }
      racket_items: {
        Row: {
          category: string
          code: string
          created_at: string
          effect_params: Json
          id: string
          is_active: boolean
          material_params: Json
          name: string
          preview_color: string
          price: number
          rarity: string
          sort_order: number
          unlock_condition: Json
          updated_at: string
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          effect_params?: Json
          id?: string
          is_active?: boolean
          material_params?: Json
          name: string
          preview_color?: string
          price?: number
          rarity?: string
          sort_order?: number
          unlock_condition?: Json
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          effect_params?: Json
          id?: string
          is_active?: boolean
          material_params?: Json
          name?: string
          preview_color?: string
          price?: number
          rarity?: string
          sort_order?: number
          unlock_condition?: Json
          updated_at?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          created_at: string
          id: string
          player_id: string
          seed: number | null
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          player_id: string
          seed?: number | null
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          player_id?: string
          seed?: number | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      sticker_cards: {
        Row: {
          created_at: string
          hue: number
          id: string
          player_id: string
          rarity: string
          updated_at: string
          variant: string
        }
        Insert: {
          created_at?: string
          hue?: number
          id?: string
          player_id: string
          rarity?: string
          updated_at?: string
          variant?: string
        }
        Update: {
          created_at?: string
          hue?: number
          id?: string
          player_id?: string
          rarity?: string
          updated_at?: string
          variant?: string
        }
        Relationships: []
      }
      sticker_inventory: {
        Row: {
          acquired_at: string
          card_id: string
          id: string
          owner_id: string
          seen: boolean
          source: string
        }
        Insert: {
          acquired_at?: string
          card_id: string
          id?: string
          owner_id: string
          seen?: boolean
          source?: string
        }
        Update: {
          acquired_at?: string
          card_id?: string
          id?: string
          owner_id?: string
          seen?: boolean
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "sticker_inventory_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "sticker_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      sticker_journal: {
        Row: {
          card_id: string
          id: string
          owner_id: string
          placed_at: string
        }
        Insert: {
          card_id: string
          id?: string
          owner_id: string
          placed_at?: string
        }
        Update: {
          card_id?: string
          id?: string
          owner_id?: string
          placed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sticker_journal_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "sticker_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      sticker_trades: {
        Row: {
          created_at: string
          from_player_id: string
          id: string
          offered_inventory_id: string
          requested_card_id: string
          responded_at: string | null
          status: string
          to_player_id: string
        }
        Insert: {
          created_at?: string
          from_player_id: string
          id?: string
          offered_inventory_id: string
          requested_card_id: string
          responded_at?: string | null
          status?: string
          to_player_id: string
        }
        Update: {
          created_at?: string
          from_player_id?: string
          id?: string
          offered_inventory_id?: string
          requested_card_id?: string
          responded_at?: string | null
          status?: string
          to_player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sticker_trades_offered_inventory_id_fkey"
            columns: ["offered_inventory_id"]
            isOneToOne: false
            referencedRelation: "sticker_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sticker_trades_requested_card_id_fkey"
            columns: ["requested_card_id"]
            isOneToOne: false
            referencedRelation: "sticker_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      sticker_wallet: {
        Row: {
          owner_id: string
          shards: number
          updated_at: string
        }
        Insert: {
          owner_id: string
          shards?: number
          updated_at?: string
        }
        Update: {
          owner_id?: string
          shards?: number
          updated_at?: string
        }
        Relationships: []
      }
      tournaments: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          location: string | null
          location_kind: string | null
          name: string
          starts_at: string | null
          status: Database["public"]["Enums"]["tournament_status"]
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          location_kind?: string | null
          name: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          location_kind?: string | null
          name?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
          updated_at?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          id: string
          player_id: string
          progress: number
          unlocked_at: string
        }
        Insert: {
          achievement_id: string
          id?: string
          player_id: string
          progress?: number
          unlocked_at?: string
        }
        Update: {
          achievement_id?: string
          id?: string
          player_id?: string
          progress?: number
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      user_racket_config: {
        Row: {
          blade_id: string | null
          effect_id: string | null
          handle_id: string | null
          player_id: string
          rubber_back_id: string | null
          rubber_front_id: string | null
          sticker_id: string | null
          updated_at: string
        }
        Insert: {
          blade_id?: string | null
          effect_id?: string | null
          handle_id?: string | null
          player_id: string
          rubber_back_id?: string | null
          rubber_front_id?: string | null
          sticker_id?: string | null
          updated_at?: string
        }
        Update: {
          blade_id?: string | null
          effect_id?: string | null
          handle_id?: string | null
          player_id?: string
          rubber_back_id?: string | null
          rubber_front_id?: string | null
          sticker_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_racket_config_blade_id_fkey"
            columns: ["blade_id"]
            isOneToOne: false
            referencedRelation: "racket_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_racket_config_effect_id_fkey"
            columns: ["effect_id"]
            isOneToOne: false
            referencedRelation: "racket_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_racket_config_handle_id_fkey"
            columns: ["handle_id"]
            isOneToOne: false
            referencedRelation: "racket_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_racket_config_rubber_back_id_fkey"
            columns: ["rubber_back_id"]
            isOneToOne: false
            referencedRelation: "racket_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_racket_config_rubber_front_id_fkey"
            columns: ["rubber_front_id"]
            isOneToOne: false
            referencedRelation: "racket_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_racket_config_sticker_id_fkey"
            columns: ["sticker_id"]
            isOneToOne: false
            referencedRelation: "racket_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_racket_inventory: {
        Row: {
          id: string
          item_id: string
          player_id: string
          unlocked_at: string
        }
        Insert: {
          id?: string
          item_id: string
          player_id: string
          unlocked_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          player_id?: string
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_racket_inventory_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "racket_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _ensure_points_row: { Args: { _player_id: string }; Returns: undefined }
      _my_player_id: { Args: never; Returns: string }
      _player_current_win_streak: {
        Args: { _player_id: string }
        Returns: number
      }
      _player_has_place: {
        Args: { _place: number; _player_id: string }
        Returns: boolean
      }
      _sticker_grant: {
        Args: { _opponent: string; _owner: string; _source: string }
        Returns: string
      }
      admin_grant_achievement: {
        Args: { _achievement_id: string; _player_id: string }
        Returns: {
          achievement_id: string
          id: string
          player_id: string
          progress: number
          unlocked_at: string
        }
        SetofOptions: {
          from: "*"
          to: "user_achievements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_revoke_achievement: {
        Args: { _achievement_id: string; _player_id: string }
        Returns: undefined
      }
      admin_sticker_grant_card: {
        Args: { _card_id: string; _player_id: string }
        Returns: {
          acquired_at: string
          card_id: string
          id: string
          owner_id: string
          seen: boolean
          source: string
        }
        SetofOptions: {
          from: "*"
          to: "sticker_inventory"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_sticker_grant_pack: {
        Args: { _player_id: string }
        Returns: {
          acquired_at: string
          card_id: string
          id: string
          owner_id: string
          seen: boolean
          source: string
        }[]
        SetofOptions: {
          from: "*"
          to: "sticker_inventory"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_sticker_grant_shards: {
        Args: { _amount: number; _player_id: string }
        Returns: {
          owner_id: string
          shards: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "sticker_wallet"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_my_player: {
        Args: { _handle?: string; _name: string }
        Returns: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          handicap: number
          handle: string
          has_password: boolean
          id: string
          is_guest: boolean
          last_login_at: string | null
          losses: number
          migration_completed: boolean
          name: string
          password_changed_at: string | null
          password_reset_required: boolean
          photo_url: string | null
          rating: number
          status: string
          telegram_id: number | null
          telegram_username: string | null
          updated_at: string
          user_id: string | null
          wins: number
        }
        SetofOptions: {
          from: "*"
          to: "players"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      evaluate_player_achievements: {
        Args: { _player_id: string }
        Returns: {
          code: string
          condition_type: string
          condition_value: Json
          created_at: string
          description: string
          glow_color: string
          icon: string
          id: string
          is_active: boolean
          rarity: string
          sort_order: number
          title: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "achievements"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      mark_password_auth_completed: {
        Args: never
        Returns: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          handicap: number
          handle: string
          has_password: boolean
          id: string
          is_guest: boolean
          last_login_at: string | null
          losses: number
          migration_completed: boolean
          name: string
          password_changed_at: string | null
          password_reset_required: boolean
          photo_url: string | null
          rating: number
          status: string
          telegram_id: number | null
          telegram_username: string | null
          updated_at: string
          user_id: string | null
          wins: number
        }
        SetofOptions: {
          from: "*"
          to: "players"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_password_login_seen: {
        Args: never
        Returns: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          handicap: number
          handle: string
          has_password: boolean
          id: string
          is_guest: boolean
          last_login_at: string | null
          losses: number
          migration_completed: boolean
          name: string
          password_changed_at: string | null
          password_reset_required: boolean
          photo_url: string | null
          rating: number
          status: string
          telegram_id: number | null
          telegram_username: string | null
          updated_at: string
          user_id: string | null
          wins: number
        }
        SetofOptions: {
          from: "*"
          to: "players"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_player_avatar: {
        Args: { _avatar_url: string; _player_id: string }
        Returns: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          handicap: number
          handle: string
          has_password: boolean
          id: string
          is_guest: boolean
          last_login_at: string | null
          losses: number
          migration_completed: boolean
          name: string
          password_changed_at: string | null
          password_reset_required: boolean
          photo_url: string | null
          rating: number
          status: string
          telegram_id: number | null
          telegram_username: string | null
          updated_at: string
          user_id: string | null
          wins: number
        }
        SetofOptions: {
          from: "*"
          to: "players"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_player_handicap: {
        Args: { _handicap: number; _player_id: string }
        Returns: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          handicap: number
          handle: string
          has_password: boolean
          id: string
          is_guest: boolean
          last_login_at: string | null
          losses: number
          migration_completed: boolean
          name: string
          password_changed_at: string | null
          password_reset_required: boolean
          photo_url: string | null
          rating: number
          status: string
          telegram_id: number | null
          telegram_username: string | null
          updated_at: string
          user_id: string | null
          wins: number
        }
        SetofOptions: {
          from: "*"
          to: "players"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sticker_buy_pack: {
        Args: never
        Returns: {
          acquired_at: string
          card_id: string
          id: string
          owner_id: string
          seen: boolean
          source: string
        }[]
        SetofOptions: {
          from: "*"
          to: "sticker_inventory"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      sticker_dust_duplicate: {
        Args: { _inventory_id: string }
        Returns: number
      }
      sticker_ensure_all_cards: { Args: never; Returns: number }
      sticker_ensure_card: {
        Args: { _player_id: string }
        Returns: {
          created_at: string
          hue: number
          id: string
          player_id: string
          rarity: string
          updated_at: string
          variant: string
        }
        SetofOptions: {
          from: "*"
          to: "sticker_cards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sticker_mark_seen: { Args: { _ids: string[] }; Returns: undefined }
      sticker_place: {
        Args: { _inventory_id: string }
        Returns: {
          card_id: string
          id: string
          owner_id: string
          placed_at: string
        }
        SetofOptions: {
          from: "*"
          to: "sticker_journal"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sticker_trade_cancel: { Args: { _trade_id: string }; Returns: undefined }
      sticker_trade_create: {
        Args: {
          _offered_inventory_id: string
          _requested_card: string
          _to_player: string
        }
        Returns: {
          created_at: string
          from_player_id: string
          id: string
          offered_inventory_id: string
          requested_card_id: string
          responded_at: string | null
          status: string
          to_player_id: string
        }
        SetofOptions: {
          from: "*"
          to: "sticker_trades"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sticker_trade_respond: {
        Args: { _accept: boolean; _trade_id: string }
        Returns: {
          created_at: string
          from_player_id: string
          id: string
          offered_inventory_id: string
          requested_card_id: string
          responded_at: string | null
          status: string
          to_player_id: string
        }
        SetofOptions: {
          from: "*"
          to: "sticker_trades"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      telegram_upsert_player: {
        Args: {
          _first_name: string
          _last_name: string
          _photo_url: string
          _telegram_id: number
          _username: string
        }
        Returns: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          handicap: number
          handle: string
          has_password: boolean
          id: string
          is_guest: boolean
          last_login_at: string | null
          losses: number
          migration_completed: boolean
          name: string
          password_changed_at: string | null
          password_reset_required: boolean
          photo_url: string | null
          rating: number
          status: string
          telegram_id: number | null
          telegram_username: string | null
          updated_at: string
          user_id: string | null
          wins: number
        }
        SetofOptions: {
          from: "*"
          to: "players"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      tournament_status: "registration" | "live" | "finished"
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
      tournament_status: ["registration", "live", "finished"],
    },
  },
} as const
