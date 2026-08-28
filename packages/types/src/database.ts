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
          arranged_externally: boolean;
          club_note: string | null;
          court_id: string;
          created_at: string;
          currency: string | null;
          ends_at: string;
          id: string;
          match_id: string;
          payment_method: string;
          price_minor: number | null;
          proposed_court_id: string | null;
          proposed_end_at: string | null;
          proposed_start_at: string | null;
          requested_by: string;
          starts_at: string;
          status: Database["public"]["Enums"]["booking_status"];
          updated_at: string;
        };
        Insert: {
          acted_at?: string | null;
          acted_by?: string | null;
          arranged_externally?: boolean;
          club_note?: string | null;
          court_id: string;
          created_at?: string;
          currency?: string | null;
          ends_at: string;
          id?: string;
          match_id: string;
          payment_method?: string;
          price_minor?: number | null;
          proposed_court_id?: string | null;
          proposed_end_at?: string | null;
          proposed_start_at?: string | null;
          requested_by: string;
          starts_at: string;
          status?: Database["public"]["Enums"]["booking_status"];
          updated_at?: string;
        };
        Update: {
          acted_at?: string | null;
          acted_by?: string | null;
          arranged_externally?: boolean;
          club_note?: string | null;
          court_id?: string;
          created_at?: string;
          currency?: string | null;
          ends_at?: string;
          id?: string;
          match_id?: string;
          payment_method?: string;
          price_minor?: number | null;
          proposed_court_id?: string | null;
          proposed_end_at?: string | null;
          proposed_start_at?: string | null;
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
            foreignKeyName: "bookings_proposed_court_id_fkey";
            columns: ["proposed_court_id"];
            isOneToOne: false;
            referencedRelation: "courts";
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
      client_events: {
        Row: {
          created_at: string;
          event: string;
          id: number;
          props: Json;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event: string;
          id?: never;
          props?: Json;
          user_id: string;
        };
        Update: {
          created_at?: string;
          event?: string;
          id?: never;
          props?: Json;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
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
      discovery_search_log: {
        Row: {
          id: number;
          searched_at: string;
          surface: string;
          user_id: string;
        };
        Insert: {
          id?: number;
          searched_at?: string;
          surface: string;
          user_id: string;
        };
        Update: {
          id?: number;
          searched_at?: string;
          surface?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discovery_search_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      match_activity: {
        Row: {
          match_id: string;
          updated_at: string;
        };
        Insert: {
          match_id: string;
          updated_at?: string;
        };
        Update: {
          match_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "match_activity_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: true;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      match_court_requests: {
        Row: {
          answered_at: string | null;
          club_id: string;
          created_at: string;
          id: string;
          match_id: string;
          opened_at: string;
          requested_by: string;
          status: Database["public"]["Enums"]["court_request_status"];
        };
        Insert: {
          answered_at?: string | null;
          club_id: string;
          created_at?: string;
          id?: string;
          match_id: string;
          opened_at?: string;
          requested_by: string;
          status?: Database["public"]["Enums"]["court_request_status"];
        };
        Update: {
          answered_at?: string | null;
          club_id?: string;
          created_at?: string;
          id?: string;
          match_id?: string;
          opened_at?: string;
          requested_by?: string;
          status?: Database["public"]["Enums"]["court_request_status"];
        };
        Relationships: [
          {
            foreignKeyName: "match_court_requests_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_court_requests_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_court_requests_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "player_profiles";
            referencedColumns: ["user_id"];
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
          note: string | null;
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
          note?: string | null;
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
          note?: string | null;
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
          chat_last_read_at: string | null;
          created_at: string;
          is_creator: boolean;
          join_note: string | null;
          joined_at: string | null;
          left_at: string | null;
          match_id: string;
          score_declined_at: string | null;
          status: Database["public"]["Enums"]["participant_status"];
          user_id: string;
        };
        Insert: {
          attendance?: Database["public"]["Enums"]["attendance_status"];
          chat_last_read_at?: string | null;
          created_at?: string;
          is_creator?: boolean;
          join_note?: string | null;
          joined_at?: string | null;
          left_at?: string | null;
          match_id: string;
          score_declined_at?: string | null;
          status: Database["public"]["Enums"]["participant_status"];
          user_id: string;
        };
        Update: {
          attendance?: Database["public"]["Enums"]["attendance_status"];
          chat_last_read_at?: string | null;
          created_at?: string;
          is_creator?: boolean;
          join_note?: string | null;
          joined_at?: string | null;
          left_at?: string | null;
          match_id?: string;
          score_declined_at?: string | null;
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
      match_preferred_clubs: {
        Row: {
          club_id: string;
          match_id: string;
        };
        Insert: {
          club_id: string;
          match_id: string;
        };
        Update: {
          club_id?: string;
          match_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "match_preferred_clubs_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_preferred_clubs_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      match_results: {
        Row: {
          confirmed_at: string | null;
          confirmed_by: string | null;
          created_at: string;
          dispute_note: string | null;
          disputed_by: string | null;
          id: string;
          match_id: string;
          resolved_at: string | null;
          resolved_by: string | null;
          revision: number;
          score: Json;
          side_a_user_ids: string[];
          status: Database["public"]["Enums"]["result_status"];
          submitted_by: string;
          updated_at: string;
          winner_user_id: string | null;
          winning_side: number;
        };
        Insert: {
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          dispute_note?: string | null;
          disputed_by?: string | null;
          id?: string;
          match_id: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          revision?: number;
          score: Json;
          side_a_user_ids: string[];
          status?: Database["public"]["Enums"]["result_status"];
          submitted_by: string;
          updated_at?: string;
          winner_user_id?: string | null;
          winning_side: number;
        };
        Update: {
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          dispute_note?: string | null;
          disputed_by?: string | null;
          id?: string;
          match_id?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          revision?: number;
          score?: Json;
          side_a_user_ids?: string[];
          status?: Database["public"]["Enums"]["result_status"];
          submitted_by?: string;
          updated_at?: string;
          winner_user_id?: string | null;
          winning_side?: number;
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
            foreignKeyName: "match_results_disputed_by_fkey";
            columns: ["disputed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
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
          listing_extended_at: string | null;
          max_skill: Database["public"]["Enums"]["skill_band"];
          min_skill: Database["public"]["Enums"]["skill_band"];
          notes: string | null;
          requires_creator_approval: boolean;
          selected_time_option_id: string | null;
          status: Database["public"]["Enums"]["match_status"];
          timing_mode: string;
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
          listing_extended_at?: string | null;
          max_skill: Database["public"]["Enums"]["skill_band"];
          min_skill: Database["public"]["Enums"]["skill_band"];
          notes?: string | null;
          requires_creator_approval?: boolean;
          selected_time_option_id?: string | null;
          status?: Database["public"]["Enums"]["match_status"];
          timing_mode?: string;
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
          listing_extended_at?: string | null;
          max_skill?: Database["public"]["Enums"]["skill_band"];
          min_skill?: Database["public"]["Enums"]["skill_band"];
          notes?: string | null;
          requires_creator_approval?: boolean;
          selected_time_option_id?: string | null;
          status?: Database["public"]["Enums"]["match_status"];
          timing_mode?: string;
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
          attempt_count: number;
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
          attempt_count?: number;
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
          attempt_count?: number;
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
      platform_policy_settings: {
        Row: {
          key: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          key: string;
          updated_at?: string;
          value: Json;
        };
        Update: {
          key?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
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
      player_favorite_clubs: {
        Row: {
          club_id: string;
          created_at: string;
          user_id: string;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          user_id: string;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_favorite_clubs_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_favorite_clubs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "player_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      player_profiles: {
        Row: {
          bio: string | null;
          created_at: string;
          default_match_format:
            Database["public"]["Enums"]["match_format"] | null;
          default_match_visibility: Database["public"]["Enums"]["match_visibility"];
          default_max_skill: Database["public"]["Enums"]["skill_band"] | null;
          default_min_skill: Database["public"]["Enums"]["skill_band"] | null;
          default_requires_creator_approval: boolean;
          internal_rating: number;
          match_defaults_set_at: string | null;
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
          default_match_format?:
            Database["public"]["Enums"]["match_format"] | null;
          default_match_visibility?: Database["public"]["Enums"]["match_visibility"];
          default_max_skill?: Database["public"]["Enums"]["skill_band"] | null;
          default_min_skill?: Database["public"]["Enums"]["skill_band"] | null;
          default_requires_creator_approval?: boolean;
          internal_rating?: number;
          match_defaults_set_at?: string | null;
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
          default_match_format?:
            Database["public"]["Enums"]["match_format"] | null;
          default_match_visibility?: Database["public"]["Enums"]["match_visibility"];
          default_max_skill?: Database["public"]["Enums"]["skill_band"] | null;
          default_min_skill?: Database["public"]["Enums"]["skill_band"] | null;
          default_requires_creator_approval?: boolean;
          internal_rating?: number;
          match_defaults_set_at?: string | null;
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
          gender: Database["public"]["Enums"]["gender"] | null;
          id: string;
          is_adult_confirmed: boolean;
          languages: string[];
          notification_locale: string;
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
          gender?: Database["public"]["Enums"]["gender"] | null;
          id: string;
          is_adult_confirmed?: boolean;
          languages?: string[];
          notification_locale?: string;
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
          gender?: Database["public"]["Enums"]["gender"] | null;
          id?: string;
          is_adult_confirmed?: boolean;
          languages?: string[];
          notification_locale?: string;
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
      accept_booking: { Args: { p_booking_id: string }; Returns: undefined };
      accept_match_invitation: {
        Args: { p_invitation_id: string };
        Returns: string;
      };
      accept_match_invite: { Args: { p_token: string }; Returns: string };
      add_match_time_option: {
        Args: { p_ends_at: string; p_match_id: string; p_starts_at: string };
        Returns: string;
      };
      answer_court_request: {
        Args: { p_request_id: string; p_sent: boolean };
        Returns: undefined;
      };
      append_booking_event: {
        Args: {
          p_actor_id: string;
          p_booking_id: string;
          p_from_status: Database["public"]["Enums"]["booking_status"];
          p_payload?: Json;
          p_reason?: string;
          p_to_status: Database["public"]["Enums"]["booking_status"];
        };
        Returns: undefined;
      };
      apply_attendance_completion: {
        Args: { p_match_id: string };
        Returns: boolean;
      };
      apply_match_invitation_acceptance: {
        Args: {
          p_invite: Database["public"]["Tables"]["match_invitations"]["Row"];
          p_user_id: string;
        };
        Returns: string;
      };
      apply_rating_for_result: {
        Args: { p_result_id: string };
        Returns: undefined;
      };
      assert_accepted_match_participant: {
        Args: { p_match_id: string; p_user_id?: string };
        Returns: undefined;
      };
      assert_active_zones: {
        Args: { p_zone_ids: string[] };
        Returns: undefined;
      };
      assert_authenticated_caller: { Args: never; Returns: string };
      assert_club_admin: { Args: { p_club_id: string }; Returns: string };
      assert_club_staff: { Args: { p_club_id: string }; Returns: string };
      assert_discovery_caller_eligible: { Args: never; Returns: string };
      assert_joinable_match: {
        Args: {
          p_allow_non_public?: boolean;
          p_match_id: string;
          p_viewer_id: string;
        };
        Returns: {
          cancellation_reason: string | null;
          cancelled_at: string | null;
          created_at: string;
          creator_id: string;
          format: Database["public"]["Enums"]["match_format"];
          id: string;
          intent: Database["public"]["Enums"]["play_intent"];
          listing_extended_at: string | null;
          max_skill: Database["public"]["Enums"]["skill_band"];
          min_skill: Database["public"]["Enums"]["skill_band"];
          notes: string | null;
          requires_creator_approval: boolean;
          selected_time_option_id: string | null;
          status: Database["public"]["Enums"]["match_status"];
          timing_mode: string;
          updated_at: string;
          visibility: Database["public"]["Enums"]["match_visibility"];
        };
        SetofOptions: {
          from: "*";
          to: "matches";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      assert_marketplace_caller: { Args: never; Returns: string };
      assert_match_roster_full: {
        Args: { p_match_id: string };
        Returns: undefined;
      };
      assert_opposing_side_actor: {
        Args: {
          p_result: Database["public"]["Tables"]["match_results"]["Row"];
          p_user_id: string;
        };
        Returns: undefined;
      };
      assert_platform_operator: { Args: never; Returns: string };
      assert_valid_result_sides: {
        Args: {
          p_format: Database["public"]["Enums"]["match_format"];
          p_match_id: string;
          p_side_a_user_ids: string[];
        };
        Returns: undefined;
      };
      availability_day_part_from_local: {
        Args: { p_local_start: string };
        Returns: string;
      };
      booking_stale_reminders: { Args: never; Returns: Json };
      cancel_booking_request: {
        Args: { p_booking_id: string };
        Returns: undefined;
      };
      cancel_match: {
        Args: { p_match_id: string; p_reason?: string };
        Returns: undefined;
      };
      cast_match_time_vote: {
        Args: {
          p_match_id: string;
          p_time_option_id: string;
          p_vote: Database["public"]["Enums"]["vote_value"];
        };
        Returns: undefined;
      };
      claim_due_notifications: {
        Args: { p_limit?: number };
        Returns: {
          attempt_count: number;
          kind: string;
          locale: string;
          notification_id: string;
          payload: Json;
          push_tokens: string[];
          user_id: string;
        }[];
      };
      classify_withdrawal_attendance: {
        Args: { p_booking_starts_at: string };
        Returns: Database["public"]["Enums"]["attendance_status"];
      };
      complete_matches_from_attendance: { Args: never; Returns: number };
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
      completed_match_count_for_user: {
        Args: { p_user_id: string };
        Returns: number;
      };
      confirm_external_court: {
        Args: {
          p_court_id: string;
          p_ends_at: string;
          p_match_id: string;
          p_note?: string;
          p_starts_at: string;
        };
        Returns: string;
      };
      confirm_match_result: {
        Args: { p_match_id: string };
        Returns: undefined;
      };
      court_first_roster_reminders: { Args: never; Returns: number };
      court_has_block: {
        Args: { p_court_id: string; p_ends_at: string; p_starts_at: string };
        Returns: boolean;
      };
      create_and_publish_match: {
        Args: {
          p_format: Database["public"]["Enums"]["match_format"];
          p_intent: Database["public"]["Enums"]["play_intent"];
          p_max_skill: Database["public"]["Enums"]["skill_band"];
          p_min_skill: Database["public"]["Enums"]["skill_band"];
          p_notes?: string;
          p_preferred_club_ids?: string[];
          p_proposed_times?: Json;
          p_requires_creator_approval: boolean;
          p_timing_mode?: string;
          p_visibility: Database["public"]["Enums"]["match_visibility"];
          p_zone_ids?: string[];
        };
        Returns: string;
      };
      create_court_block: {
        Args: {
          p_court_id: string;
          p_ends_at: string;
          p_reason?: string;
          p_starts_at: string;
        };
        Returns: string;
      };
      create_match_draft: {
        Args: {
          p_format: Database["public"]["Enums"]["match_format"];
          p_intent: Database["public"]["Enums"]["play_intent"];
          p_max_skill: Database["public"]["Enums"]["skill_band"];
          p_min_skill: Database["public"]["Enums"]["skill_band"];
          p_notes?: string;
          p_preferred_club_ids?: string[];
          p_proposed_times?: Json;
          p_requires_creator_approval: boolean;
          p_timing_mode?: string;
          p_visibility: Database["public"]["Enums"]["match_visibility"];
          p_zone_ids?: string[];
        };
        Returns: string;
      };
      create_match_invite: {
        Args: {
          p_invited_user_id?: string;
          p_match_id: string;
          p_note?: string;
        };
        Returns: string;
      };
      deactivate_club: {
        Args: { p_club_id: string; p_reason?: string };
        Returns: undefined;
      };
      deactivate_device_push_token: {
        Args: { p_device_id: string };
        Returns: boolean;
      };
      decline_match_invitation: {
        Args: { p_invitation_id: string };
        Returns: undefined;
      };
      decline_match_score: {
        Args: { p_declined?: boolean; p_match_id: string };
        Returns: string;
      };
      delete_court_block: { Args: { p_block_id: string }; Returns: undefined };
      derive_score_winner_side: { Args: { p_score: Json }; Returns: number };
      discover_compatible_players: {
        Args: {
          p_cursor_user_id?: string;
          p_format?: Database["public"]["Enums"]["match_format"];
          p_free_from?: string;
          p_free_to?: string;
          p_horizon_days?: number;
          p_intent?: Database["public"]["Enums"]["play_intent"];
          p_level_window?: number;
          p_limit?: number;
          p_require_availability_overlap?: boolean;
          p_zone_ids?: string[];
        };
        Returns: Database["public"]["CompositeTypes"]["discover_compatible_player_card"][];
        SetofOptions: {
          from: "*";
          to: "discover_compatible_player_card";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      discover_open_matches: {
        Args: {
          p_cursor_created_at?: string;
          p_format?: Database["public"]["Enums"]["match_format"];
          p_horizon_days?: number;
          p_intent?: Database["public"]["Enums"]["play_intent"];
          p_limit?: number;
          p_zone_ids?: string[];
        };
        Returns: Database["public"]["CompositeTypes"]["discover_open_match_card"][];
        SetofOptions: {
          from: "*";
          to: "discover_open_match_card";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      dispute_match_result: {
        Args: { p_match_id: string; p_note?: string };
        Returns: undefined;
      };
      enforce_discovery_rate_limit: {
        Args: { p_surface: string; p_user_id: string };
        Returns: undefined;
      };
      enforce_invite_rate_limit: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      enqueue_notification: {
        Args: {
          p_deduplication_key: string;
          p_entity_id: string;
          p_entity_type: string;
          p_kind: string;
          p_payload?: Json;
          p_scheduled_at?: string;
          p_user_id: string;
        };
        Returns: string;
      };
      expand_user_availability: {
        Args: { p_range_end: string; p_range_start: string; p_user_id: string };
        Returns: {
          ends_at: string;
          starts_at: string;
        }[];
      };
      expire_stale_matches: { Args: never; Returns: number };
      extend_match_listing: {
        Args: { p_match_id: string };
        Returns: undefined;
      };
      first_availability_overlap: {
        Args: {
          p_range_end: string;
          p_range_start: string;
          p_user_a: string;
          p_user_b: string;
        };
        Returns: {
          ends_at: string;
          starts_at: string;
        }[];
      };
      get_availability_liquidity: {
        Args: { p_horizon_days?: number; p_zone_ids?: string[] };
        Returns: {
          ends_at: string;
          player_count: number;
          starts_at: string;
        }[];
      };
      get_club_admin_detail: { Args: { p_club_id: string }; Returns: Json };
      get_club_booking_detail: {
        Args: { p_booking_id: string };
        Returns: Json;
      };
      get_club_detail: { Args: { p_club_id: string }; Returns: Json };
      get_club_whatsapp_booking_link: {
        Args: { p_club_id: string; p_match_id?: string };
        Returns: Json;
      };
      get_match_hub: {
        Args: { p_match_id: string };
        Returns: Database["public"]["CompositeTypes"]["match_hub_card"];
        SetofOptions: {
          from: "*";
          to: "match_hub_card";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_own_chat_last_read: { Args: { p_match_id: string }; Returns: string };
      get_own_score_declined: { Args: { p_match_id: string }; Returns: string };
      get_public_player_availability_summary: {
        Args: { p_user_id: string };
        Returns: Json;
      };
      get_public_player_card: {
        Args: { p_user_id: string };
        Returns: Database["public"]["CompositeTypes"]["discover_compatible_player_card"];
        SetofOptions: {
          from: "*";
          to: "discover_compatible_player_card";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_rematch_context: {
        Args: { p_opponent_id: string };
        Returns: {
          opponent_wins: number;
          played_together: number;
          viewer_total_completed: number;
          viewer_wins: number;
        }[];
      };
      has_availability_overlap: {
        Args: {
          p_range_end: string;
          p_range_start: string;
          p_user_a: string;
          p_user_b: string;
        };
        Returns: boolean;
      };
      hash_invite_token: { Args: { p_token: string }; Returns: string };
      hosted_match_cap: { Args: never; Returns: number };
      invoke_process_notifications: { Args: never; Returns: number };
      is_blocked: {
        Args: { p_user_a: string; p_user_b: string };
        Returns: boolean;
      };
      is_blocked_from_match: {
        Args: { p_match_id: string; p_viewer_id: string };
        Returns: boolean;
      };
      is_club_admin: {
        Args: { p_club_id: string; p_user_id?: string };
        Returns: boolean;
      };
      is_club_staff: {
        Args: { p_club_id: string; p_user_id?: string };
        Returns: boolean;
      };
      is_match_activity_viewer: {
        Args: { p_match_id: string; p_user_id?: string };
        Returns: boolean;
      };
      is_match_chat_participant: {
        Args: { p_match_id: string; p_user_id?: string };
        Returns: boolean;
      };
      is_own_avatar_storage_path: {
        Args: { p_avatar_path: string; p_user_id: string };
        Returns: boolean;
      };
      is_platform_operator: { Args: { p_user_id?: string }; Returns: boolean };
      is_valid_tennis_set: {
        Args: { p_a: number; p_b: number };
        Returns: boolean;
      };
      join_match: {
        Args: { p_match_id: string; p_note?: string };
        Returns: Database["public"]["Enums"]["participant_status"];
      };
      late_cancel_window_hours: { Args: never; Returns: number };
      leave_match: { Args: { p_match_id: string }; Returns: undefined };
      list_active_zones: {
        Args: never;
        Returns: {
          name_i18n: Json;
          slug: string;
          timezone: string;
          zone_id: string;
        }[];
      };
      list_club_booking_requests: {
        Args: {
          p_club_id: string;
          p_search?: string;
          p_statuses?: Database["public"]["Enums"]["booking_status"][];
        };
        Returns: {
          booking_id: string;
          court_id: string;
          court_name: string;
          created_at: string;
          ends_at: string;
          match_format: Database["public"]["Enums"]["match_format"];
          match_id: string;
          participant_count: number;
          requested_by: string;
          requester_name: string;
          starts_at: string;
          status: Database["public"]["Enums"]["booking_status"];
        }[];
      };
      list_clubs_directory: {
        Args: { p_zone_ids?: string[] };
        Returns: {
          address_public: string;
          amenities: string[];
          booking_mode: string;
          club_id: string;
          court_count: number;
          currency: string;
          description: string;
          is_favorite: boolean;
          latitude: number;
          longitude: number;
          min_price_minor: number;
          name: string;
          slug: string;
          zone_id: string;
          zone_name_i18n: Json;
          zone_slug: string;
        }[];
      };
      list_disputed_results: {
        Args: { p_limit?: number };
        Returns: Database["public"]["CompositeTypes"]["disputed_result_queue_row"][];
        SetofOptions: {
          from: "*";
          to: "disputed_result_queue_row";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      list_match_court_requests: {
        Args: { p_match_id: string };
        Returns: {
          answered_at: string;
          club_id: string;
          club_name: string;
          is_viewer_request: boolean;
          opened_at: string;
          request_id: string;
          status: Database["public"]["Enums"]["court_request_status"];
        }[];
      };
      list_match_messages: {
        Args: { p_limit?: number; p_match_id: string };
        Returns: {
          author_display_name: string;
          author_id: string;
          body: string;
          created_at: string;
          match_id: string;
          message_id: string;
        }[];
      };
      list_my_completed_matches: {
        Args: never;
        Returns: {
          club_name: string;
          completed_at: string;
          format: Database["public"]["Enums"]["match_format"];
          match_id: string;
          opponent_names: string;
          played_at: string;
          result_status: Database["public"]["Enums"]["result_status"];
          score: Json;
          submitted_by: string;
          submitted_by_name: string;
          viewer_side: number;
          viewer_won: boolean;
          winner_user_id: string;
        }[];
      };
      list_my_match_invites: {
        Args: never;
        Returns: Database["public"]["CompositeTypes"]["match_invite_inbox_row"][];
        SetofOptions: {
          from: "*";
          to: "match_invite_inbox_row";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      list_my_matches: {
        Args: never;
        Returns: {
          can_extend_listing: boolean;
          capacity: number;
          club_name: string;
          court_starts_at: string;
          format: Database["public"]["Enums"]["match_format"];
          has_court: boolean;
          intent: Database["public"]["Enums"]["play_intent"];
          is_creator: boolean;
          is_stale_warning: boolean;
          listing_expires_at: string;
          match_id: string;
          notes: string;
          opponent_names: string;
          participant_count: number;
          participant_status: Database["public"]["Enums"]["participant_status"];
          preferred_clubs: Json;
          soonest_time: string;
          status: Database["public"]["Enums"]["match_status"];
          unread_message_count: number;
          updated_at: string;
          viewer_attendance: Database["public"]["Enums"]["attendance_status"];
          visibility: Database["public"]["Enums"]["match_visibility"];
          zones: Json;
        }[];
      };
      list_open_user_reports: {
        Args: { p_limit?: number };
        Returns: Database["public"]["CompositeTypes"]["user_report_queue_row"][];
        SetofOptions: {
          from: "*";
          to: "user_report_queue_row";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      list_pending_clubs: {
        Args: { p_limit?: number };
        Returns: {
          admin_display_name: string;
          admin_user_id: string;
          club_id: string;
          court_count: number;
          name: string;
          slug: string;
          submitted_at: string;
          zone_id: string;
          zone_slug: string;
        }[];
      };
      list_player_favorite_clubs_json: {
        Args: { p_user_id: string };
        Returns: Json;
      };
      list_public_player_recent_matches: {
        Args: { p_limit?: number; p_user_id: string };
        Returns: {
          opponent_names: string;
          played_at: string;
          player_side: number;
          player_won: boolean;
          score: Json;
        }[];
      };
      list_staff_clubs: {
        Args: never;
        Returns: {
          club_id: string;
          is_active: boolean;
          name: string;
          role: string;
          slug: string;
        }[];
      };
      mark_all_notifications_read: { Args: never; Returns: number };
      mark_match_chat_read: { Args: { p_match_id: string }; Returns: string };
      mark_notification_failed: {
        Args: { p_failure_code: string; p_notification_id: string };
        Returns: undefined;
      };
      mark_notification_read: {
        Args: { p_notification_id: string };
        Returns: undefined;
      };
      mark_notification_sent: {
        Args: { p_notification_id: string };
        Returns: undefined;
      };
      mark_notification_unreachable: {
        Args: { p_notification_id: string };
        Returns: undefined;
      };
      match_accepted_booking: {
        Args: { p_match_id: string };
        Returns: {
          acted_at: string | null;
          acted_by: string | null;
          arranged_externally: boolean;
          club_note: string | null;
          court_id: string;
          created_at: string;
          currency: string | null;
          ends_at: string;
          id: string;
          match_id: string;
          payment_method: string;
          price_minor: number | null;
          proposed_court_id: string | null;
          proposed_end_at: string | null;
          proposed_start_at: string | null;
          requested_by: string;
          starts_at: string;
          status: Database["public"]["Enums"]["booking_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "bookings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      match_active_time_option_count: {
        Args: { p_match_id: string };
        Returns: number;
      };
      match_all_times_passed_grace: {
        Args: { p_match_id: string };
        Returns: boolean;
      };
      match_awaiting_played_answer: {
        Args: { p_match_id: string };
        Returns: boolean;
      };
      match_capacity_for_format: {
        Args: { p_format: Database["public"]["Enums"]["match_format"] };
        Returns: number;
      };
      match_has_accepted_court: {
        Args: { p_match_id: string };
        Returns: boolean;
      };
      match_has_active_booking: {
        Args: { p_match_id: string };
        Returns: boolean;
      };
      match_is_stale_warning: {
        Args: { p_match_id: string };
        Returns: boolean;
      };
      match_listing_anchor: {
        Args: { p_created_at: string; p_listing_extended_at: string };
        Returns: string;
      };
      match_listing_expires_at: {
        Args: { p_created_at: string; p_listing_extended_at: string };
        Returns: string;
      };
      match_outcome_reference_at: {
        Args: { p_match_id: string };
        Returns: string;
      };
      match_participant_count: {
        Args: { p_match_id: string };
        Returns: number;
      };
      match_played_prompts: { Args: never; Returns: number };
      match_result_entry_open: {
        Args: { p_match_id: string };
        Returns: boolean;
      };
      match_result_side_for_user: {
        Args: { p_result_id: string; p_user_id: string };
        Returns: number;
      };
      match_should_expire: { Args: { p_match_id: string }; Returns: boolean };
      match_side_b_user_ids: {
        Args: { p_match_id: string; p_side_a_user_ids: string[] };
        Returns: string[];
      };
      normalize_booking_phone: { Args: { p_phone: string }; Returns: string };
      notify_match_participants: {
        Args: {
          p_dedup_scope: string;
          p_exclude_user_id: string;
          p_kind: string;
          p_match_id: string;
        };
        Returns: number;
      };
      propose_booking_alternative: {
        Args: {
          p_booking_id: string;
          p_court_id: string;
          p_ends_at: string;
          p_reason?: string;
          p_starts_at: string;
        };
        Returns: undefined;
      };
      publish_match: { Args: { p_match_id: string }; Returns: undefined };
      reactivate_club: {
        Args: { p_club_id: string; p_reason?: string };
        Returns: undefined;
      };
      record_availability_ping: {
        Args: { p_ends_at: string; p_starts_at: string };
        Returns: string;
      };
      record_client_event: {
        Args: { p_event: string; p_props?: Json };
        Returns: undefined;
      };
      record_court_request_opened: {
        Args: { p_club_id: string; p_match_id: string };
        Returns: string;
      };
      record_match_attendance: {
        Args: {
          p_attendance: Database["public"]["Enums"]["attendance_status"];
          p_match_id: string;
          p_note?: string;
        };
        Returns: undefined;
      };
      refresh_match_open_state: {
        Args: { p_match_id: string };
        Returns: undefined;
      };
      refresh_match_time_agreement: {
        Args: { p_match_id: string };
        Returns: undefined;
      };
      register_device_push_token: {
        Args: { p_device_id: string; p_platform: string; p_token: string };
        Returns: string;
      };
      register_pilot_club: {
        Args: {
          p_address_public?: string;
          p_amenities?: string[];
          p_as_operator?: boolean;
          p_booking_mode?: string;
          p_booking_phone?: string;
          p_courts?: Json;
          p_description?: string;
          p_latitude?: number;
          p_longitude?: number;
          p_name: string;
          p_slug: string;
          p_zone_id: string;
        };
        Returns: string;
      };
      reject_booking: {
        Args: { p_booking_id: string; p_reason?: string };
        Returns: undefined;
      };
      release_external_court: {
        Args: { p_match_id: string; p_reason?: string };
        Returns: undefined;
      };
      report_match_played: {
        Args: { p_match_id: string; p_played: boolean };
        Returns: undefined;
      };
      request_account_deletion: { Args: never; Returns: undefined };
      request_match_booking: {
        Args: { p_court_id: string; p_match_id: string };
        Returns: string;
      };
      reschedule_match_time: {
        Args: { p_ends_at: string; p_match_id: string; p_starts_at: string };
        Returns: string;
      };
      resolve_match_result_dispute: {
        Args: { p_reason: string; p_resolution: string; p_result_id: string };
        Returns: undefined;
      };
      resolve_stale_results: { Args: never; Returns: Json };
      resolve_user_report: {
        Args: { p_reason: string; p_report_id: string; p_resolution: string };
        Returns: undefined;
      };
      respond_booking_alternative: {
        Args: { p_accept: boolean; p_booking_id: string };
        Returns: undefined;
      };
      respond_to_join_request: {
        Args: { p_accept: boolean; p_match_id: string; p_user_id: string };
        Returns: undefined;
      };
      resubmit_match_result: {
        Args: {
          p_match_id: string;
          p_score: Json;
          p_side_a_user_ids: string[];
        };
        Returns: undefined;
      };
      review_pilot_club: {
        Args: { p_approve: boolean; p_club_id: string; p_reason?: string };
        Returns: undefined;
      };
      revoke_pending_targeted_invites: {
        Args: { p_except_invitation_id?: string; p_match_id: string };
        Returns: undefined;
      };
      run_notification_jobs: { Args: never; Returns: Json };
      sanitize_player_note: { Args: { p_note: string }; Returns: string };
      schedule_attendance_prompts: { Args: never; Returns: number };
      schedule_stale_match_reminders: { Args: never; Returns: number };
      send_match_message: {
        Args: { p_body: string; p_match_id: string };
        Returns: string;
      };
      set_club_favorite: {
        Args: { p_club_id: string; p_favorite: boolean };
        Returns: undefined;
      };
      set_court_weekly_hours: {
        Args: { p_court_id: string; p_hours: Json };
        Returns: undefined;
      };
      set_own_avatar: { Args: { p_avatar_path?: string }; Returns: string };
      set_own_gender: {
        Args: { p_gender?: Database["public"]["Enums"]["gender"] };
        Returns: undefined;
      };
      set_own_notification_locale: {
        Args: { p_locale: string };
        Returns: string;
      };
      set_own_skill_band: {
        Args: { p_skill_band: Database["public"]["Enums"]["skill_band"] };
        Returns: undefined;
      };
      set_player_preferred_zones: {
        Args: { p_zone_ids: string[] };
        Returns: undefined;
      };
      set_recurring_availability: {
        Args: { p_windows: Json };
        Returns: number;
      };
      skill_band_rank: {
        Args: { p_band: Database["public"]["Enums"]["skill_band"] };
        Returns: number;
      };
      start_in_progress_matches: { Args: never; Returns: number };
      submit_match_result: {
        Args: {
          p_match_id: string;
          p_score: Json;
          p_side_a_user_ids: string[];
        };
        Returns: string;
      };
      submit_user_report: {
        Args: {
          p_category: string;
          p_match_id?: string;
          p_message_id?: string;
          p_note?: string;
          p_reported_user_id?: string;
        };
        Returns: string;
      };
      suggest_match_times: {
        Args: {
          p_format?: Database["public"]["Enums"]["match_format"];
          p_horizon_days?: number;
          p_limit?: number;
          p_max_skill?: Database["public"]["Enums"]["skill_band"];
          p_min_skill?: Database["public"]["Enums"]["skill_band"];
          p_slot_minutes?: number;
          p_zone_ids?: string[];
        };
        Returns: {
          candidate_count: number;
          ends_at: string;
          starts_at: string;
        }[];
      };
      unreachable_notification_summary: {
        Args: never;
        Returns: {
          kind: string;
          notification_count: number;
          oldest_scheduled_at: string;
          recipient_count: number;
        }[];
      };
      update_club_booking_settings: {
        Args: {
          p_booking_mode: string;
          p_booking_phone?: string;
          p_club_id: string;
        };
        Returns: undefined;
      };
      update_club_profile: {
        Args: {
          p_address_public?: string;
          p_amenities?: string[];
          p_club_id: string;
          p_description?: string;
          p_latitude?: number;
          p_longitude?: number;
          p_name: string;
        };
        Returns: undefined;
      };
      upsert_club_court: {
        Args: {
          p_club_id: string;
          p_court_id?: string;
          p_currency?: string;
          p_is_indoor?: boolean;
          p_name?: string;
          p_price_minor?: number;
          p_slot_minutes?: number;
          p_surface?: string;
        };
        Returns: string;
      };
      validate_match_score: { Args: { p_score: Json }; Returns: number[] };
      viewer_is_platform_operator: { Args: never; Returns: boolean };
      viewer_match_time_overlap: {
        Args: {
          p_match_id: string;
          p_range_end: string;
          p_range_start: string;
          p_viewer_id: string;
        };
        Returns: boolean;
      };
      withdraw_booking_alternative: {
        Args: { p_booking_id: string; p_reason?: string };
        Returns: undefined;
      };
      withdraw_from_booked_match: {
        Args: { p_match_id: string; p_reason: string };
        Returns: undefined;
      };
      withdraw_match_time_option: {
        Args: { p_time_option_id: string };
        Returns: undefined;
      };
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
      court_request_status: "opened" | "sent" | "not_sent";
      gender: "female" | "male";
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
      result_status:
        "submitted" | "confirmed" | "disputed" | "resolved" | "unverified";
      skill_band:
        "beginner" | "improving" | "intermediate" | "advanced" | "competitive";
      vote_value: "yes" | "no";
    };
    CompositeTypes: {
      discover_compatible_player_card: {
        user_id: string | null;
        display_name: string | null;
        avatar_path: string | null;
        skill_band: Database["public"]["Enums"]["skill_band"] | null;
        play_intent: Database["public"]["Enums"]["play_intent"] | null;
        prefers_singles: boolean | null;
        prefers_doubles: boolean | null;
        zones: Json | null;
        provisional_rating_label: string | null;
        completed_match_count: number | null;
        level_fit: boolean | null;
        zone_overlap: boolean | null;
        availability_overlap: boolean | null;
        intent_fit: boolean | null;
        format_fit: boolean | null;
        display_rating: number | null;
        overlap_starts_at: string | null;
        overlap_ends_at: string | null;
        bio: string | null;
        availability_weekdays: Json | null;
        availability_day_parts: Json | null;
        near_term_slots: Json | null;
        near_term_overlap_slots: Json | null;
        favorite_clubs: Json | null;
      };
      discover_open_match_card: {
        match_id: string | null;
        format: Database["public"]["Enums"]["match_format"] | null;
        intent: Database["public"]["Enums"]["play_intent"] | null;
        visibility: Database["public"]["Enums"]["match_visibility"] | null;
        status: Database["public"]["Enums"]["match_status"] | null;
        requires_creator_approval: boolean | null;
        min_skill: Database["public"]["Enums"]["skill_band"] | null;
        max_skill: Database["public"]["Enums"]["skill_band"] | null;
        zones: Json | null;
        proposed_times: Json | null;
        participant_count: number | null;
        capacity: number | null;
        creator_display_name: string | null;
        creator_avatar_path: string | null;
        level_fit: boolean | null;
        zone_overlap: boolean | null;
        availability_overlap: boolean | null;
        created_at: string | null;
        notes: string | null;
        preferred_clubs: Json | null;
        court_secured: boolean | null;
        court_club_name: string | null;
      };
      disputed_result_queue_row: {
        result_id: string | null;
        match_id: string | null;
        status: Database["public"]["Enums"]["result_status"] | null;
        score: Json | null;
        winner_user_id: string | null;
        winner_name: string | null;
        submitted_by: string | null;
        submitted_by_name: string | null;
        dispute_note: string | null;
        disputed_at: string | null;
        match_format: Database["public"]["Enums"]["match_format"] | null;
      };
      match_hub_card: {
        match_id: string | null;
        format: Database["public"]["Enums"]["match_format"] | null;
        visibility: Database["public"]["Enums"]["match_visibility"] | null;
        status: Database["public"]["Enums"]["match_status"] | null;
        intent: Database["public"]["Enums"]["play_intent"] | null;
        min_skill: Database["public"]["Enums"]["skill_band"] | null;
        max_skill: Database["public"]["Enums"]["skill_band"] | null;
        requires_creator_approval: boolean | null;
        notes: string | null;
        creator_id: string | null;
        creator_display_name: string | null;
        participant_count: number | null;
        capacity: number | null;
        zones: Json | null;
        proposed_times: Json | null;
        participants: Json | null;
        pending_requests: Json | null;
        viewer_status: Database["public"]["Enums"]["participant_status"] | null;
        viewer_is_creator: boolean | null;
        next_action: string | null;
        selected_time_option_id: string | null;
        booking: Json | null;
        listing_expires_at: string | null;
        is_stale_warning: boolean | null;
        can_extend_listing: boolean | null;
        result: Json | null;
        viewer_attendance:
          Database["public"]["Enums"]["attendance_status"] | null;
        timing_mode: string | null;
        preferred_clubs: Json | null;
        agreed_starts_at: string | null;
        agreed_ends_at: string | null;
        cancellation_reason: string | null;
      };
      match_invite_inbox_row: {
        invitation_id: string | null;
        match_id: string | null;
        format: Database["public"]["Enums"]["match_format"] | null;
        match_status: Database["public"]["Enums"]["match_status"] | null;
        creator_display_name: string | null;
        inviter_display_name: string | null;
        participant_count: number | null;
        capacity: number | null;
        soonest_time: string | null;
        expires_at: string | null;
        created_at: string | null;
        note: string | null;
      };
      user_report_queue_row: {
        report_id: string | null;
        status: Database["public"]["Enums"]["report_status"] | null;
        category: string | null;
        note: string | null;
        reporter_id: string | null;
        reporter_name: string | null;
        reported_user_id: string | null;
        reported_user_name: string | null;
        match_id: string | null;
        created_at: string | null;
      };
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
      court_request_status: ["opened", "sent", "not_sent"],
      gender: ["female", "male"],
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
      result_status: [
        "submitted",
        "confirmed",
        "disputed",
        "resolved",
        "unverified",
      ],
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
