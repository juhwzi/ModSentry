import type { ModSentryMessage } from "@/types/message";
import { getSpamFingerprint } from "./detectors";

const WINDOW_MS = 10_000;

interface Entry {
  message: ModSentryMessage;
  fingerprint: string;
}

export interface SpamGroup {
  key: string;
  messages: ModSentryMessage[];
  usernames: string[];
  count: number;
}

export class SpamRaidGrouper {
  private readonly entries: Entry[] = [];

  ingest(message: ModSentryMessage): SpamGroup | null {
    const now = message.timestamp;
    this.entries.push({ message, fingerprint: getSpamFingerprint(message) });
    while (this.entries.length && this.entries[0].message.timestamp < now - WINDOW_MS) this.entries.shift();

    const fingerprint = getSpamFingerprint(message);
    const groupEntries = this.entries.filter((entry) => entry.fingerprint === fingerprint);
    const usernames = [...new Set(groupEntries.map((entry) => entry.message.sender.username))];
    if (usernames.length < 2) return null;

    return {
      key: `${message.platform}:${message.channelSlug}:${fingerprint}`,
      messages: groupEntries.map((entry) => entry.message),
      usernames,
      count: groupEntries.length,
    };
  }
}
