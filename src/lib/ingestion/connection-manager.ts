import type { ModSentryMessage } from "@/types/message";
import { ModSentryEventBus } from "./event-bus";
import { KickPusherConnection } from "./kick-pusher";
import { TwitchIrcConnection } from "./twitch-irc";
import type { ChannelConnection, ConnectionListener, IngestionChannel, IngestionConnectionState, MessageListener } from "./types";

export interface TwitchCredential {
  accessToken: string;
  username: string;
}

export class ConnectionManager {
  private readonly connections = new Map<string, ChannelConnection>();
  private readonly states = new Map<string, IngestionConnectionState>();
  private readonly eventBus = new ModSentryEventBus();

  constructor(
    private readonly onMessage: MessageListener,
    private readonly onState: ConnectionListener,
  ) {
    this.eventBus.subscribe(this.onMessage);
  }

  connect(channel: IngestionChannel, options?: { twitch?: TwitchCredential }): void {
    const key = this.getKey(channel);
    this.connections.get(key)?.disconnect();

    const connection = channel.platform === "twitch"
      ? this.createTwitchConnection(channel, options?.twitch)
      : new KickPusherConnection(channel, this.handleMessage, this.handleState);

    if (!connection) return;
    this.connections.set(key, connection);
    connection.connect();
  }

  disconnect(channel: IngestionChannel): void {
    const key = this.getKey(channel);
    this.connections.get(key)?.disconnect();
    this.connections.delete(key);
    this.states.delete(key);
  }

  disconnectAll(): void {
    for (const connection of this.connections.values()) connection.disconnect();
    this.connections.clear();
    this.states.clear();
    this.eventBus.clear();
  }

  getStates(): IngestionConnectionState[] {
    return [...this.states.values()];
  }

  private createTwitchConnection(channel: IngestionChannel, credential?: TwitchCredential): ChannelConnection | null {
    if (!credential) {
      this.handleState({
        key: this.getKey(channel),
        channel,
        status: "error",
        reconnectAttempt: 0,
        lastError: "Twitch realtime credential is missing",
      });
      return null;
    }

    return new TwitchIrcConnection(
      channel,
      credential.accessToken,
      credential.username,
      this.handleMessage,
      this.handleState,
    );
  }

  private handleMessage = (message: ModSentryMessage): void => {
    this.eventBus.publish(message);
  };

  private handleState = (state: IngestionConnectionState): void => {
    this.states.set(state.key, state);
    this.onState(state);
  };

  private getKey(channel: IngestionChannel): string {
    return channel.platform === "twitch"
      ? `twitch:${channel.channelSlug}`
      : `kick:${channel.chatroomId}`;
  }
}
