import type { ModSentryMessage, ModSentrySender, Platform } from "@/types/message";

export function normalizeContent(content: string): string {
  return content
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function createMessage(input: {
  id: string;
  platform: Platform;
  channelSlug: string;
  chatroomId: string | number;
  sender: ModSentrySender;
  content: string;
  timestamp?: number;
}): ModSentryMessage {
  return {
    id: input.id,
    platform: input.platform,
    channelSlug: input.channelSlug,
    chatroomId: input.chatroomId,
    sender: input.sender,
    content: input.content,
    normalizedContent: normalizeContent(input.content),
    timestamp: input.timestamp ?? Date.now(),
  };
}
