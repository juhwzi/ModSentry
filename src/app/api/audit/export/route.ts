import { requireUser } from "@/lib/moderation/service";
import { getSessionAudit } from "@/lib/moderation/audit";
function esc(value: string) { return `"${value.replaceAll('"', '""')}"`; }
export async function GET(request: Request) {
  const userId = await requireUser(); const channel = new URL(request.url).searchParams.get("channel") ?? undefined; const rows = await getSessionAudit(userId, channel);
  const header = ["TIMESTAMP (UTC)","PLATAFORMA","CANAL","INFRATOR","MOTIVO","AÇÃO EXECUTADA"];
  const body = rows.map((r) => [r.createdAt.toISOString(), r.platform, r.channelSlug, r.targetUsername, r.reason, r.eventType].map(esc).join(","));
  return new Response([header.join(","), ...body].join("\n"), { headers: { "Content-Type": "text/csv;charset=utf-8", "Content-Disposition": `attachment; filename="modsentry-audit-${Date.now()}.csv"` } });
}
