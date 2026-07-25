export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          metadata: Json;
          reason: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          metadata?: Json;
          reason?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          metadata?: Json;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      availability_windows: {
        Row: {
          created_at: string;
          ends_at: string | null;
          id: string;
          is_recurring: boolean;
          local_end: string | null;
          local_start: string | null;
          starts_at: string | null;
          timezone: string;
          user_id: string;
          valid_from: string | null;
          valid_until: string | null;
          weekday: number | null;
        };
        Insert: {
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          is_recurring?: boolean;
          local_end?: string | null;
          local_start?: string | null;
          starts_at?: string | null;
          timezone?: string;
          user_id: string;
          valid_from?: string | null;
          valid_until?: string | null;
          weekday?: number | null;
        };
        Update: {
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          is_recurring?: boolean;
          local_end?: string | null;
          local_start?: string | null;
          starts_at?: string | null;
          timezone?: string;
          user_id?: string;
          valid_from?: string | null;
          valid_until?: string | null;
          weekday?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "availability_windows_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "player_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      booking_events: {
        Row: {
          actor_id: string | null;
          booking_id: string;
          created_at: string;
          from_status: Database["public"]["Enums"]["booking_status"] | null;
          id: string;
          payload: Json;
          reason: string | null;
          to_status: Database["public"]["Enums"]["booking_status"];
        };
        Insert: {
          actor_id?: string | null;
          booking_id: string;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["booking_status"] | null;
          id?: string;
          payload?: Json;
          reason?: string | null;
          to_status: Database["public"]["Enums"]["booking_status"];
        };
        Update: {
          actor_id?: string | null;
          booking_id?: string;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["booking_status"] | null;
          id?: string;
          payload?: Json;
          reason?: string | null;
          to_status?: Database["public"]["Enums"]["booking_status"];
        };
        Relationships: [
          {
            foreignKeyName: "booking_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_events_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          acted_at: string | null;
          acted_by: string | null;
          club_note: string | null;
          court_id: string;
          created_at: string;
          currency: string | null;
          ends_at: string;
          id: string;
          match_id: string;
          payment_method: string;
          price_minor: number | null;
          requested_by: string;
          starts_at: string;
          status: Database["public"]["Enums"]["booking_status"];
          updated_at: string;
        };
        Insert: {
          acted_at?: string | null;
          acted_by?: string | null;
          club_note?: string | null;
          court_id: string;
          created_at?: string;
          currency?: string | null;
          ends_at: string;
          id?: string;
          match_id: string;
          payment_method?: string;
          price_minor?: number | null;
          requested_by: string;
          starts_at: string;
          status?: Database["public"]["Enums"]["booking_status"];
          updated_at?: string;
        };
        Update: {
          acted_at?: string | null;
          acted_by?: string | null;
          club_note?: string | null;
          court_id?: string;
          created_at?: string;
          currency?: string | null;
          ends_at?: string;
          id?: string;
          match_id?: string;
          payment_method?: string;
          price_minor?: number | null;
          requested_by?: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["booking_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_acted_by_fkey";
            columns: ["acted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_court_id_fkey";
            columns: ["court_id"];
            isOneToOne: false;
            referencedRelation: "courts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "player_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      club_memberships: {
        Row: {
          club_id: string;
          created_at: string;
          is_active: boolean;
          role: Database["public"]["Enums"]["club_role"];
          user_id: string;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          is_active?: boolean;
          role: Database["public"]["Enums"]["club_role"];
          user_id: string;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          is_active?: boolean;
          role?: Database["public"]["Enums"]["club_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "club_memberships_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "club_memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      club_private_contacts: {
        Row: {
          booking_email: string | null;
          booking_phone: string | null;
          club_id: string;
          internal_note: string | null;
          updated_at: string;
        };
        Insert: {
          booking_email?: string | null;
          booking_phone?: string | null;
          club_id: string;
          internal_note?: string | null;
          updated_at?: string;
        };
        Update: {
          booking_email?: string | null;
          booking_phone?: string | null;
          club_id?: string;
          internal_note?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "club_private_contacts_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: true;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      clubs: {
        Row: {
          address_public: string | null;
          amenities: string[];
          booking_mode: string;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          latitude: number | null;
          longitude: number | null;
          name: string;
          slug: string;
          updated_at: string;
          zone_id: string;
        };
        Insert: {
          address_public?: string | null;
          amenities?: string[];
          booking_mode?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          name: string;
          slug: string;
          updated_at?: string;
          zone_id: string;
        };
        Update: {
          address_public?: string | null;
          amenities?: string[];
          booking_mode?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          name?: string;
          slug?: string;
          updated_at?: string;
          zone_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clubs_zone_id_fkey";
            columns: ["zone_id"];
            isOneToOne: false;
            referencedRelation: "zones";
            referencedColumns: ["id"];
          },
        ];
      };
      court_blocks: {
        Row: {
          court_id: string;
          created_at: string;
          created_by: string | null;
          ends_at: string;
          id: string;
          reason: string | null;
          starts_at: string;
        };
        Insert: {
          court_id: string;
          created_at?: string;
          created_by?: string | null;
          ends_at: string;
          id?: string;
          reason?: string | null;
          starts_at: string;
        };
        Update: {
          court_id?: string;
          created_at?: string;
          created_by?: string | null;
          ends_at?: string;
          id?: string;
          reason?: string | null;
          starts_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "court_blocks_court_id_fkey";
            columns: ["court_id"];
            isOneToOne: false;
            referencedRelation: "courts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "court_blocks_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      court_operating_hours: {
        Row: {
          closes_at: string;
          court_id: string;
          id: string;
          opens_at: string;
          valid_from: string | null;
          valid_until: string | null;
          weekday: number;
        };
        Insert: {
          closes_at: string;
          court_id: string;
          id?: string;
          opens_at: string;
          valid_from?: string | null;
          valid_until?: string | null;
          weekday: number;
        };
        Update: {
          closes_at?: string;
          court_id?: string;
          id?: string;
          opens_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "court_operating_hours_court_id_fkey";
            columns: ["court_id"];
            isOneToOne: false;
            referencedRelation: "courts";
            referencedColumns: ["id"];
          },
        ];
      };
      courts: {
        Row: {
          club_id: string;
          created_at: string;
          currency: string | null;
          id: string;
          is_active: boolean;
          is_indoor: boolean;
          name: string;
          price_minor: number | null;
          slot_minutes: number;
          surface: string;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          currency?: string | null;
          id?: string;
          is_active?: boolean;
          is_indoor?: boolean;
          name: string;
          price_minor?: number | null;
          slot_minutes?: number;
          surface: string;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          currency?: string | null;
          id?: string;
          is_active?: boolean;
          is_indoor?: boolean;
          name?: string;
          price_minor?: number | null;
          slot_minutes?: number;
          surface?: string;
        };
        Relationships: [
          {
            foreignKeyName: "courts_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      device_push_tokens: {
        Row: {
          created_at: string;
          device_id: string;
          id: string;
          is_active: boolean;
          last_seen_at: string;
          platform: string;
          token: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          device_id: string;
          id?: string;
          is_active?: boolean;
          last_seen_at?: string;
          platform: string;
          token: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          device_id?: string;
          id?: string;
          is_active?: boolean;
          last_seen_at?: string;
          platform?: string;
          token?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "device_push_tokens_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      match_invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          created_by: string;
          expires_at: string;
          id: string;
          invited_user_id: string | null;
          match_id: string;
          revoked_at: string | null;
          token_hash: string | null;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          created_by: string;
          expires_at: string;
          id?: string;
          invited_user_id?: string | null;
          match_id: string;
          revoked_at?: string | null;
          token_hash?: string | null;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          id?: string;
          invited_user_id?: string | null;
          match_id?: string;
          revoked_at?: string | null;
          token_hash?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "match_invitations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "player_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "match_invitations_invited_user_id_fkey";
            columns: ["invited_user_id"];
            isOneToOne: false;
            referencedRelation: "player_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "match_invitations_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      match_messages: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          id: string;
          match_id: string;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
          match_id: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
          match_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "match_messages_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "player_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "match_messages_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      match_participants: {
        Row: {
          attendance: Database["public"]["Enums"]["attendance_status"];
          created_at: string;
          is_creator: boolean;
          joined_at: string | null;
          left_at: string | null;
          match_id: string;
          status: Database["public"]["Enums"]["participant_status"];
          user_id: string;
        };
        Insert: {
          attendance?: Database["public"]["Enums"]["attendance_status"];
          created_at?: string;
          is_creator?: boolean;
          joined_at?: string | null;
          left_at?: string | null;
          match_id: string;
          status: Database["public"]["Enums"]["participant_status"];
          user_id: string;
        };
        Update: {
          attendance?: Database["public"]["Enums"]["attendance_status"];
          created_at?: string;
          is_creator?: boolean;
          joined_at?: string | null;
          left_at?: string | null;
          match_id?: string;
          status?: Database["public"]["Enums"]["participant_status"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "match_participants_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_participants_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "player_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      match_results: {
        Row: {
          confirmed_at: string | null;
          confirmed_by: string | null;
          created_at: string;
          dispute_note: string | null;
          id: string;
          match_id: string;
          resolved_at: string | null;
          resolved_by: string | null;
          score: Json;
          status: Database["public"]["Enums"]["result_status"];
          submitted_by: string;
          updated_at: string;
          winner_user_id: string | null;
        };
        Insert: {
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          dispute_note?: string | null;
          id?: string;
          match_id: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          score: Json;
          status?: Database["public"]["Enums"]["result_status"];
          submitted_by: string;
          updated_at?: string;
          winner_user_id?: string | null;
        };
        Update: {
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          dispute_note?: string | null;
          id?: string;
          match_id?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          score?: Json;
          status?: Database["public"]["Enums"]["result_status"];
          submitted_by?: string;
          updated_at?: string;
          winner_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "match_results_confirmed_by_fkey";
            columns: ["confirmed_by"];
            isOneToOne: false;
            referencedRelation: "player_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "match_results_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: true;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_results_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_results_submitted_by_fkey";
            columns: ["submitted_by"];
            isOneToOne: false;
            referencedRelation: "player_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "match_results_winner_user_id_fkey";
            columns: ["winner_user_id"];
            isOneToOne: false;
            referencedRelation: "player_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      match_time_options: {
        Row: {
          created_at: string;
          ends_at: string;
          id: string;
          match_id: string;
          proposed_by: string;
          starts_at: string;
          withdrawn_at: string | null;
        };
        Insert: {
          created_at?: string;
          ends_at: string;
          id?: string;
          match_id: string;
          proposed_by: string;
          starts_at: string;
          withdrawn_at?: string | null;
        };
        Update: {
          created_at?: string;
          ends_at?: string;
          id?: string;
          match_id?: string;
          proposed_by?: string;
          starts_at?: string;
          withdrawn_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "match_time_options_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_time_options_proposed_by_fkey";
            columns: ["proposed_by"];
            isOneToOne: false;
            referencedRelation: "player_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      match_time_votes: {
        Row: {
          time_option_id: string;
          updated_at: string;
          user_id: string;
          vote: Database["public"]["Enums"]["vote_value"];
        };
        Insert: {
          time_option_id: string;
          updated_at?: string;
          user_id: string;
          vote: Database["public"]["Enums"]["vote_value"];
        };
        Update: {
          time_option_id?: string;
          updated_at?: string;
          user_id?: string;
          vote?: Database["public"]["Enums"]["vote_value"];
        };
        Relationships: [
          {
            foreignKeyName: "match_time_votes_time_option_id_fkey";
            columns: ["time_option_id"];
            isOneToOne: false;
            referencedRelation: "match_time_options";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_time_votes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "player_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      match_zones: {
        Row: {
          match_id: string;
          zone_id: string;
        };
        Insert: {
          match_id: string;
          zone_id: string;
        };
        Update: {
          match_id?: string;
          zone_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "match_zones_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_zones_zone_id_fkey";
            columns: ["zone_id"];
            isOneToOne: false;
            referencedRelation: "zones";
            referencedColumns: ["id"];
          },
        ];
      };
      matches: {
        Row: {
          cancellation_reason: string | null;
          cancelled_at: string | null;
          created_at: string;
          creator_id: string;
          format: Database["public"]["Enums"]["match_format"];
          id: string;
          intent: Database["public"]["Enums"]["play_intent"];
          max_skill: Database["public"]["Enums"]["skill_band"];
          min_skill: Database["public"]["Enums"]["skill_band"];
          notes: string | null;
          requires_creator_approval: boolean;
          selected_time_option_id: string | null;
          status: Database["public"]["Enums"]["match_status"];
          updated_at: string;
          visibility: Database["public"]["Enums"]["match_visibility"];
        };
        Insert: {
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          creator_id: string;
          format: Database["public"]["Enums"]["match_format"];
          id?: string;
          intent?: Database["public"]["Enums"]["play_intent"];
          max_skill: Database["public"]["Enums"]["skill_band"];
          min_skill: Database["public"]["Enums"]["skill_band"];
          notes?: string | null;
          requires_creator_approval?: boolean;
          selected_time_option_id?: string | null;
          status?: Database["public"]["Enums"]["match_status"];
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["match_visibility"];
        };
        Update: {
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          creator_id?: string;
          format?: Database["public"]["Enums"]["match_format"];
          id?: string;
          intent?: Database["public"]["Enums"]["play_intent"];
          max_skill?: Database["public"]["Enums"]["skill_band"];
          min_skill?: Database["public"]["Enums"]["skill_band"];
          notes?: string | null;
          requires_creator_approval?: boolean;
          selected_time_option_id?: string | null;
          status?: Database["public"]["Enums"]["match_status"];
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["match_visibility"];
        };
        Relationships: [
          {
            foreignKeyName: "matches_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "player_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "matches_selected_time_fk";
            columns: ["selected_time_option_id"];
            isOneToOne: false;
            referencedRelation: "match_time_options";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string;
          deduplication_key: string;
          entity_id: string | null;
          entity_type: string | null;
          failed_at: string | null;
          failure_code: string | null;
          id: string;
          kind: string;
          payload: Json;
          read_at: string | null;
          scheduled_at: string;
          sent_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          deduplication_key: string;
          entity_id?: string | null;
          entity_type?: string | null;
          failed_at?: string | null;
          failure_code?: string | null;
          id?: string;
          kind: string;
          payload?: Json;
          read_at?: string | null;
          scheduled_at?: string;
          sent_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          deduplication_key?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          failed_at?: string | null;
          failure_code?: string | null;
          id?: string;
          kind?: string;
          payload?: Json;
          read_at?: string | null;
          scheduled_at?: string;
          sent_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_roles: {
        Row: {
          created_at: string;
          created_by: string | null;
          role: Database["public"]["Enums"]["platform_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          role: Database["public"]["Enums"]["platform_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          role?: Database["public"]["Enums"]["platform_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_roles_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_profiles: {
        Row: {
          bio: string | null;
          created_at: string;
          internal_rating: number;
          play_intent: Database["public"]["Enums"]["play_intent"];
          prefers_doubles: boolean;
          prefers_singles: boolean;
          rated_match_count: number;
          skill_band: Database["public"]["Enums"]["skill_band"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          bio?: string | null;
          created_at?: string;
          internal_rating?: number;
          play_intent?: Database["public"]["Enums"]["play_intent"];
          prefers_doubles?: boolean;
          prefers_singles?: boolean;
          rated_match_count?: number;
          skill_band: Database["public"]["Enums"]["skill_band"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          bio?: string | null;
          created_at?: string;
          internal_rating?: number;
          play_intent?: Database["public"]["Enums"]["play_intent"];
          prefers_doubles?: boolean;
          prefers_singles?: boolean;
          rated_match_count?: number;
          skill_band?: Database["public"]["Enums"]["skill_band"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_zones: {
        Row: {
          priority: number;
          user_id: string;
          zone_id: string;
        };
        Insert: {
          priority?: number;
          user_id: string;
          zone_id: string;
        };
        Update: {
          priority?: number;
          user_id?: string;
          zone_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_zones_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "player_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "player_zones_zone_id_fkey";
            columns: ["zone_id"];
            isOneToOne: false;
            referencedRelation: "zones";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"];
          avatar_path: string | null;
          birth_year: number | null;
          community_rules_accepted_at: string | null;
          community_rules_version: string | null;
          created_at: string;
          deletion_requested_at: string | null;
          display_name: string | null;
          id: string;
          is_adult_confirmed: boolean;
          languages: string[];
          onboarding_completed_at: string | null;
          privacy_accepted_at: string | null;
          privacy_version: string | null;
          terms_accepted_at: string | null;
          terms_version: string | null;
          updated_at: string;
        };
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"];
          avatar_path?: string | null;
          birth_year?: number | null;
          community_rules_accepted_at?: string | null;
          community_rules_version?: string | null;
          created_at?: string;
          deletion_requested_at?: string | null;
          display_name?: string | null;
          id: string;
          is_adult_confirmed?: boolean;
          languages?: string[];
          onboarding_completed_at?: string | null;
          privacy_accepted_at?: string | null;
          privacy_version?: string | null;
          terms_accepted_at?: string | null;
          terms_version?: string | null;
          updated_at?: string;
        };
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"];
          avatar_path?: string | null;
          birth_year?: number | null;
          community_rules_accepted_at?: string | null;
          community_rules_version?: string | null;
          created_at?: string;
          deletion_requested_at?: string | null;
          display_name?: string | null;
          id?: string;
          is_adult_confirmed?: boolean;
          languages?: string[];
          onboarding_completed_at?: string | null;
          privacy_accepted_at?: string | null;
          privacy_version?: string | null;
          terms_accepted_at?: string | null;
          terms_version?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      rating_events: {
        Row: {
          algorithm_version: string;
          created_at: string;
          id: string;
          rating_after: number;
          rating_before: number;
          result_id: string;
          user_id: string;
        };
        Insert: {
          algorithm_version: string;
          created_at?: string;
          id?: string;
          rating_after: number;
          rating_before: number;
          result_id: string;
          user_id: string;
        };
        Update: {
          algorithm_version?: string;
          created_at?: string;
          id?: string;
          rating_after?: number;
          rating_before?: number;
          result_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rating_events_result_id_fkey";
            columns: ["result_id"];
            isOneToOne: false;
            referencedRelation: "match_results";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rating_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "player_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      user_blocks: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
        };
        Insert: {
          blocked_id: string;
          blocker_id: string;
          created_at?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey";
            columns: ["blocked_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey";
            columns: ["blocker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_reports: {
        Row: {
          assigned_to: string | null;
          category: string;
          created_at: string;
          id: string;
          match_id: string | null;
          message_id: string | null;
          note: string | null;
          reported_user_id: string | null;
          reporter_id: string;
          resolved_at: string | null;
          status: Database["public"]["Enums"]["report_status"];
        };
        Insert: {
          assigned_to?: string | null;
          category: string;
          created_at?: string;
          id?: string;
          match_id?: string | null;
          message_id?: string | null;
          note?: string | null;
          reported_user_id?: string | null;
          reporter_id: string;
          resolved_at?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
        };
        Update: {
          assigned_to?: string | null;
          category?: string;
          created_at?: string;
          id?: string;
          match_id?: string | null;
          message_id?: string | null;
          note?: string | null;
          reported_user_id?: string | null;
          reporter_id?: string;
          resolved_at?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
        };
        Relationships: [
          {
            foreignKeyName: "user_reports_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_reports_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_reports_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "match_messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_reports_reported_user_id_fkey";
            columns: ["reported_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      zones: {
        Row: {
          city_code: string;
          country_code: string;
          id: string;
          is_active: boolean;
          name_i18n: Json;
          slug: string;
          sort_order: number;
          timezone: string;
        };
        Insert: {
          city_code: string;
          country_code?: string;
          id?: string;
          is_active?: boolean;
          name_i18n: Json;
          slug: string;
          sort_order?: number;
          timezone?: string;
        };
        Update: {
          city_code?: string;
          country_code?: string;
          id?: string;
          is_active?: boolean;
          name_i18n?: Json;
          slug?: string;
          sort_order?: number;
          timezone?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      complete_onboarding: {
        Args: {
          p_birth_year: number;
          p_community_rules_version: string;
          p_display_name: string;
          p_is_adult_confirmed: boolean;
          p_languages: string[];
          p_play_intent: Database["public"]["Enums"]["play_intent"];
          p_prefers_doubles: boolean;
          p_prefers_singles: boolean;
          p_privacy_version: string;
          p_skill_band: Database["public"]["Enums"]["skill_band"];
          p_terms_version: string;
          p_zone_ids: string[];
        };
        Returns: undefined;
      };
      request_account_deletion: { Args: never; Returns: undefined };
    };
    Enums: {
      account_status: "active" | "suspended" | "deletion_requested" | "deleted";
      attendance_status:
        | "unknown"
        | "attended"
        | "cancelled_in_time"
        | "late_cancel"
        | "no_show"
        | "excused"
        | "disputed";
      booking_status:
        | "requested"
        | "alternative_proposed"
        | "accepted"
        | "rejected"
        | "cancelled"
        | "completed";
      club_role: "staff" | "admin";
      match_format: "singles" | "doubles";
      match_status:
        | "draft"
        | "open"
        | "full"
        | "ready_to_book"
        | "booking_pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "expired"
        | "disputed";
      match_visibility: "public" | "invite_only" | "private";
      participant_status:
        "invited" | "requested" | "accepted" | "declined" | "left" | "removed";
      platform_role: "support" | "admin";
      play_intent: "social" | "competitive" | "either";
      report_status: "open" | "investigating" | "resolved" | "dismissed";
      result_status: "submitted" | "confirmed" | "disputed" | "resolved";
      skill_band:
        "beginner" | "improving" | "intermediate" | "advanced" | "competitive";
      vote_value: "yes" | "no";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_status: ["active", "suspended", "deletion_requested", "deleted"],
      attendance_status: [
        "unknown",
        "attended",
        "cancelled_in_time",
        "late_cancel",
        "no_show",
        "excused",
        "disputed",
      ],
      booking_status: [
        "requested",
        "alternative_proposed",
        "accepted",
        "rejected",
        "cancelled",
        "completed",
      ],
      club_role: ["staff", "admin"],
      match_format: ["singles", "doubles"],
      match_status: [
        "draft",
        "open",
        "full",
        "ready_to_book",
        "booking_pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "expired",
        "disputed",
      ],
      match_visibility: ["public", "invite_only", "private"],
      participant_status: [
        "invited",
        "requested",
        "accepted",
        "declined",
        "left",
        "removed",
      ],
      platform_role: ["support", "admin"],
      play_intent: ["social", "competitive", "either"],
      report_status: ["open", "investigating", "resolved", "dismissed"],
      result_status: ["submitted", "confirmed", "disputed", "resolved"],
      skill_band: [
        "beginner",
        "improving",
        "intermediate",
        "advanced",
        "competitive",
      ],
      vote_value: ["yes", "no"],
    },
  },
} as const;
