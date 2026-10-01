export type Platform = "kick" | "twitch";

export interface ModSentrySender {
  id: string;
  username: string;
  badges: string[];
  isSubscriber: boolean;
  isVip: boolean;
  createdAt?: string;
}

export interface ModSentryMessage {
  id: string;
  platform: Platform;
  channelSlug: string;
  chatroomId: string | number;
  sender: ModSentrySender;
  content: string;
  normalizedContent: string;
  timestamp: number;
}
