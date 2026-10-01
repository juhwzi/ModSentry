import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/moderation/service";
import { ModerationError } from "@/lib/moderation/errors";
import { broadcastModeration } from "@/lib/moderation/realtime";

const schema = z.object({ platform: z.enum(["TWITCH", "KICK"]), channelSlug: z.string().min(1), ticketId: z.string().min(1).max(200) });

export async function POST(request: Request) {
  try {
    const userId = await requireUser();
    const body = schema.parse(await request.json());
    const channel = await prisma.channel.findUnique({ where: { platform_slug: { platform: body.platform, slug: body.channelSlug } } });
    if (!channel) throw new ModerationError("CHANNEL_NOT_FOUND", "Canal não encontrado.", 404);
    const membership = await prisma.moderatorChannel.findUnique({ where: { userId_channelId: { userId, channelId: channel.id } } });
    if (!membership?.active || !membership.verified) throw new ModerationError("MODERATOR_ACCESS_REQUIRED", "Sem acesso de moderação.", 403);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
    const session = await prisma.moderationSession.findFirst({ where: { userId, channelId: channel.id, status: "ACTIVE" }, orderBy: { startedAt: "desc" } }) ?? await prisma.moderationSession.create({ data: { userId, channelId: channel.id } });
    const existing = await prisma.moderationClaim.findUnique({ where: { sessionId_ticketId: { sessionId: session.id, ticketId: body.ticketId } } });
    if (existing && !existing.releasedAt && existing.userId !== userId) return NextResponse.json({ error: "CLAIMED", moderatorName: existing.moderatorName }, { status: 409 });
    const claim = existing
      ? await prisma.moderationClaim.update({ where: { id: existing.id }, data: { userId, moderatorName: user?.displayName ?? "Moderator", claimedAt: new Date(), releasedAt: null } })
      : await prisma.moderationClaim.create({ data: { sessionId: session.id, ticketId: body.ticketId, userId, moderatorName: user?.displayName ?? "Moderator" } });
    await prisma.moderationEvent.create({ data: { sessionId: session.id, userId, platform: body.platform, channelSlug: body.channelSlug, targetUsername: body.ticketId, reason: "CLAIM_TICKET", eventType: "CLAIM", metadata: { ticketId: body.ticketId, moderatorName: claim.moderatorName } } });
    await broadcastModeration(`${body.platform}:${body.channelSlug}`, { type: "CLAIM_TICKET", ticketId: body.ticketId, moderatorName: claim.moderatorName });
    return NextResponse.json(claim);
  } catch (error) {
    const e = error instanceof ModerationError ? error : new ModerationError("CLAIM_FAILED", error instanceof Error ? error.message : "Falha ao assumir chamado.", 500);
    return NextResponse.json({ error: e.code, message: e.message }, { status: e.status });
  }
}
