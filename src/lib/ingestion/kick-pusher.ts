import { createMessage } from "./normalize";
import type { ChannelConnection, ConnectionListener, IngestionChannel, IngestionConnectionState, MessageListener } from "./types";

const KICK_PUSHER_URL = "wss://ws-us2.pusher.com/app/eb1d5f283081a78b932c?protocol=7&client=js&version=8.4.0&flash=false";
const MAX_RECONNECT_DELAY_MS = 30_000;

interface PusherEnvelope {
  event?: string;
  channel?: string;
  data?: unknown;
}

function parseData(data: unknown): unknown {
  if (typeof data !== "string") return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

function getString(source: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" || typeof value === "number") return String(value);
  }
  return undefined;
}

function getObject(source: Record<string, unknown>, key: string): Record<string, unknown> {
  return source[key] && typeof source[key] === "object" ? source[key] as Record<string, unknown> : {};
}

export class KickPusherConnection implements ChannelConnection {
  readonly key: string;
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUser = false;
  private reconnectAttempt = 0;

  constructor(
    private readonly channel: IngestionChannel,
    private readonly onMessage: MessageListener,
    private readonly onState: ConnectionListener,
  ) {
    this.key = `kick:${channel.chatroomId}`;
  }

  connect(): void {
    this.closedByUser = false;
    this.setState("connecting");
    this.socket?.close();
    this.socket = new WebSocket(KICK_PUSHER_URL);

    this.socket.addEventListener("open", () => {
      this.reconnectAttempt = 0;
      this.setState("connecting");
    });

    this.socket.addEventListener("message", (event) => {
      let envelope: PusherEnvelope;
      try {
        envelope = JSON.parse(String(event.data)) as PusherEnvelope;
      } catch {
        return;
      }
      if (envelope.event === "pusher:connection_established") {
        this.subscribe();
        return;
      }

      if (envelope.event === "pusher:subscription_succeeded") {
        this.setState("connected");
        return;
      }

      if (envelope.event === "pusher:subscription_error") {
        this.setState("error", { lastError: "Kick chatroom subscription failed" });
        return;
      }

      if (envelope.event === "pusher:ping") {
        this.send({ event: "pusher:pong", data: {} });
        return;
      }

      if (envelope.event !== "App\\Events\\ChatMessageEvent") return;

      const raw = parseData(envelope.data);
      if (!raw || typeof raw !== "object") return;
      const payload = raw as Record<string, unknown>;
      const sender = getObject(payload, "sender");
      const identity = getObject(sender, "identity");
      const badges = Array.isArray(identity.badges)
        ? identity.badges.filter((badge): badge is string => typeof badge === "string")
        : [];
      const content = getString(payload, "content", "message") ?? "";
      if (!content) return;

      this.onMessage(createMessage({
        id: getString(payload, "message_id", "id") || `${this.key}:${Date.now()}`,
        platform: "kick",
        channelSlug: this.channel.channelSlug,
        chatroomId: this.channel.chatroomId,
        sender: {
          id: getString(sender, "id", "user_id") || "unknown",
          username: getString(sender, "username", "slug") || "unknown",
          badges,
          isSubscriber: badges.some((badge) => badge.toLowerCase().includes("subscriber")),
          isVip: badges.some((badge) => badge.toLowerCase().includes("vip")),
          createdAt: getString(sender, "created_at"),
        },
        content,
        timestamp: Date.now(),
      }));
      this.setState("connected", { lastMessageAt: Date.now() });
    });

    this.socket.addEventListener("error", () => {
      this.setState("error", { lastError: "Kick Pusher WebSocket error" });
    });

    this.socket.addEventListener("close", () => {
      this.socket = null;
      if (this.closedByUser) {
        this.setState("disconnected");
        return;
      }
      this.scheduleReconnect();
    });
  }

  disconnect(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close(1000, "client disconnect");
    this.socket = null;
    this.setState("disconnected");
  }

  private subscribe(): void {
    this.send({
      event: "pusher:subscribe",
      data: { auth: "", channel: `chatrooms.${this.channel.chatroomId}.v2` },
    });
  }

  private send(payload: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(payload));
  }

  private scheduleReconnect(): void {
    this.reconnectAttempt += 1;
    const exponential = Math.min(MAX_RECONNECT_DELAY_MS, 1_000 * 2 ** Math.min(this.reconnectAttempt - 1, 5));
    const jitter = Math.floor(Math.random() * 500);
    this.setState("reconnecting", { reconnectAttempt: this.reconnectAttempt });
    this.reconnectTimer = setTimeout(() => this.connect(), exponential + jitter);
  }

  private setState(status: IngestionConnectionState["status"], extra: Partial<IngestionConnectionState> = {}): void {
    this.onState({
      key: this.key,
      channel: this.channel,
      status,
      reconnectAttempt: this.reconnectAttempt,
      ...extra,
    });
  }
}
