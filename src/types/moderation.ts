import type { Platform } from "./message";

export type ViolationSeverity = "critical" | "warning" | "info";
export type ModerationAction = "timeout" | "ban" | "unban" | "dismiss";

export interface ModerationTicket {
  id: string;
  platform: Platform;
  channelSlug: string;
  senderUsername: string;
  content: string;
  createdAt: number;
  claimedBy?: string;
}

export interface ViolationTarget {
  username: string;
  platform: Platform;
}

export interface Violation {
  id: string;
  type: "link" | "impersonation" | "spam" | "raid";
  severity: ViolationSeverity;
  platform: Platform;
  channelSlug: string;
  reason: string;
  content?: string;
  targets: ViolationTarget[];
  createdAt: number;
  claimedBy?: string;
}
