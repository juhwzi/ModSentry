"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, Bell, Clipboard, ExternalLink, Home,
  Flame, Link2, Lock, MonitorPlay, Radio, ShieldAlert, Timer, Undo2,
  Users, Wifi, WifiOff, X, Volume2, VolumeX, Download
} from "lucide-react";
import Link from "next/link";
import type { IngestionChannel } from "@/lib/ingestion/types";
import type { PipelineContext } from "@/lib/pipeline/types";
import type { DetectionResult } from "@/lib/pipeline/types";
import { useModSentryIngestion } from "@/hooks/use-modsentry-ingestion";
import { requestNotificationPermission } from "@/lib/pipeline/alerts";
import { useModSentrySync } from "@/hooks/use-modsentry-sync";
import { useRemoteBlacklist } from "@/hooks/use-remote-blacklist";
import { ChannelSelector } from "@/components/dashboard/channel-selector";

const REASONS = ["Spam / Flood", "Auto-promoção", "Discurso de Ódio", "Link Suspeito", "Spoiler"];

type AuditAction = { id: string; timestamp: number; platform: string; channel: string; target: string; reason: string; action: string };

type Props = { channels: IngestionChannel[]; moderatorName: string; context?: PipelineContext };

function csvEscape(value: string) { return `"${value.replaceAll('"', '""')}"`; }
function commandFor(platform: "twitch" | "kick", target: string, action: "timeout" | "ban" | "untimeout" | "unban", reason: string) {
  if (action === "timeout") return `/timeout ${target} 300 ${reason}`;
  if (action === "ban") return `/ban ${target} ${reason}`;
  if (action === "untimeout") return `/untimeout ${target}`;
  return `/unban ${target}`;
}

