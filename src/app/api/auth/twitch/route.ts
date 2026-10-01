import { NextResponse } from "next/server";
import { assertOAuthConfig } from "@/lib/auth/config";
import { OAUTH_PLATFORM_COOKIE, OAUTH_STATE_COOKIE } from "@/lib/auth/cookies";
import { createOauthState } from "@/lib/auth/crypto";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const config = assertOAuthConfig("twitch");
  const state = createOauthState();
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    [
      "user:read:moderated_channels",
      "chat:read",
      "moderator:manage:banned_users",
      "user:read:chat",
    ].join(" "),
  );
  url.searchParams.set("state", state);
  const response = NextResponse.redirect(url);
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  response.cookies.set(OAUTH_PLATFORM_COOKIE, "twitch", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
