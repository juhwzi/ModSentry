"use client";

import { AlertTriangle, Bell, Link2, ShieldAlert, Users } from "lucide-react";
import type { DetectionResult } from "@/lib/pipeline/types";

function kindLabel(kind: DetectionResult["kind"]): string {
  if (kind === "callout") return "CALLout";
  if (kind === "link") return "LINK";
  if (kind === "impersonation") return "IMPOSTOR";
  return "SPAM / RAID";
}

function KindIcon({ kind }: { kind: DetectionResult["kind"] }) {
  if (kind === "callout") return <Bell className="size-4" />;
  if (kind === "link") return <Link2 className="size-4" />;
  if (kind === "impersonation") return <ShieldAlert className="size-4" />;
  return <Users className="size-4" />;
}

export function DefensiveQueue({ detections }: { detections: DetectionResult[] }) {
  const grouped = detections.filter((d) => d.kind === "spam" && (d.groupedCount ?? 0) >= 2);
  const visible = detections.filter((d) => d.kind !== "spam" || (d.groupedCount ?? 0) >= 2).slice(0, 20);

  return (
    <section className="rounded-2xl border border-modsentry-border bg-modsentry-surface">
      <div className="flex items-center justify-between border-b border-modsentry-border px-5 py-4">
        <div>
          <h2 className="font-mono text-sm font-bold tracking-wider text-modsentry-critical">FILA DE INFRAÇÕES & BOT ATTACKS</h2>
          <p className="mt-1 font-mono text-[10px] text-zinc-600">DE-LEET / LINKS / IMPOSTOR / RAID GROUPING</p>
        </div>
        <span className="rounded-full bg-modsentry-critical/10 px-2 py-1 font-mono text-[10px] text-red-300">{visible.length}</span>
      </div>

      {visible.length === 0 ? (
        <div className="grid min-h-72 place-items-center p-8 text-center">
          <div>
            <AlertTriangle className="mx-auto size-8 text-zinc-700" />
            <p className="mt-4 font-mono text-xs uppercase tracking-widest text-zinc-600">Nenhuma infração pendente</p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-modsentry-border">
          {visible.map((detection) => (
            <article key={detection.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className={detection.severity === "critical" ? "mt-0.5 text-red-400" : "mt-0.5 text-orange-400"}>
                  <KindIcon kind={detection.kind} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-white/5 px-2 py-1 font-mono text-[9px] text-zinc-400">{kindLabel(detection.kind)}</span>
                    <span className="font-mono text-[9px] text-zinc-700">{detection.message.platform.toUpperCase()} / {detection.message.channelSlug}</span>
                    <span className="ml-auto font-mono text-[9px] text-zinc-700">{new Date(detection.message.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="mt-2 break-words text-sm text-zinc-300">{detection.message.content}</p>
                  <p className="mt-2 font-mono text-[10px] text-zinc-500">@{detection.message.sender.username} · {detection.reason}</p>
                  {detection.matched && <p className="mt-1 font-mono text-[9px] text-zinc-700">MATCH: {detection.matched}</p>}
                  {typeof detection.similarity === "number" && <p className="mt-1 font-mono text-[9px] text-red-300">SIMILARIDADE: {(detection.similarity * 100).toFixed(1)}%</p>}
                  {detection.usernames && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {detection.usernames.slice(0, 8).map((username) => (
                        <span key={username} className="rounded-full border border-red-400/10 bg-red-400/5 px-2 py-1 font-mono text-[9px] text-red-200">@{username}</span>
                      ))}
                      {detection.usernames.length > 8 && <span className="font-mono text-[9px] text-zinc-600">+{detection.usernames.length - 8}</span>}
                    </div>
                  )}
                  {detection.groupedCount && detection.groupedCount >= 5 && (
                    <div className="mt-3 flex gap-2">
                      <button className="rounded-full bg-modsentry-critical px-3 py-1.5 font-mono text-[9px] font-bold text-white">BANIR TODOS (x{detection.groupedCount})</button>
                      <button className="rounded-full border border-modsentry-border px-3 py-1.5 font-mono text-[9px] text-zinc-500">DESCARTAR</button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {grouped.length > 0 && (
        <div className="border-t border-modsentry-border px-5 py-3 font-mono text-[9px] uppercase tracking-widest text-zinc-700">
          Janela colaborativa: 10s · {grouped.length} agrupamento(s) detectado(s)
        </div>
      )}
    </section>
  );
}
