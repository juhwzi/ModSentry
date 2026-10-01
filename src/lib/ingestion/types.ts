import type { ModSentryMessage, Platform } from "@/types/message";

export type IngestionConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export interface IngestionChannel {
  id?: string;
  platform: Platform;
  channelSlug: string;
  chatroomId: string | number;
}

export interface IngestionConnectionState {
  key: string;
  channel: IngestionChannel;
  status: IngestionConnectionStatus;
  reconnectAttempt: number;
  lastMessageAt?: number;
  lastError?: string;
}

export type MessageListener = (message: ModSentryMessage) => void;
export type ConnectionListener = (state: IngestionConnectionState) => void;

export interface ChannelConnection {
  readonly key: string;
  connect(): void;
  disconnect(): void;
}
