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
