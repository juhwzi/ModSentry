import { assertOAuthConfig } from "@/lib/auth/config";

const TWITCH_API = "https://api.twitch.tv/helix";

interface TwitchTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string[];
  token_type: string;
}

interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
}

interface TwitchModeratedChannel {
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
}

interface TwitchApiResponse<T> {
  data: T[];
  pagination?: { cursor?: string };
}

export async function exchangeTwitchCode(code: string): Promise<TwitchTokenResponse> {
  const config = assertOAuthConfig("twitch");
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
  });

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`TWITCH_TOKEN_EXCHANGE_FAILED:${response.status}`);
  }

  return response.json() as Promise<TwitchTokenResponse>;
}

async function twitchRequest<T>(accessToken: string, path: string): Promise<T> {
  const config = assertOAuthConfig("twitch");
  const response = await fetch(`${TWITCH_API}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": config.clientId,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`TWITCH_API_ERROR:${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getTwitchCurrentUser(accessToken: string): Promise<TwitchUser> {
  const result = await twitchRequest<TwitchApiResponse<TwitchUser>>(accessToken, "/users");
  const user = result.data[0];
  if (!user) throw new Error("TWITCH_USER_NOT_FOUND");
  return user;
}

export async function getTwitchModeratedChannels(accessToken: string, userId: string) {
  const result = await twitchRequest<TwitchApiResponse<TwitchModeratedChannel>>(
    accessToken,
    `/moderation/channels?user_id=${encodeURIComponent(userId)}&first=100`,
  );

  return result.data;
}

export async function validateTwitchToken(accessToken: string) {
  const response = await fetch("https://id.twitch.tv/oauth2/validate", {
    headers: { Authorization: `OAuth ${accessToken}` },
    cache: "no-store",
  });

  return response.ok;
}
