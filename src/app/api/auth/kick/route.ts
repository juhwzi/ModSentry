import { NextResponse } from "next/server";
import { assertOAuthConfig } from "@/lib/auth/config";
import { OAUTH_PLATFORM_COOKIE, OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE } from "@/lib/auth/cookies";
import { createOauthState, createPkceChallenge, createPkceVerifier } from "@/lib/auth/crypto";

export const runtime = "nodejs";

export async function GET() {
  const config = assertOAuthConfig("kick");
  const state = createOauthState();
  const verifier = createPkceVerifier();
  const challenge = createPkceChallenge(verifier);

  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    ["user:read", "channel:read", "chat:write", "moderation:ban", "moderation:chat_message:manage", "events:subscribe"].join(" "),
  );
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(url);
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  response.cookies.set(OAUTH_VERIFIER_COOKIE, verifier, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  response.cookies.set(OAUTH_PLATFORM_COOKIE, "kick", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
