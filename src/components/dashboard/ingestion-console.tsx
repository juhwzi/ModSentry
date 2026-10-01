"use client";

import { Activity, CircleAlert, Radio, Wifi, WifiOff } from "lucide-react";
import { DefensiveQueue } from "@/components/dashboard/defensive-queue";
import { requestNotificationPermission } from "@/lib/pipeline/alerts";
import React, { useEffect, useMemo } from "react";
import type { Platform } from "@/types/message";
import { useModSentryIngestion } from "@/hooks/use-modsentry-ingestion";
import type { IngestionChannel } from "@/lib/ingestion/types";
import type { PipelineContext } from "@/lib/pipeline/types";

function statusLabel(status: string) {
  switch (status) {
    case "connected": return "CONNECTED";
    case "connecting": return "CONNECTING";
    case "reconnecting": return "RECONNECTING";
    case "error": return "ERROR";
    default: return "OFFLINE";
  }
}

export function IngestionConsole({ channels, context }: { channels: IngestionChannel[]; context?: PipelineContext }) {
  const enableNotifications = async () => {
    await requestNotificationPermission();
  };
  const { messages, states, detections, error } = useModSentryIngestion(channels, context);
  const connected = states.filter((state) => state.status === "connected").length;
  const [now, setNow] = useStateNow();
  const mps = useMemo(() => {
    const cutoff = now - 1_000;
    return messages.filter((message) => message.timestamp >= cutoff).length;
  }, [messages, now]);

  return (
    <section className="mt-5 rounded-2xl border border-modsentry-border bg-modsentry-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-modsentry-border px-5 py-4">
        <div>
          <h2 className="font-mono text-sm font-bold tracking-wider text-modsentry-kick">REAL-TIME INGESTION</h2>
          <p className="mt-1 font-mono text-[10px] text-zinc-600">CONNECTION POOL / NORMALIZER / EVENT BUS</p>
        </div>
        <div className="flex gap-2 font-mono text-[10px]">
          <span className="rounded-full border border-modsentry-border px-3 py-1 text-zinc-500">{connected}/{channels.length} SOCKETS</span>
          <span className="rounded-full border border-modsentry-border px-3 py-1 text-zinc-500">{mps} MSG/S</span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 border-b border-modsentry-critical/20 bg-modsentry-critical/5 px-5 py-3 font-mono text-xs text-red-300">
          <CircleAlert className="size-4" />
          {error}
        </div>
      )}

      <div className="grid gap-3 border-b border-modsentry-border p-5 md:grid-cols-2 xl:grid-cols-3">
        {states.map((state) => (
          <div key={state.key} className="rounded-xl border border-modsentry-border bg-black/10 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {state.status === "connected" ? <Wifi className="size-4 text-modsentry-kick" /> : <WifiOff className="size-4 text-zinc-600" />}
                <span className="font-mono text-xs text-zinc-300">
                  {state.channel.platform.toUpperCase()} / {state.channel.channelSlug}
                </span>
              </div>
              <span className="font-mono text-[9px] text-zinc-600">{statusLabel(state.status)}</span>
            </div>
            <div className="mt-2 font-mono text-[9px] text-zinc-600">
              {state.status === "reconnecting" ? `retry #${state.reconnectAttempt}` : state.lastMessageAt ? `last event ${new Date(state.lastMessageAt).toLocaleTimeString()}` : "waiting for events"}
            </div>
          </div>
        ))}
        {states.length === 0 && (
          <div className="col-span-full py-5 text-center font-mono text-[10px] uppercase tracking-widest text-zinc-700">
            Nenhuma conexão iniciada
          </div>
        )}
      </div>

      <div className="max-h-80 overflow-auto">
        {messages.length === 0 ? (
          <div className="grid min-h-56 place-items-center p-8 text-center">
            <div>
              <Activity className="mx-auto size-7 text-zinc-700" />
              <p className="mt-3 font-mono text-xs uppercase tracking-widest text-zinc-600">Aguardando mensagens</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-modsentry-border">
            {messages.slice(0, 100).map((message) => (
              <article key={`${message.platform}:${message.id}`} className="grid grid-cols-[auto_1fr] gap-3 px-5 py-3">
                <div className="pt-0.5">
                  {message.platform === ("twitch" satisfies Platform) ? (
                    <span className="rounded bg-[#9146FF]/15 px-2 py-1 font-mono text-[9px] text-[#b78aff]">TWITCH</span>
                  ) : (
                    <span className="rounded bg-modsentry-kick/10 px-2 py-1 font-mono text-[9px] text-modsentry-kick">KICK</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-mono text-xs font-bold text-zinc-200">@{message.sender.username}</span>
                    <span className="font-mono text-[9px] text-zinc-700">{message.channelSlug}</span>
                    <span className="ml-auto font-mono text-[9px] text-zinc-700">{new Date(message.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="mt-1 break-words text-sm text-zinc-400">{message.content}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-modsentry-border px-5 py-3 font-mono text-[9px] uppercase tracking-widest text-zinc-700">
        <Radio className="size-3" /> Central Event Bus ativo · mensagens normalizadas em memória
      </div>
      <div className="mt-5">
        <DefensiveQueue detections={detections} />
      </div>
    </section>
  );
}

function useStateNow() {
  const [now, setNow] = React.useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  return [now, setNow] as const;
}
