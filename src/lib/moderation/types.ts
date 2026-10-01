import type { Platform } from "@prisma/client";

export type ModerationAction = "TIMEOUT" | "BAN" | "UNBAN";

export interface ModerationInput {
  platform: Platform;
  channelSlug: string;
  targetUsername: string;
  targetUserId?: string;
  reason?: string;
  durationSeconds?: number;
  action?: ModerationAction;
}

export interface ModerationResult {
  platform: Platform;
  action: ModerationAction;
  targetUsername: string;
  targetUserId: string;
  channelSlug: string;
  executedAt: string;
}

export interface MassBanItem extends ModerationInput {
  targetUsername: string;
}

export interface MassBanResult {
  requested: number;
  succeeded: ModerationResult[];
  failed: Array<{ targetUsername: string; error: string }>;
}
