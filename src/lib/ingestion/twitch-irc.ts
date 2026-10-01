import { createMessage } from "./normalize";
import type { ChannelConnection, ConnectionListener, IngestionChannel, IngestionConnectionState, MessageListener } from "./types";

const TWITCH_IRC_URL = "wss://irc-ws.chat.twitch.tv:443";
const MAX_RECONNECT_DELAY_MS = 30_000;

function parseTags(raw: string): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const pair of raw.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) {
      tags[pair] = "";
      continue;
    }
    const key = pair.slice(0, separator);
    const value = pair.slice(separator + 1).replace(/\\s/g, " ");
    tags[key] = value;
  }
  return tags;
}

function parseIrcLine(line: string) {
  let cursor = 0;
  let tags: Record<string, string> = {};

  if (line.startsWith("@")) {
    const tagsEnd = line.indexOf(" ");
    if (tagsEnd === -1) return null;
    tags = parseTags(line.slice(1, tagsEnd));
    cursor = tagsEnd + 1;
  }

  let prefix = "";
  if (line[cursor] === ":") {
    const prefixEnd = line.indexOf(" ", cursor);
    if (prefixEnd === -1) return null;
    prefix = line.slice(cursor + 1, prefixEnd);
    cursor = prefixEnd + 1;
  }

  const trailingIndex = line.indexOf(" :", cursor);
  const commandPart = trailingIndex === -1 ? line.slice(cursor) : line.slice(cursor, trailingIndex);
  const trailing = trailingIndex === -1 ? "" : line.slice(trailingIndex + 2);
  const parts = commandPart.split(" ").filter(Boolean);

  return { tags, prefix, command: parts[0] ?? "", params: parts.slice(1), trailing };
}

export class TwitchIrcConnection implements ChannelConnection {
  readonly key: string;
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUser = false;
  private reconnectAttempt = 0;

  constructor(
    private readonly channel: IngestionChannel,
    private readonly accessToken: string,
    private readonly username: string,
    private readonly onMessage: MessageListener,
    private readonly onState: ConnectionListener,
  ) {
    this.key = `twitch:${channel.channelSlug}`;
  }

  connect(): void {
    this.closedByUser = false;
    this.setState("connecting");
    this.socket?.close();
    this.socket = new WebSocket(TWITCH_IRC_URL);

    this.socket.addEventListener("open", () => {
      this.reconnectAttempt = 0;
      this.send("CAP REQ :twitch.tv/membership twitch.tv/tags twitch.tv/commands");
      this.send(`PASS oauth:${this.accessToken}`);
      this.send(`NICK ${this.username.toLowerCase()}`);
      this.send(`JOIN #${this.channel.channelSlug.toLowerCase()}`);
      this.setState("connected");
    });

    this.socket.addEventListener("message", (event) => {
      const payload = String(event.data);
      for (const line of payload.split("\r\n")) {
        if (!line) continue;
        if (line.startsWith("PING")) {
          this.send(line.replace(/^PING/, "PONG"));
          continue;
        }
        const parsed = parseIrcLine(line);
        if (!parsed || parsed.command !== "PRIVMSG") continue;

        const usernameFromPrefix = parsed.prefix.split("!")[0] || parsed.tags["display-name"] || "unknown";
        const content = parsed.trailing;
        const badges = (parsed.tags.badges ?? "")
          .split(",")
          .filter(Boolean)
          .map((badge) => badge.split("/")[0]);

        this.onMessage(createMessage({
          id: parsed.tags.id || `${this.key}:${parsed.tags["tmi-sent-ts"] ?? Date.now()}:${usernameFromPrefix}:${content}`,
          platform: "twitch",
          channelSlug: this.channel.channelSlug,
          chatroomId: parsed.tags["room-id"] || this.channel.chatroomId,
          sender: {
            id: parsed.tags["user-id"] || usernameFromPrefix,
            username: parsed.tags["display-name"] || usernameFromPrefix,
            badges,
            isSubscriber: parsed.tags.subscriber === "1" || badges.includes("subscriber"),
            isVip: parsed.tags.vip === "1" || badges.includes("vip"),
            createdAt: parsed.tags["tmi-sent-ts"] ? new Date(Number(parsed.tags["tmi-sent-ts"])).toISOString() : undefined,
          },
          content,
          timestamp: parsed.tags["tmi-sent-ts"] ? Number(parsed.tags["tmi-sent-ts"]) : Date.now(),
        }));

        this.setState("connected", { lastMessageAt: Date.now() });
      }
    });

    this.socket.addEventListener("error", () => {
      this.setState("error", { lastError: "Twitch IRC WebSocket error" });
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

  private send(payload: string): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(`${payload}\r\n`);
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
