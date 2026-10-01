"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ModSentryMessage } from "@/types/message";
import { ConnectionManager } from "@/lib/ingestion/connection-manager";
import type { IngestionChannel, IngestionConnectionState } from "@/lib/ingestion/types";
import { DefensivePipeline } from "@/lib/pipeline/engine";
import type { DetectionResult, PipelineContext } from "@/lib/pipeline/types";
import { dispatchDetectionAlert } from "@/lib/pipeline/alerts";

interface TwitchCredentialResponse {
  accessToken: string;
  username: string;
}

export function useModSentryIngestion(
  channels: IngestionChannel[],
  context: PipelineContext = { moderatorUsernames: [] },
) {
  const managerRef = useRef<ConnectionManager | null>(null);
  const [messages, setMessages] = useState<ModSentryMessage[]>([]);
  const [states, setStates] = useState<IngestionConnectionState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [detections, setDetections] = useState<DetectionResult[]>([]);
  const pipelineRef = useRef(new DefensivePipeline());
  const channelsKey = useMemo(() => JSON.stringify(channels), [channels]);
  const contextKey = useMemo(() => JSON.stringify(context), [context]);

  useEffect(() => {
    const manager = new ConnectionManager(
      (message) => {
        setMessages((current) => [message, ...current].slice(0, 5000));
        const results = pipelineRef.current.process(message, context);
        if (results.length) {
          setDetections((current) => [...results, ...current].slice(0, 250));
          for (const result of results) dispatchDetectionAlert(result);
        }
      },
      (state) => setStates(manager.getStates()),
    );
    managerRef.current = manager;

    let cancelled = false;
    void (async () => {
      let twitch: TwitchCredentialResponse | undefined;
      if (channels.some((channel) => channel.platform === "twitch")) {
        const response = await fetch("/api/realtime/twitch", { cache: "no-store" });
        if (!response.ok) {
          if (!cancelled) setError("Não foi possível obter a credencial de chat da Twitch.");
          return;
        }
        twitch = await response.json() as TwitchCredentialResponse;
      }

      if (cancelled) return;
      for (const channel of channels) {
        manager.connect(channel, twitch ? { twitch } : undefined);
      }
      setStates(manager.getStates());
    })();

    return () => {
      cancelled = true;
      manager.disconnectAll();
      managerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelsKey, contextKey]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setDetections([]);
  }, []);

  return { messages, states, detections, error, clearMessages };
}
