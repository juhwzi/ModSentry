"use client";

import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

export type SyncEvent = { type: "CLAIM_TICKET" | "RELEASE_TICKET"; ticketId: string; moderatorName?: string };

export function useModSentrySync(channelKeys: string[], onEvent: (event: SyncEvent) => void) {
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key || channelKeys.length === 0) return;
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const channels = channelKeys.map((keyName) => {
      const channel = supabase.channel(`modsentry:${keyName}`);
      channel.on("broadcast", { event: "moderation" }, (payload) => onEvent(payload.payload as SyncEvent));
      channel.subscribe();
      return channel;
    });
    return () => { channels.forEach((channel) => void supabase.removeChannel(channel)); };
  }, [channelKeys.join("|"), onEvent]);
}