export function TacticalDashboard({ channels, moderatorName, context }: Props) {
  const [activeChannels, setActiveChannels] = useState<IngestionChannel[]>(() => channels.slice(0, 2));
  const remoteBlacklist = useRemoteBlacklist();
  const pipelineContext = useMemo<PipelineContext>(() => ({
    moderatorUsernames: context?.moderatorUsernames ?? [],
    streamerUsername: context?.streamerUsername,
    customCallouts: context?.customCallouts,
    cooldownSeconds: context?.cooldownSeconds,
    blacklistTerms: remoteBlacklist.terms,
  }), [context, remoteBlacklist.terms]);
  const { messages, states, detections, error, clearMessages } = useModSentryIngestion(activeChannels, pipelineContext);
  const [channelFilter, setChannelFilter] = useState("all");
  const [reason, setReason] = useState(REASONS[0]);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [claimed, setClaimed] = useState<Record<string, string>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [audit, setAudit] = useState<AuditAction[]>([]);
  const [undo, setUndo] = useState<{ target: string; targetUserId?: string; platform: "twitch" | "kick"; channelSlug: string; action: "timeout" | "ban"; expires: number } | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pip, setPip] = useState<string | null>(null);
  const [pipOpen, setPipOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const messagesRef = useRef(messages);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!undo) return;
    const t = window.setInterval(() => { if (Date.now() >= undo.expires) setUndo(null); }, 250);
    return () => clearInterval(t);
  }, [undo]);

  const connected = states.filter((s) => s.status === "connected").length;
  const syncChannelKeys = useMemo(() => activeChannels.map((c) => `${c.platform}:${c.channelSlug}`), [activeChannels]);
  const handleSyncEvent = useCallback((event: { type: "CLAIM_TICKET" | "RELEASE_TICKET"; ticketId: string; moderatorName?: string }) => {
    setClaimed((current) => event.type === "RELEASE_TICKET" ? Object.fromEntries(Object.entries(current).filter(([id]) => id !== event.ticketId)) : { ...current, [event.ticketId]: event.moderatorName ?? "Moderator" });
  }, []);
  useModSentrySync(syncChannelKeys, handleSyncEvent);
  useEffect(() => {
    void fetch("/api/audit", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const rows = await response.json() as Array<{ id: string; createdAt: string; platform: string; channelSlug: string; targetUsername: string; reason: string; eventType: string }>;
      setAudit(rows.map((r) => ({ id: r.id, timestamp: Date.parse(r.createdAt), platform: r.platform.toLowerCase(), channel: r.channelSlug, target: r.targetUsername, reason: r.reason, action: r.eventType })));
    }).catch(() => undefined);
  }, []);
  const filteredMessages = channelFilter === "all" ? messages : messages.filter((m) => `${m.platform}:${m.channelSlug}` === channelFilter);
  const filteredDetections = detections.filter((d) => !dismissed.has(d.id) && (channelFilter === "all" || `${d.message.platform}:${d.message.channelSlug}` === channelFilter));
  const callouts = filteredDetections.filter((d) => d.kind === "callout");
  const violations = filteredDetections.filter((d) => d.kind !== "callout");
  const mps = messages.filter((m) => m.timestamp >= now - 1000).length;
  const avg15m = useMemo(() => {
    const cutoff = now - 15 * 60_000;
    const buckets = new Map<number, number>();
    for (const message of messagesRef.current) {
      if (message.timestamp >= cutoff) {
        const bucket = Math.floor(message.timestamp / 1000);
        buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
      }
    }
    return buckets.size ? [...buckets.values()].reduce((a, b) => a + b, 0) / buckets.size : 0;
  }, [now, messages.length]);
  const spike = avg15m > 0 && mps >= avg15m * 3;
  const sparkline = useMemo(() => {
    const values = Array.from({ length: 30 }, (_, index) => {
      const start = now - (29 - index) * 1000 - 999;
      const end = now - (29 - index) * 1000;
      return messagesRef.current.filter((message) => message.timestamp >= start && message.timestamp <= end).length;
    });
    const max = Math.max(1, ...values);
    return values.map((value) => Math.max(8, Math.round((value / max) * 100)));
  }, [now, messages.length]);

  const executeAction = useCallback(async (d: DetectionResult, action: "timeout" | "ban") => {
    const key = `${action}:${d.id}`;
    setActionBusy(key); setActionError(null);
    try {
      const endpoint = action === "timeout" ? "/api/moderation/timeout" : "/api/moderation/ban";
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        platform: d.message.platform.toUpperCase(), channelSlug: d.message.channelSlug, targetUsername: d.message.sender.username, targetUserId: d.message.sender.id, reason, durationSeconds: 300,
      }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? body.error ?? "Falha na moderação.");
      setAudit((a) => [{ id: body.executedAt + d.id, timestamp: Date.parse(body.executedAt), platform: d.message.platform, channel: d.message.channelSlug, target: d.message.sender.username, reason, action: action === "timeout" ? "TIMEOUT (300s)" : "BAN" }, ...a]);
      setUndo({ target: d.message.sender.username, targetUserId: d.message.sender.id, platform: d.message.platform, channelSlug: d.message.channelSlug, action, expires: Date.now() + 6000 });
    } catch (error) { setActionError(error instanceof Error ? error.message : "Falha na moderação."); } finally { setActionBusy(null); }
  }, [reason]);

  const massBan = useCallback(async (d: DetectionResult) => {
    const users = d.usernames ?? [];
    if (users.length < 5) return;
    setActionBusy(`mass:${d.id}`); setActionError(null);
    try {
      const response = await fetch("/api/moderation/mass-ban", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: users.map((targetUsername) => ({ platform: d.message.platform.toUpperCase(), channelSlug: d.message.channelSlug, targetUsername, targetUserId: messagesRef.current.find((m) => m.platform === d.message.platform && m.channelSlug === d.message.channelSlug && m.sender.username === targetUsername)?.sender.id, reason })) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? body.error ?? "Falha no mass ban.");
      const rows = body.succeeded.map((r: { executedAt: string; targetUsername: string; platform: string }) => ({ id: r.executedAt + r.targetUsername, timestamp: Date.parse(r.executedAt), platform: r.platform.toLowerCase(), channel: d.message.channelSlug, target: r.targetUsername, reason, action: "BAN" }));
      setAudit((a) => [...rows, ...a]);
      if (body.failed?.length) setActionError(`${body.succeeded.length} banidos; ${body.failed.length} falharam.`);
    } catch (error) { setActionError(error instanceof Error ? error.message : "Falha no mass ban."); } finally { setActionBusy(null); }
  }, [reason]);

  const claim = useCallback(async (d: DetectionResult) => {
    try {
      const response = await fetch("/api/claims", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform: d.message.platform.toUpperCase(), channelSlug: d.message.channelSlug, ticketId: d.id }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.moderatorName ? `Em atendimento por @${body.moderatorName}` : body.message ?? "Não foi possível assumir.");
      setClaimed((c) => ({ ...c, [d.id]: body.moderatorName ?? moderatorName }));
    } catch (error) { setActionError(error instanceof Error ? error.message : "Falha ao assumir."); }
  }, [moderatorName]);

  const dismiss = useCallback(async (id: string) => {
    setDismissed((s) => new Set(s).add(id));
  }, []);

  const undoAction = async () => {
    if (!undo) return;
    setActionBusy(`undo:${undo.target}`); setActionError(null);
    try {
      const response = await fetch("/api/moderation/unban", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform: undo.platform.toUpperCase(), channelSlug: undo.channelSlug, targetUsername: undo.target, targetUserId: undo.targetUserId }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? body.error ?? "Falha ao desfazer.");
      setAudit((a) => [{ id: body.executedAt, timestamp: Date.parse(body.executedAt), platform: undo.platform, channel: undo.channelSlug, target: undo.target, reason: "Undo", action: "UNBAN" }, ...a]);
      setUndo(null);
    } catch (error) { setActionError(error instanceof Error ? error.message : "Falha ao desfazer."); } finally { setActionBusy(null); }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((event.target as HTMLElement)?.tagName)) return;
      const active = violations[0];
      if (!active) return;
      if (event.key === "1") dismiss(active.id);
      if (event.key === "2") void executeAction(active, "timeout");
      if (event.key === "3") void executeAction(active, "ban");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [violations, executeAction, dismiss]);

  const exportCsv = async () => {
    const response = await fetch(`/api/audit/export${channelFilter === "all" ? "" : `?channel=${encodeURIComponent(channelFilter.split(":")[1])}`}`);
    if (!response.ok) return;
    const blob = await response.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `modsentry-audit-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const enableNotifications = async () => { if (alertsEnabled) await requestNotificationPermission(); setAlertsEnabled((v) => !v); };
  const channelsForFilter = [...new Map(activeChannels.map((c) => [`${c.platform}:${c.channelSlug}`, c])).values()];
  const selectedChannel = pip ? channelsForFilter.find((c) => `${c.platform}:${c.channelSlug}` === pip) : undefined;

  return (
    <main className="min-h-screen bg-modsentry-background text-white">
      <header className="sticky top-0 z-30 border-b border-modsentry-border bg-modsentry-background/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[1700px] items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-lg bg-modsentry-kick text-black"><ShieldAlert className="size-4" /></div><div><div className="font-mono text-sm font-bold tracking-[.2em]">MODSENTRY</div><div className="font-mono text-[9px] text-zinc-600">TACTICAL MODERATION COMMAND CENTER</div></div></div>
          <div className="flex items-center gap-2">
            <Hud label="CHANNELS" value={`${connected}/${activeChannels.length}`} icon={<Radio className="size-3" />} />
            <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 font-mono ${spike ? "border-modsentry-kick/60" : "border-modsentry-border"}`}><Activity className={`size-3 ${spike ? "text-modsentry-kick" : "text-zinc-500"}`} /><span className="text-[8px] text-zinc-500">MPS</span><span className="text-[10px] text-zinc-300">{mps} msg/s</span><div className="flex h-4 items-end gap-px">{sparkline.slice(-12).map((height, i) => <span key={i} className={`w-1 rounded-sm ${spike ? "bg-modsentry-kick" : "bg-zinc-600"}`} style={{ height: `${height}%` }} />)}</div></div>
            <button onClick={() => setPipOpen((v) => !v)} className="flex items-center gap-2 rounded-xl border border-modsentry-border px-3 py-2 font-mono text-[9px] text-zinc-400 hover:text-white"><MonitorPlay className="size-3" /> PIP</button>
            <Hud label="SYNC" value="LOCAL" icon={<Wifi className="size-3" />} />
            <span className="rounded-xl border border-modsentry-border px-3 py-2 font-mono text-[9px] text-zinc-400">SYNC · REALTIME</span><span className="rounded-xl border border-modsentry-border px-3 py-2 font-mono text-[9px] text-zinc-400">@{moderatorName}</span><Link
  href="/"
  className="flex items-center gap-2 rounded-xl border border-modsentry-border px-3 py-2 font-mono text-[9px] text-zinc-400 transition hover:border-modsentry-kick/30 hover:text-modsentry-kick"
