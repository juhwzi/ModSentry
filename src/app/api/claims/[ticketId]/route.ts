import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/moderation/service";
import { ModerationError } from "@/lib/moderation/errors";
import { broadcastModeration } from "@/lib/moderation/realtime";

const schema = z.object({ platform: z.enum(["TWITCH", "KICK"]), channelSlug: z.string().min(1) });
export async function DELETE(request: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  try {
    const userId = await requireUser(); const body = schema.parse(await request.json()); const { ticketId } = await params;
    const channel = await prisma.channel.findUnique({ where: { platform_slug: { platform: body.platform, slug: body.channelSlug } } });
    if (!channel) throw new ModerationError("CHANNEL_NOT_FOUND", "Canal não encontrado.", 404);
    const session = await prisma.moderationSession.findFirst({ where: { userId, channelId: channel.id, status: "ACTIVE" }, orderBy: { startedAt: "desc" } });
    if (!session) return NextResponse.json({ ok: true });
    const claim = await prisma.moderationClaim.findUnique({ where: { sessionId_ticketId: { sessionId: session.id, ticketId } } });
    if (!claim) return NextResponse.json({ ok: true });
    if (claim.userId !== userId && !claim.releasedAt) throw new ModerationError("CLAIM_OWNER_REQUIRED", "Somente quem assumiu o chamado pode liberá-lo.", 403);
    await prisma.moderationClaim.update({ where: { id: claim.id }, data: { releasedAt: new Date() } });
    await prisma.moderationEvent.create({ data: { sessionId: session.id, userId, platform: body.platform, channelSlug: body.channelSlug, targetUsername: ticketId, reason: "RELEASE_TICKET", eventType: "RELEASE", metadata: { ticketId } } });
    await broadcastModeration(`${body.platform}:${body.channelSlug}`, { type: "RELEASE_TICKET", ticketId });
    return NextResponse.json({ ok: true });
  } catch (error) { const e = error instanceof ModerationError ? error : new ModerationError("RELEASE_FAILED", error instanceof Error ? error.message : "Falha ao liberar.", 500); return NextResponse.json({ error: e.code, message: e.message }, { status: e.status }); }
}
