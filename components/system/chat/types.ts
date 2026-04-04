// components/system/chat/types.ts
// Shared chat types.

export interface Channel {
  id:          string;
  label:       string;
  unread:      number;
  memberCount: number;
  topic:       string;
  permissions: string[]; // ['view_channel', 'send_message', 'delete_message']
}

export interface ChatMessage {
  id:        string;
  channel:   string;
  timestamp: string;
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
