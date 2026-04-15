// lib/supabase/types.ts
// Typed DB schema for Supabase client.

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id:             string;
          display_id:     number;
          username:       string;
          access_flags:   string[];
          session_status: string;
          last_login_ip:  string;
          last_active:    string;
          created_at:     string;
        };
        Insert: {
          id:              string;
          username:        string;
          access_flags?:   string[];
          session_status?: string;
          last_login_ip?:  string;
          last_active?:    string;
          // display_id is omitted — assigned automatically by DB sequence
        };
        Update: {
          username?:       string;
          access_flags?:   string[];
          session_status?: string;
          last_login_ip?:  string;
          last_active?:    string;
        };
      };
      channels: {
        Row: {
          id:           string;
          label:        string;
          topic:        string;
          member_count: number;
          created_at:   string;
        };
        Insert: {
          id:            string;
          label:         string;
          topic?:        string;
          member_count?: number;
        };
        Update: {
          label?:        string;
          topic?:        string;
          member_count?: number;
        };
      };
      messages: {
        Row: {
          id:         string;
          channel_id: string;
          user_id:    string | null;
          body:       string;
          type:       "message" | "system";
          created_at: string;
        };
        Insert: {
          channel_id: string;
          user_id?:   string | null;
          body:       string;
          type?:      "message" | "system";
        };
        Update: {
          body?: string;
        };
      };
    };
  };
};
