import type { ModSentryMessage } from "@/types/message";
import type { MessageListener } from "./types";

export class ModSentryEventBus {
  private readonly listeners = new Set<MessageListener>();

  subscribe(listener: MessageListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(message: ModSentryMessage): void {
    for (const listener of this.listeners) {
      try {
        listener(message);
      } catch (error) {
        console.error("[ModSentryEventBus] listener failed", error);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
