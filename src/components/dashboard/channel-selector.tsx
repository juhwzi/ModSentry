"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import type { IngestionChannel } from "@/lib/ingestion/types";

type Channel = IngestionChannel & {
  displayName?: string;
  isLive?: boolean;
};

type Props = {
  channels: Channel[];
  activeChannels: Channel[];
  onChange: (channels: Channel[]) => void;
};

export function ChannelSelector({ channels, activeChannels, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<Channel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const available = new Map(channels.map((channel) => [`${channel.platform}:${channel.channelSlug}`, channel]));
    const saved = window.localStorage.getItem("modsentry:dashboard-channels");
    if (saved) {
      try {
        const keys = JSON.parse(saved) as string[];
        const restored = keys.map((key) => available.get(key)).filter(Boolean) as Channel[];
        if (restored.length) onChange(restored.slice(0, 2));
      } catch { /* ignore invalid local state */ }
    }
  }, [channels, onChange]);

  useEffect(() => {
    window.localStorage.setItem("modsentry:dashboard-channels", JSON.stringify(activeChannels.map((channel) => `${channel.platform}:${channel.channelSlug}`)));
  }, [activeChannels]);

  const activeKeys = useMemo(() => new Set(activeChannels.map((channel) => `${channel.platform}:${channel.channelSlug}`)), [activeChannels]);

  const selectChannel = (channel: Channel) => {
    if (activeKeys.has(`${channel.platform}:${channel.channelSlug}`)) return;
    if (activeChannels.length >= 2) return;
    onChange([...activeChannels, channel]);
    setOpen(false);
  };

  const removeChannel = (channel: Channel) => {
    if (activeChannels.length <= 1) return;
    onChange(activeChannels.filter((item) => `${item.platform}:${item.channelSlug}` !== `${channel.platform}:${channel.channelSlug}`));
  };

  const searchKick = async () => {
    const normalized = slug.trim().toLowerCase();
    if (!normalized) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const response = await fetch(`/api/kick/channels?slug=${encodeURIComponent(normalized)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Canal não encontrado.");
      const channel = body.data as { broadcaster_user_id: number; slug: string; chatroom_id?: string | number; stream?: { is_live?: boolean } };
      setResult({ id: `kick:${channel.broadcaster_user_id}`, platform: "kick", channelSlug: channel.slug, chatroomId: channel.chatroom_id ?? channel.broadcaster_user_id, isLive: Boolean(channel.stream?.is_live) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha na busca.");
    } finally { setLoading(false); }
  };

  const addKick = async () => {
    if (!result || activeChannels.length >= 2) return;
    setAdding(true); setError(null);
    try {
      const response = await fetch("/api/kick/channels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: result.channelSlug }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Não foi possível adicionar o canal.");
      const saved = body.data.channel;
      selectChannel({ id: saved.id, platform: "kick", channelSlug: saved.slug, chatroomId: saved.chatroomId ?? saved.externalId, isLive: saved.isLive });
      setResult(null); setSlug("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao adicionar canal.");
    } finally { setAdding(false); }
  };

  return (
    <div className="relative rounded-2xl border border-modsentry-border bg-modsentry-surface p-3 shadow-xl shadow-black/10">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto flex items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[.18em] text-zinc-600">Chats ativos</span>
          <span className="rounded-full border border-modsentry-kick/20 bg-modsentry-kick/5 px-2 py-1 font-mono text-[9px] text-modsentry-kick">{activeChannels.length}/2</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeChannels.map((channel) => (
            <div key={`${channel.platform}:${channel.channelSlug}`} className="flex items-center gap-2 rounded-full border border-modsentry-border bg-black/20 px-3 py-2">
              <span className={`size-1.5 rounded-full ${channel.platform === "kick" ? "bg-modsentry-kick" : "bg-[#9146FF]"}`} />
              <span className="font-mono text-[10px] text-zinc-300">{channel.platform.toUpperCase()} / {channel.channelSlug}</span>
              {activeChannels.length > 1 && <button aria-label={`Remover ${channel.channelSlug}`} onClick={() => removeChannel(channel)} className="text-zinc-600 hover:text-white"><X className="size-3" /></button>}
            </div>
          ))}
          <button onClick={() => setOpen((value) => !value)} disabled={activeChannels.length >= 2} className="flex items-center gap-2 rounded-full border border-dashed border-modsentry-kick/30 px-3 py-2 font-mono text-[9px] text-modsentry-kick transition hover:bg-modsentry-kick/5 disabled:cursor-not-allowed disabled:opacity-30">
            <Plus className="size-3" /> ADICIONAR CHAT
          </button>
        </div>
      </div>

      {open && activeChannels.length < 2 && (
        <div className="absolute left-3 right-3 top-[calc(100%+8px)] z-40 rounded-2xl border border-modsentry-border bg-[#101416] p-4 shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between gap-3">
            <div><div className="font-mono text-[10px] font-bold tracking-widest text-modsentry-kick">ADICIONAR CANAL</div><div className="mt-1 text-xs text-zinc-600">Twitch usa seus canais descobertos. Na Kick, busque pelo slug.</div></div>
            <button onClick={() => setOpen(false)} className="text-zinc-600 hover:text-white"><X className="size-4" /></button>
          </div>

          <div className="mt-4 flex gap-2">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-700" /><input value={slug} onChange={(event) => setSlug(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchKick(); }} placeholder="Ex.: coringa" className="w-full rounded-xl border border-modsentry-border bg-black/30 py-2.5 pl-9 pr-3 font-mono text-[10px] text-zinc-300 outline-none placeholder:text-zinc-700 focus:border-modsentry-kick/40" /></div>
            <button onClick={() => void searchKick()} disabled={loading || !slug.trim()} className="rounded-xl bg-modsentry-kick px-4 font-mono text-[9px] font-bold text-black disabled:opacity-40">{loading ? <Loader2 className="size-3 animate-spin" /> : "BUSCAR"}</button>
          </div>

          {error && <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 font-mono text-[9px] text-red-300">{error}</div>}
          {result && <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-modsentry-kick/20 bg-modsentry-kick/[.03] p-3"><div><div className="flex items-center gap-2 font-mono text-xs font-bold text-zinc-200"><Check className="size-3 text-modsentry-kick" /> {result.channelSlug}</div><div className="mt-1 font-mono text-[8px] text-zinc-600">{result.isLive ? "LIVE AGORA" : "OFFLINE"} · CANAL KICK ENCONTRADO</div></div><button onClick={() => void addKick()} disabled={adding} className="rounded-full border border-modsentry-kick/30 px-3 py-2 font-mono text-[9px] font-bold text-modsentry-kick disabled:opacity-40">{adding ? "ADICIONANDO..." : "FIXAR NO DASHBOARD"}</button></div>}

          <div className="mt-3 border-t border-modsentry-border pt-3 font-mono text-[8px] leading-5 text-zinc-700">A API pública da Kick permite localizar o canal pelo slug, mas não fornece uma lista automática equivalente à descoberta de moderadores da Twitch. O acesso de moderação continua vinculado à conta autenticada e às permissões concedidas.</div>
        </div>
      )}
    </div>
  );
}
