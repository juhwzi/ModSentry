import { NextResponse } from "next/server";
import { Platform } from "@prisma/client";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ authenticated: false }, { status: 401 });

  const [user, accounts, channels] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, displayName: true } }),
    prisma.platformAccount.findMany({
      where: { userId },
      select: { platform: true, username: true, scopes: true, tokenExpiresAt: true },
    }),
    prisma.moderatorChannel.findMany({
      where: { userId, active: true },
      select: {
        verified: true,
        channel: {
          select: { id: true, platform: true, externalId: true, slug: true, displayName: true, isLive: true },
        },
      },
    }),
  ]);

  if (!user) return NextResponse.json({ authenticated: false }, { status: 401 });

  return NextResponse.json({
    authenticated: true,
    user,
    platforms: Object.values(Platform).map((platform) => {
      const account = accounts.find((item) => item.platform === platform);
      return {
        platform: platform.toLowerCase(),
        authenticated: Boolean(account),
        username: account?.username ?? null,
        scopes: account?.scopes ?? [],
        tokenExpiresAt: account?.tokenExpiresAt ?? null,
      };
    }),
    channels,
  });
}
