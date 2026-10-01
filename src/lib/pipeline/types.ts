import type { ModSentryMessage } from "@/types/message";

export type DetectionKind = "callout" | "link" | "blacklist" | "impersonation" | "spam";
export type DetectionSeverity = "info" | "moderate" | "critical";

export interface DetectionResult {
  id: string;
  kind: DetectionKind;
  severity: DetectionSeverity;
  message: ModSentryMessage;
  reason: string;
  matched?: string;
  similarity?: number;
  groupKey?: string;
  groupedCount?: number;
  usernames?: string[];
  soundAllowed?: boolean;
  notificationAllowed?: boolean;
}

export interface PipelineContext {
  moderatorUsernames: string[];
  streamerUsername?: string;
  customCallouts?: string[];
  cooldownSeconds?: number;
  blacklistTerms?: string[];
}
