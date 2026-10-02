import { Platform } from "@prisma/client";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { prisma } from "@/lib/db/prisma";
import { TacticalDashboard } from "@/components/dashboard/tactical-dashboard";

export default async function DashboardPage() {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const [user, channels] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } }),
    prisma.moderatorChannel.findMany({
      where: { userId, active: true },
      select: { channel: { select: { id: true, platform: true, slug: true, externalId: true, chatroomId: true, displayName: true, isLive: true } } },
      orderBy: { channel: { slug: "asc" } },
    }),
  ]);
  return <TacticalDashboard moderatorName={user?.displayName ?? "Moderator"} channels={channels.filter(({ channel }) => channel.platform === Platform.TWITCH || channel.chatroomId !== null).map(({ channel }) => ({ id: channel.id, platform: channel.platform === Platform.TWITCH ? "twitch" : "kick", channelSlug: channel.slug, chatroomId: channel.chatroomId ?? channel.externalId }))} context={{ moderatorUsernames: user?.displayName ? [user.displayName] : [], cooldownSeconds: 15, customCallouts: ["modera", "socorro", "staff", "admin"] }} />;
}