>
  <Home className="size-3" /> HOME
</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1700px] p-4 md:p-5">
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-modsentry-border bg-modsentry-surface p-3">
          <ChannelSelector channels={channels} activeChannels={activeChannels} onChange={setActiveChannels} />
          <div className="flex flex-wrap items-center gap-2">
          <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="rounded-full border border-modsentry-border bg-black/20 px-4 py-2 font-mono text-[10px] text-zinc-300 outline-none"><option value="all">TODOS OS CANAIS</option>{channelsForFilter.map((c) => <option key={`${c.platform}:${c.channelSlug}`} value={`${c.platform}:${c.channelSlug}`}>{c.platform.toUpperCase()} / {c.channelSlug}</option>)}</select>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-full border border-modsentry-border bg-black/20 px-4 py-2 font-mono text-[10px] text-zinc-300 outline-none">{REASONS.map((r) => <option key={r}>{r}</option>)}</select>
          <button onClick={enableNotifications} className="ml-auto flex items-center gap-2 rounded-full border border-modsentry-kick/30 px-4 py-2 font-mono text-[10px] text-modsentry-kick">{alertsEnabled ? <Volume2 className="size-3" /> : <VolumeX className="size-3" />} ALERTAS · 15S</button>
          <span className="font-mono text-[9px] text-zinc-700">KEYBINDS 1 DISPENSAR · 2 TIMEOUT · 3 BAN</span>
          </div>
        </div>

        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto] rounded-2xl border border-modsentry-border bg-modsentry-surface p-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-mono text-[9px] text-zinc-500"><Link2 className="size-3" /> BLACKLIST REMOTA <span className={remoteBlacklist.status === "ready" ? "text-modsentry-kick" : remoteBlacklist.status === "error" ? "text-red-400" : "text-zinc-700"}>● {remoteBlacklist.status.toUpperCase()}</span></div>
            <input aria-label="URL da blacklist remota" defaultValue={remoteBlacklist.url} onBlur={(event) => remoteBlacklist.save(event.currentTarget.value, remoteBlacklist.localTerms)} placeholder="https://.../blacklist.json" className="mt-2 w-full rounded-xl border border-modsentry-border bg-black/20 px-3 py-2 font-mono text-[10px] text-zinc-300 outline-none placeholder:text-zinc-700" />
            <div className="mt-2 font-mono text-[8px] text-zinc-700">{remoteBlacklist.terms.length} termos ativos · local + remoto</div>
          </div>
          <div className="rounded-xl border border-modsentry-border bg-black/10 px-4 py-3 lg:min-w-72">
            <div className="flex items-center justify-between font-mono text-[9px] text-zinc-600"><span>CHAT HEATMAP · 30s</span><span className={spike ? "text-modsentry-kick" : "text-zinc-500"}>{spike ? "⚡ PICO" : `${avg15m.toFixed(1)} msg/s média 15m`}</span></div>
            <div className="mt-3 flex h-8 items-end gap-1">{sparkline.map((height, i) => <span key={i} className={`flex-1 rounded-sm ${spike ? "bg-modsentry-kick/70" : "bg-zinc-700"}`} style={{ height: `${height}%` }} />)}</div>
          </div>
        </div>

        {(error || actionError) && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 font-mono text-xs text-red-300">{error || actionError}</div>}
        {spike && <div className="mb-4 flex items-center gap-2 rounded-xl border border-modsentry-kick/50 bg-modsentry-kick/5 px-4 py-3 font-mono text-xs text-modsentry-kick"><Flame className="size-4" /> ⚡ PICO DE ATIVIDADE DETECTADO · MPS {mps} · MÉDIA 15M {avg15m.toFixed(1)}</div>}

        <div className="mb-5 grid gap-4 xl:grid-cols-[1fr_1.2fr]">
          <section className="rounded-2xl border border-modsentry-border bg-modsentry-surface overflow-hidden">
            <PanelHeader title={`📢 CHAMADOS DA MODERAÇÃO (${callouts.length})`} tone="info" />
            {callouts.length === 0 ? <Empty icon={<Bell className="size-7" />} text="Aguardando chamados de moderação" /> : <div className="divide-y divide-modsentry-border">{callouts.slice(0, 20).map((d) => <CalloutCard key={d.id} d={d} claim={claimed[d.id]} onClaim={() => void claim(d)} onDismiss={() => dismiss(d.id)} />)}</div>}
          </section>

          <section className="rounded-2xl border border-modsentry-border bg-modsentry-surface overflow-hidden">
            <PanelHeader title={`🚨 FILA DE INFRAÇÕES & BOT ATTACKS (${violations.length})`} tone="critical" />
            {violations.length === 0 ? <Empty icon={<AlertTriangle className="size-7" />} text="Nenhuma infração pendente" /> : <div className="divide-y divide-modsentry-border">{violations.slice(0, 30).map((d) => <ViolationCard key={d.id} d={d} claim={claimed[d.id]} onClaim={() => void claim(d)} onDismiss={() => dismiss(d.id)} onTimeout={() => void executeAction(d, "timeout")} onBan={() => void executeAction(d, "ban")} onMassBan={() => void massBan(d)} />)}</div>}
          </section>
        </div>

        <section className="rounded-2xl border border-modsentry-border bg-modsentry-surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-modsentry-border px-5 py-3"><div><div className="font-mono text-xs font-bold tracking-wider text-zinc-400">REAL-TIME FEED</div><div className="font-mono text-[9px] text-zinc-700">{states.length} SOCKETS · {filteredMessages.length} EVENTOS EM MEMÓRIA</div></div><button onClick={clearMessages} className="rounded-full border border-modsentry-border px-3 py-1.5 font-mono text-[9px] text-zinc-600 hover:text-white">LIMPAR</button></div>
          <div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-3">{states.map((s) => <div key={s.key} className="rounded-xl border border-modsentry-border bg-black/10 p-3"><div className="flex items-center gap-2">{s.status === "connected" ? <Wifi className="size-3 text-modsentry-kick" /> : <WifiOff className="size-3 text-zinc-600" />}<span className="font-mono text-[10px] text-zinc-300">{s.channel.platform.toUpperCase()} / {s.channel.channelSlug}</span><span className="ml-auto font-mono text-[8px] text-zinc-600">{s.status.toUpperCase()}</span></div></div>)}</div>
          <div className="max-h-64 overflow-auto divide-y divide-modsentry-border">{filteredMessages.slice(0, 100).map((m) => <div key={`${m.platform}:${m.id}`} className="flex gap-3 px-5 py-2.5"><span className="font-mono text-[9px] text-zinc-600">{m.platform.toUpperCase()}</span><span className="font-mono text-[10px] font-bold text-zinc-300">@{m.sender.username}</span><span className="min-w-0 flex-1 truncate text-xs text-zinc-500">{m.content}</span><span className="font-mono text-[8px] text-zinc-700">{new Date(m.timestamp).toLocaleTimeString()}</span></div>)}</div>
        </section>

        <section className="mt-4 rounded-2xl border border-modsentry-border bg-modsentry-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-mono text-xs font-bold tracking-wider text-zinc-400">📋 AUDITORIA DA SESSÃO</div><div className="mt-1 font-mono text-[9px] text-zinc-700">{audit.length} PUNIÇÕES REGISTRADAS</div></div><button onClick={exportCsv} className="flex items-center gap-2 rounded-full border border-modsentry-border px-4 py-2 font-mono text-[10px] text-zinc-400 hover:text-white"><Download className="size-3" /> EXPORTAR CSV</button></div>
          {audit.length > 0 && <div className="mt-4 overflow-auto"><table className="w-full text-left font-mono text-[9px]"><thead className="text-zinc-700"><tr><th className="p-2">UTC</th><th className="p-2">PLATAFORMA</th><th className="p-2">CANAL</th><th className="p-2">INFRATOR</th><th className="p-2">MOTIVO</th><th className="p-2">AÇÃO</th></tr></thead><tbody>{audit.slice(0, 20).map((r) => <tr key={r.id} className="border-t border-modsentry-border"><td className="p-2 text-zinc-600">{new Date(r.timestamp).toISOString()}</td><td className="p-2 text-zinc-400">{r.platform.toUpperCase()}</td><td className="p-2 text-zinc-400">{r.channel}</td><td className="p-2 text-zinc-300">@{r.target}</td><td className="p-2 text-zinc-500">{r.reason}</td><td className="p-2 text-zinc-300">{r.action}</td></tr>)}</tbody></table></div>}
        </section>
      </div>

      {undo && <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-modsentry-kick/30 bg-modsentry-surface px-4 py-3 shadow-2xl"><Undo2 className="size-4 text-modsentry-kick" /><span className="font-mono text-xs text-zinc-300">Punição aplicada em @{undo.target}</span><button onClick={() => void undoAction()} className="rounded-full bg-modsentry-kick px-3 py-1.5 font-mono text-[9px] font-bold text-black">DESFAZER</button></div>}

      {pipOpen && <div className="fixed bottom-5 right-5 z-40 w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-modsentry-border bg-modsentry-surface shadow-2xl"><div className="flex items-center gap-2 border-b border-modsentry-border px-4 py-3"><MonitorPlay className="size-4 text-modsentry-kick" /><span className="font-mono text-xs text-zinc-300">CONTEXT PIP</span><select className="ml-auto bg-transparent font-mono text-[9px] text-zinc-500" value={pip ?? ""} onChange={(e) => setPip(e.target.value)}><option value="">Selecione</option>{channelsForFilter.map((c) => <option key={`${c.platform}:${c.channelSlug}`} value={`${c.platform}:${c.channelSlug}`}>{c.platform} / {c.channelSlug}</option>)}</select><button onClick={() => setPipOpen(false)}><X className="size-4 text-zinc-600" /></button></div>{selectedChannel ? <div className="aspect-video bg-black">{selectedChannel.platform === "twitch" ? <iframe title={`Twitch ${selectedChannel.channelSlug}`} className="size-full" src={`https://player.twitch.tv/?channel=${encodeURIComponent(selectedChannel.channelSlug)}&parent=${encodeURIComponent(window.location.hostname)}&muted=true`} allowFullScreen /> : <iframe title={`Kick ${selectedChannel.channelSlug}`} className="size-full" src={`https://player.kick.com/${encodeURIComponent(selectedChannel.channelSlug)}?muted=true&allowfullscreen=false`} allow="autoplay; fullscreen" />}</div> : <div className="grid h-48 place-items-center font-mono text-[10px] text-zinc-700">Selecione um canal</div>}</div>}
    </main>
  );
}

