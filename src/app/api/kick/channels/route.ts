import { NextResponse } from "next/server";
import { Platform } from "@prisma/client";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const channels = await prisma.moderatorChannel.findMany({
    where: { userId, active: true, channel: { platform: Platform.KICK } },
    select: { verified: true, channel: true },
    orderBy: { channel: { slug: "asc" } },
  });

  return NextResponse.json({ data: channels });
}
