// components/system/chat/types.ts
// Shared chat types used across page, sidebar, and message log.

export interface Channel {
  id:          string;
  label:       string;
  unread:      number;
  memberCount: number;
  topic:       string;
}

export interface ChatMessage {
  id:        string;
  channel:   string;
  timestamp: string;
  user:      string;
  text:      string;
  type:      "message" | "system";
}
