// lib/supabase/types.ts
// Typed DB schema for Supabase client.

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id:           string;
          alias:        string;
          department:   string;
          access_flags: string[];
          created_at:   string;
        };
        Insert: {
          id:            string;
          alias?:        string;
          department?:   string;
          access_flags?: string[];
        };
        Update: {
          alias?:        string;
          department?:   string;
          access_flags?: string[];
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
          id:          string;
          channel_id:  string;
          user_id:     string | null;
          user_handle: string;
          body:        string;
          type:        "message" | "system";
          created_at:  string;
        };
        Insert: {
          channel_id:  string;
          user_id?:    string | null;
          user_handle: string;
          body:        string;
          type?:       "message" | "system";
        };
        Update: {
          body?: string;
        };
      };
    };
  };
};
