import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { getPlatformAccount } from "@/lib/auth/persistence";
import { decryptSecret } from "@/lib/auth/crypto";
import { Platform } from "@prisma/client";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const account = await getPlatformAccount(userId, Platform.TWITCH);
  if (!account?.accessToken) {
    return NextResponse.json({ error: "TWITCH_NOT_CONNECTED" }, { status: 404 });
  }

  return NextResponse.json({
    accessToken: decryptSecret(account.accessToken),
    username: account.username,
    expiresAt: account.tokenExpiresAt?.toISOString() ?? null,
  }, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
