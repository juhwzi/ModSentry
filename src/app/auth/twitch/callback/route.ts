import { cookies } from "next/headers";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { NextResponse } from "next/server";
import { Platform } from "@prisma/client";
import {
  OAUTH_PLATFORM_COOKIE,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
} from "@/lib/auth/cookies";
import { signSession } from "@/lib/auth/crypto";
import { upsertPlatformIdentity } from "@/lib/auth/persistence";
import { authErrorRedirect } from "@/lib/auth/redirect";
import { exchangeTwitchCode, getTwitchCurrentUser, getTwitchModeratedChannels } from "@/lib/platforms/twitch/client";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieStore = await cookies();

  if (error) return authErrorRedirect(request, `TWITCH_${error.toUpperCase()}`, "twitch");

  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  const platform = cookieStore.get(OAUTH_PLATFORM_COOKIE)?.value;

  if (platform !== "twitch" || !code || !state || state !== expectedState) {
    return authErrorRedirect(request, "OAUTH_STATE_INVALID", "twitch");
  }

  try {
    const token = await exchangeTwitchCode(code);
    const user = await getTwitchCurrentUser(token.access_token);
    const moderatedChannels = await getTwitchModeratedChannels(token.access_token, user.id);

    if (moderatedChannels.length === 0) {
      return authErrorRedirect(request, "AUTH_NO_MOD_CHANNELS", "twitch");
    }

    const dbUser = await upsertPlatformIdentity({
      currentUserId: await getCurrentUserId(),
      platform: Platform.TWITCH,
      platformUserId: user.id,
      username: user.login,
      displayName: user.display_name,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresIn: token.expires_in,
      scopes: token.scope,
    });

    await prisma.$transaction(
      moderatedChannels.map((channel) =>
        prisma.channel.upsert({
          where: {
            platform_externalId: {
              platform: Platform.TWITCH,
              externalId: channel.broadcaster_id,
            },
          },
          create: {
            platform: Platform.TWITCH,
            externalId: channel.broadcaster_id,
            slug: channel.broadcaster_login,
            displayName: channel.broadcaster_name,
          },
          update: {
            slug: channel.broadcaster_login,
            displayName: channel.broadcaster_name,
          },
        }),
      ),
    );

    const channels = await prisma.channel.findMany({
      where: {
        platform: Platform.TWITCH,
        externalId: { in: moderatedChannels.map((channel) => channel.broadcaster_id) },
      },
      select: { id: true },
    });

    await prisma.$transaction(
      channels.map((channel) =>
        prisma.moderatorChannel.upsert({
          where: { userId_channelId: { userId: dbUser.id, channelId: channel.id } },
          create: { userId: dbUser.id, channelId: channel.id, verified: true, active: true },
          update: { verified: true, active: true },
        }),
      ),
    );

    const response = NextResponse.redirect(new URL("/", request.url));
    const secure = process.env.NODE_ENV === "production";
    response.cookies.set(SESSION_COOKIE, signSession(dbUser.id), {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      priority: "high",
      path: "/",
    });

    for (const name of [OAUTH_STATE_COOKIE, OAUTH_PLATFORM_COOKIE]) {
      response.cookies.delete(name);
    }

    return response;
  } catch (cause) {
    console.error("Twitch OAuth callback failed", cause);
    return authErrorRedirect(request, cause instanceof Error ? cause.message : "TWITCH_AUTH_FAILED", "twitch");
  }
}

