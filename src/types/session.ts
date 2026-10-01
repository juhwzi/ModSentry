import type { Platform } from "./message";

export type SessionStatus = "active" | "ended";

export interface ConnectedChannel {
  id: string;
  platform: Platform;
  externalId: string;
  slug: string;
  displayName?: string;
  chatroomId?: string | number;
  isLive: boolean;
  verified: boolean;
  active: boolean;
}

export interface ModerationSession {
  id: string;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string;
  channels: ConnectedChannel[];
}
