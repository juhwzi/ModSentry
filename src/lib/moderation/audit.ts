import { prisma } from "@/lib/db/prisma";

export async function getSessionAudit(userId: string, channelSlug?: string) {
  return prisma.moderationEvent.findMany({
    where: { userId, ...(channelSlug ? { channelSlug } : {}) },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { id: true, createdAt: true, platform: true, channelSlug: true, targetUsername: true, reason: true, eventType: true, metadata: true },
  });
}
