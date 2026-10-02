import { assertOAuthConfig } from "@/lib/auth/config";

const KICK_API = "https://api.kick.com/public/v1";

interface KickTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface KickUser {
  user_id: number;
  name: string;
  email?: string;
}

export interface KickChannel {
  broadcaster_user_id: number;
  slug: string;
  chatroom_id?: number | string;
  stream?: { is_live?: boolean };
}

interface KickApiResponse<T> {
  data: T[];
  message?: string;
}

export async function exchangeKickCode(code: string, verifier: string): Promise<KickTokenResponse> {
  const config = assertOAuthConfig("kick");
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
    code_verifier: verifier,
  });

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`KICK_TOKEN_EXCHANGE_FAILED:${response.status}`);
  }

  return response.json() as Promise<KickTokenResponse>;
}

async function kickRequest<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`${KICK_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`KICK_API_ERROR:${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getKickCurrentUser(accessToken: string): Promise<KickUser> {
  const result = await kickRequest<KickApiResponse<KickUser>>(accessToken, "/users");
  const user = result.data[0];
  if (!user) throw new Error("KICK_USER_NOT_FOUND");
  return user;
}

export async function getKickChatroomId(slug: string): Promise<string | null> {
  const response = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (!response.ok) return null;
  const body = await response.json() as { chatroom?: { id?: number | string; chatroom_id?: number | string } };
  const id = body.chatroom?.id ?? body.chatroom?.chatroom_id;
  return id === undefined ? null : String(id);
}

export async function getKickChannelBySlug(accessToken: string, slug: string): Promise<KickChannel | null> {
  const result = await kickRequest<KickApiResponse<KickChannel>>(
  accessToken,
  `/channels?slug=${encodeURIComponent(slug)}`
);
  const channel = result.data[0];
  if (!channel) return null;
  if (!channel.chatroom_id) channel.chatroom_id = await getKickChatroomId(channel.slug) ?? undefined;
  return channel;
}

export async function validateKickToken(accessToken: string): Promise<boolean> {
  const response = await fetch("https://id.kick.com/oauth/token/introspect", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) return false;
  const body = (await response.json()) as { data?: { active?: boolean } };
  return body.data?.active === true;
}
