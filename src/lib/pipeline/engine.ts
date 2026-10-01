import type { ModSentryMessage } from "@/types/message";
import { detectBlacklist, detectCallout, detectImpersonation, detectLinks } from "./detectors";
import { SpamRaidGrouper } from "./grouping";
import type { DetectionResult, PipelineContext } from "./types";

export class DefensivePipeline {
  private readonly groupers = new Map<string, SpamRaidGrouper>();
  private readonly lastAlertAt = new Map<string, number>();

  process(message: ModSentryMessage, context: PipelineContext): DetectionResult[] {
    const results: DetectionResult[] = [];
    const callout = detectCallout(message, context);
    if (callout) results.push(this.withAlertRateLimit(callout, context.cooldownSeconds ?? 15));

    const blacklist = detectBlacklist(message, context);
    if (blacklist) results.push(blacklist);

    const link = detectLinks(message);
    if (link) results.push(link);

    const impersonation = detectImpersonation(message, context);
    if (impersonation) results.push(impersonation);

    const key = `${message.platform}:${message.channelSlug}`;
    let grouper = this.groupers.get(key);
    if (!grouper) {
      grouper = new SpamRaidGrouper();
      this.groupers.set(key, grouper);
    }
    const group = grouper.ingest(message);
    if (group) {
      results.push({
        id: `spam-group:${group.key}:${message.timestamp}`,
        kind: "spam",
        severity: group.usernames.length >= 5 ? "critical" : "moderate",
        message,
        reason: "Agrupamento colaborativo de spam/raid",
        groupKey: group.key,
        groupedCount: group.count,
        usernames: group.usernames,
      });
    }

    return results;
  }

  private withAlertRateLimit(result: DetectionResult, cooldownSeconds: number): DetectionResult {
    const key = `${result.message.platform}:${result.message.channelSlug}:callout`;
    const now = result.message.timestamp;
    const previous = this.lastAlertAt.get(key) ?? 0;
    const allowed = now - previous >= cooldownSeconds * 1_000;
    if (allowed) this.lastAlertAt.set(key, now);
    return { ...result, soundAllowed: allowed, notificationAllowed: allowed };
  }
}