function Hud({ label, value, icon, alert }: { label: string; value: string; icon: React.ReactNode; alert?: boolean }) { return <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 font-mono ${alert ? "border-modsentry-kick/50 text-modsentry-kick" : "border-modsentry-border text-zinc-500"}`}>{icon}<span className="text-[8px]">{label}</span><span className="text-[10px] text-zinc-300">{value}</span></div>; }
function PanelHeader({ title, tone }: { title: string; tone: "info" | "critical" }) { return <div className="flex items-center justify-between border-b border-modsentry-border px-5 py-4"><h2 className={`font-mono text-sm font-bold tracking-wider ${tone === "info" ? "text-modsentry-info" : "text-modsentry-critical"}`}>{title}</h2></div>; }
function Empty({ icon, text }: { icon: React.ReactNode; text: string }) { return <div className="grid min-h-48 place-items-center p-8 text-center"><div className="text-zinc-700">{icon}<p className="mt-3 font-mono text-[10px] uppercase tracking-widest">{text}</p></div></div>; }
function Claim({ claim, onClaim }: { claim?: string; onClaim: () => void }) { return claim ? <span className="flex items-center gap-1 rounded-full border border-yellow-400/20 bg-yellow-400/5 px-2 py-1 font-mono text-[8px] text-yellow-300"><Lock className="size-3" /> Em atendimento por @{claim}</span> : <button onClick={onClaim} className="rounded-full border border-modsentry-border px-2 py-1 font-mono text-[8px] text-zinc-500 hover:text-white">ATENDER</button>; }
function CalloutCard({ d, claim, onClaim, onDismiss }: { d: DetectionResult; claim?: string; onClaim: () => void; onDismiss: () => void }) { return <article className="p-4"><div className="flex items-start gap-3"><Bell className="mt-1 size-4 text-modsentry-info" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[9px] text-zinc-600">{d.message.platform.toUpperCase()} / {d.message.channelSlug}</span><span className="ml-auto font-mono text-[8px] text-zinc-700">{new Date(d.message.timestamp).toLocaleTimeString()}</span></div><div className="mt-2 text-sm text-zinc-300"><b>@{d.message.sender.username}</b>: {d.message.content}</div><div className="mt-3 flex flex-wrap items-center gap-2"><Claim claim={claim} onClaim={onClaim} /><button onClick={onDismiss} className="rounded-full border border-modsentry-border px-2 py-1 font-mono text-[8px] text-zinc-600 hover:text-white">MARCAR LIDO</button><a href="#chat" className="flex items-center gap-1 rounded-full border border-modsentry-border px-2 py-1 font-mono text-[8px] text-zinc-600 hover:text-white">IR PRO CHAT <ExternalLink className="size-3" /></a></div></div></div></article>; }
function ViolationCard({ d, claim, onClaim, onDismiss, onTimeout, onBan, onMassBan }: { d: DetectionResult; claim?: string; onClaim: () => void; onDismiss: () => void; onTimeout: () => void; onBan: () => void; onMassBan: () => void }) { const group = (d.groupedCount ?? 0) >= 5; return <article className={`p-4 ${d.severity === "critical" ? "bg-red-500/[.02]" : ""}`}><div className="flex items-start gap-3"><div className="mt-1 text-red-400">{d.kind === "link" || d.kind === "blacklist" ? <Link2 className="size-4" /> : d.kind === "impersonation" ? <ShieldAlert className="size-4" /> : <Users className="size-4" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded bg-red-400/5 px-2 py-1 font-mono text-[8px] text-red-300">{d.kind === "impersonation" ? "⚠️ IMPOSTOR PROVÁVEL" : d.kind === "blacklist" ? "BLACKLIST REMOTA" : d.kind === "spam" ? `ATAQUE DE BOTS DETECTADO (x${d.groupedCount})` : d.kind.toUpperCase()}</span><span className="font-mono text-[8px] text-zinc-600">{d.message.platform.toUpperCase()} / {d.message.channelSlug}</span><span className="ml-auto font-mono text-[8px] text-zinc-700">{new Date(d.message.timestamp).toLocaleTimeString()}</span></div><p className="mt-2 break-words text-sm text-zinc-300">{d.message.content}</p><p className="mt-2 font-mono text-[9px] text-zinc-500">@{d.message.sender.username} · {d.reason}</p>{d.usernames && <div className="mt-2 flex flex-wrap gap-1">{d.usernames.map((u) => <span key={u} className="rounded-full border border-red-400/10 bg-red-400/5 px-2 py-1 font-mono text-[8px] text-red-200">@{u}</span>)}</div>}<div className="mt-3 flex flex-wrap items-center gap-2"><Claim claim={claim} onClaim={onClaim} /><button onClick={onTimeout} className="flex items-center gap-1 rounded-full bg-modsentry-warning px-3 py-1.5 font-mono text-[8px] font-bold text-black"><Timer className="size-3" /> TIMEOUT 5M</button><button onClick={onBan} className="rounded-full bg-modsentry-critical px-3 py-1.5 font-mono text-[8px] font-bold text-white">BAN</button>{group && <button onClick={onMassBan} className="rounded-full bg-red-600 px-3 py-1.5 font-mono text-[8px] font-bold text-white">🚨 BANIR TODOS (x{d.groupedCount})</button>}<button onClick={() => navigator.clipboard.writeText(commandFor(d.message.platform, d.message.sender.username, "timeout", ""))} title="Copiar comando" className="grid size-7 place-items-center rounded-full border border-modsentry-border text-zinc-500 hover:text-white"><Clipboard className="size-3" /></button><button onClick={onDismiss} className="rounded-full border border-modsentry-border px-3 py-1.5 font-mono text-[8px] text-zinc-600 hover:text-white">DESCARTAR</button></div></div></div></article>; }
