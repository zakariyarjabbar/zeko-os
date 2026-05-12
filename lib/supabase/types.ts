// lib/supabase/types.ts
// Typed DB schema for the Supabase client.
// Branded ID types are used for all primary keys so the TypeScript compiler
// prevents accidentally mixing user IDs with channel IDs, message IDs, etc.

import type { UserId, ChannelId, MessageId, RoleId, PermissionId, DmId } from "../types/ids";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id:             UserId;
          display_id:     number;
          display_name:   string;
          username:       string;
          access_flags:   string[];            // permission UUIDs
          session_status: "ONLINE" | "OFFLINE" | "AWAY";
          last_login_ip:  string;
          last_active:    string;
          created_at:     string;
        };
        Insert: {
          id:              UserId;
          display_name?:   string;
          username:        string;
          access_flags?:   string[];           // permission UUIDs
          session_status?: "ONLINE" | "OFFLINE" | "AWAY";
          last_login_ip?:  string;
          last_active?:    string;
          // display_id is omitted — assigned automatically by DB sequence
        };
        Update: {
          display_name?:   string;
          username?:       string;
          access_flags?:   string[];           // permission UUIDs
          session_status?: "ONLINE" | "OFFLINE" | "AWAY";
          last_login_ip?:  string;
          last_active?:    string;
        };
      };

      channels: {
        Row: {
          id:                ChannelId;
          label:             string;
          topic:             string;
          public:            boolean;
          view_permission:   string | null;
          delete_permission: string | null;
          created_at:        string;
        };
        Insert: {
          id:                 ChannelId;
          label:              string;
          topic?:             string;
          public?:            boolean;
          view_permission?:   string | null;
          delete_permission?: string | null;
        };
        Update: {
          label?:             string;
          topic?:             string;
          public?:            boolean;
          view_permission?:   string | null;
          delete_permission?: string | null;
        };
      };

      messages: {
        Row: {
          id:          MessageId;
          channel_id:  ChannelId;
          user_id:     UserId | null;
          user_handle: string;
          body:        string;
          type:        "message" | "system";
          created_at:  string;
        };
        Insert: {
          channel_id:  ChannelId;
          user_id?:    UserId | null;
          user_handle: string;
          body:        string;
          type?:       "message" | "system";
        };
        Update: {
          body?: string;
        };
      };

      direct_messages: {
        Row: {
          id:           DmId;
          from_user_id: UserId;
          to_user_id:   UserId;
          from_handle:  string;
          to_handle:    string;
          body:         string;
          read:         boolean;
          created_at:   string;
        };
        Insert: {
          from_user_id: UserId;
          to_user_id:   UserId;
          from_handle:  string;
          to_handle:    string;
          body:         string;
          read?:        boolean;
        };
        Update: {
          read?: boolean;
        };
      };

      roles: {
        Row: {
          id:          RoleId;
          name:        string;
          description: string;
          permissions: string[];   // permission UUIDs
          created_at:  string;
        };
        Insert: {
          name:         string;
          description?: string;
          permissions?: string[];  // permission UUIDs
        };
        Update: {
          name?:        string;
          description?: string;
          permissions?: string[];  // permission UUIDs
        };
      };

      user_roles: {
        Row: {
          user_id: UserId;
          role_id: RoleId;
        };
        Insert: {
          user_id: UserId;
          role_id: RoleId;
        };
        Update: never;
      };

      permissions: {
        Row: {
          id:          PermissionId;
          name:        string;
          description: string;
          created_at:  string;
        };
        Insert: {
          name:         string;
          description?: string;
        };
        Update: {
          description?: string;
        };
      };

      contact_messages: {
        Row: {
          id:         string;
          name:       string;
          email:      string;
          subject:    string;
          message:    string;
          read:       boolean;
          created_at: string;
        };
        Insert: {
          name:     string;
          email:    string;
          subject:  string;
          message:  string;
          read?:    boolean;
        };
        Update: {
          read?: boolean;
        };
      };
    };
  };
};
