// components/system/chat/types.ts
// Shared chat types.

export interface Channel {
  id:               string;
  label:            string;
  unread:           number;
  memberCount:      number;
  topic:            string;
  permissions:      string[];
  isPublic:         boolean;
  viewPermission:   string | null;
  deletePermission: string | null;
}

export interface ChatMessage {
  id:        string;
  channel:   string;
  timestamp: string; // HH:MM:SS
  date:      string; // YYYY-MM-DD
  user:      string;
  userId:    string;
  text:      string;
  type:      "message" | "system";
  edited?:   boolean;
  editedAt?: string;
  read?:     boolean; // DMs: whether recipient has read this message
}

export interface TypingUser {
  user_id:    string;
  handle:     string;
  updated_at: string;
}

export interface AppNotification {
  id:          string;
  type:        string;
  source_type: "channel" | "dm";
  source_id:   string;
  channel_id:  string | null;
  from_handle: string;
  body:        string;
  read:        boolean;
  created_at:  string;
}

export interface DMConversation {
  userId:   string;
  handle:   string;
  unread:   number;
  lastMsg:  string;
  lastTime: string;
}

export interface DirectMessage {
  id:           string;
  fromUserId:   string;
  toUserId:     string;
  fromHandle:   string;
  toHandle:     string;
  body:         string;
  read:         boolean;
  created_at:   string;
}
