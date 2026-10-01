import { cookies } from "next/headers";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { NextResponse } from "next/server";
import { Platform } from "@prisma/client";
import {
  OAUTH_PLATFORM_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  SESSION_COOKIE,
} from "@/lib/auth/cookies";
import { signSession } from "@/lib/auth/crypto";
import { upsertPlatformIdentity } from "@/lib/auth/persistence";
import { authErrorRedirect } from "@/lib/auth/redirect";
import { exchangeKickCode, getKickCurrentUser, validateKickToken } from "@/lib/platforms/kick/client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieStore = await cookies();

  if (error) return authErrorRedirect(request, `KICK_${error.toUpperCase()}`, "kick");

  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  const verifier = cookieStore.get(OAUTH_VERIFIER_COOKIE)?.value;
  const platform = cookieStore.get(OAUTH_PLATFORM_COOKIE)?.value;

  if (platform !== "kick" || !code || !state || state !== expectedState || !verifier) {
    return authErrorRedirect(request, "OAUTH_STATE_INVALID", "kick");
  }

  try {
    const token = await exchangeKickCode(code, verifier);
    const valid = await validateKickToken(token.access_token);
    if (!valid) {
      return authErrorRedirect(request, "KICK_TOKEN_INVALID", "kick");
    }

    const user = await getKickCurrentUser(token.access_token);
    const scopes = token.scope.split(/\s+/).filter(Boolean);

    const dbUser = await upsertPlatformIdentity({
      currentUserId: await getCurrentUserId(),
      platform: Platform.KICK,
      platformUserId: String(user.user_id),
      username: user.name,
      displayName: user.name,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresIn: token.expires_in,
      scopes,
    });

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

    for (const name of [OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE, OAUTH_PLATFORM_COOKIE]) {
      response.cookies.delete(name);
    }

    return response;
  } catch (cause) {
    console.error("Kick OAuth callback failed", cause);
    return authErrorRedirect(request, cause instanceof Error ? cause.message : "KICK_AUTH_FAILED", "kick");
  }
}
